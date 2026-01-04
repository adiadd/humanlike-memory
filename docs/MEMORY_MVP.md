# Human-like Memory for AI Agents: MVP Implementation

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
│  │   • Group messages by topic (embedding similarity >= 0.82)            │  │
│  │   • Track importance and access patterns                              │  │
│  │   • Candidates for promotion if importance >= 0.6                     │  │
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
│  │   • Deduplication on insert (cosine similarity >= 0.95)               │  │
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
│  │   • Identity: "User is a software engineer in New York City"          │  │
│  │   • Preferences: "User prefers concise, technical responses"          │  │
│  │   • Behavioral: "User typically works late evenings"                  │  │
│  │   • Relationships: "User has a dog named Max"                         │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────────────────┐
                    │  4. MEMORY MANAGERS (Background)      │
                    │                                       │
                    │  Consolidation (every 15 min):        │
                    │  • Cleanup: Delete expired STMs       │
                    │  • Decay: Apply forgetting curve      │
                    │  • Promote: STM → LTM (importance≥0.6)│
                    │                                       │
                    │  Reflection (daily 3 AM):             │
                    │  • Detect patterns in LTM via LLM     │
                    │  • Promote patterns → Core (conf≥0.7) │
                    │                                       │
                    │  Pruning (weekly Sunday 4 AM):        │
                    │  • Delete low-importance LTM (<0.1)   │
                    │  • Cleanup orphaned edges             │
                    │                                       │
                    │         [RUNS VIA CRON JOBS]          │
                    └───────────────────────────────────────┘
```

---

## Part 2: Configuration & Constants

```typescript
// convex/config.ts
/**
 * Short-term memory expiry time in hours
 */
export const STM_EXPIRY_HOURS = 4

/**
 * Minimum attention score required for sensory memory to be promoted
 */
export const ATTENTION_THRESHOLD = 0.3

/**
 * Similarity threshold for deduplicating long-term memories
 * Memories with similarity >= this threshold are considered duplicates
 */
export const DEDUP_SIMILARITY_THRESHOLD = 0.95

/**
 * Similarity threshold for clustering short-term memories into topics
 */
export const TOPIC_SIMILARITY_THRESHOLD = 0.82

/**
 * Token budgets for different memory types during context assembly
 */
export const CONTEXT_BUDGET = {
  core: 400,
  longTerm: 1200,
  shortTerm: 400,
} as const

/**
 * Approximate characters per token for budget estimation
 */
export const CHARS_PER_TOKEN = 4
```

---

## Part 3: Schema Design

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import { categoryValidator } from './types'

export default defineSchema({
  // ============================================
  // USERS
  // Threads & messages managed by Agent component
  // ============================================

  users: defineTable({
    externalId: v.string(), // External auth ID (e.g., Clerk)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    lastActiveAt: v.number(), // For finding active users in reflection
    createdAt: v.number(),
  })
    .index('by_externalId', ['externalId'])
    .index('by_lastActive', ['lastActiveAt']),

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
    category: categoryValidator,

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

## Part 4: Shared Types

```typescript
// convex/types.ts
import { v } from 'convex/values'

/**
 * Memory context returned from retrieval, used for formatting prompts
 */
export interface MemoryContext {
  core: Array<{ content: string; category: string }>
  longTerm: Array<{ content: string; type: string; importance: number }>
  shortTerm: Array<{ content: string; importance: number }>
  totalTokens: number
}

/**
 * Category validator for core memories
 */
export const categoryValidator = v.union(
  v.literal('identity'),
  v.literal('preference'),
  v.literal('relationship'),
  v.literal('behavioral'),
  v.literal('goal'),
  v.literal('constraint'),
)

/**
 * Type for the category union (derived from validator)
 */
export type CoreMemoryCategory =
  | 'identity'
  | 'preference'
  | 'relationship'
  | 'behavioral'
  | 'goal'
  | 'constraint'
