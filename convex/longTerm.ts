import { v } from 'convex/values'

import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { memoryStats } from './components'
import { DEDUP_SIMILARITY_THRESHOLD } from './config'

import type { Id } from './_generated/dataModel'

// Type for STM document returned from query
interface STMDoc {
  _id: Id<'shortTermMemories'>
  content: string
  summary?: string
  embedding: Array<number>
  importance: number
  entities: Array<{ name: string; type: string; salience: number }>
  userId: Id<'users'>
}

// Type for search results
interface SearchResult {
  _id: Id<'longTermMemories'>
  _score: number
  isActive: boolean
  summary: string
}

// Helper query to get a single memory by ID (used by searchSimilar action)
export const getMemoryById = internalQuery({
  args: { memoryId: v.id('longTermMemories') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.memoryId)
  },
})

// Query for high-importance memories (used by reflection)
export const getHighImportance = internalQuery({
  args: {
    userId: v.id('users'),
    minImportance: v.float64(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('longTermMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .filter((q) => q.gte(q.field('currentImportance'), args.minImportance))
      .take(args.limit)
  },
})

export const consolidateFromSTM = internalAction({
  args: {
    stmId: v.id('shortTermMemories'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { action: 'reinforced'; existingId: Id<'longTermMemories'> }
    | { action: 'created' }
    | undefined
  > => {
    const stm: STMDoc | null = await ctx.runQuery(internal.shortTerm.get, {
      id: args.stmId,
    })
    if (!stm) return

    // Check for duplicates via vector similarity
    const similar: Array<SearchResult> = await ctx.runAction(
      internal.longTerm.searchSimilar,
      {
        userId: stm.userId,
        embedding: stm.embedding,
        limit: 3,
      },
    )

    // If too similar to existing, skip (deduplication)
    for (const existing of similar) {
      if (existing._score >= DEDUP_SIMILARITY_THRESHOLD) {
        // Reinforce existing memory instead
        await ctx.runMutation(internal.longTerm.reinforce, {
          memoryId: existing._id,
        })
        return { action: 'reinforced' as const, existingId: existing._id }
      }
    }

    // Create new LTM
    await ctx.runMutation(internal.longTerm.create, {
      content: stm.content,
      summary: stm.summary || stm.content.slice(0, 200),
      embedding: stm.embedding,
      memoryType: 'semantic',
      baseImportance: stm.importance,
      entityName: stm.entities[0]?.name,
      entityType: stm.entities[0]?.type,
      userId: stm.userId,
      consolidatedFrom: [args.stmId],
    })

    return { action: 'created' as const }
  },
})

export const create = internalMutation({
  args: {
    content: v.string(),
    summary: v.string(),
    embedding: v.array(v.float64()),
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    baseImportance: v.float64(),
    entityName: v.optional(v.string()),
    entityType: v.optional(v.string()),
    userId: v.id('users'),
    consolidatedFrom: v.array(v.id('shortTermMemories')),
  },
  handler: async (ctx, args) => {
    // Insert memory
    const id = await ctx.db.insert('longTermMemories', {
      content: args.content,
      summary: args.summary,
      embedding: args.embedding,
      memoryType: args.memoryType,
      baseImportance: args.baseImportance,
      currentImportance: args.baseImportance,
      stability: 100,
      accessCount: 0,
      lastAccessed: Date.now(),
      reinforcementCount: 1,
      entityName: args.entityName,
      entityType: args.entityType,
      userId: args.userId,
      consolidatedFrom: args.consolidatedFrom,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // IMPORTANT: Sync with aggregate for O(log n) stats
    const doc = await ctx.db.get(id)
    if (doc) {
      await memoryStats.insert(ctx, doc)
    }

    return id
  },
})

export const reinforce = internalMutation({
  args: { memoryId: v.id('longTermMemories') },
  handler: async (ctx, args) => {
    const oldDoc = await ctx.db.get(args.memoryId)
    if (!oldDoc) return

    await ctx.db.patch(args.memoryId, {
      reinforcementCount: oldDoc.reinforcementCount + 1,
      currentImportance: Math.min(1, oldDoc.currentImportance + 0.05),
      stability: Math.min(1000, oldDoc.stability + 10),
      updatedAt: Date.now(),
    })

    // Sync aggregate on importance change
    const newDoc = await ctx.db.get(args.memoryId)
    if (newDoc) {
      await memoryStats.replace(ctx, oldDoc, newDoc)
    }
  },
})

export const searchSimilar = internalAction({
  args: {
    userId: v.id('users'),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<Array<SearchResult>> => {
    // Vector search is only available in actions
    const results = await ctx.vectorSearch(
      'longTermMemories',
      'embedding_idx',
      {
        vector: args.embedding,
        limit: args.limit,
        filter: (q) => q.eq('userId', args.userId),
      },
    )

    // Fetch full documents and filter for isActive
    const docs: Array<SearchResult | null> = await Promise.all(
      results.map(async (r): Promise<SearchResult | null> => {
        const doc = await ctx.runQuery(internal.longTerm.getMemoryById, {
          memoryId: r._id,
        })
        if (doc && doc.isActive) {
          return {
            _id: doc._id,
            _score: r._score,
            isActive: doc.isActive,
            summary: doc.summary,
          }
        }
        return null
      }),
    )

    return docs.filter((d): d is SearchResult => d !== null)
  },
})

export const deleteMemory = internalMutation({
  args: { memoryId: v.id('longTermMemories') },
  handler: async (ctx, args) => {
    const oldDoc = await ctx.db.get(args.memoryId)
    if (!oldDoc) return

    await ctx.db.patch(args.memoryId, {
      isActive: false,
      updatedAt: Date.now(),
    })

    // Sync aggregate on soft delete
    const newDoc = await ctx.db.get(args.memoryId)
    if (newDoc) {
      await memoryStats.replace(ctx, oldDoc, newDoc)
    }
  },
})

// Public query for listing active long-term memories
export const listActive = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('longTermMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .order('desc')
      .take(100)
  },
})
