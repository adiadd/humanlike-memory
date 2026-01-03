# Human-Like Memory for AI Agents: MVP Implementation

> _"Memory is not retrieval. Memory is cognition."_

---

## Executive Summary

This document provides a complete implementation blueprint for building human-like memory in AI agents using **TanStack Start + Convex + Convex Components + Vercel AI SDK** + **Shadcn/UI**.

The system implements five interconnected memory layers inspired by human cognition:

1. **Sensory Memory** - Filters noise, extracts entities, passes salient content forward
2. **Short-Term Memory** - Buffer for active topics, groups related messages
3. **Long-Term Memory** - Consolidated knowledge organized by entity and topic
4. **Memory Managers** - Background processes that promote, decay, and prune memories
5. **Core Memory** - Stable identity facts, always included in context

### Convex Components Used

| Component                  | Purpose                                      | Priority |
| -------------------------- | -------------------------------------------- | -------- |
| `@convex-dev/agent`        | Thread/message management, tool calling, RAG | Core     |
| `@convex-dev/workflow`     | Durable memory consolidation pipelines       | High     |
| `@convex-dev/action-cache` | Cache embeddings to reduce API costs         | High     |
| `@convex-dev/rate-limiter` | Protect LLM APIs, control costs              | High     |
| `@convex-dev/aggregate`    | O(log n) memory counts/stats per user        | Medium   |

---

## Part 1: The Five-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                     │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     1. SENSORY MEMORY                                 │  │
│  │                                                                       │  │
│  │   Purpose: Gate-keep what enters the memory system                    │  │
│  │   Lifespan: Seconds (processed immediately or discarded)              │  │
│  │                                                                       │  │
│  │   • Capture raw input with metadata                                   │  │
│  │   • Score attention worthiness (heuristics)                           │  │
│  │   • Extract initial entities for routing                              │  │
│  │   • Pass/fail decision: score >= 0.3 continues                        │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   2. SHORT-TERM MEMORY                                │  │
│  │                                                                       │  │
│  │   Purpose: Active working memory for current context                  │  │
│  │   Lifespan: Hours (expires or promotes to LTM)                        │  │
│  │                                                                       │  │
│  │   • Buffer for active reasoning and conversation                      │  │
│  │   • Group messages by topic (embedding similarity)                    │  │
│  │   • Track importance and access patterns                              │  │
│  │   • Candidates for promotion if importance persists                   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   3. LONG-TERM MEMORY                                 │  │
│  │                                                                       │  │
│  │   Purpose: Persistent knowledge                                       │  │
│  │   Lifespan: Days to months (decays, can be pruned)                    │  │
│  │                                                                       │  │
│  │   • Semantic memories: Facts, concepts, skills                        │  │
│  │   • Episodic memories: Experiences, events, conversations             │  │
│  │   • Knowledge graph: Entity relationships                             │  │
│  │   • Deduplication on insert (cosine similarity > 0.95)                │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      5. CORE MEMORY                                   │  │
│  │                                                                       │  │
│  │   Purpose: Stable identity, always in context                         │  │
│  │   Lifespan: Persistent, slow-evolving                                 │  │
│  │                                                                       │  │
│  │   • Identity: "User is a software engineer in Bangalore"              │  │
│  │   • Preferences: "User prefers concise, technical responses"          │  │
│  │   • Behavioral: "User typically works late evenings"                  │  │
│  │   • Relationships: "User has a dog named Max"                         │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │  4. MEMORY MANAGERS (Background)     │
                    │                                      │
                    │  Consolidation:                      │
                    │  • Promote: STM → LTM (hourly)       │
                    │  • Decay: Apply forgetting curve     │
                    │  • Prune: Delete low-importance      │
                    │                                      │
                    │  Reflection:                         │
                    │  • Detect patterns in LTM            │
                    │  • Promote patterns → Core           │
                    │                                      │
                    │         [RUNS VIA CRON JOBS]         │
                    └──────────────────────────────────────┘
