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

const MAX_RETRIES = 3
const TOPIC_SIMILARITY_THRESHOLD = 0.82

export const extractAndEmbed = internalAction({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    content: v.string(),
    userId: v.id('users'),
    threadId: v.string(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const retryCount = args.retryCount ?? 0

    // 1. Rate limit extraction per user
    const extractionLimit = await rateLimiter.limit(ctx, 'extraction', {
      key: args.userId,
    })
    if (!extractionLimit.ok) {
      // Reschedule for later if rate limited
      await ctx.scheduler.runAfter(
        extractionLimit.retryAfter,
        internal.extraction.extractAndEmbed,
        { ...args, retryCount },
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
        { ...args, retryCount },
      )
      return
    }

    try {
      // 3. Extract entities and relationships using generateText + Output.object
      const { output: extraction } = await generateText({
        model: anthropic('claude-haiku-4-5'),
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

      // 5. Find existing topic via vector search (only available in actions)
      let existingTopicId: string | null = null
      const searchResults = await ctx.vectorSearch(
        'shortTermMemories',
        'embedding_idx',
        {
          vector: embedding,
          filter: (q: any) => q.eq('userId', args.userId),
          limit: 3,
        },
      )

      // Find a similar memory with high enough score
      for (const result of searchResults) {
        if (result._score >= TOPIC_SIMILARITY_THRESHOLD) {
          // Fetch the full document to get topicId
          const memory = await ctx.runQuery(internal.shortTerm.get, {
            id: result._id,
          })
          if (memory && memory.topicId) {
            existingTopicId = memory.topicId
            break
          }
        }
      }

      // 6. Create short-term memory (mutation will create new topic if none found)
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
        existingTopicId,
      })
    } catch (error) {
      console.error(
        `Extraction failed for sensory ${args.sensoryMemoryId}:`,
        error,
      )

      // Retry with exponential backoff for transient errors
      if (retryCount < MAX_RETRIES) {
        const backoffMs = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        console.log(
          `Retrying extraction (attempt ${retryCount + 1}/${MAX_RETRIES}) in ${backoffMs}ms`,
        )
        await ctx.scheduler.runAfter(
          backoffMs,
          internal.extraction.extractAndEmbed,
          { ...args, retryCount: retryCount + 1 },
        )
        return
      }

      // Max retries exceeded - mark sensory memory as failed
      console.error(
        `Extraction permanently failed for sensory ${args.sensoryMemoryId} after ${MAX_RETRIES} retries`,
      )
      await ctx.runMutation(internal.sensory.markExtractionFailed, {
        sensoryMemoryId: args.sensoryMemoryId,
        reason:
          error instanceof Error ? error.message : 'Unknown extraction error',
      })
    }
  },
})