```

---

## Part 5: Convex Components Setup

### Installation

```bash
bun add @convex-dev/agent @convex-dev/workflow @convex-dev/action-cache @convex-dev/rate-limiter @convex-dev/aggregate ai @ai-sdk/anthropic @ai-sdk/openai zod
```

### Component Registration

```typescript
// convex/convex.config.ts
import actionCache from '@convex-dev/action-cache/convex.config'
import agent from '@convex-dev/agent/convex.config'
import aggregate from '@convex-dev/aggregate/convex.config'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import workflow from '@convex-dev/workflow/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(agent)
app.use(workflow)
app.use(actionCache)
app.use(rateLimiter)
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
| Chat responses    | `claude-haiku-4-5`       | Good quality/speed balance   |
| Embeddings        | `text-embedding-3-small` | 1536 dims, good cost/quality |

### Component Initialization

```typescript
// convex/components.ts
import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { WorkflowManager } from '@convex-dev/workflow'
import { ActionCache } from '@convex-dev/action-cache'
import { TableAggregate } from '@convex-dev/aggregate'

import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

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
export const embeddingCache: any = new ActionCache(components.actionCache, {
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
  sumValue: () => 1, // Count memories
})
```

---

## Part 6: Implementation Patterns

### Pattern 1: Sensory Memory - Attention Scoring

```typescript
// convex/sensory.ts
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { ATTENTION_THRESHOLD } from './config'

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
      return { status: 'duplicate' as const, id: duplicate._id }
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

    return { status: 'created' as const, id: memoryId, attentionScore }
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
```

```typescript
// convex/extraction.ts
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { v } from 'convex/values'
import { z } from 'zod'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { embeddingCache, rateLimiter } from './components'
import { TOPIC_SIMILARITY_THRESHOLD } from './config'

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
          const memory = await ctx.runQuery(internal.shortTerm.get, {
            id: result._id,
          })
          if (memory && memory.topicId) {
            existingTopicId = memory.topicId
            break
          }
        }
      }

      // 6. Create short-term memory
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

      // Retry with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const backoffMs = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        await ctx.scheduler.runAfter(
          backoffMs,
          internal.extraction.extractAndEmbed,
          { ...args, retryCount: retryCount + 1 },
        )
        return
      }

      // Max retries exceeded - mark sensory memory as failed
      await ctx.runMutation(internal.sensory.markExtractionFailed, {
        sensoryMemoryId: args.sensoryMemoryId,
        reason:
          error instanceof Error ? error.message : 'Unknown extraction error',
      })
    }
  },
})
```

### Pattern 3: Short-Term Memory with Topic Clustering