```

---

## Part 2: Schema Design

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ============================================
  // USERS
  // Threads & messages managed by Agent component
  // ============================================

  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
  }),

  // ============================================
  // LAYER 1: SENSORY MEMORY
  // Brief input buffer, filters noise before processing
  // ============================================

  sensoryMemories: defineTable({
    content: v.string(),
    contentHash: v.string(),
    inputType: v.union(
      v.literal('message'),
      v.literal('event'),
      v.literal('observation'),
    ),

    // Attention scoring (0-1)
    attentionScore: v.float64(),

    // Processing state
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('promoted'),
      v.literal('discarded'),
    ),
    discardReason: v.optional(v.string()),

    // Ownership
    userId: v.id('users'),
    threadId: v.optional(v.string()), // Agent component thread ID

    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index('by_user_status', ['userId', 'status', 'createdAt'])
    .index('by_thread', ['threadId', 'createdAt'])
    .index('by_hash', ['userId', 'contentHash']),

  // ============================================
  // LAYER 2: SHORT-TERM MEMORY
  // Active context buffer, grouped by topic
  // ============================================

  shortTermMemories: defineTable({
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),

    // Topic clustering
    topicId: v.optional(v.id('topics')),

    // Extracted entities
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        salience: v.float64(),
      }),
    ),

    // Extracted relationships
    relationships: v.array(
      v.object({
        subject: v.string(),
        predicate: v.string(),
        object: v.string(),
        confidence: v.float64(),
      }),
    ),

    // Importance tracking
    importance: v.float64(),
    accessCount: v.number(),
    lastAccessed: v.number(),

    // Lifecycle
    expiresAt: v.number(),

    // Lineage
    sourceId: v.id('sensoryMemories'),
    threadId: v.string(), // Agent component thread ID
    userId: v.id('users'),

    createdAt: v.number(),
  })
    .index('by_thread', ['threadId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt'])
    .index('by_user_importance', ['userId', 'importance'])
    .index('by_expiry', ['expiresAt'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId'],
    }),

  // Topic registry for clustering
  topics: defineTable({
    userId: v.id('users'),
    label: v.string(),
    centroid: v.array(v.float64()),
    memberCount: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  // ============================================
  // LAYER 3: LONG-TERM MEMORY
  // Consolidated knowledge
  // ============================================

  longTermMemories: defineTable({
    content: v.string(),
    summary: v.string(),
    embedding: v.array(v.float64()),

    // Memory classification
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    category: v.optional(v.string()),

    // Entity reference
    entityName: v.optional(v.string()),
    entityType: v.optional(v.string()),

    // Importance with decay
    baseImportance: v.float64(),
    currentImportance: v.float64(),
    stability: v.float64(), // 1-1000, higher = slower decay

    // Access tracking
    accessCount: v.number(),
    lastAccessed: v.number(),

    // Reinforcement
    reinforcementCount: v.number(),

    // Lineage
    consolidatedFrom: v.array(v.id('shortTermMemories')),

    // Ownership
    userId: v.id('users'),

    // Soft delete
    isActive: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId', 'isActive', 'currentImportance'])
    .index('by_user_type', ['userId', 'memoryType', 'isActive'])
    .index('by_entity', ['userId', 'entityType', 'entityName'])
    .index('by_access', ['userId', 'lastAccessed'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'memoryType', 'isActive'],
    }),

  // ============================================
  // KNOWLEDGE GRAPH: EDGES
  // Relationships between entities
  // ============================================

  memoryEdges: defineTable({
    // Source entity
    sourceName: v.string(),
    sourceType: v.string(),

    // Target entity
    targetName: v.string(),
    targetType: v.string(),

    // Relationship
    relationType: v.string(),
    fact: v.string(),
    embedding: v.array(v.float64()),

    // Strength and confidence
    strength: v.float64(),

    // Ownership
    userId: v.id('users'),

    isActive: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_source', ['userId', 'sourceName'])
    .index('by_target', ['userId', 'targetName'])
    .index('by_relation', ['userId', 'relationType'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'relationType'],
    }),

  // ============================================
  // LAYER 5: CORE MEMORY
  // Stable identity, always in context
  // ============================================

  coreMemories: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),

    // Classification
    category: v.union(
      v.literal('identity'),
      v.literal('preference'),
      v.literal('relationship'),
      v.literal('behavioral'),
      v.literal('goal'),
      v.literal('constraint'),
    ),

    // Confidence and evidence
    confidence: v.float64(),
    evidenceCount: v.number(),

    // Ownership
    userId: v.id('users'),

    // Active status
    isActive: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId', 'isActive'])
    .index('by_user_category', ['userId', 'category', 'isActive'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'category'],
    }),

  // ============================================
  // LAYER 4: MEMORY MANAGEMENT LOGS
  // ============================================

  consolidationLogs: defineTable({
    userId: v.optional(v.id('users')),
    runType: v.union(
      v.literal('promotion'),
      v.literal('decay'),
      v.literal('pruning'),
      v.literal('reflection'),
      v.literal('cleanup'),
    ),
    memoriesProcessed: v.number(),
    memoriesPromoted: v.number(),
    memoriesPruned: v.number(),
    duration: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),

  reflections: defineTable({
    userId: v.id('users'),
    insight: v.string(),
    insightType: v.union(
      v.literal('pattern'),
      v.literal('trend'),
      v.literal('gap'),
    ),
    supportingMemoryCount: v.number(),
    confidence: v.float64(),
    actionTaken: v.optional(
      v.union(
        v.literal('promoted_to_core'),
        v.literal('flagged_for_review'),
        v.literal('none'),
      ),
    ),
    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),
})
```

---

## Part 3: Convex Components Setup

### Installation

```bash
bun add @convex-dev/agent @convex-dev/workflow @convex-dev/action-cache @convex-dev/rate-limiter @convex-dev/aggregate ai @ai-sdk/anthropic @ai-sdk/openai zod
```

### Component Registration

```typescript
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import agent from '@convex-dev/agent/convex.config'
import workflow from '@convex-dev/workflow/convex.config'
import actionCache from '@convex-dev/action-cache/convex.config'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import aggregate from '@convex-dev/aggregate/convex.config'

const app = defineApp()

// Core AI agent functionality
app.use(agent)

// Durable workflow execution for memory consolidation
app.use(workflow)

// Cache expensive LLM/embedding calls
app.use(actionCache)

// Rate limiting for LLM APIs
app.use(rateLimiter)

// Efficient memory statistics (counts, sums)
app.use(aggregate, { name: 'memoryStats' })

export default app
```

Run `npx convex dev` to generate the component code before defining agents.

### Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Model Recommendations

| Use Case          | Model                    | Notes                        |
| ----------------- | ------------------------ | ---------------------------- |
| Entity extraction | `claude-haiku-4-5`       | Fast, cost-effective         |
| Chat responses    | `claude-sonnet-4-5`      | Balanced quality/speed       |
| Embeddings        | `text-embedding-3-small` | 1536 dims, good cost/quality |

### Component Initialization

```typescript
// convex/components.ts
import { components } from './_generated/api'
import { WorkflowManager } from '@convex-dev/workflow'
import { ActionCache } from '@convex-dev/action-cache'
import { RateLimiter, MINUTE, HOUR } from '@convex-dev/rate-limiter'
import { TableAggregate } from '@convex-dev/aggregate'
import type { DataModel } from './_generated/dataModel'
import { internal } from './_generated/api'

// ============================================
// WORKFLOW MANAGER
// For durable memory consolidation pipelines
// ============================================
export const workflowManager = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  },
})

// ============================================
// ACTION CACHE
// Cache embeddings to reduce OpenAI API costs
// ============================================
export const embeddingCache = new ActionCache(components.actionCache, {
  action: internal.embedding.generateEmbedding,
  name: 'embeddings-v1',
  ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
})

// ============================================
// RATE LIMITER
// Protect LLM APIs and control costs
// ============================================
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-user extraction rate (entity extraction is expensive)
  extraction: {
    kind: 'token bucket',
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  // Per-user embedding rate
  embedding: {
    kind: 'token bucket',
    rate: 100,
    period: MINUTE,
    capacity: 20,
  },
  // Global LLM token budget (for reflection/consolidation)
  llmTokens: {
    kind: 'token bucket',
    rate: 50000,
    period: HOUR,
    capacity: 10000,
    shards: 5,
  },
  // Per-user chat messages
  chatMessages: {
    kind: 'token bucket',
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
})

// ============================================
// MEMORY STATISTICS AGGREGATE
// O(log n) counts and sums for memory stats
// ============================================
export const memoryStats = new TableAggregate<{
  Namespace: string // userId
  Key: [string, number] // [memoryType, importance]
  DataModel: DataModel
  TableName: 'longTermMemories'
}>(components.memoryStats, {
  namespace: (doc) => doc.userId,
  sortKey: (doc) => [doc.memoryType, doc.currentImportance],
  sumValue: (doc) => 1, // Count memories
})
```

