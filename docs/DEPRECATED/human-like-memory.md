# Building human-like memory for AI agents in TypeScript

A sophisticated memory system transforms AI agents from stateless responders into contextually aware assistants that learn and evolve. After analyzing implementations from Mem0, Letta (MemGPT), Zep's Graphiti, and academic research, this guide provides concrete patterns for building your five-layer architecture using TypeScript, Convex, and Claude.

## The core insight: hybrid storage beats pure vectors

The most effective memory systems combine **three storage paradigms**: vector embeddings for semantic search, graph structures for relationship tracking, and structured documents for fast retrieval. Mem0's hybrid approach achieves **26% better accuracy** than OpenAI's baseline while using **90% fewer tokens**. Zep's Graphiti temporal knowledge graph reaches **94.8% accuracy** on deep memory retrieval benchmarks with sub-200ms latency.

Your implementation should store memories as structured Convex documents with embedded vectors, using adjacency patterns for graph relationships. This avoids external graph database dependencies while preserving relationship semantics.

## Schema design for five memory layers

The foundation is a well-designed Convex schema that maps directly to your architecture:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Layer 1: Sensory Memory - raw, unprocessed inputs
  sensoryMemories: defineTable({
    content: v.string(),
    inputType: v.union(v.literal('message'), v.literal('event')),
    relevanceScore: v.optional(v.float64()),
    processed: v.boolean(),
    userId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_user_unprocessed', ['userId', 'processed'])
    .index('by_created', ['createdAt']),

  // Layer 2: Short-Term Memory - active conversation buffer
  shortTermMemories: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    topicId: v.optional(v.string()),
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        attributes: v.optional(v.any()),
      }),
    ),
    importance: v.float64(),
    accessCount: v.number(),
    conversationId: v.string(),
    userId: v.id('users'),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_user_topic', ['userId', 'topicId'])
    .index('by_expiry', ['expiresAt'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'topicId'],
    }),

  // Layer 3: Long-Term Memory - consolidated knowledge graph
  longTermMemories: defineTable({
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),
    entityType: v.optional(v.string()),
    importance: v.float64(),
    effectiveImportance: v.float64(), // After decay
    accessCount: v.number(),
    lastAccessed: v.number(),
    consolidatedFrom: v.optional(v.array(v.id('shortTermMemories'))),
    userId: v.id('users'),
    tValid: v.number(), // When fact became valid
    tInvalid: v.optional(v.number()), // When superseded
    createdAt: v.number(),
  })
    .index('by_user', ['userId', 'effectiveImportance'])
    .index('by_entity', ['entityType', 'userId'])
    .index('by_access', ['lastAccessed'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'entityType'],
    }),

  // Graph edges for relationships
  memoryEdges: defineTable({
    sourceId: v.id('longTermMemories'),
    targetId: v.id('longTermMemories'),
    relationType: v.string(),
    fact: v.string(),
    embedding: v.array(v.float64()),
    strength: v.float64(),
    userId: v.id('users'),
    tValid: v.number(),
    tInvalid: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_source', ['sourceId'])
    .index('by_target', ['targetId'])
    .index('by_user_relation', ['userId', 'relationType'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'relationType'],
    }),

  // Layer 5: Core Memory - identity and stable preferences
  coreMemories: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    category: v.union(
      v.literal('identity'),
      v.literal('preference'),
      v.literal('relationship'),
      v.literal('behavioral'),
    ),
    confidence: v.float64(),
    sourceMemories: v.array(v.id('longTermMemories')),
    userId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_category', ['userId', 'category'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'category'],
    }),
})
```

## Sensory memory: filtering signal from noise

The sensory layer captures raw input and determines what deserves attention. Use **LLM-based relevance scoring** combined with heuristics for efficiency—score only potentially important content:

```typescript
// convex/sensory.ts
import { mutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

export const ingestMessage = mutation({
  args: {
    content: v.string(),
    userId: v.id('users'),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Quick heuristic pre-filter
    const quickScore = heuristicRelevance(args.content)

    const memoryId = await ctx.db.insert('sensoryMemories', {
      content: args.content,
      inputType: 'message',
      relevanceScore: quickScore,
      processed: false,
      userId: args.userId,
      createdAt: Date.now(),
    })

    // Only process potentially relevant content
    if (quickScore > 0.3) {
      await ctx.scheduler.runAfter(0, internal.sensory.processForShortTerm, {
        memoryId,
        conversationId: args.conversationId,
      })
    } else {
      // Mark low-relevance as processed, skip further processing
      await ctx.db.patch(memoryId, { processed: true })
    }

    return memoryId
  },
})

function heuristicRelevance(content: string): number {
  let score = 0.5

  // Boost for personal information indicators
  const personalIndicators = [
    /\b(i am|i'm|my name|i work|i live|i prefer|i like|i hate)\b/i,
    /\b(always|never|usually|every time)\b/i,
    /\b(important|remember|don't forget)\b/i,
  ]
  personalIndicators.forEach((p) => {
    if (p.test(content)) score += 0.15
  })

  // Boost for named entities (capitalized words mid-sentence)
  const namedEntities = content.match(/\b[A-Z][a-z]+\b/g) || []
  score += Math.min(0.2, namedEntities.length * 0.05)

  // Penalize very short or generic content
  if (content.length < 20) score -= 0.3
  if (/^(ok|thanks|yes|no|sure|got it)$/i.test(content.trim())) score -= 0.4

  return Math.max(0, Math.min(1, score))
}
```

## Short-term memory with entity extraction

The short-term layer uses Claude to extract structured entities and relationships. This is where **Mem0's pattern shines**—extract candidates, then decide whether to ADD, UPDATE, DELETE, or NOOP against existing memories:

```typescript
// convex/shortTerm.ts
import { internalAction, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { generateObject, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const ExtractionSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum([
        'person',
        'organization',
        'place',
        'concept',
        'preference',
      ]),
      attributes: z.record(z.string()).optional(),
    }),
  ),
  topics: z.array(z.string()),
  relationships: z.array(
    z.object({
      subject: z.string(),
      predicate: z.string(),
      object: z.string(),
    }),
  ),
  importance: z.number().min(1).max(10),
  summary: z.string(),
})

