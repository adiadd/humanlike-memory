// convex/agent.ts
import { Agent, createTool } from '@convex-dev/agent'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'
import { z } from 'zod'

import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

// Tool: Save important facts to core memory
// NOTE: Tools are defined before the agent so they can be referenced
const saveToCore = createTool({
  description: 'Save an important fact about the user to permanent memory',
  args: z.object({
    content: z.string().describe('The fact to remember'),
    category: z.enum([
      'identity',
      'preference',
      'relationship',
      'behavioral',
      'goal',
      'constraint',
    ]),
  }),
  handler: async (ctx, args): Promise<{ saved: boolean }> => {
    const { embedding } = await embed({
      model: openai.embeddingModel('text-embedding-3-small'),
      value: args.content,
    })
    await ctx.runMutation(internal.core.create, {
      content: args.content,
      embedding,
      category: args.category,
      confidence: 0.8,
      evidenceCount: 1,
      userId: ctx.userId as Id<'users'>,
    })
    return { saved: true }
  },
})

// Tool: Search across all memory layers
const searchMemories = createTool({
  description: 'Search memories for relevant context',
  args: z.object({
    query: z.string().describe('What to search for'),
  }),
  handler: async (ctx, args): Promise<Array<string>> => {
    const { embedding } = await embed({
      model: openai.embeddingModel('text-embedding-3-small'),
      value: args.query,
    })
    const results: Array<{ summary: string }> = await ctx.runQuery(
      internal.longTerm.searchSimilar,
      {
        userId: ctx.userId as Id<'users'>,
        embedding,
        limit: 5,
      },
    )
    return results.map((m) => m.summary)
  },
})

// Define the memory-aware agent
export const memoryAgent = new Agent(components.agent, {
  name: 'MemoryAgent',
  languageModel: anthropic('claude-sonnet-4-5-20250514'),
  textEmbeddingModel: openai.embeddingModel('text-embedding-3-small'),
  instructions: `You are a helpful AI assistant with memory of previous conversations.
Use your memories to personalize responses and reference past context naturally.
When learning important information about the user, save it using the saveToCore tool.`,
  tools: { saveToCore, searchMemories },
})