```typescript
// convex/shortTerm.ts
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, internalQuery, query } from './_generated/server'
import { STM_EXPIRY_HOURS } from './config'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// Query to get STM by ID (used by consolidation)
export const get = internalQuery({
  args: { id: v.id('shortTermMemories') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

// Query to get promotion candidates
export const getPromotionCandidates = internalQuery({
  args: {
    minImportance: v.float64(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db
      .query('shortTermMemories')
      .withIndex('by_user_importance')
      .filter((q) =>
        q.and(
          q.gte(q.field('importance'), args.minImportance),
          q.gt(q.field('expiresAt'), now),
        ),
      )
      .take(args.limit)
  },
})

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
    existingTopicId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // 1. Use existing topic or create new one
    const topicId = await findOrCreateTopic(
      ctx,
      args.userId,
      args.embedding,
      args.entities,
      args.existingTopicId,
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
  ctx: MutationCtx,
  userId: Id<'users'>,
  embedding: Array<number>,
  entities: Array<{ name: string; type: string; salience: number }>,
  existingTopicId: string | null,
): Promise<Id<'topics'>> {
  // If an existing topic was found via vector search in the action, use it
  if (existingTopicId) {
    const topic = await ctx.db.get(existingTopicId as Id<'topics'>)
    if (topic) {
      // Update topic centroid with the new embedding
      const newCentroid = topic.centroid.map(
        (val: number, i: number) =>
          (val * topic.memberCount + embedding[i]) / (topic.memberCount + 1),
      )
      await ctx.db.patch(topic._id, {
        centroid: newCentroid,
        memberCount: topic.memberCount + 1,
      })
      return topic._id
    }
  }

  // Create new topic
  const label =
    entities.length > 0 ? `${entities[0].type}: ${entities[0].name}` : 'General'

  return ctx.db.insert('topics', {
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
    return ctx.db
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
import { v } from 'convex/values'

import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { memoryStats } from './components'
import { DEDUP_SIMILARITY_THRESHOLD } from './config'

import type { Id } from './_generated/dataModel'

// Query for high-importance memories (used by reflection)
export const getHighImportance = internalQuery({
  args: {
    userId: v.id('users'),
    minImportance: v.float64(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('longTermMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .filter((q) => q.gte(q.field('currentImportance'), args.minImportance))
      .take(args.limit)
  },
})

export const consolidateFromSTM = internalAction({
  args: {
    stmId: v.id('shortTermMemories'),
  },
  handler: async (ctx, args) => {
    const stm = await ctx.runQuery(internal.shortTerm.get, { id: args.stmId })
    if (!stm) return

    // Check for duplicates via vector similarity
    const similar = await ctx.runAction(internal.longTerm.searchSimilar, {
      userId: stm.userId,
      embedding: stm.embedding,
      limit: 3,
    })

    // If too similar to existing, reinforce instead of creating
    for (const existing of similar) {
      if (existing._score >= DEDUP_SIMILARITY_THRESHOLD) {
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

export const searchSimilar = internalAction({
  args: {
    userId: v.id('users'),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Vector search is only available in actions
    const results = await ctx.vectorSearch(
      'longTermMemories',
      'embedding_idx',
      {
        vector: args.embedding,
        limit: args.limit,
        filter: (q) => q.eq('userId', args.userId),
      },
    )

    // Fetch full documents and filter for isActive
    const docs = await Promise.all(
      results.map(async (r) => {
        const doc = await ctx.runQuery(internal.longTerm.getMemoryById, {
          memoryId: r._id,
        })
        if (doc && doc.isActive) {
          return { _id: doc._id, _score: r._score, summary: doc.summary }
        }
        return null
      }),
    )

    return docs.filter((d) => d !== null)
  },
})
```

### Pattern 5: Core Memory

```typescript
// convex/core.ts
import { v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'
import { categoryValidator } from './types'

export const listActive = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return ctx.db
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
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    return ctx.db
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
    category: categoryValidator,
    confidence: v.float64(),
    evidenceCount: v.number(),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('coreMemories', {
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
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction, internalQuery, query } from './_generated/server'
import { CHARS_PER_TOKEN, CONTEXT_BUDGET } from './config'
import type { MemoryContext } from './types'

// Helper: Fit memories within a token budget
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

// Helper query to get core and short-term memories
export const getCoreAndShortTerm = internalQuery({
  args: {
    userId: v.id('users'),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const coreMemories = await ctx.db
      .query('coreMemories')
      .withIndex('by_user', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .take(10)

    const stmResults = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(10)

    return { coreMemories, stmResults }
  },
})

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

function buildMemoryContext(coreMemories, ltmDocs, stmResults): MemoryContext {
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

// Agent instructions
export const AGENT_INSTRUCTIONS = `You are a helpful AI assistant with memory of previous conversations.
Use your memories to personalize responses and reference past context naturally.
Important information shared by the user will be automatically remembered through the memory pipeline.`

// Define the memory-aware agent
// NOTE: saveToCore tool is intentionally NOT included - memories should flow through
// the proper pipeline: Sensory → STM → LTM → Core (via reflection workflow)
export const memoryAgent = new Agent(components.agent, {
  name: 'MemoryAgent',
  languageModel: anthropic('claude-haiku-4-5'),
  textEmbeddingModel: openai.embeddingModel('text-embedding-3-small'),
  instructions: AGENT_INSTRUCTIONS,
  tools: { searchMemories },
})
```