export const processForShortTerm = internalAction({
  args: {
    memoryId: v.id('sensoryMemories'),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const sensory = await ctx.runQuery(internal.queries.getSensoryMemory, {
      id: args.memoryId,
    })
    if (!sensory) return

    // Get recent conversation context
    const recentMemories = await ctx.runQuery(
      internal.queries.getRecentShortTerm,
      {
        conversationId: args.conversationId,
        limit: 5,
      },
    )

    const contextStr = recentMemories.map((m) => m.content).join('\n')

    // Extract entities and assess importance
    const { object: extraction } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: ExtractionSchema,
      prompt: `Extract entities, topics, and relationships from this message in context.

Previous conversation:
${contextStr}

New message:
"${sensory.content}"

Rate importance 1-10 where:
- 1-3: Mundane, forgettable
- 4-6: Moderately useful context  
- 7-10: Important facts, preferences, or identity information`,
    })

    // Generate embedding
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: extraction.summary,
    })

    // Determine topic grouping
    const topicId = extraction.topics[0] || 'general'

    // Store in short-term memory
    await ctx.runMutation(internal.shortTerm.createShortTermMemory, {
      content: sensory.content,
      embedding,
      topicId,
      entities: extraction.entities,
      importance: extraction.importance / 10,
      conversationId: args.conversationId,
      userId: sensory.userId,
      relationships: extraction.relationships,
    })

    // Mark sensory as processed
    await ctx.runMutation(internal.sensory.markProcessed, {
      id: args.memoryId,
    })
  },
})
```

## Long-term memory with graph structure

Long-term storage uses the **adjacency list pattern** for graph relationships without requiring an external graph database. Graphiti's **bi-temporal model** tracks both when facts occurred and when they were learned:

```typescript
// convex/longTerm.ts
import { mutation, query, internalAction } from './_generated/server'
import { v } from 'convex/values'

// Memory retrieval with graph expansion
export const searchWithGraph = internalAction({
  args: {
    query: v.string(),
    userId: v.id('users'),
    includeRelated: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: args.query,
    })

    // Vector search on memories
    const memoryHits = await ctx.vectorSearch(
      'longTermMemories',
      'embedding_idx',
      {
        vector: embedding,
        limit: args.limit ?? 10,
        filter: (q) => q.eq('userId', args.userId),
      },
    )

    // Vector search on relationship facts
    const edgeHits = await ctx.vectorSearch('memoryEdges', 'embedding_idx', {
      vector: embedding,
      limit: 10,
      filter: (q) => q.eq('userId', args.userId),
    })

    let results = {
      memories: await ctx.runQuery(internal.queries.getMemoriesByIds, {
        ids: memoryHits.map((h) => h._id),
      }),
      facts: edgeHits.map((e) => e.fact),
    }

    // Graph expansion from top hits
    if (args.includeRelated && memoryHits.length > 0) {
      const relatedIds = new Set<string>()

      for (const hit of memoryHits.slice(0, 3)) {
        const edges = await ctx.runQuery(internal.queries.getEdgesForMemory, {
          memoryId: hit._id,
        })
        edges.forEach((e) => {
          relatedIds.add(e.sourceId)
          relatedIds.add(e.targetId)
        })
      }

      const relatedMemories = await ctx.runQuery(
        internal.queries.getMemoriesByIds,
        {
          ids: Array.from(relatedIds).filter(
            (id) => !memoryHits.some((h) => h._id === id),
          ),
        },
      )

      results.memories = [...results.memories, ...relatedMemories]
    }

    // Update access counts for retrieved memories
    await ctx.runMutation(internal.longTerm.updateAccessCounts, {
      ids: results.memories.map((m) => m._id),
    })

    return results
  },
})