---

## Part 4: Implementation Patterns

### Pattern 1: Sensory Memory - Attention Scoring

```typescript
// convex/sensory.ts
import { mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

const ATTENTION_THRESHOLD = 0.3

export const ingestMessage = mutation({
  args: {
    content: v.string(),
    userId: v.id('users'),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Check for duplicates (same content in last hour)
    const contentHash = hashContent(args.content)
    const duplicate = await ctx.db
      .query('sensoryMemories')
      .withIndex('by_hash', (q) =>
        q.eq('userId', args.userId).eq('contentHash', contentHash),
      )
      .filter((q) => q.gt(q.field('createdAt'), Date.now() - 3600000))
      .first()

    if (duplicate) {
      return { status: 'duplicate', id: duplicate._id }
    }

    // 2. Calculate attention score
    const attentionScore = calculateAttentionScore(args.content)

    // 3. Store in sensory memory
    const memoryId = await ctx.db.insert('sensoryMemories', {
      content: args.content,
      contentHash,
      inputType: 'message',
      attentionScore,
      status: attentionScore >= ATTENTION_THRESHOLD ? 'pending' : 'discarded',
      discardReason:
        attentionScore < ATTENTION_THRESHOLD
          ? `Low attention score: ${attentionScore.toFixed(2)}`
          : undefined,
      userId: args.userId,
      threadId: args.threadId,
      createdAt: Date.now(),
    })

    // 4. If passes threshold, schedule promotion to STM
    if (attentionScore >= ATTENTION_THRESHOLD) {
      await ctx.scheduler.runAfter(0, internal.shortTerm.promoteFromSensory, {
        sensoryMemoryId: memoryId,
      })
    }

    return { status: 'created', id: memoryId, attentionScore }
  },
})

function calculateAttentionScore(content: string): number {
  let score = 0.4 // Base score

  // Personal information patterns (+0.25)
  if (
    /\b(i am|i'm|my name|i work|i live|i prefer|i like|i hate|i need|i want)\b/i.test(
      content,
    )
  ) {
    score += 0.25
  }

  // Named entities (+0.15)
  if (
    (content.match(/(?<=[a-z]\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [])
      .length > 0
  ) {
    score += 0.15
  }

  // Temporal references (+0.1)
  if (
    /\b(yesterday|today|tomorrow|last week|next month|always|never|usually)\b/i.test(
      content,
    )
  ) {
    score += 0.1
  }

  // Length modifiers
  if (content.length >= 50) score += 0.15
  if (content.length < 20) score -= 0.3

  // Low-value patterns
  if (
    /^(ok|thanks|yes|no|sure|got it|okay|k|yep|nope)$/i.test(content.trim())
  ) {
    score -= 0.5
  }

  return Math.max(0, Math.min(1, score))
}

function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}
```

### Pattern 2: Entity Extraction with LLM (Rate Limited + Cached)

```typescript
// convex/embedding.ts
// Dedicated embedding action for caching
import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

export const generateEmbedding = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }): Promise<number[]> => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text,
    })
    return embedding
  },
})
```

```typescript
// convex/extraction.ts
import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
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

    // 3. Extract entities and relationships
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
    if (extraction) {
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
    }
  },
})
```

### Pattern 3: Short-Term Memory with Topic Clustering

```typescript
// convex/shortTerm.ts
import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

const TOPIC_SIMILARITY_THRESHOLD = 0.82
const STM_EXPIRY_HOURS = 4

export const promoteFromSensory = internalMutation({
  args: { sensoryMemoryId: v.id('sensoryMemories') },
  handler: async (ctx, args) => {
    const sensory = await ctx.db.get(args.sensoryMemoryId)
    if (!sensory || sensory.status !== 'pending') return

    await ctx.db.patch(args.sensoryMemoryId, { status: 'processing' })

    await ctx.scheduler.runAfter(0, internal.extraction.extractAndEmbed, {
      sensoryMemoryId: args.sensoryMemoryId,
      content: sensory.content,
      userId: sensory.userId,
      threadId: sensory.threadId!,
    })
  },
})

export const create = internalMutation({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        salience: v.float64(),
      }),
    ),
    relationships: v.array(
      v.object({
        subject: v.string(),
        predicate: v.string(),
        object: v.string(),
        confidence: v.float64(),
      }),
    ),
    importance: v.float64(),
    userId: v.id('users'),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find or create topic based on embedding similarity
    const topicId = await findOrCreateTopic(
      ctx,
      args.userId,
      args.embedding,
      args.entities,
    )

    // 2. Create STM entry
    const stmId = await ctx.db.insert('shortTermMemories', {
      content: args.content,
      summary: args.summary,
      embedding: args.embedding,
      topicId,
      entities: args.entities,
      relationships: args.relationships,
      importance: args.importance,
      accessCount: 1,
      lastAccessed: Date.now(),
      expiresAt: Date.now() + STM_EXPIRY_HOURS * 60 * 60 * 1000,
      sourceId: args.sensoryMemoryId,
      threadId: args.threadId,
      userId: args.userId,
      createdAt: Date.now(),
    })

    // 3. Update sensory memory status
    await ctx.db.patch(args.sensoryMemoryId, {
      status: 'promoted',
      processedAt: Date.now(),
    })

    return stmId
  },
})

async function findOrCreateTopic(
  ctx: any,
  userId: string,
  embedding: number[],
  entities: Array<{ name: string; type: string; salience: number }>,
) {
  // Search for similar STM to find existing topic
  const similar = await ctx.db
    .query('shortTermMemories')
    .withIndex('embedding_idx')
    .vectorSearch('embedding', embedding, {
      filter: (q: any) => q.eq('userId', userId),
      limit: 3,
    })

  for (const memory of similar) {
    if (memory._score >= TOPIC_SIMILARITY_THRESHOLD && memory.topicId) {
      // Update topic centroid
      const topic = await ctx.db.get(memory.topicId)
      if (topic) {
        const newCentroid = topic.centroid.map(
          (val: number, i: number) =>
            (val * topic.memberCount + embedding[i]) / (topic.memberCount + 1),
        )
        await ctx.db.patch(topic._id, {
          centroid: newCentroid,
          memberCount: topic.memberCount + 1,
        })
      }
      return memory.topicId
    }
  }

  // Create new topic
  const label =
    entities.length > 0 ? `${entities[0].type}: ${entities[0].name}` : 'General'

  return await ctx.db.insert('topics', {
    userId,
    label,
    centroid: embedding,
    memberCount: 1,
    createdAt: Date.now(),
  })
}

export const byThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('shortTermMemories')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(20)
  },
})
```

