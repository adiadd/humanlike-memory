# Human-Like Memory for AI Agents: The Unified Plan (v2)

> _"The evolution of agentic memory won't be about storing more. It will be about thinking better."_

---

## Executive Summary

This document provides a complete implementation blueprint for building human-like memory in AI agents. It synthesizes insights from cognitive science, existing frameworks (Mem0, Letta, Graphiti), and practical engineering patterns into a single, coherent plan tailored for **TanStack Start + Convex + shadcn**.

**The Core Thesis:** Memory is not retrieval. Memory is cognition. Our system must encode, consolidate, retrieve, and forget—just like the human mind.

---

## Revision Notes (v2)

This revision addresses the following gaps from v1:

| Gap                                     | Resolution                                        |
| --------------------------------------- | ------------------------------------------------- |
| Topic grouping was a black box          | Added embedding-based clustering algorithm        |
| Entity extraction had no implementation | Added LLM-based structured extraction with schema |
| Core memory promotion logic missing     | Added pattern detection and promotion criteria    |
| Memory conflict resolution weak         | Added Mem0-style ADD/UPDATE/DELETE/NOOP pattern   |
| Reflection was just a stub              | Added full reflection generation implementation   |
| Agent integration underspecified        | Added context assembly and token budgeting        |
| No user correction mechanism            | Added explicit memory management mutations        |
| Cold start problem ignored              | Added onboarding flow                             |
| Concurrency concerns                    | Added user-partitioned processing                 |

### Frontend/TanStack Start Additions (v2.1)

| Gap                                       | Resolution                                                   |
| ----------------------------------------- | ------------------------------------------------------------ |
| Route structure didn't follow conventions | Added TanStack Router patterns (`_authenticated`, `$params`) |
| No data fetching patterns                 | Added TanStack Query + Convex integration (Pattern 9)        |
| Auth handling missing                     | Added `beforeLoad` guards with redirect (Pattern 10)         |
| Route loaders not specified               | Added `loader`, `pendingComponent`, `errorComponent`         |
| Component hierarchy incomplete            | Added layouts, skeletons, error components                   |
| Agent invocation unclear                  | Added Convex action with memory injection (Pattern 11)       |
| Real-time updates vague                   | Clarified Convex subscription patterns                       |

### Vercel AI SDK v6 Integration (v2.2)

| Gap                                     | Resolution                                                       |
| --------------------------------------- | ---------------------------------------------------------------- |
| Direct Anthropic/OpenAI SDK usage       | Migrated to unified Vercel AI SDK v6                             |
| No structured output for extraction     | Added `Output.object({ schema })` with Zod (Pattern 3)           |
| Manual JSON parsing for LLM responses   | AI SDK handles structured output automatically                   |
| Inconsistent embedding generation       | Unified `embed()` / `embedMany()` functions                      |
| No streaming persistence pattern        | Added chunk buffering with Convex persistence (Pattern 11)       |
| `generateObject` usage (deprecated)     | Migrated to `generateText` with `output` property (AI SDK v6)    |

---

## Part 1: The Five-Layer Architecture

Each layer is **distinct** and serves a specific cognitive function:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                     │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     1. SENSORY MEMORY (Sensory.ts)                    │  │
│  │                                                                       │  │
│  │   Purpose: Gate-keep what enters the memory system                    │  │
│  │   Lifespan: Seconds (processed immediately or discarded)              │  │
│  │                                                                       │  │
│  │   • Capture raw input with metadata                                   │  │
│  │   • Score attention worthiness (heuristics + optional LLM)            │  │
│  │   • Extract initial entities for routing                              │  │
│  │   • Pass/fail decision: score >= 0.3 continues                        │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   2. SHORT-TERM MEMORY (ShortTerm.ts)                 │  │
│  │                                                                       │  │
│  │   Purpose: Active working memory for current context                  │  │
│  │   Lifespan: Minutes to hours (expires or promotes)                    │  │
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
│  │                   3. LONG-TERM MEMORY (LongTerm.ts)                   │  │
│  │                                                                       │  │
│  │   Purpose: Persistent knowledge with temporal tracking                │  │
│  │   Lifespan: Days to months (decays, can be pruned)                    │  │
│  │                                                                       │  │
│  │   • Semantic memories: Facts, concepts, skills                        │  │
│  │   • Episodic memories: Experiences, events, conversations             │  │
│  │   • Knowledge graph: Entity relationships with edges                  │  │
│  │   • Bi-temporal: validFrom/validUntil for time-travel queries         │  │
│  │   • Conflict resolution: UPDATE supersedes, doesn't delete            │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      5. CORE MEMORY (Core.ts)                         │  │
│  │                                                                       │  │
│  │   Purpose: Stable identity, always in context                         │  │
│  │   Lifespan: Persistent, slow-evolving                                 │  │
│  │                                                                       │  │
│  │   • Identity: "User is a software engineer in Bangalore"              │  │
│  │   • Preferences: "User prefers concise, technical responses"          │  │
│  │   • Behavioral: "User typically works late evenings"                  │  │
│  │   • Relationships: "User has a dog named Max"                         │  │
│  │                                                                       │  │
│  │   Promotion criteria: 3+ occurrences, 7+ day span, 0.8+ confidence    │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │  4. MEMORY MANAGERS (Background)     │
                    │                                      │
                    │  Consolidation.ts:                   │
                    │  • Promote: STM → LTM (hourly)       │
                    │  • Decay: Apply forgetting curve     │
                    │  • Prune: Delete low-importance      │
                    │  • Merge: Deduplicate similar        │
                    │                                      │
                    │  Reflection.ts:                      │
                    │  • Detect patterns in LTM            │
                    │  • Generate meta-insights            │
                    │  • Promote patterns → Core           │
                    │                                      │
                    │         [RUNS VIA CRON JOBS]         │
                    └──────────────────────────────────────┘