// Create or update relationship edge
export const upsertEdge = internalMutation({
  args: {
    sourceId: v.id('longTermMemories'),
    targetId: v.id('longTermMemories'),
    relationType: v.string(),
    fact: v.string(),
    embedding: v.array(v.float64()),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Check for existing edge
    const existing = await ctx.db
      .query('memoryEdges')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .filter((q) =>
        q.and(
          q.eq(q.field('targetId'), args.targetId),
          q.eq(q.field('relationType'), args.relationType),
          q.eq(q.field('tInvalid'), undefined),
        ),
      )
      .first()

    const now = Date.now()

    if (existing) {
      // Invalidate old edge, create new one (temporal tracking)
      await ctx.db.patch(existing._id, { tInvalid: now })
    }

    await ctx.db.insert('memoryEdges', {
      ...args,
      strength: existing ? Math.min(1, existing.strength + 0.1) : 0.5,
      tValid: now,
      createdAt: now,
    })
  },
})
```

## Memory managers: scheduled consolidation cycles

The "sleep cycle" pattern uses Convex scheduled functions for background memory management. This follows **Letta's sleep-time compute** concept—perform expensive operations when the user isn't waiting:

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Hourly: Promote important short-term to long-term
crons.interval(
  'consolidate_memories',
  { minutes: 60 },
  internal.managers.consolidateShortTerm,
)

// Every 15 minutes: Apply importance decay
crons.interval('apply_decay', { minutes: 15 }, internal.managers.applyDecay)

// Daily at 3am: Deep reflection and core memory updates
crons.daily(
  'daily_reflection',
  { hourUTC: 3, minuteUTC: 0 },
  internal.managers.generateReflections,
)

// Weekly: Prune low-importance memories
crons.weekly(
  'weekly_prune',
  { dayOfWeek: 'sunday', hourUTC: 4, minuteUTC: 0 },
  internal.managers.pruneMemories,
)

export default crons
```

```typescript
// convex/managers.ts
import { internalMutation, internalAction } from './_generated/server'

// Promote persistent topics to long-term memory
export const consolidateShortTerm = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()

    // Find short-term memories ready for promotion
    const candidates = await ctx.db
      .query('shortTermMemories')
      .filter((q) =>
        q.and(
          q.gte(q.field('importance'), 0.6),
          q.gte(q.field('accessCount'), 2),
          q.lt(q.field('createdAt'), now - 3600000), // At least 1 hour old
        ),
      )
      .take(50)

    for (const memory of candidates) {
      // Check if similar long-term memory exists
      const existing = await findSimilarLongTerm(ctx, memory)

      if (existing) {
        // Merge: Update existing memory
        await ctx.db.patch(existing._id, {
          content: `${existing.content}\n\nAdditional context: ${memory.content}`,
          importance: Math.min(1, existing.importance + 0.1),
          accessCount: existing.accessCount + memory.accessCount,
          lastAccessed: now,
        })
      } else {
        // Promote: Create new long-term memory
        await ctx.db.insert('longTermMemories', {
          content: memory.content,
          embedding: memory.embedding,
          importance: memory.importance,
          effectiveImportance: memory.importance,
          accessCount: memory.accessCount,
          lastAccessed: now,
          consolidatedFrom: [memory._id],
          userId: memory.userId,
          tValid: memory.createdAt,
          createdAt: now,
        })
      }
    }

    // Clean up expired short-term memories
    const expired = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_expiry', (q) => q.lt('expiresAt', now))
      .take(100)

    for (const memory of expired) {
      await ctx.db.delete(memory._id)
    }
  },
})

// Apply exponential decay to importance scores (Park et al. pattern)
export const applyDecay = internalMutation({
  handler: async (ctx) => {
    const DECAY_FACTOR = 0.995 // Per-hour decay
    const now = Date.now()

    const memories = await ctx.db.query('longTermMemories').take(500)

    for (const memory of memories) {
      const hoursSinceAccess = (now - memory.lastAccessed) / 3600000
      const decayed =
        memory.importance * Math.pow(DECAY_FACTOR, hoursSinceAccess)

      await ctx.db.patch(memory._id, {
        effectiveImportance: Math.max(0.01, decayed),
      })
    }
  },
})

// Generate reflections from recent high-importance memories
export const generateReflections = internalAction({
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.queries.getActiveUsers, {})

    for (const user of users) {
      const recentMemories = await ctx.runQuery(
        internal.queries.getRecentLongTerm,
        {
          userId: user._id,
          limit: 50,
        },
      )

      if (recentMemories.length < 10) continue

      // Generate reflection questions
      const { object: questions } = await generateObject({
        model: anthropic('claude-sonnet-4-20250514'),
        schema: z.object({
          questions: z.array(z.string()).max(3),
        }),
        prompt: `Based on these recent memories, generate 3 high-level questions 
