import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'
import { memoryStats, workflowManager } from './components'

export const consolidationWorkflow = workflowManager.define({
  args: {},
  handler: async (ctx): Promise<void> => {
    const cleanupResult = await ctx.runMutation(
      internal.consolidation.cleanupExpiredSTM,
      {},
    )

    await Promise.all([
      ctx.runMutation(internal.consolidation.applyDecay, {}),
      ctx.runAction(internal.consolidation.promoteToLongTerm, {}),
    ])

    await ctx.runMutation(internal.consolidation.logRun, {
      runType: 'promotion',
      memoriesProcessed: cleanupResult.processed,
      memoriesPromoted: cleanupResult.promoted,
      memoriesPruned: cleanupResult.pruned,
    })
  },
  workpoolOptions: {
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  },
})

export const pruningWorkflow = workflowManager.define({
  args: {},
  handler: async (ctx): Promise<void> => {
    const pruned = await ctx.runMutation(
      internal.consolidation.pruneMemories,
      {},
    )
    await ctx.runMutation(internal.edges.cleanupOrphaned, {})
    await ctx.runMutation(internal.consolidation.logRun, {
      runType: 'pruning',
      memoriesProcessed: pruned.processed,
      memoriesPromoted: 0,
      memoriesPruned: pruned.count,
    })
  },
})

export const triggerConsolidation = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(
      ctx,
      internal.consolidation.consolidationWorkflow,
      {},
    )
  },
})

export const triggerPruning = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(ctx, internal.consolidation.pruningWorkflow, {})
  },
})

export const cleanupExpiredSTM = internalMutation({
  handler: async (
    ctx,
  ): Promise<{ processed: number; promoted: number; pruned: number }> => {
    const now = Date.now()
    const expired = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_expiry', (q) => q.lt('expiresAt', now))
      .take(100)

    for (const stm of expired) {
      await ctx.db.delete(stm._id)
    }

    return { processed: expired.length, promoted: 0, pruned: expired.length }
  },
})

export const applyDecay = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const memories = await ctx.db
      .query('longTermMemories')
      .withIndex('by_user')
      .filter((q) => q.eq(q.field('isActive'), true))
      .take(500)

    let decayed = 0
    for (const memory of memories) {
      const hoursSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60)
      // Ebbinghaus forgetting curve: R = e^(-t/S)
      // Where S is stability (higher = slower decay)
      const decayRate = 0.01 / memory.stability
      const decay = Math.exp(-decayRate * hoursSinceAccess)
      const newImportance = memory.baseImportance * decay

      if (Math.abs(newImportance - memory.currentImportance) > 0.01) {
        const oldDoc = memory
        await ctx.db.patch(memory._id, {
          currentImportance: Math.max(0.01, newImportance),
          updatedAt: now,
        })
        // Sync aggregate since sortKey includes currentImportance
        const newDoc = await ctx.db.get(memory._id)
        if (newDoc) {
          await memoryStats.replace(ctx, oldDoc, newDoc)
        }
        decayed++
      }
    }

    return { decayed }
  },
})

export const promoteToLongTerm = internalAction({
  handler: async (ctx) => {
    // Get high-importance STM that haven't expired
    const candidates = await ctx.runQuery(
      internal.shortTerm.getPromotionCandidates,
      {
        minImportance: 0.6,
        limit: 50,
      },
    )

    let promoted = 0
    for (const stm of candidates) {
      const result = await ctx.runAction(internal.longTerm.consolidateFromSTM, {
        stmId: stm._id,
      })
      if (result?.action === 'created') {
        promoted++
      }
    }

    return { promoted }
  },
})

export const pruneMemories = internalMutation({
  handler: async (ctx): Promise<{ processed: number; count: number }> => {
    const now = Date.now()
    const threshold = 0.1

    const lowImportance = await ctx.db
      .query('longTermMemories')
      .withIndex('by_user')
      .filter((q) =>
        q.and(
          q.eq(q.field('isActive'), true),
          q.lt(q.field('currentImportance'), threshold),
        ),
      )
      .take(100)

    for (const memory of lowImportance) {
      await ctx.db.patch(memory._id, { isActive: false, updatedAt: now })
    }

    return { processed: lowImportance.length, count: lowImportance.length }
  },
})

export const logRun = internalMutation({
  args: {
    runType: v.union(
      v.literal('promotion'),
      v.literal('decay'),
      v.literal('pruning'),
      v.literal('reflection'),
      v.literal('cleanup'),
    ),
    memoriesProcessed: v.number(),
    memoriesPromoted: v.number(),
    memoriesPruned: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('consolidationLogs', {
      runType: args.runType,
      memoriesProcessed: args.memoriesProcessed,
      memoriesPromoted: args.memoriesPromoted,
      memoriesPruned: args.memoriesPruned,
      duration: 0,
      createdAt: Date.now(),
    })
  },
})
