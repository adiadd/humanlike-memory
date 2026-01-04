# Human-like Memory for AI Agents: The Unified Plan

> _"The evolution of agentic memory won't be about storing more. It will be about thinking better."_

---

## Executive Summary

This document provides a complete implementation blueprint for building human-like memory in AI agents. It synthesizes insights from cognitive science, existing frameworks (Mem0, Letta, Graphiti), and practical engineering patterns into a single, coherent plan tailored for **TanStack Start + Convex + shadcn**.

**The Core Thesis:** Memory is not retrieval. Memory is cognition. Our system must encode, consolidate, retrieve, and forget—just like the human mind.

---

## Part 1: The Problem We're Solving

### What the Blog Identifies

Most memory systems are **glorified caches**:

```
Current Approach:
User Message → Embed → Store in Vector DB → Retrieve by Similarity

Problems:
├── No filtering → clutter accumulates
├── No structure → relationships lost
├── No consolidation → redundancy grows
└── No forgetting → relevance drifts
```

### What We're Building Instead

A **cognitive memory architecture** that mirrors how humans actually process experience:

```
Human-like Approach:
Input → Filter → Short-Term Buffer → Consolidate → Long-Term Graph
                                            ↓
                                    Core Memory (Identity)
                                            ↑
                            Background: Prune, Promote, Reflect
```

---

## Part 2: The Five-Layer Architecture

Each layer maps directly to human cognition:

| Layer               | Human Analog               | Purpose                            | Persistence               |
| ------------------- | -------------------------- | ---------------------------------- | ------------------------- |
| **Sensory**         | Brief impressions          | Filter noise, extract entities     | Seconds                   |
| **Short-Term**      | Working memory             | Active reasoning, topic continuity | Minutes to hours          |
| **Long-Term**       | Semantic + episodic memory | Consolidated knowledge graph       | Days to months            |
| **Memory Managers** | Sleep consolidation        | Promote, demote, prune, reflect    | Background processes      |
| **Core**            | Sense of self              | Stable identity and preferences    | Persistent, slow-evolving |

### Layer Interactions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                     │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        1. SENSORY MEMORY                              │  │
│  │                                                                       │  │
│  │   [Capture] → [Score Attention] → [Extract Entities]                  │  │
│  │                        │                                              │  │
│  │            score < 0.3 ─┴─ score >= 0.3                               │  │
│  │                │                 │                                    │  │
│  │            [DISCARD]        [CONTINUE]                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      2. SHORT-TERM MEMORY                             │  │
│  │                                                                       │  │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                               │  │
│  │   │ Topic A │  │ Topic B │  │ Topic C │   Grouped by topic            │  │
│  │   └────┬────┘  └────┬────┘  └────┬────┘                               │  │
│  │        │            │            │                                    │  │
│  │        └────────────┴────────────┴─── Persists? ──▶ PROMOTE           │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      3. LONG-TERM MEMORY                              │  │
│  │                                                                       │  │
│  │   ┌──────────────────────────────────────────────────────────────┐    │  │
│  │   │              TEMPORAL KNOWLEDGE GRAPH                        │    │  │
│  │   │                                                              │    │  │
│  │   │    [User]──prefers──▶[Python]                                │    │  │
│  │   │      │                                                       │    │  │
│  │   │      └──works_at──▶[Acme Corp]──located_in──▶[Bangalore]     │    │  │
│  │   │                                                              │    │  │
│  │   └──────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │   ┌─────────────────┐    ┌─────────────────┐                          │  │
│  │   │ SEMANTIC        │    │ EPISODIC        │                          │  │
│  │   │ Facts, concepts │    │ Experiences     │                          │  │
│  │   └─────────────────┘    └─────────────────┘                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        5. CORE MEMORY                                 │  │
│  │                                                                       │  │
│  │   ┌────────────────────────────────────────────────────────────────┐  │  │
│  │   │  • Identity: "User is a software engineer in Bangalore"        │  │  │
│  │   │  • Preference: "User prefers concise, technical responses"     │  │  │
│  │   │  • Behavioral: "User typically works late evenings"            │  │  │
│  │   │  • Relationship: "User has a dog named Max"                    │  │  │
│  │   └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │                       [ALWAYS IN CONTEXT]                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │     4. MEMORY MANAGERS (Background)  │
                    │                                      │
                    │  • Consolidation: Merge similar      │
                    │  • Decay: Apply forgetting curve     │
                    │  • Promotion: STM → LTM → Core       │
                    │  • Reflection: Generate insights     │
                    │  • Pruning: Delete irrelevant        │
                    │                                      │
                    │         [RUNS VIA CRON JOBS]         │
                    └──────────────────────────────────────┘