### Pattern 4: Long-Term Memory with Deduplication

```typescript
// convex/longTerm.ts
import { internalMutation, internalAction, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { memoryStats } from './components'

const DEDUP_SIMILARITY_THRESHOLD = 0.95

export const consolidateFromSTM = internalAction({
  args: {
    stmId: v.id('shortTermMemories'),
  },
  handler: async (ctx, args) => {
    const stm = await ctx.runQuery(internal.shortTerm.get, { id: args.stmId })
    if (!stm) return

    // Check for duplicates via vector similarity
    const similar = await ctx.runQuery(internal.longTerm.searchSimilar, {
      userId: stm.userId,
      embedding: stm.embedding,
      limit: 3,
    })

    // If too similar to existing, skip (deduplication)
    for (const existing of similar) {
      if (existing._score >= DEDUP_SIMILARITY_THRESHOLD) {
        // Reinforce existing memory instead
        await ctx.runMutation(internal.longTerm.reinforce, {
          memoryId: existing._id,
        })
        return { action: 'reinforced', existingId: existing._id }
      }
    }

    // Create new LTM
    await ctx.runMutation(internal.longTerm.create, {
      content: stm.content,
      summary: stm.summary || stm.content.slice(0, 200),
      embedding: stm.embedding,
      memoryType: 'semantic',
      baseImportance: stm.importance,
      entityName: stm.entities[0]?.name,
      entityType: stm.entities[0]?.type,
      userId: stm.userId,
      consolidatedFrom: [args.stmId],
    })

    return { action: 'created' }
  },
})

export const create = internalMutation({
  args: {
    content: v.string(),
    summary: v.string(),
    embedding: v.array(v.float64()),
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    baseImportance: v.float64(),
    entityName: v.optional(v.string()),
    entityType: v.optional(v.string()),
    userId: v.id('users'),
    consolidatedFrom: v.array(v.id('shortTermMemories')),
  },
  handler: async (ctx, args) => {
    // Insert memory
    const id = await ctx.db.insert('longTermMemories', {
      content: args.content,
      summary: args.summary,
      embedding: args.embedding,
      memoryType: args.memoryType,
      baseImportance: args.baseImportance,
      currentImportance: args.baseImportance,
      stability: 100,
      accessCount: 0,
      lastAccessed: Date.now(),
      reinforcementCount: 1,
      entityName: args.entityName,
      entityType: args.entityType,
      userId: args.userId,
      consolidatedFrom: args.consolidatedFrom,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // IMPORTANT: Sync with aggregate for O(log n) stats
    const doc = await ctx.db.get(id)
    if (doc) {
      await memoryStats.insert(ctx, doc)
    }

    return id
  },
})

export const reinforce = internalMutation({
  args: { memoryId: v.id('longTermMemories') },
  handler: async (ctx, args) => {
    const oldDoc = await ctx.db.get(args.memoryId)
    if (!oldDoc) return

    await ctx.db.patch(args.memoryId, {
      reinforcementCount: oldDoc.reinforcementCount + 1,
      currentImportance: Math.min(1, oldDoc.currentImportance + 0.05),
      stability: Math.min(1000, oldDoc.stability + 10),
      updatedAt: Date.now(),
    })

    // Sync aggregate on importance change
    const newDoc = await ctx.db.get(args.memoryId)
    if (newDoc) {
      await memoryStats.replace(ctx, oldDoc, newDoc)
    }
  },
})

export const searchSimilar = query({
  args: {
    userId: v.id('users'),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('longTermMemories')
      .withIndex('embedding_idx')
      .vectorSearch('embedding', args.embedding, {
        filter: (q) => q.eq('userId', args.userId).eq('isActive', true),
        limit: args.limit,
      })
  },
})

export const deleteMemory = internalMutation({
  args: { memoryId: v.id('longTermMemories') },
  handler: async (ctx, args) => {
    const oldDoc = await ctx.db.get(args.memoryId)
    if (!oldDoc) return

    await ctx.db.patch(args.memoryId, {
      isActive: false,
      updatedAt: Date.now(),
    })

    // Sync aggregate on soft delete
    const newDoc = await ctx.db.get(args.memoryId)
    if (newDoc) {
      await memoryStats.replace(ctx, oldDoc, newDoc)
    }
  },
})
```

### Pattern 5: Core Memory

```typescript
// convex/core.ts
import { mutation, query, internalMutation } from './_generated/server'
import { v } from 'convex/values'

export const listActive = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .collect()
  },
})

export const byCategory = query({
  args: {
    userId: v.id('users'),
    category: v.union(
      v.literal('identity'),
      v.literal('preference'),
      v.literal('relationship'),
      v.literal('behavioral'),
      v.literal('goal'),
      v.literal('constraint'),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('coreMemories')
      .withIndex('by_user_category', (q) =>
        q
          .eq('userId', args.userId)
          .eq('category', args.category)
          .eq('isActive', true),
      )
      .collect()
  },
})

export const create = internalMutation({
  args: {
    content: v.string(),
    embedding: v.array(v.float64()),
    category: v.union(
      v.literal('identity'),
      v.literal('preference'),
      v.literal('relationship'),
      v.literal('behavioral'),
      v.literal('goal'),
      v.literal('constraint'),
    ),
    confidence: v.float64(),
    evidenceCount: v.number(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('coreMemories', {
      content: args.content,
      embedding: args.embedding,
      category: args.category,
      confidence: args.confidence,
      evidenceCount: args.evidenceCount,
      userId: args.userId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

// User-facing mutation to delete a core memory
export const remove = mutation({
  args: {
    memoryId: v.id('coreMemories'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId)
    if (!memory || memory.userId !== args.userId) {
      throw new Error('Memory not found or unauthorized')
    }

    await ctx.db.patch(args.memoryId, {
      isActive: false,
      updatedAt: Date.now(),
    })
    return { success: true }
  },
})
```

### Pattern 6: Context Assembly for Agent