```

---

## Part 2: Revised Schema Design

```typescript
// convex/Schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ============================================
  // USERS & CONVERSATIONS
  // ============================================

  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
  }),

  conversations: defineTable({
    userId: v.id('users'),
    title: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  }).index('by_user', ['userId', 'startedAt']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    userId: v.id('users'),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system'),
    ),
    content: v.string(),
    isStreaming: v.optional(v.boolean()), // True while streaming, false when complete
    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt']),

  // ============================================
  // LAYER 1: SENSORY MEMORY
  // Brief input buffer, filters noise before processing
  // ============================================

  sensoryMemories: defineTable({
    // Content
    content: v.string(),
    contentHash: v.string(), // For deduplication
    inputType: v.union(
      v.literal('message'),
      v.literal('event'),
      v.literal('observation'),
      v.literal('file'),
      v.literal('correction'), // User correcting a memory
    ),

    // Attention scoring
    attentionScore: v.float64(), // 0-1, heuristic-based
    attentionSignals: v.object({
      hasPersonalInfo: v.boolean(),
      hasNamedEntities: v.boolean(),
      hasTemporalRef: v.boolean(),
      hasSentiment: v.boolean(),
      contentLength: v.number(),
    }),

    // Initial entity extraction (lightweight)
    detectedEntities: v.optional(
      v.array(
        v.object({
          text: v.string(),
          type: v.string(), // person, place, org, skill, preference
          confidence: v.float64(),
        }),
      ),
    ),

    // Processing state
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('promoted'), // Moved to STM
      v.literal('discarded'), // Below attention threshold
    ),
    discardReason: v.optional(v.string()),

    // Ownership
    userId: v.id('users'),
    conversationId: v.optional(v.id('conversations')),
    messageId: v.optional(v.id('messages')),

    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index('by_user_status', ['userId', 'status', 'createdAt'])
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_hash', ['userId', 'contentHash']), // Dedup check

  // ============================================
  // LAYER 2: SHORT-TERM MEMORY
  // Active context buffer, grouped by topic
  // ============================================

  shortTermMemories: defineTable({
    // Content
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),

    // Topic clustering
    topicId: v.string(), // Cluster ID
    topicLabel: v.optional(v.string()), // Human-readable: "Python preferences"
    topicCentroid: v.optional(v.array(v.float64())), // For cluster membership

    // Extracted entities (full extraction)
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        attributes: v.optional(v.any()),
        salience: v.float64(), // 0-1, how central to the memory
      }),
    ),

    // Extracted relationships
    relationships: v.array(
      v.object({
        subject: v.string(),
        predicate: v.string(), // prefers, works_at, knows, lives_in
        object: v.string(),
        confidence: v.float64(),
      }),
    ),

    // Importance tracking
    importance: v.float64(), // 0-1, LLM-scored
    importanceReason: v.optional(v.string()), // Why it's important

    // Access patterns (for promotion decisions)
    accessCount: v.number(),
    lastAccessed: v.number(),
    retrievalContexts: v.array(v.string()), // What queries retrieved this

    // Lifecycle
    expiresAt: v.number(), // Auto-expire if not promoted
    promotionScore: v.float64(), // Calculated: importance * accessCount * age

    // Lineage
    sourceIds: v.array(v.id('sensoryMemories')),
    conversationId: v.id('conversations'),
    userId: v.id('users'),

    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_user_topic', ['userId', 'topicId', 'createdAt'])
    .index('by_user_importance', ['userId', 'importance'])
    .index('by_expiry', ['expiresAt'])
    .index('by_promotion_score', ['userId', 'promotionScore'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'topicId'],
    }),

  // Topic registry for clustering
  topics: defineTable({
    userId: v.id('users'),
    label: v.string(),
    centroid: v.array(v.float64()), // Average embedding of cluster
    memberCount: v.number(),
    lastUpdated: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId', 'lastUpdated']),

  // ============================================
  // LAYER 3: LONG-TERM MEMORY
  // Consolidated knowledge with temporal tracking
  // ============================================

  longTermMemories: defineTable({
    // Content
    content: v.string(),
    summary: v.string(), // Required for LTM
    embedding: v.array(v.float64()),

    // Memory classification
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    category: v.optional(v.string()), // skill, preference, fact, experience

    // Entity reference (if this memory is about an entity)
    entityName: v.optional(v.string()),
    entityType: v.optional(v.string()),

    // Importance with decay
    baseImportance: v.float64(), // Original importance (never changes)
    currentImportance: v.float64(), // After decay
    stability: v.float64(), // 1-1000, higher = slower decay

    // Access tracking
    accessCount: v.number(),
    lastAccessed: v.number(),
    retrievalQueries: v.array(v.string()), // What queries retrieved this

    // Reinforcement tracking
    reinforcementCount: v.number(), // Times this fact was repeated
    lastReinforced: v.number(),

    // Lineage
    consolidatedFrom: v.array(v.id('shortTermMemories')),

    // Ownership
    userId: v.id('users'),

    // Bi-temporal tracking
    validFrom: v.number(), // When the fact became true
    validUntil: v.optional(v.number()), // When superseded (null = current)
    supersededBy: v.optional(v.id('longTermMemories')), // What replaced this

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId', 'currentImportance'])
    .index('by_user_type', ['userId', 'memoryType', 'currentImportance'])
    .index('by_user_category', ['userId', 'category'])
    .index('by_entity', ['userId', 'entityType', 'entityName'])
    .index('by_access', ['userId', 'lastAccessed'])
    .index('by_validity', ['userId', 'validFrom', 'validUntil'])
    .index('by_reinforcement', ['userId', 'reinforcementCount'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'memoryType', 'category'],
    }),

  // ============================================
  // KNOWLEDGE GRAPH: EDGES
  // Relationships between entities/memories
  // ============================================

  memoryEdges: defineTable({
    // Nodes (can be LTM IDs or entity names)
    sourceType: v.union(v.literal('memory'), v.literal('entity')),
    sourceId: v.optional(v.id('longTermMemories')),
    sourceName: v.optional(v.string()),

    targetType: v.union(v.literal('memory'), v.literal('entity')),
    targetId: v.optional(v.id('longTermMemories')),
    targetName: v.optional(v.string()),

    // Relationship
    relationType: v.string(), // works_at, knows, prefers, related_to, etc.
    fact: v.string(), // Human-readable: "Alice works at Acme Corp"
    embedding: v.array(v.float64()),

    // Strength and confidence
    strength: v.float64(), // 0-1, increases with reinforcement
    confidence: v.float64(), // 0-1, extraction confidence

    // Ownership
    userId: v.id('users'),

    // Temporal validity
    validFrom: v.number(),
    validUntil: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_source', ['sourceType', 'sourceId'])
    .index('by_source_name', ['sourceType', 'sourceName', 'userId'])
    .index('by_target', ['targetType', 'targetId'])
    .index('by_target_name', ['targetType', 'targetName', 'userId'])
    .index('by_user_relation', ['userId', 'relationType'])
    .index('by_validity', ['userId', 'validFrom', 'validUntil'])
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
    // Content
    content: v.string(), // The core fact
    embedding: v.array(v.float64()),

    // Classification
    category: v.union(
      v.literal('identity'), // "User is a software engineer"
      v.literal('preference'), // "User prefers concise responses"
      v.literal('relationship'), // "User has a dog named Max"
      v.literal('behavioral'), // "User often works late"
      v.literal('goal'), // "User is learning Rust"
      v.literal('constraint'), // "User is vegetarian"
    ),

    // Confidence and evidence
    confidence: v.float64(), // 0-1
    evidenceCount: v.number(), // How many memories support this
    evidenceMemories: v.array(v.id('longTermMemories')),

    // Evolution tracking
    previousVersions: v.array(
      v.object({
        content: v.string(),
        changedAt: v.number(),
        reason: v.string(),
      }),
    ),

    // Ownership
    userId: v.id('users'),

    // Active status
    isActive: v.boolean(), // Can be deactivated without deleting

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_category', ['userId', 'category', 'isActive'])
    .index('by_user_confidence', ['userId', 'confidence'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'category'],
    }),

  // ============================================
  // LAYER 4: MEMORY MANAGEMENT
  // Logs and reflections
  // ============================================

  consolidationLogs: defineTable({
    userId: v.optional(v.id('users')),
    runType: v.union(
      v.literal('promotion'), // STM → LTM
      v.literal('decay'), // Apply forgetting curve
      v.literal('pruning'), // Delete low-importance
      v.literal('merging'), // Combine duplicates
      v.literal('reflection'), // Generate insights
      v.literal('core_promotion'), // LTM → Core
      v.literal('cleanup'), // Delete expired STM
    ),
    memoriesProcessed: v.number(),
    memoriesPromoted: v.number(),
    memoriesMerged: v.number(),
    memoriesPruned: v.number(),
    details: v.optional(v.string()), // JSON with specifics
    duration: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),

  reflections: defineTable({
    userId: v.id('users'),

    // Reflection content
    insight: v.string(), // "User has been focusing on Python lately"
    insightType: v.union(
      v.literal('pattern'), // Detected pattern
      v.literal('trend'), // Change over time
      v.literal('gap'), // Missing information
      v.literal('conflict'), // Contradictory memories
    ),

    // Evidence
    supportingMemories: v.array(v.id('longTermMemories')),
    confidence: v.float64(),

    // Action taken
    actionTaken: v.optional(
      v.union(
        v.literal('promoted_to_core'),
        v.literal('flagged_for_review'),
        v.literal('merged_memories'),
        v.literal('none'),
      ),
    ),

    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),

  // ============================================
  // USER MEMORY MANAGEMENT
  // Explicit user corrections and deletions
  // ============================================

  memoryCorrections: defineTable({
    userId: v.id('users'),

    // What was corrected
    targetType: v.union(
      v.literal('core'),
      v.literal('longTerm'),
      v.literal('shortTerm'),
    ),
    targetId: v.string(), // ID of the corrected memory

    // Correction details
    correctionType: v.union(
      v.literal('update'), // Change content
      v.literal('delete'), // Remove entirely
      v.literal('merge'), // Combine with another
      v.literal('split'), // Split into multiple
    ),
    originalContent: v.string(),
    correctedContent: v.optional(v.string()),
    reason: v.optional(v.string()),

    // Status
    applied: v.boolean(),
    appliedAt: v.optional(v.number()),

    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),
})
```

---

## Part 2.5: Vercel AI SDK v6 Setup

The Vercel AI SDK provides a unified, provider-agnostic API for LLM interactions. This project uses AI SDK v6, which introduces important changes from previous versions.

### Installation

```bash
# Core AI SDK
bun add ai

# Provider packages
bun add @ai-sdk/anthropic @ai-sdk/openai

# Zod for structured output schemas
bun add zod
```

### Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Key AI SDK v6 Concepts

#### 1. Unified Provider API

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

// Models are created via provider functions
const model = anthropic('claude-sonnet-4-20250514')
const embeddingModel = openai.embedding('text-embedding-3-small')
```

#### 2. Structured Output (Replaces `generateObject`)

> **IMPORTANT:** `generateObject` and `streamObject` are **deprecated** in AI SDK v6.
> Use `generateText` / `streamText` with the `output` property instead.

```typescript
import { generateText, Output } from 'ai'
import { z } from 'zod'

const schema = z.object({
  entities: z.array(z.object({
    name: z.string().describe('Entity name'),
    type: z.string().describe('Entity type'),
  })),
  importance: z.number().min(0).max(1),
})

const { output } = await generateText({
  model: anthropic('claude-3-5-haiku-latest'),
  output: Output.object({ schema }),
  prompt: 'Extract entities from: "I work at Acme Corp"',
})

// output is fully typed: { entities: [...], importance: number }
```

#### 3. Embeddings

```typescript
import { embed, embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'

// Single embedding
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'Hello world',
})

// Batch embeddings (auto-chunks large requests)
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: ['Hello', 'World', 'Foo', 'Bar'],
})
```

#### 4. Streaming

```typescript
import { streamText } from 'ai'

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: 'You are a helpful assistant.',
  prompt: 'Tell me a story.',
})

// Async iterator for streaming
for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}

// Or get the full response
const { text, usage } = await result
```

#### 5. Output Variants

```typescript
import { Output } from 'ai'

// Structured object (with Zod schema)
output: Output.object({ schema: MyZodSchema })

// Array of objects
output: Output.array({ element: MyItemSchema })

// Plain text (default, no output needed)
// Just use generateText without output property
```

### Convex + AI SDK Integration Notes

1. **Actions only**: AI SDK calls must be in Convex `action` or `internalAction` (not `mutation` or `query`)
2. **Streaming with persistence**: Buffer chunks and persist to Convex DB for resilience
3. **Environment variables**: Convex automatically loads `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`

### Model Recommendations

| Use Case              | Model                              | Notes                                   |
| --------------------- | ---------------------------------- | --------------------------------------- |
| Entity extraction     | `claude-3-5-haiku-latest`          | Fast, cost-effective for structured    |
| Conflict resolution   | `claude-3-5-haiku-latest`          | Simple decisions, low latency          |
| Chat responses        | `claude-sonnet-4-20250514`         | Balanced quality/speed                  |
| Complex reasoning     | `claude-opus-4-20250514`           | When quality is paramount               |
| Embeddings            | `text-embedding-3-small`           | 1536 dims, good cost/quality balance    |
| High-dim embeddings   | `text-embedding-3-large`           | 3072 dims, better for complex queries   |

---

## Part 3: Implementation Patterns (Revised)

### Pattern 1: Sensory Memory - Attention Scoring

```typescript
// convex/Sensory.ts
import { mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Attention signal weights (tunable)
const ATTENTION_WEIGHTS = {
  personalInfo: 0.25,
  namedEntities: 0.15,
  temporalRef: 0.1,
  sentiment: 0.05,
  lengthBonus: 0.15,
  lengthPenalty: -0.3,
}

const ATTENTION_THRESHOLD = 0.3

export const ingestMessage = mutation({
  args: {
    content: v.string(),
    userId: v.id('users'),
    conversationId: v.id('conversations'),
    messageId: v.optional(v.id('messages')),
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

    // 2. Calculate attention signals
    const signals = calculateAttentionSignals(args.content)
    const attentionScore = calculateAttentionScore(signals)

    // 3. Quick entity detection (regex-based, not LLM)
    const detectedEntities = detectEntitiesQuick(args.content)

    // 4. Store in sensory memory
    const memoryId = await ctx.db.insert('sensoryMemories', {
      content: args.content,
      contentHash,
      inputType: 'message',
      attentionScore,
      attentionSignals: signals,
      detectedEntities,
      status: attentionScore >= ATTENTION_THRESHOLD ? 'pending' : 'discarded',
      discardReason:
        attentionScore < ATTENTION_THRESHOLD
          ? `Low attention score: ${attentionScore.toFixed(2)}`
          : undefined,
      userId: args.userId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      createdAt: Date.now(),
    })

    // 5. If passes threshold, schedule promotion to STM
    if (attentionScore >= ATTENTION_THRESHOLD) {
      await ctx.scheduler.runAfter(0, internal.ShortTerm.promoteFromSensory, {
        sensoryMemoryId: memoryId,
      })
    }

    return { status: 'created', id: memoryId, attentionScore }
  },
})

function calculateAttentionSignals(content: string) {
  const lower = content.toLowerCase()

  return {
    // Personal information patterns
    hasPersonalInfo:
      /\b(i am|i'm|my name|i work|i live|i prefer|i like|i hate|i need|i want)\b/i.test(
        content,
      ) ||
      /\b(my wife|my husband|my kid|my dog|my cat|my family|my job|my company)\b/i.test(
        content,
      ),

    // Named entities (capitalized words mid-sentence)
    hasNamedEntities:
      (content.match(/(?<=[a-z]\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [])
        .length > 0,

    // Temporal references
    hasTemporalRef:
      /\b(yesterday|today|tomorrow|last week|next month|always|never|usually|every|recently)\b/i.test(
        content,
      ) ||
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        content,
      ),

    // Sentiment indicators
    hasSentiment:
      /\b(love|hate|amazing|terrible|excited|frustrated|happy|sad|worried|great)\b/i.test(
        content,
      ),

    // Content length
    contentLength: content.length,
  }
}

function calculateAttentionScore(
  signals: ReturnType<typeof calculateAttentionSignals>,
): number {
  let score = 0.4 // Base score

  if (signals.hasPersonalInfo) score += ATTENTION_WEIGHTS.personalInfo
  if (signals.hasNamedEntities) score += ATTENTION_WEIGHTS.namedEntities
  if (signals.hasTemporalRef) score += ATTENTION_WEIGHTS.temporalRef
  if (signals.hasSentiment) score += ATTENTION_WEIGHTS.sentiment

  // Length modifiers
  if (signals.contentLength >= 50) score += ATTENTION_WEIGHTS.lengthBonus
  if (signals.contentLength < 20) score += ATTENTION_WEIGHTS.lengthPenalty

  // Low-value pattern penalties
  if (
    /^(ok|thanks|yes|no|sure|got it|okay|right|hmm|ah|k|yep|nope)$/i.test(
      signals.contentLength.toString(),
    )
  ) {
    score -= 0.5
  }

  return Math.max(0, Math.min(1, score))
}

function detectEntitiesQuick(content: string) {
  const entities: Array<{ text: string; type: string; confidence: number }> = []

  // Named entities (capitalized)
  const namedMatches =
    content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  for (const match of namedMatches) {
    entities.push({ text: match, type: 'named_entity', confidence: 0.6 })
  }

  // Skills/technologies (common patterns)
  const techPatterns =
    /\b(Python|JavaScript|TypeScript|React|Node|Rust|Go|Java|SQL|AWS|Docker|Kubernetes)\b/gi
  const techMatches = content.match(techPatterns) || []
  for (const match of techMatches) {
    entities.push({ text: match, type: 'skill', confidence: 0.9 })
  }

  return entities.slice(0, 10) // Cap at 10 entities
}

function hashContent(content: string): string {
  // Simple hash for deduplication
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}
```

### Pattern 2: Short-Term Memory - Topic Clustering

```typescript
// convex/ShortTerm.ts
import { internalMutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

const TOPIC_SIMILARITY_THRESHOLD = 0.82 // Cosine similarity for same topic
const STM_EXPIRY_HOURS = 4

export const promoteFromSensory = internalMutation({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
  },
  handler: async (ctx, args) => {
    const sensory = await ctx.db.get(args.sensoryMemoryId)
    if (!sensory || sensory.status !== 'pending') return

    // Mark as processing
    await ctx.db.patch(args.sensoryMemoryId, { status: 'processing' })

    // Schedule the async extraction (LLM call)
    await ctx.scheduler.runAfter(0, internal.Extraction.extractAndEmbed, {
      sensoryMemoryId: args.sensoryMemoryId,
      content: sensory.content,
      userId: sensory.userId,
      conversationId: sensory.conversationId!,
    })
  },
})

// Called after extraction.extractAndEmbed completes
export const createShortTermMemory = internalMutation({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        attributes: v.optional(v.any()),
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
    importanceReason: v.optional(v.string()),
    userId: v.id('users'),
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    // 1. Find or create topic
    const { topicId, topicLabel } = await findOrCreateTopic(
      ctx,
      args.userId,
      args.embedding,
      args.entities,
    )

    // 2. Calculate initial promotion score
    const promotionScore = args.importance * 0.5 // Will grow with access

    // 3. Create STM entry
    const stmId = await ctx.db.insert('shortTermMemories', {
      content: args.content,
      summary: args.summary,
      embedding: args.embedding,
      topicId,
      topicLabel,
      entities: args.entities,
      relationships: args.relationships,
      importance: args.importance,
      importanceReason: args.importanceReason,
      accessCount: 1,
      lastAccessed: Date.now(),
      retrievalContexts: [],
      expiresAt: Date.now() + STM_EXPIRY_HOURS * 60 * 60 * 1000,
      promotionScore,
      sourceIds: [args.sensoryMemoryId],
      conversationId: args.conversationId,
      userId: args.userId,
      createdAt: Date.now(),
    })

    // 4. Update sensory memory status
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
  // 1. Search for similar topics by vector similarity
  const similarMemories = await ctx.db
    .query('shortTermMemories')
    .withIndex('embedding_idx')
    .vectorSearch('embedding', embedding, {
      filter: (q: any) => q.eq('userId', userId),
      limit: 5,
    })

  // 2. Check if any are similar enough to cluster
  for (const memory of similarMemories) {
    if (memory._score >= TOPIC_SIMILARITY_THRESHOLD && memory.topicId) {
      // Update topic centroid (running average)
      const topic = await ctx.db
        .query('topics')
        .filter((q: any) => q.eq(q.field('_id'), memory.topicId))
        .first()

      if (topic) {
        const newCentroid = averageEmbeddings(
          topic.centroid,
          embedding,
          topic.memberCount,
        )
        await ctx.db.patch(topic._id, {
          centroid: newCentroid,
          memberCount: topic.memberCount + 1,
          lastUpdated: Date.now(),
        })
      }

      return { topicId: memory.topicId, topicLabel: memory.topicLabel }
    }
  }

  // 3. Create new topic
  const topicLabel = generateTopicLabel(entities)
  const topicId = await ctx.db.insert('topics', {
    userId,
    label: topicLabel,
    centroid: embedding,
    memberCount: 1,
    lastUpdated: Date.now(),
    createdAt: Date.now(),
  })

  return { topicId, topicLabel }
}

function averageEmbeddings(
  current: number[],
  newEmb: number[],
  currentCount: number,
): number[] {
  return current.map(
    (val, i) => (val * currentCount + newEmb[i]) / (currentCount + 1),
  )
}

function generateTopicLabel(
  entities: Array<{ name: string; type: string; salience: number }>,
): string {
  // Use most salient entity as topic label
  const sorted = [...entities].sort((a, b) => b.salience - a.salience)
  if (sorted.length > 0) {
    return `${sorted[0].type}: ${sorted[0].name}`
  }
  return 'General'
}
```

### Pattern 3: Entity Extraction with LLM (Vercel AI SDK v6)

```typescript
// convex/Extraction.ts
import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { generateText, embed, embedMany, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// ============================================
// SCHEMA DEFINITIONS (Zod for type-safe extraction)
// ============================================

const EntitySchema = z.object({
  name: z.string().describe('The entity name (e.g., "Python", "Acme Corp")'),
  type: z
    .string()
    .describe('Entity type: person, place, org, skill, preference, date'),
  attributes: z
    .record(z.string())
    .optional()
    .describe('Additional context about the entity'),
  salience: z
    .number()
    .min(0)
    .max(1)
    .describe('How central this entity is to the message (0-1)'),
})

const RelationshipSchema = z.object({
  subject: z.string().describe('The subject of the relationship'),
  predicate: z
    .string()
    .describe('The relationship type: prefers, works_at, knows, lives_in'),
  object: z.string().describe('The object of the relationship'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Extraction confidence (0-1)'),
})

const ExtractionSchema = z.object({
  entities: z
    .array(EntitySchema)
    .describe('Extracted entities from the message'),
  relationships: z
    .array(RelationshipSchema)
    .describe('Relationships between entities'),
  importance: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'How important this is to remember long-term. Personal info > preferences > facts > opinions > transient',
    ),
  importanceReason: z
    .string()
    .describe('Brief explanation of the importance score'),
  summary: z
    .string()
    .describe('One sentence capturing the key information'),
})

// ============================================
// EXTRACTION ACTION
// ============================================

export const extractAndEmbed = internalAction({
  args: {
    sensoryMemoryId: v.id('sensoryMemories'),
    content: v.string(),
    userId: v.id('users'),
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    // 1. Extract entities and relationships with structured output (AI SDK v6)
    const { output: extraction } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      output: Output.object({ schema: ExtractionSchema }),
      system: `You are an entity and relationship extractor. Extract structured information from user messages.

Rules:
- "user" is always a valid subject for user preferences/facts
- salience is how central the entity is to this message (0-1)
- confidence is how certain the relationship extraction is (0-1)
- importance considers: personal info > preferences > facts > opinions > transient`,
      prompt: `Extract entities, relationships, and importance from this message:\n\n"${args.content}"`,
    })

    // Handle extraction failure
    if (!extraction) {
      console.error('Failed to extract structured data')
      await ctx.runMutation(internal.ShortTerm.createShortTermMemory, {
        sensoryMemoryId: args.sensoryMemoryId,
        content: args.content,
        summary: args.content.slice(0, 100),
        embedding: await generateEmbedding(args.content),
        entities: [],
        relationships: [],
        importance: 0.5,
        importanceReason: 'Default importance (extraction failed)',
        userId: args.userId,
        conversationId: args.conversationId,
      })
      return
    }

    // 2. Generate embedding using AI SDK
    const embedding = await generateEmbedding(args.content)

    // 3. Create short-term memory
    await ctx.runMutation(internal.ShortTerm.createShortTermMemory, {
      sensoryMemoryId: args.sensoryMemoryId,
      content: args.content,
      summary: extraction.summary,
      embedding,
      entities: extraction.entities,
      relationships: extraction.relationships,
      importance: extraction.importance,
      importanceReason: extraction.importanceReason,
      userId: args.userId,
      conversationId: args.conversationId,
    })
  },
})

// ============================================
// EMBEDDING HELPER
// ============================================

async function generateEmbedding(content: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: content,
  })
  return embedding
}

// Batch embedding for multiple values
export async function generateEmbeddings(
  contents: string[],
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: contents,
  })
  return embeddings
}
```

### Pattern 4: Memory Conflict Resolution (ADD/UPDATE/DELETE/NOOP) - AI SDK v6

```typescript
// convex/LongTerm.ts
import { internalMutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// ============================================
// CONFLICT RESOLUTION SCHEMA
// ============================================

const ConflictResolutionSchema = z.object({
  action: z
    .enum(['ADD', 'UPDATE', 'DELETE', 'NOOP'])
    .describe(
      'ADD: keep both, UPDATE: supersede existing, DELETE: invalidate existing, NOOP: redundant',
    ),
  reason: z.string().describe('Brief explanation of the decision'),
  mergedContent: z
    .string()
    .nullable()
    .describe('If UPDATE, the combined/merged content'),
})

// ============================================
// CONFLICT RESOLUTION ACTION
// ============================================

export const checkConflictsAndStore = internalAction({
  args: {
    content: v.string(),
    summary: v.string(),
    embedding: v.array(v.float64()),
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    category: v.optional(v.string()),
    entityName: v.optional(v.string()),
    entityType: v.optional(v.string()),
    baseImportance: v.float64(),
    userId: v.id('users'),
    consolidatedFrom: v.array(v.id('shortTermMemories')),
  },
  handler: async (ctx, args) => {
    // 1. Find potentially conflicting memories
    const similar = await ctx.runQuery(internal.Search.vectorSearchLTM, {
      userId: args.userId,
      embedding: args.embedding,
      limit: 5,
      threshold: 0.85,
    })

    let action = 'ADD'
    let targetMemory = null
    let mergedContent = null

    // 2. Check each similar memory for conflicts using AI SDK v6
    for (const memory of similar) {
      const resolution = await resolveConflict(memory.content, args.content)

      if (resolution.action === 'NOOP') {
        // Don't store, it's redundant
        return { action: 'NOOP', reason: resolution.reason }
      }

      if (resolution.action === 'UPDATE' || resolution.action === 'DELETE') {
        action = resolution.action
        targetMemory = memory
        mergedContent = resolution.mergedContent
        break
      }
    }

    // 3. Execute the action
    if (action === 'UPDATE' && targetMemory) {
      await ctx.runMutation(internal.LongTerm.supersede, {
        oldMemoryId: targetMemory._id,
        newContent: mergedContent || args.content,
        newSummary: args.summary,
        newEmbedding: args.embedding,
        baseImportance: Math.max(
          args.baseImportance,
          targetMemory.baseImportance,
        ),
        userId: args.userId,
        consolidatedFrom: args.consolidatedFrom,
      })
      return { action: 'UPDATE', superseded: targetMemory._id }
    }

    if (action === 'DELETE' && targetMemory) {
      await ctx.runMutation(internal.LongTerm.invalidate, {
        memoryId: targetMemory._id,
        reason: 'Contradicted by newer information',
      })
    }

    // ADD: Create new memory
    const newId = await ctx.runMutation(internal.LongTerm.create, {
      ...args,
      currentImportance: args.baseImportance,
      stability: 100,
    })

    return { action: 'ADD', id: newId }
  },
})

// ============================================
// CONFLICT RESOLVER (AI SDK v6 Structured Output)
// ============================================

async function resolveConflict(existing: string, newContent: string) {
  const { output } = await generateText({
    model: anthropic('claude-3-5-haiku-latest'),
    output: Output.object({ schema: ConflictResolutionSchema }),
    system: `You are a memory conflict resolver. Given an existing memory and a new memory, decide what to do:

- ADD: New memory is different information, keep both
- UPDATE: New memory supersedes existing (same topic, newer info). Provide mergedContent.
- DELETE: New memory contradicts and invalidates existing
- NOOP: New memory is redundant, don't store it`,
    prompt: `Existing memory: "${existing}"

New memory: "${newContent}"

Analyze and decide the appropriate action.`,
  })

  // Fallback if structured output fails
  if (!output) {
    return { action: 'ADD' as const, reason: 'Default to ADD on parse failure', mergedContent: null }
  }

  return output
}

export const supersede = internalMutation({
  args: {
    oldMemoryId: v.id('longTermMemories'),
    newContent: v.string(),
    newSummary: v.string(),
    newEmbedding: v.array(v.float64()),
    baseImportance: v.float64(),
    userId: v.id('users'),
    consolidatedFrom: v.array(v.id('shortTermMemories')),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Mark old memory as superseded
    await ctx.db.patch(args.oldMemoryId, {
      validUntil: now,
    })

    // Create new memory with reference to old
    const newId = await ctx.db.insert('longTermMemories', {
      content: args.newContent,
      summary: args.newSummary,
      embedding: args.newEmbedding,
      memoryType: 'semantic',
      baseImportance: args.baseImportance,
      currentImportance: args.baseImportance,
      stability: 100,
      accessCount: 0,
      lastAccessed: now,
      retrievalQueries: [],
      reinforcementCount: 1,
      lastReinforced: now,
      consolidatedFrom: args.consolidatedFrom,
      userId: args.userId,
      validFrom: now,
      createdAt: now,
      updatedAt: now,
    })

    // Link supersession
    await ctx.db.patch(args.oldMemoryId, {
      supersededBy: newId,
    })

    return newId
  },
})
```

### Pattern 5: Core Memory Promotion

```typescript
// convex/Reflection.ts
import { internalMutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

// Promotion criteria
const CORE_PROMOTION_CRITERIA = {
  minOccurrences: 3, // Must appear 3+ times
  minSpanDays: 7, // Across at least 7 days
  minConfidence: 0.75, // High confidence
  minImportance: 0.7, // Important memories only
}

export const detectPatternsAndPromote = internalAction({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // 1. Get high-importance long-term memories from last 30 days
    const memories = await ctx.runQuery(internal.LongTerm.getRecentImportant, {
      userId: args.userId,
      minImportance: CORE_PROMOTION_CRITERIA.minImportance,
      days: 30,
    })

    // 2. Group by entity/topic
    const patterns = groupIntoPatterns(memories)

    // 3. Check each pattern against promotion criteria
    const promotionCandidates = []

    for (const pattern of patterns) {
      const spanDays =
        (pattern.lastSeen - pattern.firstSeen) / (1000 * 60 * 60 * 24)

      if (
        pattern.occurrences >= CORE_PROMOTION_CRITERIA.minOccurrences &&
        spanDays >= CORE_PROMOTION_CRITERIA.minSpanDays &&
        pattern.avgConfidence >= CORE_PROMOTION_CRITERIA.minConfidence
      ) {
        promotionCandidates.push(pattern)
      }
    }

    // 4. Check if pattern already exists in core memory
    for (const candidate of promotionCandidates) {
      const existingCore = await ctx.runQuery(internal.Core.findSimilar, {
        userId: args.userId,
        embedding: candidate.embedding,
        threshold: 0.9,
      })

      if (existingCore) {
        // Update confidence and evidence
        await ctx.runMutation(internal.Core.reinforce, {
          coreMemoryId: existingCore._id,
          newEvidence: candidate.memoryIds,
        })
      } else {
        // Create new core memory
        await ctx.runMutation(internal.Core.create, {
          content: candidate.summary,
          embedding: candidate.embedding,
          category: categorizePattern(candidate),
          confidence: candidate.avgConfidence,
          evidenceCount: candidate.occurrences,
          evidenceMemories: candidate.memoryIds,
          userId: args.userId,
        })
      }
    }

    // 5. Log reflection
    await ctx.runMutation(internal.Consolidation.logRun, {
      userId: args.userId,
      runType: 'reflection',
      memoriesProcessed: memories.length,
      memoriesPromoted: promotionCandidates.length,
      memoriesMerged: 0,
      memoriesPruned: 0,
    })

    // 6. Create reflection records
    for (const candidate of promotionCandidates) {
      await ctx.runMutation(internal.Reflection.createReflection, {
        userId: args.userId,
        insight: `Detected pattern: ${candidate.summary}`,
        insightType: 'pattern',
        supportingMemories: candidate.memoryIds,
        confidence: candidate.avgConfidence,
        actionTaken: 'promoted_to_core',
      })
    }

    return {
      patternsDetected: patterns.length,
      promoted: promotionCandidates.length,
    }
  },
})

function groupIntoPatterns(memories: any[]) {
  // Group memories by similar content (entity-based clustering)
  const patterns = new Map()

  for (const memory of memories) {
    // Key by entity name if available, otherwise by content hash
    const key = memory.entityName || hashContent(memory.summary)

    if (!patterns.has(key)) {
      patterns.set(key, {
        key,
        summary: memory.summary,
        embedding: memory.embedding,
        memoryIds: [],
        occurrences: 0,
        firstSeen: memory.createdAt,
        lastSeen: memory.createdAt,
        totalConfidence: 0,
        avgConfidence: 0,
      })
    }

    const pattern = patterns.get(key)
    pattern.memoryIds.push(memory._id)
    pattern.occurrences++
    pattern.lastSeen = Math.max(pattern.lastSeen, memory.createdAt)
    pattern.firstSeen = Math.min(pattern.firstSeen, memory.createdAt)
    pattern.totalConfidence += memory.currentImportance
    pattern.avgConfidence = pattern.totalConfidence / pattern.occurrences
  }

  return Array.from(patterns.values())
}

function categorizePattern(pattern: any): string {
  const content = pattern.summary.toLowerCase()

  if (/\b(i am|i'm|my name|work as|profession|job)\b/.test(content)) {
    return 'identity'
  }
  if (/\b(prefer|like|love|favorite|rather|instead)\b/.test(content)) {
    return 'preference'
  }
  if (/\b(always|usually|often|every|habit|routine)\b/.test(content)) {
    return 'behavioral'
  }
  if (/\b(wife|husband|friend|family|dog|cat|pet)\b/.test(content)) {
    return 'relationship'
  }
  if (/\b(learning|goal|want to|trying to|planning)\b/.test(content)) {
    return 'goal'
  }
  if (/\b(can't|don't|never|avoid|allergic|vegetarian)\b/.test(content)) {
    return 'constraint'
  }

  return 'identity' // Default
}

function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i)
    hash = hash & hash
  }
  return hash.toString(16)
}
```

### Pattern 6: Context Assembly for Agent

```typescript
// convex/Retrieval.ts
import { query, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// Token budget allocation
const CONTEXT_BUDGET = {
  core: 400, // Core memories always included
  longTerm: 1200, // Relevant long-term memories
  shortTerm: 400, // Current session context
  total: 2000, // Max tokens for memory context
}

// Rough token estimation (4 chars per token)
const CHARS_PER_TOKEN = 4

export const assembleContext = query({
  args: {
    userId: v.id('users'),
    conversationId: v.id('conversations'),
    queryEmbedding: v.array(v.float64()),
    queryText: v.string(),
  },
  handler: async (ctx, args) => {
    const context: MemoryContext = {
      core: [],
      longTerm: [],
      shortTerm: [],
      totalTokens: 0,
    }

    // 1. Always include core memories (highest priority)
    const coreMemories = await ctx.db
      .query('coreMemories')
      .withIndex('by_user_category', (q) =>
        q.eq('userId', args.userId).eq('isActive', true),
      )
      .order('desc')
      .take(10)

    let usedTokens = 0
    for (const core of coreMemories) {
      const tokens = Math.ceil(core.content.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.core) {
        context.core.push({
          content: core.content,
          category: core.category,
          confidence: core.confidence,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    // 2. Retrieve relevant long-term memories
    const ltmResults = await ctx.db
      .query('longTermMemories')
      .withIndex('embedding_idx')
      .vectorSearch('embedding', args.queryEmbedding, {
        filter: (q) =>
          q.and(
            q.eq('userId', args.userId),
            q.eq('validUntil', undefined), // Only current memories
          ),
        limit: 20,
      })

    // Score and rank LTM
    const scoredLtm = ltmResults.map((m) => ({
      ...m,
      retrievalScore: calculateRetrievalScore(m, m._score),
    }))
    scoredLtm.sort((a, b) => b.retrievalScore - a.retrievalScore)

    usedTokens = 0
    for (const ltm of scoredLtm) {
      const tokens = Math.ceil(ltm.summary.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.longTerm) {
        context.longTerm.push({
          content: ltm.summary,
          type: ltm.memoryType,
          importance: ltm.currentImportance,
          score: ltm.retrievalScore,
        })
        usedTokens += tokens

        // Track retrieval for reinforcement
        await ctx.db.patch(ltm._id, {
          accessCount: ltm.accessCount + 1,
          lastAccessed: Date.now(),
          retrievalQueries: [...ltm.retrievalQueries.slice(-9), args.queryText],
        })
      }
    }
    context.totalTokens += usedTokens

    // 3. Include recent short-term memories from this conversation
    const stmResults = await ctx.db
      .query('shortTermMemories')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .order('desc')
      .take(10)

    usedTokens = 0
    for (const stm of stmResults) {
      const content = stm.summary || stm.content
      const tokens = Math.ceil(content.length / CHARS_PER_TOKEN)
      if (usedTokens + tokens <= CONTEXT_BUDGET.shortTerm) {
        context.shortTerm.push({
          content,
          topic: stm.topicLabel,
          importance: stm.importance,
        })
        usedTokens += tokens
      }
    }
    context.totalTokens += usedTokens

    return context
  },
})

function calculateRetrievalScore(
  memory: {
    lastAccessed: number
    currentImportance: number
    accessCount: number
  },
  embeddingScore: number,
): number {
  const now = Date.now()
  const hoursSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60)

  // Weights
  const recencyWeight = 0.25
  const importanceWeight = 0.25
  const relevanceWeight = 0.4
  const frequencyWeight = 0.1

  // Recency: exponential decay
  const recencyScore = Math.pow(0.995, hoursSinceAccess)

  // Frequency: logarithmic scaling
  const frequencyScore = Math.min(1, Math.log10(memory.accessCount + 1) / 2)

  return (
    recencyWeight * recencyScore +
    importanceWeight * memory.currentImportance +
    relevanceWeight * embeddingScore +
    frequencyWeight * frequencyScore
  )
}

interface MemoryContext {
  core: Array<{ content: string; category: string; confidence: number }>
  longTerm: Array<{
    content: string
    type: string
    importance: number
    score: number
  }>
  shortTerm: Array<{ content: string; topic?: string; importance: number }>
  totalTokens: number
}

// Format context for system prompt injection
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

### Pattern 7: User Memory Corrections

```typescript
// convex/Corrections.ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const forgetMemory = mutation({
  args: {
    userId: v.id('users'),
    memoryType: v.union(
      v.literal('core'),
      v.literal('longTerm'),
      v.literal('shortTerm'),
    ),
    memoryId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Log the correction
    await ctx.db.insert('memoryCorrections', {
      userId: args.userId,
      targetType: args.memoryType,
      targetId: args.memoryId,
      correctionType: 'delete',
      originalContent: '', // Will be filled below
      reason: args.reason,
      applied: false,
      createdAt: Date.now(),
    })

    // 2. Apply the deletion based on type
    if (args.memoryType === 'core') {
      const memory = await ctx.db.get(args.memoryId as any)
      if (memory && memory.userId === args.userId) {
        await ctx.db.patch(args.memoryId as any, { isActive: false })
      }
    } else if (args.memoryType === 'longTerm') {
      const memory = await ctx.db.get(args.memoryId as any)
      if (memory && memory.userId === args.userId) {
        await ctx.db.patch(args.memoryId as any, { validUntil: Date.now() })
      }
    } else if (args.memoryType === 'shortTerm') {
      const memory = await ctx.db.get(args.memoryId as any)
      if (memory && memory.userId === args.userId) {
        await ctx.db.delete(args.memoryId as any)
      }
    }

    return { success: true }
  },
})

export const correctMemory = mutation({
  args: {
    userId: v.id('users'),
    memoryType: v.union(v.literal('core'), v.literal('longTerm')),
    memoryId: v.string(),
    correctedContent: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.memoryType === 'core') {
      const memory = await ctx.db.get(args.memoryId as any)
      if (memory && memory.userId === args.userId) {
        // Store previous version
        const previousVersions = memory.previousVersions || []
        previousVersions.push({
          content: memory.content,
          changedAt: Date.now(),
          reason: args.reason || 'User correction',
        })

        await ctx.db.patch(args.memoryId as any, {
          content: args.correctedContent,
          previousVersions,
          updatedAt: Date.now(),
        })

        // Log correction
        await ctx.db.insert('memoryCorrections', {
          userId: args.userId,
          targetType: 'core',
          targetId: args.memoryId,
          correctionType: 'update',
          originalContent: memory.content,
          correctedContent: args.correctedContent,
          reason: args.reason,
          applied: true,
          appliedAt: Date.now(),
          createdAt: Date.now(),
        })
      }
    } else if (args.memoryType === 'longTerm') {
      const memory = await ctx.db.get(args.memoryId as any)
      if (memory && memory.userId === args.userId) {
        // Supersede with corrected version
        await ctx.db.patch(args.memoryId as any, {
          validUntil: Date.now(),
        })

        // Create corrected version
        await ctx.db.insert('longTermMemories', {
          ...memory,
          _id: undefined,
          content: args.correctedContent,
          summary: args.correctedContent,
          validFrom: Date.now(),
          validUntil: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any)
      }
    }

    return { success: true }
  },
})
```

### Pattern 8: Cron Jobs (Revised)

```typescript
// convex/Crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// ============================================
// HIGH FREQUENCY (Every 5-15 minutes)
// ============================================

// Clean up expired short-term memories
crons.interval(
  'cleanup-expired-stm',
  { minutes: 15 },
  internal.Consolidation.cleanupExpiredSTM,
)

// Apply decay to importance scores
crons.interval(
  'apply-decay',
  { minutes: 30 },
  internal.Consolidation.applyDecay,
)

// ============================================
// MEDIUM FREQUENCY (Hourly)
// ============================================

// Promote high-value STM to LTM
crons.interval(
  'promote-stm-to-ltm',
  { hours: 1 },
  internal.Consolidation.promoteToLongTerm,
)

// Merge duplicate/similar memories
crons.interval(
  'merge-similar',
  { hours: 2 },
  internal.Consolidation.mergeSimilarMemories,
)

// ============================================
// LOW FREQUENCY (Daily/Weekly)
// ============================================

// Generate reflections and promote patterns to core
// Run at 3 AM UTC when usage is typically low
crons.daily(
  'daily-reflection',
  { hourUTC: 3, minuteUTC: 0 },
  internal.Reflection.runDailyReflection,
)

// Prune very low importance memories
crons.weekly(
  'weekly-prune',
  { dayOfWeek: 'sunday', hourUTC: 4, minuteUTC: 0 },
  internal.Consolidation.pruneMemories,
)

// Archive old sensory memories (keep only stats)
crons.weekly(
  'archive-sensory',
  { dayOfWeek: 'sunday', hourUTC: 5, minuteUTC: 0 },
  internal.Consolidation.archiveSensory,
)

export default crons
```

### Pattern 9: TanStack Query + Convex Integration

```typescript
// src/lib/memory-hooks.ts
import { useQuery, useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// ============================================
// CORE MEMORY HOOKS
// Real-time subscriptions via Convex
// ============================================

export function useCoreMemories(userId: Id<'users'>) {
  return useQuery({
    ...convexQuery(api.Core.listActive, { userId }),
    // Convex handles real-time updates automatically
    // No need for manual invalidation
  })
}

export function useCoreMemoriesByCategory(
  userId: Id<'users'>,
  category:
    | 'identity'
    | 'preference'
    | 'relationship'
    | 'behavioral'
    | 'goal'
    | 'constraint',
) {
  return useQuery({
    ...convexQuery(api.Core.byCategory, { userId, category }),
  })
}

// ============================================
// CONVERSATION & SHORT-TERM MEMORY
// ============================================

export function useConversation(conversationId: Id<'conversations'>) {
  return useSuspenseQuery({
    ...convexQuery(api.Conversations.get, { conversationId }),
  })
}

export function useConversationMessages(conversationId: Id<'conversations'>) {
  return useQuery({
    ...convexQuery(api.Messages.list, { conversationId }),
  })
}

export function useShortTermMemories(conversationId: Id<'conversations'>) {
  return useQuery({
    ...convexQuery(api.ShortTerm.byConversation, { conversationId }),
  })
}

// ============================================
// MEMORY CONTEXT FOR AGENT
// ============================================

export function useMemoryContext(
  userId: Id<'users'>,
  conversationId: Id<'conversations'>,
  queryText: string,
  queryEmbedding: number[],
) {
  return useQuery({
    ...convexQuery(api.Retrieval.assembleContext, {
      userId,
      conversationId,
      queryText,
      queryEmbedding,
    }),
    // Only fetch when we have an embedding
    enabled: queryEmbedding.length > 0,
  })
}

// ============================================
// MUTATIONS
// ============================================

export function useSendMessage() {
  const sendMessage = useConvexMutation(api.Messages.send)
  return useMutation({
    mutationFn: sendMessage,
    // Convex automatically updates all subscribed queries
  })
}

export function useCorrectMemory() {
  const correctMemory = useConvexMutation(api.Corrections.correctMemory)
  return useMutation({
    mutationFn: correctMemory,
  })
}

export function useForgetMemory() {
  const forgetMemory = useConvexMutation(api.Corrections.forgetMemory)
  return useMutation({
    mutationFn: forgetMemory,
  })
}

export function useUpdateCoreMemory() {
  const updateCore = useConvexMutation(api.Core.update)
  return useMutation({
    mutationFn: updateCore,
  })
}

// ============================================
// LONG-TERM MEMORY SEARCH
// ============================================

export function useLongTermMemories(userId: Id<'users'>) {
  return useQuery({
    ...convexQuery(api.LongTerm.listRecent, { userId, limit: 50 }),
  })
}

export function useMemoryGraph(userId: Id<'users'>) {
  return useQuery({
    ...convexQuery(api.Edges.getGraph, { userId }),
  })
}
```

### Pattern 10: Route Loaders and Auth Guards

```typescript
// src/routes/_authenticated.tsx
// Pathless layout route for authenticated sections
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    // Check authentication state from router context
    const { auth } = context

    if (!auth?.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    // Return user data for child routes
    return {
      user: auth.user,
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

// src/routes/_authenticated/chat.$conversationId.tsx
// Dynamic route with data prefetching
import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { ChatSkeleton } from '@/components/chat/ChatSkeleton'
import { ChatError } from '@/components/chat/ChatError'

export const Route = createFileRoute('/_authenticated/chat/$conversationId')({
  // Prefetch conversation data before rendering
  loader: async ({ params, context }) => {
    const { queryClient } = context

    // Ensure conversation data is cached
    await queryClient.ensureQueryData(
      convexQuery(api.Conversations.get, {
        conversationId: params.conversationId as Id<'conversations'>
      })
    )

    // Prefetch messages
    await queryClient.prefetchQuery(
      convexQuery(api.Messages.list, {
        conversationId: params.conversationId as Id<'conversations'>
      })
    )
  },

  // Loading state while data loads
  pendingComponent: ChatSkeleton,

  // Error boundary for this route
  errorComponent: ({ error }) => <ChatError error={error} />,

  component: ChatConversation,
})

function ChatConversation() {
  const { conversationId } = Route.useParams()
  const { user } = Route.useRouteContext()

  return (
    <ChatWindow
      conversationId={conversationId as Id<'conversations'>}
      userId={user.id}
    />
  )
}

// src/routes/_authenticated/memory.index.tsx
// Memory dashboard with suspense boundaries
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MemoryDashboard } from '@/components/memory/MemoryDashboard'
import { MemorySkeleton } from '@/components/memory/MemorySkeleton'

export const Route = createFileRoute('/_authenticated/memory/')({
  component: MemoryPage,
})

function MemoryPage() {
  const { user } = Route.useRouteContext()

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Your Memory</h1>
      <Suspense fallback={<MemorySkeleton />}>
        <MemoryDashboard userId={user.id} />
      </Suspense>
    </div>
  )
}
```

### Pattern 11: Agent Chat Action with Streaming (Vercel AI SDK v6)

```typescript
// convex/Agent.ts
import { action, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal, api } from './_generated/api'
import { generateText, streamText, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

// ============================================
// NON-STREAMING CHAT (Simple use case)
// ============================================

export const chat = action({
  args: {
    userId: v.id('users'),
    conversationId: v.id('conversations'),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Store user message
    const messageId = await ctx.runMutation(api.Messages.create, {
      conversationId: args.conversationId,
      userId: args.userId,
      role: 'user',
      content: args.message,
    })

    // 2. Ingest into sensory memory (async, non-blocking)
    await ctx.scheduler.runAfter(0, internal.Sensory.ingestMessage, {
      content: args.message,
      userId: args.userId,
      conversationId: args.conversationId,
      messageId,
    })

    // 3. Generate embedding for context retrieval (AI SDK v6)
    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: args.message,
    })

    // 4. Assemble memory context
    const memoryContext = await ctx.runQuery(api.Retrieval.assembleContext, {
      userId: args.userId,
      conversationId: args.conversationId,
      queryText: args.message,
      queryEmbedding,
    })

    // 5. Format context for system prompt
    const systemPrompt = formatMemorySystemPrompt(memoryContext)

    // 6. Get recent conversation history
    const recentMessages = await ctx.runQuery(api.Messages.listRecent, {
      conversationId: args.conversationId,
      limit: 20,
    })

    // 7. Call Claude with memory context (AI SDK v6)
    const { text: assistantMessage } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      maxTokens: 2048,
      system: systemPrompt,
      messages: recentMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    // 8. Store assistant response
    await ctx.runMutation(api.Messages.create, {
      conversationId: args.conversationId,
      userId: args.userId,
      role: 'assistant',
      content: assistantMessage,
    })

    // 9. Ingest assistant response into sensory memory
    await ctx.scheduler.runAfter(0, internal.Sensory.ingestMessage, {
      content: assistantMessage,
      userId: args.userId,
      conversationId: args.conversationId,
    })

    return { message: assistantMessage }
  },
})

// ============================================
// STREAMING CHAT (Persisted chunks for resilience)
// Based on: https://www.arhamhumayun.com/blog/streamed-ai-response
// ============================================

export const chatStreaming = action({
  args: {
    userId: v.id('users'),
    conversationId: v.id('conversations'),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Store user message & create placeholder for assistant
    const userMessageId = await ctx.runMutation(api.Messages.create, {
      conversationId: args.conversationId,
      userId: args.userId,
      role: 'user',
      content: args.message,
    })

    const assistantMessageId = await ctx.runMutation(api.Messages.create, {
      conversationId: args.conversationId,
      userId: args.userId,
      role: 'assistant',
      content: '', // Will be updated as chunks arrive
      isStreaming: true,
    })

    // 2. Ingest user message into sensory memory
    await ctx.scheduler.runAfter(0, internal.Sensory.ingestMessage, {
      content: args.message,
      userId: args.userId,
      conversationId: args.conversationId,
      messageId: userMessageId,
    })

    // 3. Generate embedding for context retrieval
    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: args.message,
    })

    // 4. Assemble memory context
    const memoryContext = await ctx.runQuery(api.Retrieval.assembleContext, {
      userId: args.userId,
      conversationId: args.conversationId,
      queryText: args.message,
      queryEmbedding,
    })

    // 5. Get conversation history
    const recentMessages = await ctx.runQuery(api.Messages.listRecent, {
      conversationId: args.conversationId,
      limit: 20,
    })

    // 6. Stream response with AI SDK v6
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      maxTokens: 2048,
      system: formatMemorySystemPrompt(memoryContext),
      messages: recentMessages
        .filter((m) => m._id !== assistantMessageId) // Exclude placeholder
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    })

    // 7. Buffer and persist chunks (200ms intervals, min 20 chars)
    let buffer = ''
    let fullContent = ''
    let lastFlush = Date.now()
    const MIN_CHARS = 20
    const FLUSH_INTERVAL = 200

    for await (const chunk of result.textStream) {
      buffer += chunk
      fullContent += chunk

      const now = Date.now()
      const shouldFlush =
        buffer.length >= MIN_CHARS || now - lastFlush >= FLUSH_INTERVAL

      if (shouldFlush && buffer.length > 0) {
        // Persist chunk to database
        await ctx.runMutation(internal.Messages.appendChunk, {
          messageId: assistantMessageId,
          chunk: buffer,
        })
        buffer = ''
        lastFlush = now
      }
    }

    // 8. Flush remaining buffer
    if (buffer.length > 0) {
      await ctx.runMutation(internal.Messages.appendChunk, {
        messageId: assistantMessageId,
        chunk: buffer,
      })
    }

    // 9. Mark streaming complete
    await ctx.runMutation(internal.Messages.completeStreaming, {
      messageId: assistantMessageId,
      finalContent: fullContent,
    })

    // 10. Ingest complete response into sensory memory
    await ctx.scheduler.runAfter(0, internal.Sensory.ingestMessage, {
      content: fullContent,
      userId: args.userId,
      conversationId: args.conversationId,
    })

    return { messageId: assistantMessageId }
  },
})

// ============================================
// HELPER: Format Memory System Prompt
// ============================================

function formatMemorySystemPrompt(context: any): string {
  let prompt = `You are a helpful AI assistant with memory of previous conversations.

`

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

  prompt += `Use this context to personalize your responses. Reference relevant memories naturally without explicitly stating "I remember that...".`

  return prompt
}

// ============================================
// MESSAGE CHUNK MUTATIONS (for streaming persistence)
// ============================================

export const appendChunk = internalMutation({
  args: {
    messageId: v.id('messages'),
    chunk: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId)
    if (!message) return

    await ctx.db.patch(args.messageId, {
      content: message.content + args.chunk,
    })
  },
})

export const completeStreaming = internalMutation({
  args: {
    messageId: v.id('messages'),
    finalContent: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.finalContent,
      isStreaming: false,
    })
  },
})
```

---

## Part 4: Updated File Structure

```
convex/
├── Schema.ts              # Unified schema (revised)
├── Sensory.ts             # Layer 1: Ingest, filter, attention scoring
├── ShortTerm.ts           # Layer 2: Topic clustering, STM management
├── LongTerm.ts            # Layer 3: Conflict resolution, storage
├── Core.ts                # Layer 5: Core memory CRUD
├── Edges.ts               # Knowledge graph relationships
├── Consolidation.ts       # Layer 4: Promotion, decay, pruning, merging
├── Reflection.ts          # Layer 4: Pattern detection, insights
├── Extraction.ts          # LLM entity/relationship extraction
├── Embeddings.ts          # Embedding generation (action)
├── Retrieval.ts           # Context assembly, scoring
├── Search.ts              # Vector search helpers
├── Corrections.ts         # User memory management
├── Agent.ts               # AI agent with memory injection
├── Crons.ts               # Scheduled jobs
├── _generated/            # Convex generated

src/
├── routes/
│   ├── __root.tsx                    # Root layout with providers
│   ├── index.tsx                     # Landing page
│   ├── login.tsx                     # Login page
│   ├── onboarding.tsx                # Initial user onboarding (public)
│   ├── _authenticated.tsx            # Auth guard layout (pathless)
│   └── _authenticated/
│       ├── chat.index.tsx            # /chat - conversation list
│       ├── chat.$conversationId.tsx  # /chat/:id - individual chat
│       ├── chat.new.tsx              # /chat/new - start new conversation
│       ├── memory.index.tsx          # /memory - dashboard
│       ├── memory.graph.tsx          # /memory/graph - knowledge graph
│       ├── memory.timeline.tsx       # /memory/timeline - history view
│       └── settings.tsx              # /settings - user preferences
├── components/
│   ├── ui/                           # Base UI components (existing)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── ... (existing components)
│   │   ├── skeleton.tsx              # Loading placeholder
│   │   ├── spinner.tsx               # Loading spinner
│   │   ├── toast.tsx                 # Notifications
│   │   └── avatar.tsx                # User/AI avatars
│   ├── chat/
│   │   ├── ChatWindow.tsx            # Main chat container
│   │   ├── ChatInput.tsx             # Message input with actions
│   │   ├── ChatSkeleton.tsx          # Loading state
│   │   ├── ChatError.tsx             # Error boundary component
│   │   ├── MessageBubble.tsx         # Individual message
│   │   ├── MessageStream.tsx         # Streaming message display
│   │   ├── MemoryIndicator.tsx       # Shows active memory context
│   │   └── ConversationList.tsx      # Sidebar conversation list
│   ├── memory/
│   │   ├── MemoryDashboard.tsx       # Overview with stats
│   │   ├── MemorySkeleton.tsx        # Loading state
│   │   ├── MemoryCard.tsx            # Individual memory display
│   │   ├── CoreMemoryEditor.tsx      # Edit/delete core memories
│   │   ├── CoreMemoryList.tsx        # List by category
│   │   ├── MemoryGraph.tsx           # D3/React Flow visualization
│   │   ├── MemoryTimeline.tsx        # Chronological view
│   │   └── MemorySearch.tsx          # Search interface
│   └── layouts/
│       ├── Sidebar.tsx               # Navigation sidebar
│       ├── Header.tsx                # Top header bar
│       └── AuthProvider.tsx          # Auth context wrapper
└── lib/
    ├── memory-hooks.ts               # TanStack Query + Convex hooks
    ├── auth.ts                       # Auth utilities
    ├── ai.ts                         # AI SDK helpers (embedding, schemas)
    └── utils.ts                      # Existing utilities
```

---

## Part 5: Implementation Phases (Revised)

### Phase 1: Foundation (Core Storage + Route Structure)

**Goal:** Schema deployed, basic CRUD, route structure, auth layout

| Task                                     | Files                                           |
| ---------------------------------------- | ----------------------------------------------- |
| Deploy schema                            | `convex/Schema.ts`                              |
| User/conversation CRUD                   | `convex/Users.ts`, `convex/Conversations.ts`    |
| Sensory ingestion with attention scoring | `convex/Sensory.ts`                             |
| Auth guard layout                        | `src/routes/_authenticated.tsx`                 |
| Landing page                             | `src/routes/index.tsx`                          |
| Login page                               | `src/routes/login.tsx`                          |
| Basic chat route                         | `src/routes/_authenticated/chat.index.tsx`      |
| Loading/error components                 | `src/components/ui/skeleton.tsx`, `spinner.tsx` |
| Sidebar layout                           | `src/components/layouts/Sidebar.tsx`            |

**Frontend Validation:**

- [ ] `/_authenticated` routes redirect to `/login` when unauthenticated
- [ ] After login, redirect back to intended route
- [ ] Sidebar navigation works between `/chat` and `/memory`
- [ ] Loading skeletons display during data fetch

**Backend Validation:**

- [ ] Messages stored as sensory memories
- [ ] 30-50% of low-value messages filtered
- [ ] Can query sensory memories by user

### Phase 2: Short-Term Memory + Chat UI

**Goal:** Entity extraction, topic clustering, embeddings, functional chat

| Task                  | Files                                                |
| --------------------- | ---------------------------------------------------- |
| Embedding generation  | `convex/Embeddings.ts`                               |
| LLM entity extraction | `convex/Extraction.ts`                               |
| Topic clustering      | `convex/ShortTerm.ts`                                |
| Vector search         | `convex/Search.ts`                                   |
| Memory hooks          | `src/lib/memory-hooks.ts`                            |
| Chat window component | `src/components/chat/ChatWindow.tsx`                 |
| Message input         | `src/components/chat/ChatInput.tsx`                  |
| Message display       | `src/components/chat/MessageBubble.tsx`              |
| Conversation route    | `src/routes/_authenticated/chat.$conversationId.tsx` |
| Conversation list     | `src/components/chat/ConversationList.tsx`           |

**Frontend Validation:**

- [ ] Real-time message updates via Convex subscription
- [ ] Route loader prefetches conversation data
- [ ] `pendingComponent` shows while loading
- [ ] `errorComponent` handles errors gracefully
- [ ] New conversation creation works

**Backend Validation:**

- [ ] Entities extracted from messages
- [ ] Similar messages grouped under topics
- [ ] Vector search returns relevant STM

### Phase 3: Long-Term Memory & Graph

**Goal:** Consolidation, conflict resolution, relationships

| Task                                    | Files                     |
| --------------------------------------- | ------------------------- |
| STM → LTM promotion                     | `convex/Consolidation.ts` |
| Conflict resolution (ADD/UPDATE/DELETE) | `convex/LongTerm.ts`      |
| Edge creation                           | `convex/Edges.ts`         |
| Decay calculation                       | `convex/Consolidation.ts` |
| Cron setup                              | `convex/Crons.ts`         |

**Validation:**

- [ ] High-importance STM promoted to LTM
- [ ] Conflicting memories superseded (not duplicated)
- [ ] Decay applied, effectiveImportance decreasing
- [ ] Relationships captured as edges

### Phase 4: Core Memory, Retrieval & Agent Integration

**Goal:** Pattern detection, core promotion, memory-aware agent, dashboard

| Task                       | Files                                        |
| -------------------------- | -------------------------------------------- |
| Pattern detection          | `convex/Reflection.ts`                       |
| Core memory promotion      | `convex/Core.ts`                             |
| Context assembly           | `convex/Retrieval.ts`                        |
| Agent action with memory   | `convex/Agent.ts`                            |
| Memory dashboard route     | `src/routes/_authenticated/memory.index.tsx` |
| Memory dashboard component | `src/components/memory/MemoryDashboard.tsx`  |
| Core memory list           | `src/components/memory/CoreMemoryList.tsx`   |
| Memory indicator in chat   | `src/components/chat/MemoryIndicator.tsx`    |
| Memory graph visualization | `src/components/memory/MemoryGraph.tsx`      |
| Memory graph route         | `src/routes/_authenticated/memory.graph.tsx` |

**Frontend Validation:**

- [ ] Memory dashboard shows core/LTM/STM counts
- [ ] Core memories grouped by category
- [ ] Memory indicator shows active context in chat
- [ ] Graph visualization renders entity relationships
- [ ] Real-time updates when memories change

**Backend Validation:**

- [ ] Patterns detected across 7+ days
- [ ] High-confidence patterns promoted to core
- [ ] Agent responses use retrieved context
- [ ] Context includes core + relevant LTM + recent STM

### Phase 5: Polish, User Control & Onboarding

**Goal:** User corrections, onboarding, timeline, settings

| Task                      | Files                                           |
| ------------------------- | ----------------------------------------------- |
| User memory corrections   | `convex/Corrections.ts`                         |
| Onboarding flow           | `src/routes/onboarding.tsx`                     |
| Memory timeline route     | `src/routes/_authenticated/memory.timeline.tsx` |
| Memory timeline component | `src/components/memory/MemoryTimeline.tsx`      |
| Core memory editor        | `src/components/memory/CoreMemoryEditor.tsx`    |
| Memory search             | `src/components/memory/MemorySearch.tsx`        |
| Settings page             | `src/routes/_authenticated/settings.tsx`        |
| Toast notifications       | `src/components/ui/toast.tsx`                   |

**Frontend Validation:**

- [ ] Users can edit/delete core memories inline
- [ ] Deletion shows confirmation dialog
- [ ] Toast notifications for successful actions
- [ ] Timeline shows memory evolution over time
- [ ] Search filters memories by content/type
- [ ] Onboarding collects initial user preferences

**Backend Validation:**

- [ ] Corrections logged with history
- [ ] Onboarding seeds initial core memories
- [ ] Soft delete preserves history (validUntil set)

---

## Part 6: Key Differences from v1

| Aspect                  | v1                         | v2                                            |
| ----------------------- | -------------------------- | --------------------------------------------- |
| **Sensory filtering**   | Regex heuristics only      | Structured attention signals + threshold      |
| **Topic clustering**    | Undefined `topicId`        | Embedding-based with centroid tracking        |
| **Entity extraction**   | Mentioned, not implemented | Full LLM-based structured extraction          |
| **Conflict resolution** | validUntil field unused    | ADD/UPDATE/DELETE/NOOP pattern                |
| **Core promotion**      | No criteria defined        | 3+ occurrences, 7+ day span, 0.75+ confidence |
| **Reflection**          | Stub only                  | Pattern detection + meta-insights             |
| **Agent integration**   | Mentioned lib/agent.ts     | Full Convex action with memory injection      |
| **User control**        | None                       | forgetMemory, correctMemory mutations         |
| **Onboarding**          | None                       | Cold start with onboarding flow               |

### Frontend/TanStack-Specific Differences (v2)

| Aspect                  | v1            | v2                                                        |
| ----------------------- | ------------- | --------------------------------------------------------- |
| **Route structure**     | Flat routes   | TanStack Router conventions (`_authenticated`, `$params`) |
| **Data fetching**       | Not specified | TanStack Query + Convex via `convexQuery()`               |
| **Auth handling**       | Not addressed | `beforeLoad` guards with redirect                         |
| **Route loaders**       | None          | `loader` + `pendingComponent` + `errorComponent`          |
| **Real-time updates**   | Mentioned     | Automatic via Convex subscriptions                        |
| **Component structure** | Basic list    | Full hierarchy with layouts, skeletons, errors            |
| **State management**    | Vague         | TanStack Query cache + Convex real-time                   |

### AI SDK Integration Differences (v2.2)

| Aspect                    | v1 (Direct SDK)                  | v2.2 (Vercel AI SDK v6)                           |
| ------------------------- | -------------------------------- | ------------------------------------------------- |
| **LLM Provider**          | `@anthropic-ai/sdk` directly     | `@ai-sdk/anthropic` via unified API               |
| **Embeddings**            | `openai.embeddings.create()`     | `embed()` / `embedMany()` from `ai`               |
| **Structured output**     | Manual JSON parsing              | `Output.object({ schema })` with Zod              |
| **Streaming**             | Not implemented                  | `streamText()` + chunk persistence                |
| **Type safety**           | Manual types                     | Zod schemas with `.describe()` for LLM hints      |
| **Error handling**        | Try/catch JSON parse             | AI SDK throws `AI_NoObjectGeneratedError`         |
| **Provider switching**    | Rewrite all code                 | Change model string only                          |
| **Function deprecation**  | N/A                              | `generateObject` → `generateText` + `output`      |

---

## Part 7: TanStack Start Integration Notes

### Router Context Setup

The router must be configured with auth and query client context for the patterns above to work:

```typescript
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'
import { routeTree } from './routeTree.gen'

const convexQueryClient = new ConvexQueryClient(import.meta.env.VITE_CONVEX_URL)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
})

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: undefined, // Will be set by AuthProvider
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  Wrap: ({ children }) => (
    <ConvexProvider client={convexQueryClient.convexClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ConvexProvider>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface RouteContext {
    queryClient: QueryClient
    auth?: { isAuthenticated: boolean; user: User }
  }
}
```

### Key TanStack Patterns Used

1. **Pathless Layout Routes** (`_authenticated.tsx`)
   - The underscore prefix creates a layout without affecting the URL
   - All child routes inherit the `beforeLoad` auth check

2. **Dynamic Segments** (`$conversationId`)
   - The dollar sign creates a URL parameter
   - Access via `Route.useParams()`

3. **Index Routes** (`.index.tsx`)
   - Matches when the parent path is accessed exactly
   - `/memory` → `memory.index.tsx`

4. **Nested Routes** (`memory.graph.tsx`)
   - Dot notation creates nested routes
   - `/memory/graph` → `memory.graph.tsx`

5. **Route Loaders**
   - Prefetch data before render
   - Integrates with TanStack Query's cache

6. **Route Context**
   - Pass data from parent routes via `beforeLoad` return
   - Access via `Route.useRouteContext()`

---

## Conclusion

This revised plan maintains the five distinct memory layers while filling critical implementation gaps:

1. **Sensory Memory** - Now has structured attention signals, not just regex
2. **Short-Term Memory** - Has concrete topic clustering with centroid tracking
3. **Long-Term Memory** - Implements full conflict resolution (Mem0 pattern)
4. **Memory Managers** - Pattern detection and promotion criteria defined
5. **Core Memory** - Clear promotion path with versioning and user control

**New in v2 - Frontend Architecture:**

6. **TanStack Router Integration** - Proper file-based routing with auth guards, loaders, and context
7. **TanStack Query + Convex** - Real-time data with automatic cache invalidation
8. **Component Hierarchy** - Loading states, error boundaries, and layout composition

**New in v2.2 - Vercel AI SDK v6 Integration:**

9. **Unified LLM API** - Provider-agnostic via `@ai-sdk/anthropic` and `@ai-sdk/openai`
10. **Structured Output** - Type-safe extraction with `Output.object({ schema })` + Zod
11. **Streaming Persistence** - Chunk buffering with Convex DB for resilient streaming
12. **Modern Patterns** - Uses `generateText`/`streamText` (not deprecated `generateObject`)

The key insight remains: **memory is cognition, not storage**. But now we have the implementation details—backend, frontend, and AI integration—to make that real.

> _"That's where intelligence begins: not in retrieval, but in reflection."_

---

## Appendix: AI SDK v6 Quick Reference

```typescript
// ============================================
// IMPORTS
// ============================================
import { generateText, streamText, embed, embedMany, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// ============================================
// TEXT GENERATION
// ============================================
const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: 'You are helpful.',
  prompt: 'Hello!',
})

// ============================================
// STRUCTURED OUTPUT (replaces generateObject)
// ============================================
const schema = z.object({
  name: z.string(),
  age: z.number(),
})

const { output } = await generateText({
  model: anthropic('claude-3-5-haiku-latest'),
  output: Output.object({ schema }),
  prompt: 'Extract: John is 30 years old',
})
// output: { name: 'John', age: 30 }

// ============================================
// STREAMING
// ============================================
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Tell a story',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}

// ============================================
// EMBEDDINGS
// ============================================
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'Hello world',
})

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: ['Hello', 'World'],
})
```

**Sources:**
- [AI SDK v6 Documentation](https://ai-sdk.dev/docs/introduction)
- [AI SDK Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
- [Streaming with Convex](https://www.arhamhumayun.com/blog/streamed-ai-response)