```typescript
// convex/chat.ts
import { stepCountIs } from 'ai'
import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { api, components, internal } from './_generated/api'
import { action, internalAction, mutation, query } from './_generated/server'
import { AGENT_INSTRUCTIONS, memoryAgent } from './agent'
import { embeddingCache, memoryStats, rateLimiter } from './components'
import { formatContextForPrompt } from './retrieval'

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
    // Save the user's message to the thread immediately
    const { messageId } = await memoryAgent.saveMessage(ctx, {
      threadId,
      prompt,
      skipEmbeddings: true, // Generate lazily when streaming
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
    const memoryBlock = formatContextForPrompt(memoryContext)

    // 4. Generate with memory-enriched context using streaming
    const systemMessage = memoryBlock
      ? `${AGENT_INSTRUCTIONS}\n\n${memoryBlock}`
      : AGENT_INSTRUCTIONS

    // Stream the response with deltas saved to DB for real-time UI updates
    const result = await (memoryAgent as any).streamText(
      ctx,
      { threadId, userId },
      {
        promptMessageId,
        system: systemMessage,
        stopWhen: stepCountIs(5),
      },
      {
        saveStreamDeltas: {
          throttleMs: 50, // Update frequently for smooth streaming
        },
      },
    )

    // Consume the stream to ensure it completes
    await result.consumeStream()

    // Ingest user message into sensory memory
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
    const paginated = await listUIMessages(ctx, components.agent, args)
    const streams = await syncStreams(ctx, components.agent, args)
    return { ...paginated, streams }
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
```

---

## Part 7: Memory Managers (Workflow + Cron)

The Memory Managers layer uses **Convex Workflows** for durable, multi-step consolidation pipelines that survive server restarts, with **Cron Jobs** to trigger them on schedule.

### Why Workflows for Memory Consolidation?

1. **Durability** - If the server restarts mid-consolidation, the workflow resumes
2. **Step-level retries** - LLM calls for reflection can retry on transient errors
3. **Parallel execution** - Decay and promotion can run concurrently
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
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'
import { memoryStats, workflowManager } from './components'

// Main consolidation workflow - runs every 15 minutes
// Steps: cleanup expired STM → apply decay → promote to LTM
export const consolidationWorkflow = workflowManager.define({
  args: {},
  handler: async (ctx): Promise<void> => {
    const cleanupResult = await ctx.runMutation(
      internal.consolidation.cleanupExpiredSTM,
      {},
    )

    // Run decay and promotion in parallel
    await Promise.all([
      ctx.runMutation(internal.consolidation.applyDecay, {}),
      ctx.runAction(internal.consolidation.promoteToLongTerm, {}),
    ])

    await ctx.runMutation(internal.consolidation.logRun, {
      runType: 'promotion',
      memoriesProcessed: cleanupResult.processed,
      memoriesPromoted: cleanupResult.promoted,
      memoriesPruned: cleanupResult.pruned,
    })
  },
  workpoolOptions: {
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  },
})

// Pruning workflow - runs weekly
export const pruningWorkflow = workflowManager.define({
  args: {},
  handler: async (ctx): Promise<void> => {
    const pruned = await ctx.runMutation(
      internal.consolidation.pruneMemories,
      {},
    )
    await ctx.runMutation(internal.edges.cleanupOrphaned, {})
    await ctx.runMutation(internal.consolidation.logRun, {
      runType: 'pruning',
      memoriesProcessed: pruned.processed,
      memoriesPromoted: 0,
      memoriesPruned: pruned.count,
    })
  },
})

