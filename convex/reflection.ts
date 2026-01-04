// convex/reflection.ts
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

// Core promotion criteria
const CORE_PROMOTION_CRITERIA = {
  minOccurrences: 3,
  minConfidence: 0.7,
}

// ============================================
// REFLECTION WORKFLOW
// Durable pattern detection and core promotion
// ============================================

/**
 * Daily reflection workflow - runs at 3 AM
 * Analyzes LTM patterns and promotes stable facts to Core Memory
 *
 * This is the agent's "sleep cycle" - consolidating learnings
 */
export const dailyReflectionWorkflow = workflowManager.define({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, args): Promise<void> => {
    // Step 1: Get active users (or specific user)
    const users = args.userId
      ? [{ _id: args.userId }]
      : await ctx.runQuery(internal.users.getActiveUsers, { days: 7 })

    // Step 2: Process each user's memories
    for (const user of users) {
      // Get high-importance memories
      const memories = await ctx.runQuery(internal.longTerm.getHighImportance, {
        userId: user._id,
        minImportance: 0.7,
        limit: 100,
      })

      if (memories.length < CORE_PROMOTION_CRITERIA.minOccurrences) {
        continue // Not enough data to find patterns
      }

      // Step 3: Use LLM to detect patterns (with retry)
      const patterns = await ctx.runAction(
        internal.reflection.detectPatternsWithLLM,
        { userId: user._id, memories },
        { retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 } },
      )

      // Step 4: Promote high-confidence patterns to core
      for (const pattern of patterns) {
        if (pattern.confidence >= CORE_PROMOTION_CRITERIA.minConfidence) {
          await ctx.runAction(internal.reflection.promoteToCoreAction, {
            userId: user._id,
            pattern,
          })
        }
      }

      // Step 5: Log reflection
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

// Trigger for cron
export const triggerDailyReflection = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(
      ctx,
      internal.reflection.dailyReflectionWorkflow,
      {},
    )
  },
})

// ============================================
// LLM-POWERED PATTERN DETECTION
// ============================================

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
    // Rate limit LLM calls
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

// ============================================
// PATTERN-BASED PROMOTION (heuristic fallback)
// ============================================

export const detectPatternsHeuristic = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const memories = await ctx.runQuery(internal.longTerm.getHighImportance, {
      userId: args.userId,
      minImportance: 0.7,
      limit: 100,
    })

    // Group by entity name
    const patterns = new Map<
      string,
      Array<{ currentImportance: number; summary: string }>
    >()
    for (const memory of memories) {
      if (memory.entityName) {
        if (!patterns.has(memory.entityName)) {
          patterns.set(memory.entityName, [])
        }
        patterns.get(memory.entityName)!.push(memory)
      }
    }

    const results: Array<{
      content: string
      category: string
      confidence: number
      supportingCount: number
    }> = []

    for (const [, group] of patterns) {
      if (group.length >= CORE_PROMOTION_CRITERIA.minOccurrences) {
        const avgImportance =
          group.reduce((sum, m) => sum + m.currentImportance, 0) / group.length

        results.push({
          content: group[0].summary,
          category: categorizePattern(group[0].summary),
          confidence: avgImportance,
          supportingCount: group.length,
        })
      }
    }

    return results
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
    embedding: v.array(v.float64()), // Pre-computed embedding from action
  },
  handler: async (ctx, args) => {
    // Check if already in core (avoid duplicates)
    const existing = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .filter((q) => q.eq(q.field('content'), args.pattern.content))
      .first()

    if (existing) {
      // Reinforce existing core memory
      await ctx.db.patch(existing._id, {
        confidence: Math.min(1, existing.confidence + 0.05),
        evidenceCount: existing.evidenceCount + args.pattern.supportingCount,
        updatedAt: Date.now(),
      })
      return { action: 'reinforced' as const, id: existing._id }
    }

    // Create new core memory with pre-computed embedding
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

    // Log reflection
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

/**
 * Action wrapper for promoteToCore that handles embedding generation.
 * ActionCache can only be used in actions, not mutations.
 * This is called from workflows.
 */
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
    // Check if already exists first (avoid unnecessary embedding generation)
    const existing: { _id: string } | null = await ctx.runQuery(
      internal.reflection.checkExistingCore,
      {
        userId: args.userId,
        content: args.pattern.content,
      },
    )

    if (existing) {
      // Just reinforce - no new embedding needed
      return await ctx.runMutation(internal.reflection.reinforceCore, {
        coreId: existing._id as Id<'coreMemories'>,
        supportingCount: args.pattern.supportingCount,
      })
    }

    // Generate embedding for new core memory (cached)
    const embedding: Array<number> = await embeddingCache.fetch(ctx, {
      text: args.pattern.content,
    })

    // Create new core memory with embedding
    return await ctx.runMutation(internal.reflection.promoteToCore, {
      userId: args.userId,
      pattern: args.pattern,
      embedding,
    })
  },
})

// Helper query to check for existing core memory
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

// Helper mutation to reinforce existing core memory
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

function categorizePattern(
  content: string,
):
  | 'identity'
  | 'preference'
  | 'relationship'
  | 'behavioral'
  | 'goal'
  | 'constraint' {
  const lower = content.toLowerCase()

  if (/\b(i am|i'm|my name|work as|profession|job)\b/.test(lower))
    return 'identity'
  if (/\b(prefer|like|love|favorite|rather)\b/.test(lower)) return 'preference'
  if (/\b(always|usually|often|every|habit)\b/.test(lower)) return 'behavioral'
  if (/\b(wife|husband|friend|family|dog|cat)\b/.test(lower))
    return 'relationship'
  if (/\b(learning|goal|want to|trying to|planning)\b/.test(lower))
    return 'goal'
  if (/\b(can't|don't|never|avoid|allergic)\b/.test(lower)) return 'constraint'

  return 'identity'
}

export const logReflection = internalMutation({
  args: {
    userId: v.id('users'),
    insight: v.string(),
    insightType: v.union(
      v.literal('pattern'),
      v.literal('trend'),
      v.literal('gap'),
    ),
    supportingMemoryCount: v.number(),
    confidence: v.float64(),
    actionTaken: v.optional(
      v.union(
        v.literal('promoted_to_core'),
        v.literal('flagged_for_review'),
        v.literal('none'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('reflections', {
      userId: args.userId,
      insight: args.insight,
      insightType: args.insightType,
      supportingMemoryCount: args.supportingMemoryCount,
      confidence: args.confidence,
      actionTaken: args.actionTaken,
      createdAt: Date.now(),
    })
  },
})
