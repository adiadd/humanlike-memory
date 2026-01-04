import { v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'

export const cleanupOrphaned = internalMutation({
  handler: async (ctx): Promise<{ deleted: number }> => {
    let deleted = 0
    const edges = await ctx.db.query('memoryEdges').take(500)

    for (const edge of edges) {
      const sourceMemories = await ctx.db
        .query('longTermMemories')
        .withIndex('by_entity', (q) =>
          q
            .eq('userId', edge.userId)
            .eq('entityType', edge.sourceType)
            .eq('entityName', edge.sourceName),
        )
        .first()

      const targetMemories = await ctx.db
        .query('longTermMemories')
        .withIndex('by_entity', (q) =>
          q
            .eq('userId', edge.userId)
            .eq('entityType', edge.targetType)
            .eq('entityName', edge.targetName),
        )
        .first()

      if (!sourceMemories || !targetMemories) {
        await ctx.db.delete(edge._id)
        deleted++
      }
    }

    return { deleted }
  },
})

export const upsertEdge = mutation({
  args: {
    userId: v.id('users'),
    sourceName: v.string(),
    sourceType: v.string(),
    targetName: v.string(),
    targetType: v.string(),
    relationType: v.string(),
    fact: v.string(),
    embedding: v.array(v.float64()),
    strength: v.float64(),
  },
  handler: async (ctx, args) => {
    // Check for existing edge
    const existing = await ctx.db
      .query('memoryEdges')
      .withIndex('by_source', (q) =>
        q.eq('userId', args.userId).eq('sourceName', args.sourceName),
      )
      .filter((q) => q.eq(q.field('targetName'), args.targetName))
      .first()

    if (existing) {
      // Strengthen existing edge
      await ctx.db.patch(existing._id, {
        strength: Math.min(1, existing.strength + args.strength * 0.2),
        updatedAt: Date.now(),
      })
      return existing._id
    }

    // Create new edge
    return await ctx.db.insert('memoryEdges', {
      userId: args.userId,
      sourceName: args.sourceName,
      sourceType: args.sourceType,
      targetName: args.targetName,
      targetType: args.targetType,
      relationType: args.relationType,
      fact: args.fact,
      embedding: args.embedding,
      strength: args.strength,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const getConnected = query({
  args: {
    userId: v.id('users'),
    entityName: v.string(),
  },
  handler: async (ctx, args) => {
    const outgoing = await ctx.db
      .query('memoryEdges')
      .withIndex('by_source', (q) =>
        q.eq('userId', args.userId).eq('sourceName', args.entityName),
      )
      .collect()

    const incoming = await ctx.db
      .query('memoryEdges')
      .withIndex('by_target', (q) =>
        q.eq('userId', args.userId).eq('targetName', args.entityName),
      )
      .collect()

    return { outgoing, incoming }
  },
})