// Triggers for crons
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

export const cleanupExpiredSTM = internalMutation({
  handler: async (ctx) => {
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
      const decayRate = 0.01 / memory.stability
      const decay = Math.exp(-decayRate * hoursSinceAccess)
      const newImportance = memory.baseImportance * decay

      if (Math.abs(newImportance - memory.currentImportance) > 0.01) {
        const oldDoc = memory
        await ctx.db.patch(memory._id, {
          currentImportance: Math.max(0.01, newImportance),
          updatedAt: now,
        })
        // Sync aggregate since sortKey includes currentImportance
        const newDoc = await ctx.db.get(memory._id)
        if (newDoc) {
          await memoryStats.replace(ctx, oldDoc, newDoc)
        }
        decayed++
      }
    }

    return { decayed }
  },
})

export const promoteToLongTerm = internalAction({
  handler: async (ctx) => {
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
      }
    }

    return { promoted }
  },
})

export const pruneMemories = internalMutation({
  handler: async (ctx) => {
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
      duration: 0,
      createdAt: Date.now(),
    })
  },
})
```

```typescript
// convex/reflection.ts
import { anthropic } from '@ai-sdk/anthropic'
import { Output, generateText } from 'ai'
import { v } from 'convex/values'
import { z } from 'zod'

import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { embeddingCache, rateLimiter, workflowManager } from './components'
import type { CoreMemoryCategory } from './types'

const CORE_PROMOTION_CRITERIA = {
  minOccurrences: 3,
  minConfidence: 0.7,
}

// Daily reflection workflow - the agent's "sleep cycle"
export const dailyReflectionWorkflow = workflowManager.define({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, args): Promise<void> => {
    const users = args.userId
      ? [{ _id: args.userId }]
      : await ctx.runQuery(internal.users.getActiveUsers, { days: 7 })

    for (const user of users) {
      const memories = await ctx.runQuery(internal.longTerm.getHighImportance, {
        userId: user._id,
        minImportance: 0.7,
        limit: 100,
      })

      if (memories.length < CORE_PROMOTION_CRITERIA.minOccurrences) {
        continue
      }

      // LLM pattern detection with retry
      const patterns = await ctx.runAction(
        internal.reflection.detectPatternsWithLLM,
        { userId: user._id, memories },
        { retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 } },
      )

      // Promote high-confidence patterns to core
      for (const pattern of patterns) {
        if (pattern.confidence >= CORE_PROMOTION_CRITERIA.minConfidence) {
          await ctx.runAction(internal.reflection.promoteToCoreAction, {
            userId: user._id,
            pattern,
          })
        }
      }

      await ctx.runMutation(internal.consolidation.logRun, {
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

export const triggerDailyReflection = internalMutation({
  handler: async (ctx) => {
    await workflowManager.start(
      ctx,
      internal.reflection.dailyReflectionWorkflow,
      {},
    )
  },
})

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
  handler: async (ctx, args) => {
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
      model: anthropic('claude-haiku-4-5'),
      output: Output.object({ schema: PatternSchema }),
      system: `You are analyzing a user's memory patterns to identify stable facts about them.
Look for:
- Repeated themes or entities (mentioned 3+ times)
- High-importance facts that persist over time
- Identity markers, preferences, relationships, goals

Only output patterns you're confident are stable, long-term facts.`,
      prompt: `Analyze these memories and identify stable patterns:\n\n${memorySummaries}`,
    })

    return output.patterns
  },
})

