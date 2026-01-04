// convex/threads.ts
import { v } from 'convex/values'

import { components } from './_generated/api'
import { query } from './_generated/server'

/**
 * List all threads for a user
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
    return result.page
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