```

---

## Part 3: Technology Decisions

### Stack Alignment

| Component         | Choice                        | Rationale                                                                 |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------- |
| **Database**      | Convex                        | Real-time subscriptions, vector search, scheduled functions, transactions |
| **Frontend**      | TanStack Start + React        | Already configured, reactive queries                                      |
| **UI**            | shadcn/ui (Base UI + CVA)     | Already configured                                                        |
| **LLM**           | Claude (Anthropic)            | Entity extraction, summarization, importance scoring                      |
| **Embeddings**    | OpenAI text-embedding-3-small | 1536 dimensions, cost-effective, native Convex support                    |
| **Graph Storage** | Convex relational tables      | No external dependencies, sufficient for MVP                              |

### Key Technical Decisions

| Decision              | Choice                                     | Trade-off                                                           |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| **Vector DB**         | Use Convex's built-in vector search        | Max 256 results per query, but eliminates infrastructure complexity |
| **Filtering**         | Heuristics for sensory, LLM for extraction | Fast + cheap for filtering, accurate for important operations       |
| **Temporal tracking** | Bi-temporal (validFrom/validUntil)         | Enables "time travel" queries at cost of storage growth             |
| **Graph model**       | Adjacency tables in Convex                 | Simpler than Neo4j, may need migration for complex traversals       |

---

## Part 4: Unified Schema Design

This schema synthesizes the best patterns from all approaches into one coherent design:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ============================================
  // USERS & CONVERSATIONS
  // ============================================

  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
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
    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt']),

  // ============================================
  // LAYER 1: SENSORY MEMORY
  // Brief input buffer, filters noise before processing
  // ============================================

  sensoryMemories: defineTable({
    content: v.string(),
    inputType: v.union(
      v.literal('message'),
      v.literal('event'),
      v.literal('observation'),
    ),
    relevanceScore: v.float64(),
    extractedEntities: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          salience: v.float64(),
        }),
      ),
    ),
    processed: v.boolean(),
    userId: v.id('users'),
    conversationId: v.optional(v.id('conversations')),
    createdAt: v.number(),
  })
    .index('by_user_unprocessed', ['userId', 'processed', 'createdAt'])
    .index('by_conversation', ['conversationId', 'createdAt']),

  // ============================================
  // LAYER 2: SHORT-TERM MEMORY
  // Active context buffer, grouped by topic
  // ============================================

  shortTermMemories: defineTable({
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
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
    lastAccessed: v.number(),
    conversationId: v.id('conversations'),
    userId: v.id('users'),
    sourceIds: v.array(v.id('sensoryMemories')),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId', 'createdAt'])
    .index('by_user_topic', ['userId', 'topicId'])
    .index('by_user_importance', ['userId', 'importance'])
    .index('by_expiry', ['expiresAt'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'topicId'],
    }),

  // ============================================
  // LAYER 3: LONG-TERM MEMORY
  // Consolidated knowledge with temporal tracking
  // ============================================

  longTermMemories: defineTable({
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    entityType: v.optional(v.string()),

    // Importance scoring
    importance: v.float64(),
    effectiveImportance: v.float64(), // After decay
    stability: v.float64(), // Increases with retrieval, slows decay

    // Access tracking
    accessCount: v.number(),
    lastAccessed: v.number(),

    // Lineage
    consolidatedFrom: v.optional(v.array(v.id('shortTermMemories'))),

    // Ownership
    userId: v.id('users'),

    // Bi-temporal tracking (Graphiti pattern)
    validFrom: v.number(), // When the fact became true
    validUntil: v.optional(v.number()), // When superseded (null = current)

    createdAt: v.number(),
  })
    .index('by_user', ['userId', 'effectiveImportance'])
    .index('by_user_type', ['userId', 'memoryType'])
    .index('by_entity', ['entityType', 'userId'])
    .index('by_access', ['userId', 'lastAccessed'])
    .index('by_validity', ['userId', 'validFrom'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'memoryType', 'entityType'],
    }),

  // ============================================
  // KNOWLEDGE GRAPH: EDGES
  // Relationships between memories/entities
  // ============================================

  memoryEdges: defineTable({
    sourceId: v.id('longTermMemories'),
    targetId: v.id('longTermMemories'),
    relationType: v.string(), // works_at, knows, prefers, related_to
    fact: v.string(), // Human-readable: "Alice works at Acme Corp"
    embedding: v.array(v.float64()),
    strength: v.float64(), // 0-1, increases with reinforcement

    userId: v.id('users'),

    // Temporal validity
    validFrom: v.number(),
    validUntil: v.optional(v.number()),

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

  // ============================================
  // LAYER 5: CORE MEMORY
  // Stable identity, always in context
  // ============================================

  coreMemories: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    category: v.union(
      v.literal('identity'), // "User is a software engineer"
      v.literal('preference'), // "User prefers concise responses"
      v.literal('relationship'), // "User has a dog named Max"
      v.literal('behavioral'), // "User often works late"
    ),
    confidence: v.float64(), // 0-1
    sourceCount: v.number(), // How many memories support this
    sourceMemories: v.array(v.id('longTermMemories')),

    userId: v.id('users'),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_category', ['userId', 'category', 'confidence'])
    .vectorIndex('embedding_idx', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'category'],
    }),

  // ============================================
  // LAYER 4: MEMORY MANAGEMENT
  // Consolidation job tracking
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
    memoriesMerged: v.number(),
    memoriesPruned: v.number(),
    duration: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),
})
```