export const promoteToCoreAction = internalAction({
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
    // Check if already exists
    const existing = await ctx.runQuery(internal.reflection.checkExistingCore, {
      userId: args.userId,
      content: args.pattern.content,
    })

    if (existing) {
      return await ctx.runMutation(internal.reflection.reinforceCore, {
        coreId: existing._id,
        supportingCount: args.pattern.supportingCount,
      })
    }

    // Generate embedding for new core memory (cached)
    const embedding = await embeddingCache.fetch(ctx, {
      text: args.pattern.content,
    })

    return await ctx.runMutation(internal.reflection.promoteToCore, {
      userId: args.userId,
      pattern: args.pattern,
      embedding,
    })
  },
})
```

---

## Part 8: File Structure

```
convex/
├── convex.config.ts       # Component registration (agent, workflow, cache, rate-limiter, aggregate)
├── components.ts          # Component initialization (workflowManager, embeddingCache, rateLimiter, memoryStats)
├── config.ts              # Configuration constants (thresholds, budgets)
├── types.ts               # Shared types (MemoryContext, categoryValidator)
├── schema.ts              # Database schema (memory layers only)
├── agent.ts               # Agent definition + memory tools
├── chat.ts                # Chat actions (send, stream, list) with rate limiting
├── sensory.ts             # Layer 1: Ingest, filter, attention scoring
├── shortTerm.ts           # Layer 2: Topic clustering, STM management
├── longTerm.ts            # Layer 3: Deduplication, storage, decay
├── core.ts                # Layer 5: Core memory CRUD
├── edges.ts               # Knowledge graph relationships
├── consolidation.ts       # Layer 4: Workflows for promotion, decay, pruning
├── reflection.ts          # Layer 4: Pattern detection workflow with LLM
├── extraction.ts          # LLM entity extraction (rate limited, with retry)
├── embedding.ts           # Embedding generation (cached via ActionCache)
├── retrieval.ts           # Context assembly for memory injection
├── users.ts               # User CRUD
├── threads.ts             # Thread management via Agent component
├── crons.ts               # Scheduled workflow triggers

src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   ├── chat.tsx
│   └── memory.tsx
├── components/
│   ├── ui/
│   ├── memory-tab.tsx
│   └── memory-layer-indicator.tsx
└── hooks/
    ├── use-auth.ts
    └── use-memory.ts
```

> **Note:** The Agent component manages threads and messages internally.
> Our custom schema focuses on the five memory layers.

---

## Part 9: Component Benefits Summary

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
│     └── Uses: ctx.vectorSearch (topic clustering)                       │
│                                                                         │
│  3. LONG-TERM MEMORY                                                    │
│     └── Uses: embeddingCache, memoryStats (aggregate counts)            │
│     └── Uses: ctx.vectorSearch (deduplication, retrieval)               │
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

## Part 10: Key Design Decisions

### Memory Flow is Automatic, Not Manual

The `saveToCore` tool was intentionally **removed** from the agent. Memories should flow through the proper cognitive pipeline:

```
User Message → Sensory → STM → LTM → Core (via reflection)
```

This mimics how human memory works: you don't consciously decide to remember something important forever. Instead, important information is reinforced through repetition and reflection until it becomes part of your core beliefs.

### Vector Search in Actions, Not Queries

Convex vector search (`ctx.vectorSearch`) is only available in actions, not queries. This architectural constraint led to:

1. **Separation of concerns**: Actions handle vector search, mutations handle DB writes
2. **Two-phase retrieval**: Action finds IDs via vector search, query fetches documents
3. **Fallback patterns**: Simple retrieval uses recency when embedding isn't available

### Aggregate Syncing is Manual

The `@convex-dev/aggregate` component requires manual syncing when documents change:

```typescript
// On create
await memoryStats.insert(ctx, doc)

// On update that affects sortKey
await memoryStats.replace(ctx, oldDoc, newDoc)
```

This is necessary because `currentImportance` is part of the sort key, and changes to importance (via decay or reinforcement) must be reflected in the aggregate.

### Retry Logic at Multiple Levels

The system implements retry at three levels:

1. **Extraction level**: 3 retries with exponential backoff (1s, 2s, 4s)
2. **Workflow level**: Step retries for LLM calls in reflection
3. **Rate limiting**: Automatic rescheduling when rate limited

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