```typescript
// convex/retrieval.ts
import { query } from './_generated/server'
import { v } from 'convex/values'

const CONTEXT_BUDGET = {
  core: 400,
  longTerm: 1200,
  shortTerm: 400,
}
const CHARS_PER_TOKEN = 4

export const assembleContext = query({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
    queryEmbedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const context: MemoryContext = {
      core: [],
      longTerm: [],
      shortTerm: [],
      totalTokens: 0,
    }

    // 1. Always include core memories
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

    // 2. Retrieve relevant long-term memories via vector search
    const ltmResults = await ctx.db
      .query('longTermMemories')
      .withIndex('embedding_idx')
      .vectorSearch('embedding', args.queryEmbedding, {
        filter: (q) => q.eq('userId', args.userId).eq('isActive', true),
        limit: 15,
      })

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

    // 3. Include recent short-term memories from thread
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

interface MemoryContext {
  core: Array<{ content: string; category: string }>
  longTerm: Array<{ content: string; type: string; importance: number }>
  shortTerm: Array<{ content: string; importance: number }>
  totalTokens: number
}

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
```

### Pattern 7: Agent with Memory Integration

```typescript
// convex/agent.ts
import { Agent, createTool } from '@convex-dev/agent'
import { components, internal } from './_generated/api'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'
import { z } from 'zod'

// Define the memory-aware agent
export const memoryAgent = new Agent(components.agent, {
  name: 'MemoryAgent',
  languageModel: anthropic('claude-sonnet-4-20250514'),
  textEmbeddingModel: openai.embedding('text-embedding-3-small'),
  instructions: `You are a helpful AI assistant with memory of previous conversations.
Use your memories to personalize responses and reference past context naturally.
When learning important information about the user, save it using the saveToCore tool.`,
  tools: { saveToCore, searchMemories },
  maxSteps: 3,
})

// Tool: Save important facts to core memory
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
  handler: async (ctx, args) => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: args.content,
    })
    await ctx.runMutation(internal.core.create, {
      content: args.content,
      embedding,
      category: args.category,
      confidence: 0.8,
      evidenceCount: 1,
      userId: ctx.userId,
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
  handler: async (ctx, args) => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: args.query,
    })
    const results = await ctx.runQuery(internal.longTerm.searchSimilar, {
      userId: ctx.userId,
      embedding,
      limit: 5,
    })
    return results.map((m) => m.summary)
  },
})
```

```typescript
// convex/chat.ts
import { action, query, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { api, internal, components } from './_generated/api'
import { memoryAgent } from './agent'
import { createThread, listMessages } from '@convex-dev/agent'
import { embeddingCache, rateLimiter, memoryStats } from './components'
import { ConvexError } from 'convex/values'

// Create a new thread for a user
export const createConversation = action({
  args: { userId: v.id('users'), title: v.optional(v.string()) },
  handler: async (ctx, { userId, title }) => {
    const threadId = await createThread(ctx, components.agent, {
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
    const memoryContext = await ctx.runQuery(api.retrieval.assembleContext, {
      userId,
      threadId,
      queryEmbedding: embedding,
    })

    // 3. Generate with memory-enriched context
    const { thread } = await memoryAgent.continueThread(ctx, { threadId })
    const result = await thread.generateText({
      prompt: message,
      // Inject memory as additional context
      contextHandler: async (messages) => {
        const memoryBlock = formatMemoryContext(memoryContext)
        return [{ role: 'system', content: memoryBlock }, ...messages]
      },
    })

    // 4. Ingest into sensory memory (background)
    await ctx.scheduler.runAfter(0, internal.sensory.ingestFromThread, {
      threadId,
      userId,
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
    const memoryContext = await ctx.runQuery(api.retrieval.assembleContext, {
      userId,
      threadId,
      queryEmbedding: embedding,
    })

    // 3. Stream response
    const { thread } = await memoryAgent.continueThread(ctx, { threadId })
    await thread.streamText(
      { prompt: message },
      {
        saveStreamDeltas: true,
        contextHandler: async (messages) => [
          { role: 'system', content: formatMemoryContext(memoryContext) },
          ...messages,
        ],
      },
    )

    // 4. Ingest into sensory memory (background)
    await ctx.scheduler.runAfter(0, internal.sensory.ingestFromThread, {
      threadId,
      userId,
    })
  },
})

// List messages for a thread (reactive)
export const getMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return await listMessages(ctx, components.agent, {
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

// Type for memory context (matches retrieval.ts)
interface MemoryContext {
  core: Array<{ content: string; category: string }>
  longTerm: Array<{ content: string; type: string; importance: number }>
  shortTerm: Array<{ content: string; importance: number }>
  totalTokens: number
}

function formatMemoryContext(context: MemoryContext): string {
  let text = ''
  if (context.core.length > 0) {
    text += '## What I Know About You\n'
    text += context.core.map((c) => `- ${c.content}`).join('\n') + '\n\n'
  }
  if (context.longTerm.length > 0) {
    text += '## Relevant Memories\n'
    text += context.longTerm.map((m) => `- ${m.content}`).join('\n') + '\n\n'
  }
  if (context.shortTerm.length > 0) {
    text += '## Current Context\n'
    text += context.shortTerm.map((m) => `- ${m.content}`).join('\n') + '\n'
  }
  return text
}
```

```typescript
// convex/sensory.ts - Updated for thread integration
import { listMessages } from '@convex-dev/agent'
import { components, internal } from './_generated/api'

export const ingestFromThread = internalAction({
  args: { threadId: v.string(), userId: v.id('users') },
  handler: async (ctx, { threadId, userId }) => {
    // Get recent messages from thread using correct API
    const messages = await listMessages(ctx, components.agent, {
      threadId,
      paginationOpts: { cursor: null, numItems: 5 },
    })

    for (const msg of messages.page) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const content = typeof msg.content === 'string'
          ? msg.content
          : msg.content.map(c => c.type === 'text' ? c.text : '').join('')
        await ctx.runMutation(internal.sensory.ingestMessage, {
          content,
          userId,
          threadId,
        })
      }
    }
  },
})
```

---

## Part 5: Memory Managers (Workflow + Cron)

The Memory Managers layer uses **Convex Workflows** for durable, multi-step consolidation pipelines that survive server restarts, with **Cron Jobs** to trigger them on schedule.

### Why Workflows for Memory Consolidation?

1. **Durability** - If the server restarts mid-consolidation, the workflow resumes
2. **Step-level retries** - LLM calls for reflection can retry on transient errors
3. **Parallel execution** - Decay and cleanup can run concurrently
4. **Observability** - Track workflow status and debug failures
5. **Long-running** - Reflection workflows can span minutes without timeout concerns

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Trigger consolidation workflow (every 15 min)
// The workflow handles: cleanup, decay, and promotion
crons.interval(
  'memory-consolidation',
  { minutes: 15 },
  internal.consolidation.triggerConsolidation,
)