that would help synthesize insights about the user:

${recentMemories.map((m) => `- ${m.content}`).join('\n')}`,
      })

      // For each question, generate insight and potentially update core memory
      for (const question of questions.questions) {
        const relevant = await ctx.runAction(
          internal.longTerm.searchWithGraph,
          {
            query: question,
            userId: user._id,
            includeRelated: true,
            limit: 20,
          },
        )

        const { object: insight } = await generateObject({
          model: anthropic('claude-sonnet-4-20250514'),
          schema: z.object({
            insight: z.string(),
            isCoreTrait: z.boolean(),
            category: z.enum([
              'identity',
              'preference',
              'relationship',
              'behavioral',
            ]),
            confidence: z.number().min(0).max(1),
          }),
          prompt: `Question: ${question}

Relevant memories:
${relevant.memories.map((m) => `- ${m.content}`).join('\n')}

Generate a high-level insight. Mark as core trait if it represents a 
stable aspect of the user's identity or preferences (not temporary states).`,
        })

        // Store significant insights as core memories
        if (insight.isCoreTrait && insight.confidence > 0.7) {
          await ctx.runMutation(internal.core.createOrUpdateCore, {
            content: insight.insight,
            category: insight.category,
            confidence: insight.confidence,
            userId: user._id,
            sourceMemories: relevant.memories.map((m) => m._id),
          })
        }
      }
    }
  },
})
```

## Importance scoring: the three-factor formula

The **Park et al. scoring function** from the "Generative Agents" paper combines recency, importance, and relevance. This is the gold standard for memory retrieval ranking:

```typescript
// convex/scoring.ts
interface ScoringConfig {
  recencyWeight: number
  importanceWeight: number
  relevanceWeight: number
  decayFactor: number
}

const DEFAULT_CONFIG: ScoringConfig = {
  recencyWeight: 0.3,
  importanceWeight: 0.3,
  relevanceWeight: 0.4,
  decayFactor: 0.995, // Per-hour decay
}

export function calculateRetrievalScore(
  memory: {
    lastAccessed: number
    importance: number
    embeddingScore: number
  },
  config = DEFAULT_CONFIG,
): number {
  const now = Date.now()
  const hoursSinceAccess = (now - memory.lastAccessed) / 3600000

  // Recency: exponential decay
  const recencyScore = Math.pow(config.decayFactor, hoursSinceAccess)

  // Importance: raw importance value (0-1)
  const importanceScore = memory.importance

  // Relevance: embedding similarity (0-1)
  const relevanceScore = memory.embeddingScore

  // Weighted combination
  return (
    config.recencyWeight * recencyScore +
    config.importanceWeight * importanceScore +
    config.relevanceWeight * relevanceScore
  )
}

