// convex/sensory.ts
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'

const ATTENTION_THRESHOLD = 0.3

export const ingestMessage = mutation({
  args: {
    content: v.string(),
    userId: v.id('users'),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Check for duplicates (same content in last hour)
    const contentHash = hashContent(args.content)
    const duplicate = await ctx.db
      .query('sensoryMemories')
      .withIndex('by_hash', (q) =>
        q.eq('userId', args.userId).eq('contentHash', contentHash),
      )
      .filter((q) => q.gt(q.field('createdAt'), Date.now() - 3600000))
      .first()

    if (duplicate) {
      return { status: 'duplicate' as const, id: duplicate._id }
    }

    // 2. Calculate attention score
    const attentionScore = calculateAttentionScore(args.content)

    // 3. Store in sensory memory
    const memoryId = await ctx.db.insert('sensoryMemories', {
      content: args.content,
      contentHash,
      inputType: 'message',
      attentionScore,
      status: attentionScore >= ATTENTION_THRESHOLD ? 'pending' : 'discarded',
      discardReason:
        attentionScore < ATTENTION_THRESHOLD
          ? `Low attention score: ${attentionScore.toFixed(2)}`
          : undefined,
      userId: args.userId,
      threadId: args.threadId,
      createdAt: Date.now(),
    })

    // 4. If passes threshold, schedule promotion to STM
    if (attentionScore >= ATTENTION_THRESHOLD) {
      await ctx.scheduler.runAfter(0, internal.shortTerm.promoteFromSensory, {
        sensoryMemoryId: memoryId,
      })
    }

    return { status: 'created' as const, id: memoryId, attentionScore }
  },
})

function calculateAttentionScore(content: string): number {
  let score = 0.4 // Base score

  // Personal information patterns (+0.25)
  if (
    /\b(i am|i'm|my name|i work|i live|i prefer|i like|i hate|i need|i want)\b/i.test(
      content,
    )
  ) {
    score += 0.25
  }

  // Named entities (+0.15)
  if (
    (content.match(/(?<=[a-z]\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [])
      .length > 0
  ) {
    score += 0.15
  }

  // Temporal references (+0.1)
  if (
    /\b(yesterday|today|tomorrow|last week|next month|always|never|usually)\b/i.test(
      content,
    )
  ) {
    score += 0.1
  }

  // Length modifiers
  if (content.length >= 50) score += 0.15
  if (content.length < 20) score -= 0.3

  // Low-value patterns
  if (
    /^(ok|thanks|yes|no|sure|got it|okay|k|yep|nope)$/i.test(content.trim())
  ) {
    score -= 0.5
  }

  return Math.max(0, Math.min(1, score))
}

function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

// Internal mutation for updating sensory memory status
export const updateStatus = internalMutation({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('promoted'),
      v.literal('discarded'),
    ),
    processedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sensoryMemoryId, {
      status: args.status,
      processedAt: args.processedAt,
    })
  },
})

// Internal mutation for marking extraction as failed
export const markExtractionFailed = internalMutation({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sensoryMemoryId, {
      status: 'discarded',
      discardReason: `Extraction failed: ${args.reason}`,
      processedAt: Date.now(),
    })
  },
})

// Ingest from thread (called by chat.ts after message)
export const ingestFromThread = internalMutation({
  args: { threadId: v.string(), userId: v.id('users') },
  handler: (_ctx, { threadId, userId }) => {
    // For now, we'll skip the thread message ingestion
    // since the agent component manages messages separately
    // This is called to ensure any new messages are processed
    // The actual ingestion happens when the user sends a message
    // via the sendMessage action which already calls ingestMessage

    // Note: In a production system, you might want to fetch messages
    // from the agent component and process them here
    // But for the MVP, we'll rely on the direct ingestion path

    // Just log that we were called
    console.log(
      `ingestFromThread called for thread ${threadId}, user ${userId}`,
    )
  },
})

// Public query for listing recent sensory memories (for debugging/visualization)
export const listRecent = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('sensoryMemories')
      .withIndex('by_user_status', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(50)
  },
})