// Trigger daily reflection workflow (3 AM UTC)
// Detects patterns and promotes to core memory
crons.daily(
  'daily-reflection',
  { hourUTC: 3, minuteUTC: 0 },
  internal.reflection.triggerDailyReflection,
)

// Trigger weekly pruning workflow (Sunday 4 AM UTC)
crons.weekly(
  'weekly-prune',
  { dayOfWeek: 'sunday', hourUTC: 4, minuteUTC: 0 },
  internal.consolidation.triggerPruning,
)

export default crons
```

```typescript
// convex/consolidation.ts
import { internalMutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { workflowManager, memoryStats } from './components'

// ============================================
// WORKFLOW DEFINITIONS
// Durable, multi-step memory consolidation
// ============================================

/**
 * Main consolidation workflow - runs every 15 minutes
 * Steps: cleanup expired STM → apply decay → promote to LTM
 */
export const consolidationWorkflow = workflowManager.define({
  args: {},
  handler: async (step, _args): Promise<void> => {
    // Step 1: Clean up expired short-term memories
    const cleanupResult = await step.runMutation(
      internal.consolidation.cleanupExpiredSTM,
      {},
    )

    // Step 2 & 3: Run decay and promotion in parallel
    // These don't depend on each other
    await Promise.all([
      step.runMutation(internal.consolidation.applyDecay, {}),
      step.runAction(
        internal.consolidation.promoteToLongTerm,
        {},
        { retry: true }, // Retry on transient errors
      ),
    ])

    // Step 4: Log consolidation run
    await step.runMutation(internal.consolidation.logRun, {
      runType: 'promotion',
      memoriesProcessed: cleanupResult.processed,
      memoriesPromoted: cleanupResult.promoted,
      memoriesPruned: cleanupResult.pruned,
    })
  },
})

/**
 * Pruning workflow - runs weekly
 * More aggressive cleanup of low-importance memories
 */
export const pruningWorkflow = workflowManager.define({
  args: {},
  handler: async (step, _args): Promise<void> => {
    // Step 1: Prune low-importance LTM
    const pruned = await step.runMutation(
      internal.consolidation.pruneMemories,
      {},
    )

    // Step 2: Clean up orphaned edges
    await step.runMutation(internal.edges.cleanupOrphaned, {})

    // Step 3: Log
    await step.runMutation(internal.consolidation.logRun, {
      runType: 'pruning',
      memoriesProcessed: pruned.processed,
      memoriesPromoted: 0,
      memoriesPruned: pruned.count,
    })
  },
})

// ============================================
// WORKFLOW TRIGGERS (called by crons)
// ============================================

export const triggerConsolidation = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(
      ctx,
      internal.consolidation.consolidationWorkflow,
      {},
    )
  },
})

export const triggerPruning = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(ctx, internal.consolidation.pruningWorkflow, {})
  },
})

// ============================================
// CONSOLIDATION MUTATIONS
// Individual steps called by workflows
// ============================================

export const cleanupExpiredSTM = internalMutation({
  handler: async (
    ctx,
  ): Promise<{ processed: number; promoted: number; pruned: number }> => {
    const now = Date.now()
    const expired = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_expiry', (q) => q.lt('expiresAt', now))
      .take(100)

    for (const stm of expired) {
      await ctx.db.delete(stm._id)
    }

    return { processed: expired.length, promoted: 0, pruned: expired.length }
  },
})

export const applyDecay = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const memories = await ctx.db
      .query('longTermMemories')
      .withIndex('by_user')
      .filter((q) => q.eq(q.field('isActive'), true))
      .take(500)

    let decayed = 0
    for (const memory of memories) {
      const hoursSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60)
      // Ebbinghaus forgetting curve: R = e^(-t/S)
      // Where S is stability (higher = slower decay)
      const decayRate = 0.01 / memory.stability
      const decay = Math.exp(-decayRate * hoursSinceAccess)
      const newImportance = memory.baseImportance * decay

      if (Math.abs(newImportance - memory.currentImportance) > 0.01) {
        await ctx.db.patch(memory._id, {
          currentImportance: Math.max(0.01, newImportance),
          updatedAt: now,
        })
        decayed++
      }
    }

    return { decayed }
  },
})

export const promoteToLongTerm = internalAction({
  handler: async (ctx) => {
    // Get high-importance STM that haven't expired
    const candidates = await ctx.runQuery(
      internal.shortTerm.getPromotionCandidates,
      {
        minImportance: 0.6,
        limit: 50,
      },
    )

    let promoted = 0
    for (const stm of candidates) {
      const result = await ctx.runAction(internal.longTerm.consolidateFromSTM, {
        stmId: stm._id,
      })
      if (result?.action === 'created') {
        promoted++
        // Update aggregate stats
        await ctx.runMutation(internal.consolidation.updateMemoryStats, {
          userId: stm.userId,
          memoryType: 'semantic',
          importance: stm.importance,
        })
      }
    }

    return { promoted }
  },
})

export const pruneMemories = internalMutation({
  handler: async (ctx): Promise<{ processed: number; count: number }> => {
    const now = Date.now()
    const threshold = 0.1

    const lowImportance = await ctx.db
      .query('longTermMemories')
      .withIndex('by_user')
      .filter((q) =>
        q.and(
          q.eq(q.field('isActive'), true),
          q.lt(q.field('currentImportance'), threshold),
        ),
      )
      .take(100)

    for (const memory of lowImportance) {
      await ctx.db.patch(memory._id, { isActive: false, updatedAt: now })
    }

    return { processed: lowImportance.length, count: lowImportance.length }
  },
})

export const logRun = internalMutation({
  args: {
    runType: v.union(
      v.literal('promotion'),
      v.literal('decay'),
      v.literal('pruning'),
      v.literal('reflection'),
      v.literal('cleanup'),
    ),
    memoriesProcessed: v.number(),
    memoriesPromoted: v.number(),
    memoriesPruned: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('consolidationLogs', {
      runType: args.runType,
      memoriesProcessed: args.memoriesProcessed,
      memoriesPromoted: args.memoriesPromoted,
      memoriesPruned: args.memoriesPruned,
      duration: 0, // Workflow handles timing
      createdAt: Date.now(),
    })
  },
})