---

## Part 5: Core Implementation Patterns

### Pattern 1: Sensory Filtering (Fast, No LLM)

```typescript
// convex/sensory.ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

export const ingestMessage = mutation({
  args: {
    content: v.string(),
    userId: v.id('users'),
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const relevanceScore = calculateRelevanceScore(args.content)

    const memoryId = await ctx.db.insert('sensoryMemories', {
      content: args.content,
      inputType: 'message',
      relevanceScore,
      processed: false,
      userId: args.userId,
      conversationId: args.conversationId,
      createdAt: Date.now(),
    })

    // Only process content that passes attention filter
    if (relevanceScore >= 0.3) {
      await ctx.scheduler.runAfter(0, internal.shortTerm.processForShortTerm, {
        memoryId,
        conversationId: args.conversationId,
      })
    } else {
      await ctx.db.patch(memoryId, { processed: true })
    }

    return memoryId
  },
})

function calculateRelevanceScore(content: string): number {
  let score = 0.5

  // Personal information indicators (high signal)
  const personalPatterns = [
    /\b(i am|i'm|my name is|i work|i live|i prefer|i like|i hate)\b/i,
    /\b(my wife|my husband|my kid|my dog|my cat|my family)\b/i,
    /\b(always|never|usually|every time)\b/i,
    /\b(favorite|important|remember|don't forget)\b/i,
  ]
  personalPatterns.forEach((p) => {
    if (p.test(content)) score += 0.15
  })

  // Named entities (capitalized words mid-sentence)
  const namedEntities =
    content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  score += Math.min(0.2, namedEntities.length * 0.05)

  // Temporal references (suggests episodic memory)
  const temporalPatterns = [
    /\b(yesterday|today|tomorrow|last week|next month)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  ]
  temporalPatterns.forEach((p) => {
    if (p.test(content)) score += 0.1
  })

  // Penalize low-value content
  if (content.length < 20) score -= 0.3
  if (
    /^(ok|thanks|yes|no|sure|got it|okay|right|hmm|ah)$/i.test(content.trim())
  ) {
    score -= 0.5
  }

  return Math.max(0, Math.min(1, score))
}
```

