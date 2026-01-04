import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, internalQuery, query } from './_generated/server'
import { STM_EXPIRY_HOURS } from './config'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// Query to get STM by ID (used by consolidation)
export const get = internalQuery({
  args: { id: v.id('shortTermMemories') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

// Query to get promotion candidates
export const getPromotionCandidates = internalQuery({
  args: {
    minImportance: v.float64(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db
      .query('shortTermMemories')
      .withIndex('by_user_importance')
      .filter((q) =>
        q.and(
          q.gte(q.field('importance'), args.minImportance),
          q.gt(q.field('expiresAt'), now),
        ),
      )
      .take(args.limit)
  },
})

export const promoteFromSensory = internalMutation({
  args: { sensoryMemoryId: v.id('sensoryMemories') },
  handler: async (ctx, args) => {
    const sensory = await ctx.db.get(args.sensoryMemoryId)
    if (!sensory || sensory.status !== 'pending') return

    await ctx.db.patch(args.sensoryMemoryId, { status: 'processing' })

    await ctx.scheduler.runAfter(0, internal.extraction.extractAndEmbed, {
      sensoryMemoryId: args.sensoryMemoryId,
      content: sensory.content,
      userId: sensory.userId,
      threadId: sensory.threadId!,
    })
  },
})

export const create = internalMutation({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        salience: v.float64(),
      }),
    ),
    relationships: v.array(
      v.object({
        subject: v.string(),
        predicate: v.string(),
        object: v.string(),
        confidence: v.float64(),
      }),
    ),
    importance: v.float64(),
    userId: v.id('users'),
    threadId: v.string(),
    existingTopicId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // 1. Use existing topic or create new one
    const topicId = await findOrCreateTopic(
      ctx,
      args.userId,
      args.embedding,
      args.entities,
      args.existingTopicId,
    )

    // 2. Create STM entry
    const stmId = await ctx.db.insert('shortTermMemories', {
      content: args.content,
      summary: args.summary,
      embedding: args.embedding,
      topicId,
      entities: args.entities,
      relationships: args.relationships,
      importance: args.importance,
      accessCount: 1,
      lastAccessed: Date.now(),
      expiresAt: Date.now() + STM_EXPIRY_HOURS * 60 * 60 * 1000,
      sourceId: args.sensoryMemoryId,
      threadId: args.threadId,
      userId: args.userId,
      createdAt: Date.now(),
    })

    // 3. Update sensory memory status
    await ctx.db.patch(args.sensoryMemoryId, {
      status: 'promoted',
      processedAt: Date.now(),
    })

    return stmId
  },
})

async function findOrCreateTopic(
  ctx: MutationCtx,
  userId: Id<'users'>,
  embedding: Array<number>,
  entities: Array<{ name: string; type: string; salience: number }>,
  existingTopicId: string | null,
): Promise<Id<'topics'>> {
  // If an existing topic was found via vector search in the action, use it
  if (existingTopicId) {
    const topic = await ctx.db.get(existingTopicId as Id<'topics'>)
    if (topic) {
      // Update topic centroid with the new embedding
      const newCentroid = topic.centroid.map(
        (val: number, i: number) =>
          (val * topic.memberCount + embedding[i]) / (topic.memberCount + 1),
      )
      await ctx.db.patch(topic._id, {
        centroid: newCentroid,
        memberCount: topic.memberCount + 1,
      })
      return topic._id
    }
  }

  // Create new topic
  const label =
    entities.length > 0 ? `${entities[0].type}: ${entities[0].name}` : 'General'

  return ctx.db.insert('topics', {
    userId,
    label,
    centroid: embedding,
    memberCount: 1,
    createdAt: Date.now(),
  })
}

export const byThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('shortTermMemories')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(20)
  },
})

// Public query for listing active STMs for a user
export const listActive = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db
      .query('shortTermMemories')
      .withIndex('by_user_importance', (q) => q.eq('userId', args.userId))
      .filter((q) => q.gt(q.field('expiresAt'), now))
      .order('desc')
      .take(50)
  },
})
