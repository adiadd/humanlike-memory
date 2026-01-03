// convex/extraction.ts
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { v } from 'convex/values'
import { z } from 'zod'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { embeddingCache, rateLimiter } from './components'

const ExtractionSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string().describe('The entity name'),
      type: z
        .string()
        .describe('Entity type: person, place, org, skill, preference'),
      salience: z
        .number()
        .min(0)
        .max(1)
        .describe('How central to the message (0-1)'),
    }),
  ),
  relationships: z.array(
    z.object({
      subject: z.string(),
      predicate: z
        .string()
        .describe('Relationship: prefers, works_at, knows, lives_in'),
      object: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  importance: z.number().min(0).max(1).describe('Long-term importance score'),
  summary: z.string().describe('One sentence summary'),
})

export const extractAndEmbed = internalAction({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    content: v.string(),
    userId: v.id('users'),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Rate limit extraction per user
    const extractionLimit = await rateLimiter.limit(ctx, 'extraction', {
      key: args.userId,
    })
    if (!extractionLimit.ok) {
      // Reschedule for later if rate limited
      await ctx.scheduler.runAfter(
        extractionLimit.retryAfter,
        internal.extraction.extractAndEmbed,
        args,
      )
      return
    }

    // 2. Rate limit embedding per user
    const embeddingLimit = await rateLimiter.limit(ctx, 'embedding', {
      key: args.userId,
    })
    if (!embeddingLimit.ok) {
      await ctx.scheduler.runAfter(
        embeddingLimit.retryAfter,
        internal.extraction.extractAndEmbed,
        args,
      )
      return
    }

    // 3. Extract entities and relationships using generateText + Output.object
    const { output: extraction } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      output: Output.object({ schema: ExtractionSchema }),
      system: `Extract entities and relationships from user messages.
Rules:
- "user" is always a valid subject for user preferences/facts
- salience is how central the entity is (0-1)
- importance: personal info > preferences > facts > opinions > transient`,
      prompt: `Extract from: "${args.content}"`,
    })

    // 4. Generate embedding (CACHED via ActionCache)
    // If the same text was embedded before, returns cached result
    const embedding = await embeddingCache.fetch(ctx, { text: args.content })

    // 5. Create short-term memory
    await ctx.runMutation(internal.shortTerm.create, {
      sensoryMemoryId: args.sensoryMemoryId,
      content: args.content,
      summary: extraction.summary,
      embedding,
      entities: extraction.entities,
      relationships: extraction.relationships,
      importance: extraction.importance,
      userId: args.userId,
      threadId: args.threadId,
    })
  },
})