### Pattern 2: Importance Decay (Ebbinghaus Curve)

```typescript
// convex/consolidation.ts
import { internalMutation } from './_generated/server'

export const applyDecay = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const memories = await ctx.db.query('longTermMemories').take(500)

    let processed = 0

    for (const memory of memories) {
      const hoursSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60)

      // Ebbinghaus decay: R = e^(-t/S)
      // Higher stability = slower decay
      const decayFactor = Math.exp(-hoursSinceAccess / memory.stability)
      const newEffective = memory.importance * decayFactor

      await ctx.db.patch(memory._id, {
        effectiveImportance: Math.max(0.01, newEffective),
      })

      processed++
    }

    await ctx.db.insert('consolidationLogs', {
      runType: 'decay',
      memoriesProcessed: processed,
      memoriesPromoted: 0,
      memoriesMerged: 0,
      memoriesPruned: 0,
      duration: Date.now() - now,
      createdAt: now,
    })
  },
})

// When a memory is retrieved, increase its stability
export function updateStabilityOnAccess(currentStability: number): number {
  // Each retrieval increases stability by ~20%
  // Capped at 1000 hours half-life
  return Math.min(1000, currentStability * 1.2)
}
```

### Pattern 3: Retrieval Scoring (Park et al. Formula)

```typescript
// convex/retrieval.ts
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
    embeddingScore: number // Cosine similarity from vector search
  },
  config = DEFAULT_CONFIG,
): number {
  const now = Date.now()
  const hoursSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60)

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
```

### Pattern 4: Memory Consolidation (Promotion)

```typescript
// convex/consolidation.ts
export const promoteToLongTerm = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()

    // Find short-term memories ready for promotion
    const candidates = await ctx.db
      .query('shortTermMemories')
      .filter((q) =>
        q.and(
          q.gte(q.field('importance'), 0.6), // Important enough
          q.gte(q.field('accessCount'), 2), // Accessed multiple times
          q.lt(q.field('createdAt'), now - 3600000), // At least 1 hour old
        ),
      )
      .take(50)

    let promoted = 0
    let merged = 0

    for (const memory of candidates) {
      // Check for similar existing long-term memory
      const existing = await findSimilarLongTerm(ctx, memory)

      if (existing) {
        // Merge: Update existing memory
        await ctx.db.patch(existing._id, {
          content: `${existing.content}\n\nAdditional context: ${memory.content}`,
          importance: Math.min(1, existing.importance + 0.1),
          accessCount: existing.accessCount + memory.accessCount,
          lastAccessed: now,
        })
        merged++
      } else {
        // Promote: Create new long-term memory
        await ctx.db.insert('longTermMemories', {
          content: memory.content,
          summary: memory.summary,
          embedding: memory.embedding!,
          memoryType: 'episodic',
          importance: memory.importance,
          effectiveImportance: memory.importance,
          stability: 100, // Initial stability: ~100 hour half-life
          accessCount: memory.accessCount,
          lastAccessed: now,
          consolidatedFrom: [memory._id],
          userId: memory.userId,
          validFrom: memory.createdAt,
          createdAt: now,
        })
        promoted++
      }

      // Mark short-term as processed (or delete)
      await ctx.db.delete(memory._id)
    }

    await ctx.db.insert('consolidationLogs', {
      runType: 'promotion',
      memoriesProcessed: candidates.length,
      memoriesPromoted: promoted,
      memoriesMerged: merged,
      memoriesPruned: 0,
      duration: Date.now() - now,
      createdAt: now,
    })
  },
})
```

### Pattern 5: Cron Jobs Configuration

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Sensory → Short-term: Every 5 minutes
crons.interval(
  'process-sensory',
  { minutes: 5 },
  internal.sensory.processPendingSensory,
)

// Short-term → Long-term: Every hour
crons.interval(
  'consolidate-to-long-term',
  { hours: 1 },
  internal.consolidation.promoteToLongTerm,
)

