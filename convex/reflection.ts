import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { v } from 'convex/values'
import { z } from 'zod'

import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { embeddingCache, rateLimiter, workflowManager } from './components'

import type { Id } from './_generated/dataModel'

const CORE_PROMOTION_CRITERIA = {
  minOccurrences: 3,
  minConfidence: 0.7,
}

export const dailyReflectionWorkflow = workflowManager.define({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, args): Promise<void> => {
    const users = args.userId
      ? [{ _id: args.userId }]
      : await ctx.runQuery(internal.users.getActiveUsers, { days: 7 })

    for (const user of users) {
      const memories = await ctx.runQuery(internal.longTerm.getHighImportance, {
        userId: user._id,
        minImportance: 0.7,
        limit: 100,
      })

      if (memories.length < CORE_PROMOTION_CRITERIA.minOccurrences) {
        continue
      }

      const patterns = await ctx.runAction(
        internal.reflection.detectPatternsWithLLM,
        { userId: user._id, memories },
        { retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 } },
      )

      for (const pattern of patterns) {
        if (pattern.confidence >= CORE_PROMOTION_CRITERIA.minConfidence) {
          await ctx.runAction(internal.reflection.promoteToCoreAction, {
            userId: user._id,
            pattern,
          })
        }
      }

      await ctx.runMutation(internal.consolidation.logRun, {
        runType: 'reflection',
        memoriesProcessed: memories.length,
        memoriesPromoted: patterns.filter(
          (p: { confidence: number }) =>
            p.confidence >= CORE_PROMOTION_CRITERIA.minConfidence,
        ).length,
        memoriesPruned: 0,
      })
    }
  },
})

export const triggerDailyReflection = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(
      ctx,
      internal.reflection.dailyReflectionWorkflow,
      {},
    )
  },
})

const PatternSchema = z.object({
  patterns: z.array(
    z.object({
      content: z.string().describe('The stable fact or pattern detected'),
      category: z.enum([
        'identity',
        'preference',
        'relationship',
        'behavioral',
        'goal',
        'constraint',
      ]),
      confidence: z.number().min(0).max(1),
      supportingCount: z.number(),
      reasoning: z.string().describe('Why this is a stable pattern'),
    }),
  ),
})

export const detectPatternsWithLLM = internalAction({
  args: {
    userId: v.id('users'),
    memories: v.array(
      v.object({
        summary: v.string(),
        entityName: v.optional(v.string()),
        currentImportance: v.float64(),
        reinforcementCount: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      content: string
      category: string
      confidence: number
      supportingCount: number
    }>
  > => {
    const limit = await rateLimiter.limit(ctx, 'llmTokens', { count: 1000 })
    if (!limit.ok) {
      return [] // Skip if rate limited
    }

    const memorySummaries = args.memories
      .map(
        (m) =>
          `- ${m.summary} (importance: ${m.currentImportance.toFixed(2)}, seen ${m.reinforcementCount}x)`,
      )
      .join('\n')

    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      output: Output.object({ schema: PatternSchema }),
      system: `You are analyzing a user's memory patterns to identify stable facts about them.
Look for:
- Repeated themes or entities (mentioned 3+ times)
- High-importance facts that persist over time
- Identity markers, preferences, relationships, goals

Only output patterns you're confident are stable, long-term facts.`,
      prompt: `Analyze these memories and identify stable patterns:\n\n${memorySummaries}`,
    })

    return output.patterns
  },
})

export const promoteToCore = internalMutation({
  args: {
    userId: v.id('users'),
    pattern: v.object({
      content: v.string(),
      category: v.string(),
      confidence: v.float64(),
      supportingCount: v.number(),
    }),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .filter((q) => q.eq(q.field('content'), args.pattern.content))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        confidence: Math.min(1, existing.confidence + 0.05),
        evidenceCount: existing.evidenceCount + args.pattern.supportingCount,
        updatedAt: Date.now(),
      })
      return { action: 'reinforced' as const, id: existing._id }
    }

    const id = await ctx.db.insert('coreMemories', {
      content: args.pattern.content,
      embedding: args.embedding,
      category: args.pattern.category as
        | 'identity'
        | 'preference'
        | 'relationship'
        | 'behavioral'
        | 'goal'
        | 'constraint',
      confidence: args.pattern.confidence,
      evidenceCount: args.pattern.supportingCount,
      userId: args.userId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await ctx.db.insert('reflections', {
      userId: args.userId,
      insight: `Promoted pattern: ${args.pattern.content.slice(0, 50)}...`,
      insightType: 'pattern',
      supportingMemoryCount: args.pattern.supportingCount,
      confidence: args.pattern.confidence,
      actionTaken: 'promoted_to_core',
      createdAt: Date.now(),
    })

    return { action: 'created' as const, id }
  },
})

export const promoteToCoreAction = internalAction({
  args: {
    userId: v.id('users'),
    pattern: v.object({
      content: v.string(),
      category: v.string(),
      confidence: v.float64(),
      supportingCount: v.number(),
    }),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    action: 'created' | 'reinforced' | 'not_found'
    id: string
  }> => {
    const existing: { _id: string } | null = await ctx.runQuery(
      internal.reflection.checkExistingCore,
      {
        userId: args.userId,
        content: args.pattern.content,
      },
    )

    if (existing) {
      return await ctx.runMutation(internal.reflection.reinforceCore, {
        coreId: existing._id as Id<'coreMemories'>,
        supportingCount: args.pattern.supportingCount,
      })
    }

    const embedding: Array<number> = await embeddingCache.fetch(ctx, {
      text: args.pattern.content,
    })

    return await ctx.runMutation(internal.reflection.promoteToCore, {
      userId: args.userId,
      pattern: args.pattern,
      embedding,
    })
  },
})

export const checkExistingCore = internalQuery({
  args: {
    userId: v.id('users'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .filter((q) => q.eq(q.field('content'), args.content))
      .first()
  },
})

export const reinforceCore = internalMutation({
  args: {
    coreId: v.id('coreMemories'),
    supportingCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.coreId)
    if (!existing) return { action: 'not_found' as const, id: args.coreId }

    await ctx.db.patch(args.coreId, {
      confidence: Math.min(1, existing.confidence + 0.05),
      evidenceCount: existing.evidenceCount + args.supportingCount,
      updatedAt: Date.now(),
    })
    return { action: 'reinforced' as const, id: args.coreId }
  },
})
