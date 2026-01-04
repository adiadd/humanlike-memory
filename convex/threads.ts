// convex/threads.ts
import { v } from 'convex/values'

import { components } from './_generated/api'
import { mutation, query } from './_generated/server'

/**
 * List all active threads for a user (excludes archived)
 */
export const list = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    // Use the agent component's thread listing directly
    const result = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
        paginationOpts: { cursor: null, numItems: 50 },
      },
    )
    // Filter to only show active threads
    return result.page.filter((thread) => thread.status === 'active')
  },
})

/**
 * Archive a thread (soft delete)
 */
export const archive = mutation({
  args: {
    threadId: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, { threadId, userId }) => {
    // Verify thread exists and belongs to user
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    })

    if (!thread) {
      throw new Error('Thread not found')
    }

    if (thread.userId !== userId) {
      throw new Error('Unauthorized')
    }

    // Soft delete by setting status to archived
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { status: 'archived' },
    })

    return { success: true }
  },
})

/**
 * Get a single thread by ID
 */
export const get = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    })
  },
})