// Apply decay to importance scores: Every 15 minutes
crons.interval(
  'apply-decay',
  { minutes: 15 },
  internal.consolidation.applyDecay,
)

// Cleanup expired short-term memories: Every 30 minutes
crons.interval(
  'cleanup-expired',
  { minutes: 30 },
  internal.consolidation.cleanupExpired,
)

// Generate reflections & update core memory: Daily at 3 AM UTC
crons.daily(
  'daily-reflection',
  { hourUTC: 3, minuteUTC: 0 },
  internal.reflection.generateReflections,
)

// Prune very low importance memories: Weekly
crons.weekly(
  'weekly-prune',
  { dayOfWeek: 'sunday', hourUTC: 4, minuteUTC: 0 },
  internal.consolidation.pruneMemories,
)

export default crons
```

---

## Part 6: Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Basic memory storage with semantic search

| Task                             | Files to Create                                                    |
| -------------------------------- | ------------------------------------------------------------------ |
| Deploy Convex schema             | `convex/schema.ts`                                                 |
| Basic CRUD mutations             | `convex/users.ts`, `convex/conversations.ts`, `convex/messages.ts` |
| Sensory ingestion with filtering | `convex/sensory.ts`                                                |
| Simple chat UI                   | `src/routes/chat.tsx`, `src/components/chat/`                      |

**Deliverables:**

- [ ] Working schema deployed
- [ ] Chat stores messages as sensory memories
- [ ] Low-value messages filtered out (30-50% rejection rate)
- [ ] Basic UI to view stored memories

### Phase 2: Short-Term Memory (Week 2)

**Goal:** Topic grouping and embedding generation

| Task                         | Files to Create        |
| ---------------------------- | ---------------------- |
| Entity extraction with LLM   | `convex/extraction.ts` |
| Embedding generation         | `convex/embeddings.ts` |
| Short-term memory creation   | `convex/shortTerm.ts`  |
| Topic grouping logic         | `convex/topics.ts`     |
| Vector search implementation | `convex/search.ts`     |

**Deliverables:**

- [ ] Entities extracted from messages
- [ ] Embeddings generated for memories
- [ ] Related messages grouped under topics
- [ ] Vector search returning relevant memories

### Phase 3: Long-Term Memory & Graph (Week 3)

**Goal:** Consolidation and relationship tracking

| Task                            | Files to Create           |
| ------------------------------- | ------------------------- |
| Promotion logic (STM → LTM)     | `convex/consolidation.ts` |
| Decay calculation               | `convex/decay.ts`         |
| Edge creation for relationships | `convex/edges.ts`         |
| Graph traversal queries         | `convex/graph.ts`         |
| Cron job setup                  | `convex/crons.ts`         |

**Deliverables:**

- [ ] Important memories promoted to long-term
- [ ] Decay applied to unused memories
- [ ] Relationships captured as graph edges
- [ ] Background jobs running

### Phase 4: Core Memory & Retrieval (Week 4)

**Goal:** Persistent identity and smart retrieval

| Task                              | Files to Create         |
| --------------------------------- | ----------------------- |
| Core memory structure             | `convex/core.ts`        |
| Pattern-to-core promotion         | `convex/reflection.ts`  |
| Hybrid retrieval (vector + graph) | `convex/retrieval.ts`   |
| Memory-aware response generation  | `lib/agent.ts`          |
| Memory dashboard UI               | `src/routes/memory.tsx` |

**Deliverables:**

- [ ] Core memory capturing user identity
- [ ] Retrieval combining vectors and graph
- [ ] Responses using retrieved context
- [ ] UI showing memory state

---

## Part 7: File Structure

```
convex/
├── schema.ts              # Unified schema (above)
├── sensory.ts             # Sensory layer: ingest, filter
├── shortTerm.ts           # Short-term: buffer, topic grouping
├── longTerm.ts            # Long-term: storage, retrieval
├── core.ts                # Core memory: identity, preferences
├── edges.ts               # Graph relationships
├── consolidation.ts       # Promotion, decay, pruning
├── reflection.ts          # Pattern extraction, insights
├── search.ts              # Vector + hybrid search
├── embeddings.ts          # Embedding generation (action)
├── extraction.ts          # Entity extraction (action)
├── crons.ts               # Scheduled jobs
└── _generated/            # Convex generated

