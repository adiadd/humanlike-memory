import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction, internalQuery, query } from './_generated/server'
import { CHARS_PER_TOKEN, CONTEXT_BUDGET } from './config'
import type { MemoryContext } from './types'

// Helper: Fit memories within a token budget
// Returns the items that fit and total tokens used
function fitMemoriesWithinBudget<T>(
  memories: Array<T>,
  budget: number,
  getContent: (item: T) => string,
): { items: Array<T>; tokensUsed: number } {
  const items: Array<T> = []
  let tokensUsed = 0

  for (const memory of memories) {
    const content = getContent(memory)
    const tokens = Math.ceil(content.length / CHARS_PER_TOKEN)
    if (tokensUsed + tokens <= budget) {
      items.push(memory)
      tokensUsed += tokens
    }
  }

  return { items, tokensUsed }
}

// Helper query to get core, long-term, and short-term memories (no vector search)
export const getMemoriesWithoutVector = internalQuery({
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

    // 2. Get recent long-term memories by recency (no vector search)
    const ltmResults = await ctx.db
      .query('longTermMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .order('desc')
      .take(10)

    // 3. Get recent short-term memories from thread
    const stmResults = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(10)

    return { coreMemories, ltmResults, stmResults }
  },
})

// Helper query to get core and short-term memories (for use with vector search)
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

// Helper: Build MemoryContext from raw memories
function buildMemoryContext(
  coreMemories: Array<{ content: string; category: string }>,
  ltmDocs: Array<{
    summary: string
    memoryType: string
    currentImportance: number
  }>,
  stmResults: Array<{ summary?: string; content: string; importance: number }>,
): MemoryContext {
  const context: MemoryContext = {
    core: [],
    longTerm: [],
    shortTerm: [],
    totalTokens: 0,
  }

  // Process core memories
  const coreResult = fitMemoriesWithinBudget(
    coreMemories,
    CONTEXT_BUDGET.core,
    (c) => c.content,
  )
  context.core = coreResult.items.map((c) => ({
    content: c.content,
    category: c.category,
  }))
  context.totalTokens += coreResult.tokensUsed

  // Process long-term memories
  const ltmResult = fitMemoriesWithinBudget(
    ltmDocs,
    CONTEXT_BUDGET.longTerm,
    (m) => m.summary,
  )
  context.longTerm = ltmResult.items.map((m) => ({
    content: m.summary,
    type: m.memoryType,
    importance: m.currentImportance,
  }))
  context.totalTokens += ltmResult.tokensUsed

  // Process short-term memories
  const stmResult = fitMemoriesWithinBudget(
    stmResults,
    CONTEXT_BUDGET.shortTerm,
    (m) => m.summary || m.content,
  )
  context.shortTerm = stmResult.items.map((m) => ({
    content: m.summary || m.content,
    importance: m.importance,
  }))
  context.totalTokens += stmResult.tokensUsed

  return context
}

// Main context assembly action (uses vector search for LTM)
export const assembleContext = internalAction({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
    queryEmbedding: v.array(v.float64()),
  },
  handler: async (ctx, args): Promise<MemoryContext> => {
    // 1. Get core and STM from query
    const { coreMemories, stmResults } = await ctx.runQuery(
      internal.retrieval.getCoreAndShortTerm,
      { userId: args.userId, threadId: args.threadId },
    )

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

    return buildMemoryContext(coreMemories, ltmDocs, stmResults)
  },
})

// Simpler version without vector search for when embedding isn't available
export const assembleContextSimple = query({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
  },
  handler: async (ctx, args): Promise<MemoryContext> => {
    const { coreMemories, ltmResults, stmResults } = await ctx.runQuery(
      internal.retrieval.getMemoriesWithoutVector,
      { userId: args.userId, threadId: args.threadId },
    )

    return buildMemoryContext(coreMemories, ltmResults, stmResults)
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
