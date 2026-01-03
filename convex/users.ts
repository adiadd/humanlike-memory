// convex/users.ts
import { v } from 'convex/values'

import { internalQuery, mutation, query } from './_generated/server'

/**
 * Get users who have been active in the last N days.
 * Used by the reflection workflow to process memories.
 */
export const getActiveUsers = internalQuery({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.days * 24 * 60 * 60 * 1000

    // Get users with recent activity
    // Using lastActiveAt index for efficient querying
    const activeUsers = await ctx.db
      .query('users')
      .withIndex('by_lastActive', (q) => q.gt('lastActiveAt', cutoff))
      .take(100)

    return activeUsers
  },
})

/**
 * Get or create a user by external ID (e.g., Clerk ID)
 */
export const getOrCreate = mutation({
  args: {
    externalId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Try to find existing user
    const existing = await ctx.db
      .query('users')
      .withIndex('by_externalId', (q) => q.eq('externalId', args.externalId))
      .first()

    if (existing) {
      // Update last active time
      await ctx.db.patch(existing._id, { lastActiveAt: Date.now() })
      return existing._id
    }

    // Create new user
    const now = Date.now()
    return await ctx.db.insert('users', {
      externalId: args.externalId,
      name: args.name,
      email: args.email,
      lastActiveAt: now,
      createdAt: now,
    })
  },
})

/**
 * Get a user by ID
 */
export const get = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})

/**
 * Update user's last active timestamp
 */
export const updateActivity = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { lastActiveAt: Date.now() })
  },
})
