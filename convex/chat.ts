// convex/chat.ts
import { ConvexError, v } from 'convex/values'

import { api, internal } from './_generated/api'
import { action, query } from './_generated/server'
import { memoryAgent } from './agent'
import { embeddingCache, memoryStats, rateLimiter } from './components'

// Type for memory context (matches retrieval.ts)
interface MemoryContext {
  core: Array<{ content: string; category: string }>
  longTerm: Array<{ content: string; type: string; importance: number }>
  shortTerm: Array<{ content: string; importance: number }>
  totalTokens: number
}

// Create a new thread for a user
export const createConversation = action({
  args: { userId: v.id('users'), title: v.optional(v.string()) },
  handler: async (ctx, { userId, title }) => {
    const { threadId } = await memoryAgent.createThread(ctx, {
      userId,
      title,
    })
    return { threadId }
  },
})

// Send a message with memory context injection (rate limited)
export const sendMessage = action({
  args: {
    threadId: v.string(),
    userId: v.id('users'),
    message: v.string(),
  },
  handler: async (ctx, { threadId, userId, message }) => {
    // 1. Rate limit chat messages per user
    const chatLimit = await rateLimiter.limit(ctx, 'chatMessages', {
      key: userId,
    })
    if (!chatLimit.ok) {
      throw new ConvexError({
        code: 'RATE_LIMITED',
        message: `Too many messages. Please wait ${Math.ceil(chatLimit.retryAfter / 1000)} seconds.`,
        retryAfter: chatLimit.retryAfter,
      })
    }

    // 2. Fetch memory context (embedding is cached)
    const embedding = await embeddingCache.fetch(ctx, { text: message })
    const memoryContext = await ctx.runAction(
      internal.retrieval.assembleContext,
      {
        userId,
        threadId,
        queryEmbedding: embedding,
      },
    )

    // 3. Format memory context as system message prefix
    const memoryBlock = formatMemoryContext(memoryContext)

    // 4. Generate with memory-enriched context
    // Combine memory context with user message
    const enrichedPrompt = memoryBlock
      ? `${memoryBlock}\n\nUser message: ${message}`
      : message

    const { thread } = await memoryAgent.continueThread(ctx, { threadId })
    // @ts-expect-error - Type inference issue with createTool and Agent generics
    const result = await thread.generateText({
      prompt: enrichedPrompt,
    })

    // 5. Ingest into sensory memory (background)
    await ctx.scheduler.runAfter(0, internal.sensory.ingestFromThread, {
      threadId,
      userId,
    })

    // Also directly ingest the user message
    await ctx.runMutation(api.sensory.ingestMessage, {
      content: message,
      userId,
      threadId,
    })

    return { text: result.text }
  },
})

// Stream responses for real-time UI (rate limited)
export const streamMessage = action({
  args: {
    threadId: v.string(),
    userId: v.id('users'),
    message: v.string(),
  },
  handler: async (ctx, { threadId, userId, message }) => {
    // 1. Rate limit
    const chatLimit = await rateLimiter.limit(ctx, 'chatMessages', {
      key: userId,
    })
    if (!chatLimit.ok) {
      throw new ConvexError({
        code: 'RATE_LIMITED',
        message: `Too many messages. Please wait ${Math.ceil(chatLimit.retryAfter / 1000)} seconds.`,
        retryAfter: chatLimit.retryAfter,
      })
    }

    // 2. Fetch memory context (cached embedding)
    const embedding = await embeddingCache.fetch(ctx, { text: message })
    const memoryContext = await ctx.runAction(
      internal.retrieval.assembleContext,
      {
        userId,
        threadId,
        queryEmbedding: embedding,
      },
    )

    // 3. Format memory context as system message prefix
    const memoryBlock = formatMemoryContext(memoryContext)

    // 4. Stream response with memory context
    const enrichedPrompt = memoryBlock
      ? `${memoryBlock}\n\nUser message: ${message}`
      : message

    const { thread } = await memoryAgent.continueThread(ctx, { threadId })

    await (thread as any).streamText(
      { prompt: enrichedPrompt },
      { saveStreamDeltas: true },
    )

    // 5. Ingest into sensory memory (background)
    await ctx.scheduler.runAfter(0, internal.sensory.ingestFromThread, {
      threadId,
      userId,
    })

    // Also directly ingest the user message
    await ctx.runMutation(api.sensory.ingestMessage, {
      content: message,
      userId,
      threadId,
    })
  },
})

// List messages for a thread (reactive)
export const getMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    // Use the agent's built-in message listing
    return await memoryAgent.listMessages(ctx, {
      threadId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
  },
})

// Get memory statistics for a user (uses Aggregate component)
export const getMemoryStats = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    // These are O(log n) operations thanks to the Aggregate component
    const totalMemories = await memoryStats.count(ctx, { namespace: userId })
    const semanticCount = await memoryStats.count(ctx, {
      namespace: userId,
      bounds: { prefix: ['semantic'] },
    })
    const episodicCount = await memoryStats.count(ctx, {
      namespace: userId,
      bounds: { prefix: ['episodic'] },
    })

    const coreMemories = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) => q.eq('userId', userId).eq('isActive', true))
      .collect()

    return {
      total: totalMemories,
      semantic: semanticCount,
      episodic: episodicCount,
      core: coreMemories.length,
    }
  },
})

function formatMemoryContext(context: MemoryContext): string {
  let text = ''
  if (context.core.length > 0) {
    text += '## What I Know About You\n'
    text += `${context.core.map((c) => `- ${c.content}`).join('\n')}\n\n`
  }
  if (context.longTerm.length > 0) {
    text += '## Relevant Memories\n'
    text += `${context.longTerm.map((m) => `- ${m.content}`).join('\n')}\n\n`
  }
  if (context.shortTerm.length > 0) {
    text += '## Current Context\n'
    text += `${context.shortTerm.map((m) => `- ${m.content}`).join('\n')}\n`
  }
  return text
}
