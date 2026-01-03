// convex/retrieval.ts
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction, internalQuery, query } from './_generated/server'

const CONTEXT_BUDGET = {
  core: 400,
  longTerm: 1200,
  shortTerm: 400,
}
const CHARS_PER_TOKEN = 4

interface MemoryContext {
  core: Array<{ content: string; category: string }>
  longTerm: Array<{ content: string; type: string; importance: number }>
  shortTerm: Array<{ content: string; importance: number }>
  totalTokens: number
}

// Helper query to get core and short-term memories (no vector search needed)
export const getCoreAndShortTerm = internalQuery({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Get core memories
    const coreMemories = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .take(10)

    // 2. Get recent short-term memories from thread
    const stmResults = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(10)

    return { coreMemories, stmResults }
  },
})

// Helper query to fetch LTM documents by IDs
export const getLongTermByIds = internalQuery({
  args: {
    ids: v.array(v.id('longTermMemories')),
  },
  handler: async (ctx, args) => {
    const results = []
    for (const id of args.ids) {
      const doc = await ctx.db.get(id)
      if (doc && doc.isActive) {
        results.push(doc)
      }
    }
    return results
  },
})

// Main context assembly action (uses vector search)
export const assembleContext = internalAction({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
    queryEmbedding: v.array(v.float64()),
  },
  handler: async (ctx, args): Promise<MemoryContext> => {
    const context: MemoryContext = {
      core: [],
      longTerm: [],
      shortTerm: [],
      totalTokens: 0,
    }

    // 1. Get core and STM from query
    const { coreMemories, stmResults } = await ctx.runQuery(
      internal.retrieval.getCoreAndShortTerm,
      { userId: args.userId, threadId: args.threadId },
    )

    // Process core memories
    let usedTokens = 0
    for (const core of coreMemories) {
      const tokens = Math.ceil(core.content.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.core) {
        context.core.push({
          content: core.content,
          category: core.category,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    // 2. Vector search for long-term memories (only available in actions)
    // Note: Vector search filter only supports eq and or, not and
    // We filter by userId in the vector search, then filter isActive after
    const ltmSearchResults = await ctx.vectorSearch(
      'longTermMemories',
      'embedding_idx',
      {
        vector: args.queryEmbedding,
        limit: 15,
        filter: (q) => q.eq('userId', args.userId),
      },
    )

    // Fetch the actual documents
    const ltmDocs = await ctx.runQuery(internal.retrieval.getLongTermByIds, {
      ids: ltmSearchResults.map((r) => r._id),
    })

    usedTokens = 0
    for (const ltm of ltmDocs) {
      const tokens = Math.ceil(ltm.summary.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.longTerm) {
        context.longTerm.push({
          content: ltm.summary,
          type: ltm.memoryType,
          importance: ltm.currentImportance,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    // 3. Process short-term memories
    usedTokens = 0
    for (const stm of stmResults) {
      const content = stm.summary || stm.content
      const tokens = Math.ceil(content.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.shortTerm) {
        context.shortTerm.push({
          content,
          importance: stm.importance,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    return context
  },
})

// Simpler version without vector search for when embedding isn't available
export const assembleContextSimple = query({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
  },
  handler: async (ctx, args): Promise<MemoryContext> => {
    const context: MemoryContext = {
      core: [],
      longTerm: [],
      shortTerm: [],
      totalTokens: 0,
    }

    // 1. Get core memories
    const coreMemories = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .take(10)

    let usedTokens = 0
    for (const core of coreMemories) {
      const tokens = Math.ceil(core.content.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.core) {
        context.core.push({
          content: core.content,
          category: core.category,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    // 2. Get recent long-term memories by importance (no vector search)
    const ltmResults = await ctx.db
      .query('longTermMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .order('desc')
      .take(10)

    usedTokens = 0
    for (const ltm of ltmResults) {
      const tokens = Math.ceil(ltm.summary.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.longTerm) {
        context.longTerm.push({
          content: ltm.summary,
          type: ltm.memoryType,
          importance: ltm.currentImportance,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    // 3. Get recent short-term memories from thread
    const stmResults = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(10)

    usedTokens = 0
    for (const stm of stmResults) {
      const content = stm.summary || stm.content
      const tokens = Math.ceil(content.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.shortTerm) {
        context.shortTerm.push({
          content,
          importance: stm.importance,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    return context
  },
})

export function formatContextForPrompt(context: MemoryContext): string {
  let prompt = ''

  if (context.core.length > 0) {
    prompt += '## What I Know About You\n'
    for (const core of context.core) {
      prompt += `- ${core.content}\n`
    }
    prompt += '\n'
  }

  if (context.longTerm.length > 0) {
    prompt += '## Relevant Memories\n'
    for (const ltm of context.longTerm) {
      prompt += `- ${ltm.content}\n`
    }
    prompt += '\n'
  }

  if (context.shortTerm.length > 0) {
    prompt += '## Current Conversation Context\n'
    for (const stm of context.shortTerm) {
      prompt += `- ${stm.content}\n`
    }
    prompt += '\n'
  }

  return prompt
}
