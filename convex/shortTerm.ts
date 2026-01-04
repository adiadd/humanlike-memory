// convex/shortTerm.ts
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, internalQuery, query } from './_generated/server'

const TOPIC_SIMILARITY_THRESHOLD = 0.82
const STM_EXPIRY_HOURS = 4

// Query to get STM by ID (used by consolidation)
export const get = internalQuery({
  args: { id: v.id('shortTermMemories') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
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
    return await ctx.db
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
  },
  handler: async (ctx, args) => {
    // 1. Find or create topic based on embedding similarity
    const topicId = await findOrCreateTopic(
      ctx,
      args.userId,
      args.embedding,
      args.entities,
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
  ctx: any,
  userId: string,
  embedding: Array<number>,
  entities: Array<{ name: string; type: string; salience: number }>,
) {
  // Search for similar STM to find existing topic using vector search
  const similar = await ctx.db
    .query('shortTermMemories')
    .withSearchIndex('embedding_idx', (q: any) =>
      q.vectorSearch('embedding', embedding).eq('userId', userId),
    )
    .take(3)

  for (const memory of similar) {
    if (memory._score >= TOPIC_SIMILARITY_THRESHOLD && memory.topicId) {
      // Update topic centroid
      const topic = await ctx.db.get(memory.topicId)
      if (topic) {
        const newCentroid = topic.centroid.map(
          (val: number, i: number) =>
            (val * topic.memberCount + embedding[i]) / (topic.memberCount + 1),
        )
        await ctx.db.patch(topic._id, {
          centroid: newCentroid,
          memberCount: topic.memberCount + 1,
        })
      }
      return memory.topicId
    }
  }

  // Create new topic
  const label =
    entities.length > 0 ? `${entities[0].type}: ${entities[0].name}` : 'General'

  return await ctx.db.insert('topics', {
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
    return await ctx.db
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
    return await ctx.db
      .query('shortTermMemories')
      .withIndex('by_user_importance', (q) => q.eq('userId', args.userId))
      .filter((q) => q.gt(q.field('expiresAt'), now))
      .order('desc')
      .take(50)
  },
})