// Update aggregate for O(log n) memory statistics
export const updateMemoryStats = internalMutation({
  args: {
    userId: v.id('users'),
    memoryType: v.string(),
    importance: v.float64(),
  },
  handler: async (ctx, args) => {
    // This would be called when memories are created/updated
    // The aggregate component tracks counts automatically
    // See memoryStats in components.ts
  },
})
```

```typescript
// convex/reflection.ts
import { internalAction, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { workflowManager, rateLimiter, embeddingCache } from './components'

// Core promotion criteria
const CORE_PROMOTION_CRITERIA = {
  minOccurrences: 3,
  minConfidence: 0.7,
}

// ============================================
// REFLECTION WORKFLOW
// Durable pattern detection and core promotion
// ============================================

/**
 * Daily reflection workflow - runs at 3 AM
 * Analyzes LTM patterns and promotes stable facts to Core Memory
 *
 * This is the agent's "sleep cycle" - consolidating learnings
 */
export const dailyReflectionWorkflow = workflowManager.define({
  args: { userId: v.optional(v.id('users')) },
  handler: async (step, args): Promise<void> => {
    // Step 1: Get active users (or specific user)
    const users = args.userId
      ? [{ _id: args.userId }]
      : await step.runQuery(internal.users.getActiveUsers, { days: 7 })

    // Step 2: Process each user's memories
    for (const user of users) {
      // Get high-importance memories
      const memories = await step.runQuery(
        internal.longTerm.getHighImportance,
        {
          userId: user._id,
          minImportance: 0.7,
          limit: 100,
        },
      )

      if (memories.length < CORE_PROMOTION_CRITERIA.minOccurrences) {
        continue // Not enough data to find patterns
      }

      // Step 3: Use LLM to detect patterns (with retry)
      const patterns = await step.runAction(
        internal.reflection.detectPatternsWithLLM,
        { userId: user._id, memories },
        { retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 } },
      )

      // Step 4: Promote high-confidence patterns to core
      for (const pattern of patterns) {
        if (pattern.confidence >= CORE_PROMOTION_CRITERIA.minConfidence) {
          await step.runMutation(internal.reflection.promoteToCore, {
            userId: user._id,
            pattern,
          })
        }
      }

      // Step 5: Log reflection
      await step.runMutation(internal.consolidation.logRun, {
        runType: 'reflection',
        memoriesProcessed: memories.length,
        memoriesPromoted: patterns.filter(
          (p) => p.confidence >= CORE_PROMOTION_CRITERIA.minConfidence,
        ).length,
        memoriesPruned: 0,
      })
    }
  },
})

// Trigger for cron
export const triggerDailyReflection = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(
      ctx,
      internal.reflection.dailyReflectionWorkflow,
      {},
    )
  },
})

// ============================================
// LLM-POWERED PATTERN DETECTION
// ============================================

const PatternSchema = z.object({
  patterns: z.array(
    z.object({
      content: z.string().describe('The stable fact or pattern detected'),
      category: z.enum([
        'identity',
        'preference',
        'relationship',
        'behavioral',
        'goal',
        'constraint',
      ]),
      confidence: z.number().min(0).max(1),
      supportingCount: z.number(),
      reasoning: z.string().describe('Why this is a stable pattern'),
    }),
  ),
})

export const detectPatternsWithLLM = internalAction({
  args: {
    userId: v.id('users'),
    memories: v.array(
      v.object({
        summary: v.string(),
        entityName: v.optional(v.string()),
        currentImportance: v.float64(),
        reinforcementCount: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      content: string
      category: string
      confidence: number
      supportingCount: number
    }>
  > => {
    // Rate limit LLM calls
    const limit = await rateLimiter.limit(ctx, 'llmTokens', { count: 1000 })
    if (!limit.ok) {
      return [] // Skip if rate limited
    }

    const memorySummaries = args.memories
      .map(
        (m) =>
          `- ${m.summary} (importance: ${m.currentImportance.toFixed(2)}, seen ${m.reinforcementCount}x)`,
      )
      .join('\n')

    const { output } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      output: Output.object({ schema: PatternSchema }),
      system: `You are analyzing a user's memory patterns to identify stable facts about them.
Look for:
- Repeated themes or entities (mentioned 3+ times)
- High-importance facts that persist over time
- Identity markers, preferences, relationships, goals

Only output patterns you're confident are stable, long-term facts.`,
      prompt: `Analyze these memories and identify stable patterns:\n\n${memorySummaries}`,
    })

    return output?.patterns || []
  },
})

// ============================================
// PATTERN-BASED PROMOTION (heuristic fallback)
// ============================================

export const detectPatternsHeuristic = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const memories = await ctx.runQuery(internal.longTerm.getHighImportance, {
      userId: args.userId,
      minImportance: 0.7,
      limit: 100,
    })

    // Group by entity name
    const patterns = new Map<string, any[]>()
    for (const memory of memories) {
      if (memory.entityName) {
        if (!patterns.has(memory.entityName)) {
          patterns.set(memory.entityName, [])
        }
        patterns.get(memory.entityName)!.push(memory)
      }
    }

    const results: Array<{
      content: string
      category: string
      confidence: number
      supportingCount: number
    }> = []

    for (const [entityName, group] of patterns) {
      if (group.length >= CORE_PROMOTION_CRITERIA.minOccurrences) {
        const avgImportance =
          group.reduce((sum, m) => sum + m.currentImportance, 0) / group.length

        results.push({
          content: group[0].summary,
          category: categorizePattern(group[0].summary),
          confidence: avgImportance,
          supportingCount: group.length,
        })
      }
    }

    return results
  },
})

