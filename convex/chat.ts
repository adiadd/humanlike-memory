// convex/chat.ts
import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { api, components, internal } from './_generated/api'
import { action, internalAction, mutation, query } from './_generated/server'
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

// Save user message and schedule async response generation
// This mutation returns immediately for optimistic UI updates
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    userId: v.id('users'),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, userId, prompt }) => {
    // Save the user's message to the thread immediately using the agent's method
    const { messageId } = await memoryAgent.saveMessage(ctx, {
      threadId,
      prompt,
      // Skip embeddings in mutation - they'll be generated lazily when streaming
      skipEmbeddings: true,
    })

    // Schedule the async response generation
    await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
      threadId,
      userId,
      promptMessageId: messageId,
      prompt,
    })

    return { messageId }
  },
})

// Internal action that generates the response asynchronously with streaming
export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    userId: v.id('users'),
    promptMessageId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, userId, promptMessageId, prompt }) => {
    // 1. Rate limit chat messages per user
    const chatLimit = await rateLimiter.limit(ctx, 'chatMessages', {
      key: userId,
    })
    if (!chatLimit.ok) {
      // Log rate limit but don't throw - message is already saved
      console.warn(
        `Rate limited user ${userId}. Retry after ${chatLimit.retryAfter}ms`,
      )
      return
    }

    // 2. Fetch memory context (embedding is cached)
    const embedding = await embeddingCache.fetch(ctx, { text: prompt })
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

    // 4. Generate with memory-enriched context using streaming
    const baseInstructions = `You are a helpful AI assistant with memory of previous conversations.
Use your memories to personalize responses and reference past context naturally.
Important information shared by the user will be automatically remembered through the memory pipeline.`

    const systemMessage = memoryBlock
      ? `${baseInstructions}\n\n${memoryBlock}`
      : baseInstructions

    // Stream the response with deltas saved to DB for real-time UI updates
    // Type assertion needed due to complex generic inference with Agent tools
    const result = await (memoryAgent as any).streamText(
      ctx,
      { threadId, userId },
      // Pass system to override agent instructions with memory context
      { promptMessageId, system: systemMessage } as any,
      {
        saveStreamDeltas: {
          throttleMs: 50, // Update frequently for smooth streaming
        },
      },
    )

    // Consume the stream to ensure it completes
    await result.consumeStream()

    // 5. Ingest into sensory memory (background)
    await ctx.scheduler.runAfter(0, internal.sensory.ingestFromThread, {
      threadId,
      userId,
    })

    // Also directly ingest the user message
    await ctx.runMutation(api.sensory.ingestMessage, {
      content: prompt,
      userId,
      threadId,
    })
  },
})

// List messages for a thread with streaming support (reactive)
export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    // Fetch paginated messages
    const paginated = await listUIMessages(ctx, components.agent, args)
    // Fetch streaming deltas for real-time updates
    const streams = await syncStreams(ctx, components.agent, args)
    return { ...paginated, streams }
  },
})

// Legacy endpoint for backwards compatibility (non-streaming)
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
