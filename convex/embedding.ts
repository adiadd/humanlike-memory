// convex/embedding.ts
// Dedicated embedding action for caching
import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'
import { v } from 'convex/values'

import { internalAction } from './_generated/server'

export const generateEmbedding = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }): Promise<Array<number>> => {
    const { embedding } = await embed({
      model: openai.embeddingModel('text-embedding-3-small'),
      value: text,
    })
    return embedding
  },
})