export const promoteToCore = internalMutation({
  args: {
    userId: v.id('users'),
    pattern: v.object({
      content: v.string(),
      category: v.string(),
      confidence: v.float64(),
      supportingCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Check if already in core (avoid duplicates)
    const existing = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .filter((q) => q.eq(q.field('content'), args.pattern.content))
      .first()

    if (existing) {
      // Reinforce existing core memory
      await ctx.db.patch(existing._id, {
        confidence: Math.min(1, existing.confidence + 0.05),
        evidenceCount: existing.evidenceCount + args.pattern.supportingCount,
        updatedAt: Date.now(),
      })
      return { action: 'reinforced', id: existing._id }
    }

    // Generate embedding for new core memory (cached)
    const embedding = await embeddingCache.fetch(ctx, {
      text: args.pattern.content,
    })

    // Create new core memory
    const id = await ctx.db.insert('coreMemories', {
      content: args.pattern.content,
      embedding,
      category: args.pattern.category as any,
      confidence: args.pattern.confidence,
      evidenceCount: args.pattern.supportingCount,
      userId: args.userId,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Log reflection
    await ctx.db.insert('reflections', {
      userId: args.userId,
      insight: `Promoted pattern: ${args.pattern.content.slice(0, 50)}...`,
      insightType: 'pattern',
      supportingMemoryCount: args.pattern.supportingCount,
      confidence: args.pattern.confidence,
      actionTaken: 'promoted_to_core',
      createdAt: Date.now(),
    })

    return { action: 'created', id }
  },
})

function categorizePattern(
  content: string,
):
  | 'identity'
  | 'preference'
  | 'relationship'
  | 'behavioral'
  | 'goal'
  | 'constraint' {
  const lower = content.toLowerCase()

  if (/\b(i am|i'm|my name|work as|profession|job)\b/.test(lower))
    return 'identity'
  if (/\b(prefer|like|love|favorite|rather)\b/.test(lower)) return 'preference'
  if (/\b(always|usually|often|every|habit)\b/.test(lower)) return 'behavioral'
  if (/\b(wife|husband|friend|family|dog|cat)\b/.test(lower))
    return 'relationship'
  if (/\b(learning|goal|want to|trying to|planning)\b/.test(lower))
    return 'goal'
  if (/\b(can't|don't|never|avoid|allergic)\b/.test(lower)) return 'constraint'

  return 'identity'
}

export const logReflection = internalMutation({
  args: {
    userId: v.id('users'),
    insight: v.string(),
    insightType: v.union(
      v.literal('pattern'),
      v.literal('trend'),
      v.literal('gap'),
    ),
    supportingMemoryCount: v.number(),
    confidence: v.float64(),
    actionTaken: v.optional(
      v.union(
        v.literal('promoted_to_core'),
        v.literal('flagged_for_review'),
        v.literal('none'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('reflections', {
      userId: args.userId,
      insight: args.insight,
      insightType: args.insightType,
      supportingMemoryCount: args.supportingMemoryCount,
      confidence: args.confidence,
      actionTaken: args.actionTaken,
      createdAt: Date.now(),
    })
  },
})
```

---

## Part 6: File Structure

```
convex/
├── convex.config.ts       # Component registration (agent, workflow, cache, rate-limiter, aggregate)
├── components.ts          # Component initialization (workflowManager, embeddingCache, rateLimiter, memoryStats)
├── schema.ts              # Database schema (memory layers only)
├── agent.ts               # Agent definition + memory tools
├── chat.ts                # Chat actions (send, stream, list) with rate limiting
├── sensory.ts             # Layer 1: Ingest, filter, attention scoring
├── shortTerm.ts           # Layer 2: Topic clustering, STM management
├── longTerm.ts            # Layer 3: Deduplication, storage
├── core.ts                # Layer 5: Core memory CRUD
├── edges.ts               # Knowledge graph relationships
├── consolidation.ts       # Layer 4: Workflows for promotion, decay, pruning
├── reflection.ts          # Layer 4: Pattern detection workflow with LLM
├── extraction.ts          # LLM entity extraction (rate limited)
├── embedding.ts           # Embedding generation (cached via ActionCache)
├── retrieval.ts           # Context assembly for memory injection
├── users.ts               # User CRUD
├── crons.ts               # Scheduled workflow triggers

src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   ├── _authenticated.tsx
│   └── _authenticated/
│       ├── chat.index.tsx
│       ├── chat.$threadId.tsx
│       └── memory.index.tsx
├── components/
│   ├── ui/
│   ├── chat/
│   └── memory/
└── lib/
    ├── memory-hooks.ts
    └── utils.ts
```

> **Note:** The Agent component manages threads and messages internally.
> Our custom schema focuses on the five memory layers.

---

## Part 7: Component Benefits Summary

### Why These Components?

| Component                    | Problem Solved                            | Impact                                    |
| ---------------------------- | ----------------------------------------- | ----------------------------------------- |
| **@convex-dev/agent**        | Thread/message management, tool calling   | Foundation for AI chat                    |
| **@convex-dev/workflow**     | Memory consolidation can fail mid-process | Durable, restartable pipelines            |
| **@convex-dev/action-cache** | Same text embedded repeatedly             | 7-day cache, major cost savings           |
| **@convex-dev/rate-limiter** | LLM APIs are expensive and have limits    | Per-user and global rate limits           |
| **@convex-dev/aggregate**    | Counting memories is O(n)                 | O(log n) stats with `memoryStats.count()` |

### Memory Layer → Component Mapping

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MEMORY LAYERS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SENSORY MEMORY                                                      │
│     └── Uses: rateLimiter (extraction limits)                           │
│                                                                         │
│  2. SHORT-TERM MEMORY                                                   │
│     └── Uses: embeddingCache (cached embeddings)                        │
│                                                                         │
│  3. LONG-TERM MEMORY                                                    │
│     └── Uses: embeddingCache, memoryStats (aggregate counts)            │
│                                                                         │
│  4. MEMORY MANAGERS                                                     │
│     └── Uses: workflowManager (durable consolidation)                   │
│     └── Uses: rateLimiter (LLM budget for reflection)                   │
│                                                                         │
│  5. CORE MEMORY                                                         │
│     └── Uses: embeddingCache (cached embeddings for similarity)         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

This MVP implements the five memory layers inspired by human cognition:

1. **Sensory Memory** - Attention-based filtering prevents noise from entering the system
2. **Short-Term Memory** - Topic clustering groups related content for active reasoning
3. **Long-Term Memory** - Deduplication keeps knowledge clean and consolidated
4. **Memory Managers** - Durable workflows handle decay, promotion, and pruning
5. **Core Memory** - Stable identity facts are always available to the agent

### Convex Components Enable:

- **Durability** - Workflows survive server restarts during consolidation
- **Cost Control** - Action cache reduces embedding costs by ~80%+
- **Safety** - Rate limiting protects LLM APIs from abuse
- **Performance** - Aggregates provide O(log n) memory statistics
- **Reliability** - Step-level retries for transient LLM failures

The key insight: **memory is cognition, not storage**. This system doesn't just retrieve—it filters, consolidates, decays, and reflects.

> _"That's where intelligence begins: not in retrieval, but in reflection."_