// LLM-based importance assessment for new memories
export async function assessImportance(
  content: string,
  coreMemories: { content: string; category: string }[],
): Promise<number> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: z.object({
      score: z.number().min(1).max(10),
      reasoning: z.string(),
    }),
    prompt: `Rate importance of this information (1-10):

"${content}"

User's known core traits:
${coreMemories.map((m) => `- ${m.category}: ${m.content}`).join('\n')}

Scale:
1-3: Mundane, forgettable (small talk, acknowledgments)
4-6: Contextually useful (ongoing topics, temporary preferences)
7-10: Significant (identity facts, stable preferences, important events)`,
  })

  return object.score / 10
}
```

## Vercel AI SDK integration pattern

Tie everything together with a memory-aware agent that injects context before each response:

```typescript
// lib/agent.ts
import { streamText, generateObject, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function chatWithMemory(
  message: string,
  userId: string,
  conversationId: string,
) {
  // 1. Ingest the new message
  await convex.mutation(api.sensory.ingestMessage, {
    content: message,
    userId,
    conversationId,
  })

  // 2. Retrieve relevant memories
  const [coreMemories, relevantMemories] = await Promise.all([
    convex.query(api.core.getCoreMemories, { userId }),
    convex.action(api.longTerm.searchWithGraph, {
      query: message,
      userId,
      includeRelated: true,
      limit: 10,
    }),
  ])

  // 3. Build memory-enhanced system prompt
  const systemPrompt = buildSystemPrompt(coreMemories, relevantMemories)

  // 4. Stream response with memory tools available
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
    tools: {
      rememberFact: tool({
        description:
          'Store an important fact about the user for future reference',
        parameters: z.object({
          fact: z.string().describe('The fact to remember'),
          category: z.enum(['preference', 'identity', 'relationship']),
        }),
        execute: async ({ fact, category }) => {
          await convex.mutation(api.core.addCoreMemory, {
            content: fact,
            category,
            userId,
          })
          return `Remembered: ${fact}`
        },
      }),
      recallMemories: tool({
        description: 'Search for specific memories about a topic',
        parameters: z.object({
          query: z.string().describe('What to search for'),
        }),
        execute: async ({ query }) => {
          const results = await convex.action(api.longTerm.searchWithGraph, {
            query,
            userId,
            includeRelated: false,
            limit: 5,
          })
          return results.memories.map((m) => m.content).join('\n')
        },
      }),
    },
  })

  return result
}

function buildSystemPrompt(
  coreMemories: CoreMemory[],
  relevantMemories: { memories: Memory[]; facts: string[] },
): string {
  const coreSection =
    coreMemories.length > 0
      ? `<core_memory>
${coreMemories.map((m) => `[${m.category}] ${m.content}`).join('\n')}
</core_memory>`
      : ''

  const contextSection =
    relevantMemories.memories.length > 0
      ? `<relevant_context>
${relevantMemories.memories.map((m) => m.content).join('\n')}

Related facts:
${relevantMemories.facts.join('\n')}
</relevant_context>`
      : ''

  return `You are a helpful assistant with persistent memory. 
You remember things about users across conversations.

${coreSection}

${contextSection}

Use the rememberFact tool when the user shares important personal information.
Use the recallMemories tool when you need to look up specific past information.`
}
```

## Key implementation decisions

| Component                   | Recommendation                       | Rationale                                      |
| --------------------------- | ------------------------------------ | ---------------------------------------------- |
| **Embedding model**         | text-embedding-3-small (1536d)       | Best cost/quality ratio, native Convex support |
| **Graph storage**           | Adjacency list in Convex             | No external dependencies, sufficient for MVP   |
| **Importance scoring**      | Hybrid: heuristics + LLM             | Fast filtering, accurate assessment            |
| **Consolidation frequency** | Hourly short→long, daily reflections | Balances freshness with compute cost           |
| **Decay function**          | 0.995^hours (weekly half-life ~138h) | Matches human memory curves                    |

## What the frameworks teach us

**Mem0** demonstrates that the ADD/UPDATE/DELETE/NOOP pattern for memory operations—comparing new information against existing memories and choosing an action—prevents redundancy and maintains coherence. Their **90% token savings** come from intelligent retrieval rather than dumping everything into context.

**Letta/MemGPT** proves that agents can self-manage memory through tool calls. Their **memory_rethink** operation—where the agent reorganizes its own memory blocks—enables emergent memory organization that adapts to each user.

**Zep's Graphiti** shows that **bi-temporal tracking** (event time vs. ingestion time) is essential for temporal reasoning. Knowing both when something happened and when you learned it enables queries like "what did we know last Tuesday?" that pure vector stores can't answer.

The **Park et al. reflection mechanism**—triggering synthesis when cumulative importance exceeds a threshold—produces higher-level insights that simple summarization misses. Their agents generated emergent social behaviors purely from memory-driven reflections.

## Starting your MVP

Begin with a minimal viable memory by implementing just three components: sensory ingestion with basic filtering, short-term storage with embeddings and entity extraction, and a single scheduled consolidation job. Add graph relationships and core memory evolution once the basic flow works.

The memory system should be invisible when working well—users simply notice that the AI "remembers" without ever being told to remember. The goal isn't to build the most sophisticated architecture immediately, but to create a foundation that can evolve. Start simple, measure what matters (retrieval relevance, context utilization, user satisfaction), and add complexity where it demonstrably helps.