src/
├── routes/
│   ├── index.tsx          # Home/dashboard
│   ├── chat.tsx           # Chat interface
│   └── memory.tsx         # Memory explorer
├── components/
│   ├── ui/                # shadcn components
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   └── MemoryContext.tsx
│   └── memory/
│       ├── MemoryDashboard.tsx
│       ├── MemoryCard.tsx
│       ├── CoreMemoryView.tsx
│       └── MemoryGraph.tsx
└── lib/
    ├── agent.ts           # Memory-aware agent
    └── utils.ts           # Utilities
```

---

## Part 8: Success Metrics

### Quantitative

| Metric                   | Target          | How to Measure                                  |
| ------------------------ | --------------- | ----------------------------------------------- |
| Sensory filter rejection | 30-50%          | `filtered / total` messages                     |
| STM → LTM promotion rate | 20-40%          | `promoted / total` short-term                   |
| Core memory stability    | <5% change/week | Core updates per week                           |
| Retrieval latency        | <300ms P95      | Measure search + ranking time                   |
| Memory decay coverage    | 100%            | All memories have updated `effectiveImportance` |

### Qualitative

| Aspect              | Question to Ask                                                 |
| ------------------- | --------------------------------------------------------------- |
| **Coherence**       | Does the agent maintain consistent personality across sessions? |
| **Personalization** | Does retrieved context feel relevant to the conversation?       |
| **Evolution**       | Do core memories reflect actual user patterns over time?        |
| **Forgetting**      | Are outdated/irrelevant memories successfully pruned?           |

---

## Part 9: Key Insights from Research

### What We Learn from Existing Frameworks

| Framework        | Key Insight                                                      | How We Apply It                                    |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| **Mem0**         | ADD/UPDATE/DELETE/NOOP pattern prevents redundancy               | Compare new info against existing before storing   |
| **Letta/MemGPT** | Agents can self-manage memory via tools                          | Provide `rememberFact` and `recallMemories` tools  |
| **Graphiti**     | Bi-temporal tracking enables time-travel queries                 | `validFrom`/`validUntil` on all memories and edges |
| **Park et al.**  | Reflection triggers synthesis when importance threshold exceeded | Daily reflection job generates insights            |

### Cognitive Science Principles Applied

| Principle                        | Implementation                                                  |
| -------------------------------- | --------------------------------------------------------------- |
| **Ebbinghaus decay**             | `effectiveImportance = importance * e^(-t/stability)`           |
| **Spacing effect**               | Track access intervals; boost memories accessed across sessions |
| **Retrieval strengthens memory** | Increase `stability` on every retrieval                         |
| **Chunking**                     | Group related messages under shared `topicId`                   |
| **Sleep consolidation**          | Nightly cron jobs for promotion and pruning                     |

---

## Conclusion

This plan implements the blog's vision: **memory that thinks, not just stores**.

The five-layer architecture mirrors human cognition:

1. **Sensory** filters noise before it enters the system
2. **Short-term** maintains active context and groups related thoughts
3. **Long-term** consolidates knowledge into a temporal graph
4. **Memory managers** run "sleep cycles" to promote, decay, and prune
5. **Core memory** anchors everything with stable identity

Start with Phase 1 to get a working foundation, then iterate. The key is not to build everything at once, but to **validate each layer works** before adding complexity.

> _"That's where intelligence begins: not in retrieval, but in reflection."_

---

## References

- [Mem0](https://github.com/mem0ai/mem0) - Hybrid storage patterns
- [Graphiti](https://github.com/getzep/graphiti) - Temporal knowledge graphs
- [Letta/MemGPT](https://docs.letta.com) - Self-editing memory
- [Generative Agents (Park et al.)](https://arxiv.org/abs/2304.03442) - Reflection and importance scoring
- [LangMem](https://langchain-ai.github.io/langmem) - Memory SDK patterns
