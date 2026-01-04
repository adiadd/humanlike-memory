// convex/agent.ts
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { Agent, createTool } from '@convex-dev/agent'
import { embed } from 'ai'
import { z } from 'zod'

import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

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
    const results: Array<{ summary: string }> = await ctx.runAction(
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
// NOTE: saveToCore tool is intentionally NOT included - memories should flow through
// the proper pipeline: Sensory → STM → LTM → Core (via reflection workflow)
export const memoryAgent = new Agent(components.agent, {
  name: 'MemoryAgent',
  languageModel: anthropic('claude-haiku-4-5'),
  textEmbeddingModel: openai.embeddingModel('text-embedding-3-small'),
  instructions: `You are a helpful AI assistant with memory of previous conversations.
Use your memories to personalize responses and reference past context naturally.
Important information shared by the user will be automatically remembered through the memory pipeline.`,
  tools: { searchMemories },
  // Allow multiple steps for tool calls to complete and generate final response
  maxSteps: 5,
})
