// convex/core.ts
import { v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'

export const listActive = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .collect()
  },
})

export const byCategory = query({
  args: {
    userId: v.id('users'),
    category: v.union(
      v.literal('identity'),
      v.literal('preference'),
      v.literal('relationship'),
      v.literal('behavioral'),
      v.literal('goal'),
      v.literal('constraint'),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('coreMemories')
      .withIndex('by_user_category', (q) =>
        q
          .eq('userId', args.userId)
          .eq('category', args.category)
          .eq('isActive', true),
      )
      .collect()
  },
})

export const create = internalMutation({
  args: {
    content: v.string(),
    embedding: v.array(v.float64()),
    category: v.union(
      v.literal('identity'),
      v.literal('preference'),
      v.literal('relationship'),
      v.literal('behavioral'),
      v.literal('goal'),
      v.literal('constraint'),
    ),
    confidence: v.float64(),
    evidenceCount: v.number(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('coreMemories', {
      content: args.content,
      embedding: args.embedding,
      category: args.category,
      confidence: args.confidence,
      evidenceCount: args.evidenceCount,
      userId: args.userId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// User-facing mutation to delete a core memory
export const remove = mutation({
  args: {
    memoryId: v.id('coreMemories'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId)
    if (!memory || memory.userId !== args.userId) {
      throw new Error('Memory not found or unauthorized')
    }

    await ctx.db.patch(args.memoryId, {
      isActive: false,
      updatedAt: Date.now(),
    })
    return { success: true }
  },
})
