# Human-like Memory for AI Agents: MVP Recommendations

## Executive Summary

This document outlines a comprehensive architecture for implementing human-like memory in AI agents, based on research into cognitive science models and existing AI memory frameworks. The goal is to move beyond simple "vector dump" retrieval to a system that **encodes, consolidates, retrieves, and forgets** memories intelligently.

---

## Part 1: Understanding the Memory Types

The blog describes five interconnected memory layers that mirror human cognition. Here's a deep analysis of each:

### 1. Sensory Memory (Input Filter)

**Human Analogy:** The fleeting impressions from our senses - lasting milliseconds to seconds. You see hundreds of faces on the street but only "notice" a few.

**Purpose in AI Agents:**

- Acts as a **gatekeeper** to prevent context pollution
- Filters noise before it enters the memory pipeline
- Extracts signals worth processing (entities, emotions, intent)

**Key Operations:**
| Operation | Description |
|-----------|-------------|
| Capture | Receive raw input (messages, events, files) |
| Score | Lightweight relevance heuristics (no LLM needed) |
| Extract | Pull entities, topics, sentiment |
| Gate | Decide: process further or discard |

**What makes it "human-like":**

- We don't remember everything we see/hear
- Attention determines what enters working memory
- High emotional valence bypasses normal filtering (startle response)

### 2. Short-Term Memory (Working Context)

**Human Analogy:** The information you're actively holding "in mind" - like remembering a phone number while you dial it. Capacity: ~7 items, duration: 18-30 seconds without rehearsal.

**Purpose in AI Agents:**

- Maintains **conversational continuity** within a session
- Groups related messages under shared topics
- Active reasoning buffer for multi-step tasks

**Key Operations:**
| Operation | Description |
|-----------|-------------|
| Buffer | Hold recent context (last N messages/topics) |
| Chunk | Group related items to increase effective capacity |
| Rehearse | Access patterns determine what persists |
| Promote | Persistent topics move to long-term memory |

**What makes it "human-like":**

- Limited capacity forces prioritization
- Decay without reinforcement (access)
- Chunking increases effective capacity

### 3. Long-Term Memory (Consolidated Knowledge)

**Human Analogy:** The vast store of memories that can last a lifetime. Subdivided into:

- **Episodic:** Personal experiences (events with time/place context)
- **Semantic:** Facts and concepts (decontextualized knowledge)

**Purpose in AI Agents:**

- Store **consolidated, indexed knowledge** retrievable across sessions
- Organize by entity, topic, and relationship
- Enable personalization and behavioral continuity

**Key Operations:**
| Operation | Description |
|-----------|-------------|
| Encode | Transform short-term memories into durable form |
| Index | Vector embeddings + metadata for retrieval |
| Link | Create relationships between memories (graph) |
| Retrieve | Semantic search + graph traversal |

**What makes it "human-like":**

- Episodic memories can become semantic over time (pattern abstraction)
- Retrieval strengthens memory traces
- Context aids recall (state-dependent memory)

### 4. Memory Managers (Consolidation Engine)

**Human Analogy:** What happens during sleep - the brain replays, reorganizes, and prunes memories. This is when short-term becomes long-term, and irrelevant pathways are weakened.

**Purpose in AI Agents:**

- Background process that **maintains memory health**
- Promotes important patterns to core memory
- Demotes/archives outdated information
- Generates reflections and meta-summaries

**Key Operations:**
| Operation | Description |
|-----------|-------------|
| Consolidate | Move stable short-term topics to long-term |
| Decay | Apply time-based importance reduction |
| Merge | Combine similar memories, update facts |
| Prune | Archive or delete low-importance memories |
| Reflect | Generate insights from memory patterns |

**What makes it "human-like":**

- Consolidation happens "offline" (not during active use)
- Spaced repetition strengthens retention
- Forgetting is adaptive, not a bug

### 5. Core Memory (Identity Layer)

**Human Analogy:** The stable sense of self - personality traits, core beliefs, fundamental preferences. Changes slowly over years, shapes how we interpret everything else.

**Purpose in AI Agents:**

- **Anchor point** for all memory interpretation
- Stores stable user identity and behavioral patterns
- Shapes retrieval and reasoning (provides consistent perspective)

**Key Operations:**
| Operation | Description |
|-----------|-------------|
| Initialize | Bootstrap from early interactions |
| Update | Slowly evolve as patterns emerge from long-term memory |
| Retrieve | Always included in context (in-context memory) |
| Shape | Influences how other memories are interpreted |

**What makes it "human-like":**

- Core identity is resistant to change
- Provides coherence across all interactions
- Acts as a "lens" through which memories are filtered

---

## Part 2: Comparative Analysis of Existing Frameworks

### Framework Comparison Matrix

| Feature            | Mem0                                     | Letta (MemGPT)                          | LangChain Memory        |
| ------------------ | ---------------------------------------- | --------------------------------------- | ----------------------- |
| **Architecture**   | Managed service                          | Research-based self-editing             | Middleware/plugin       |
| **Memory Tiers**   | Conversation → Session → User → Org      | Core (in-context) + Archival (external) | Thread + Store          |
| **Consolidation**  | Compression engine (80% token reduction) | Compaction via summarization            | SummarizationMiddleware |
| **Forgetting**     | Session expiry, scoping                  | Sliding window, manual delete           | Trim, delete, summarize |
| **Graph Support**  | Yes (augments vector search)             | No                                      | Via integrations        |
| **Agent Autonomy** | Low (system-managed)                     | High (agent self-edits)                 | Medium (tool-based)     |
| **Vector Search**  | Yes (managed)                            | Yes (pgvector, Chroma)                  | Via integrations        |

### Key Insights from Existing Frameworks

1. **Mem0's Layered Scoping:** The conversation → session → user → organization hierarchy is elegant and practical. Each scope has different TTL and retrieval priority.

2. **Letta's Self-Editing:** Agents that manage their own memory via tools (`memory_replace`, `memory_insert`) are more adaptive but require careful prompt engineering.

3. **The In-Context vs External Split:** Both Letta and LangChain distinguish between:
   - Memory always visible in prompt (core/working)
   - Memory retrieved on-demand (archival/store)

4. **Compaction is Critical:** All frameworks implement some form of summarization when context fills up. This is the practical equivalent of "consolidation."

5. **Graph Memory is Additive:** Mem0's approach of using graph relationships to _augment_ (not replace) vector search results is pragmatic.

---

## Part 3: Cognitive Science Principles for Implementation

### Ebbinghaus Forgetting Curve

The mathematically-proven decay of memory over time:

```
Retention = e^(-time / stability)
```

**Implementation:** Apply exponential decay to `effectiveImportance` field. Each retrieval increases `stability`, slowing future decay.

### Spacing Effect

Memories accessed at spaced intervals are retained better than massed practice.

**Implementation:** Track `accessCount` and `accessIntervals[]`. Boost importance for memories accessed across multiple sessions vs. repeatedly in one session.

### Retrieval Strengthens Memory

The act of recalling information makes it more durable (testing effect).

**Implementation:** When a memory is retrieved and used in a response, increase its importance and reset decay timer.

### Chunking

Grouping related items increases working memory capacity from ~7 items to ~7 chunks.

**Implementation:** Group related short-term memories under `topicId`. Retrieve and display as coherent units.

### Sleep Consolidation

Transfer from hippocampus (short-term) to neocortex (long-term) happens during sleep.

**Implementation:** Scheduled "consolidation jobs" that run during low-activity periods. Replay important memories, strengthen associations, prune weak ones.

### Episodic → Semantic Promotion

Repeated similar experiences become abstracted into general knowledge.

**Implementation:** Detect patterns in episodic memories. When similar events occur 5+ times, extract and store as semantic fact in core memory.

---

## Part 4: Recommended MVP Architecture

### Technology Stack Alignment

| Layer             | Technology                    | Rationale                                     |
| ----------------- | ----------------------------- | --------------------------------------------- |
| **Database**      | Convex                        | Real-time, vector search, scheduled functions |
| **Frontend**      | TanStack Start + React 19     | Already configured, reactive queries          |
| **UI Components** | shadcn/ui (Base UI + cva)     | Already configured                            |
| **LLM**           | Claude (Anthropic) or OpenAI  | Entity extraction, summarization              |
| **Embeddings**    | OpenAI text-embedding-3-small | 1536 dimensions, cost-effective               |

### System Architecture Diagram

```
                                    USER INTERFACE (TanStack + shadcn)
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CONVEX BACKEND                                      │
│                                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐          │
│  │  SENSORY LAYER   │───▶│  SHORT-TERM MEM  │───▶│  LONG-TERM MEM   │          │
│  │                  │    │                  │    │                  │          │
│  │ • Relevance score│    │ • Topic grouping │    │ • Vector indexed │          │
│  │ • Entity extract │    │ • Access tracking│    │ • Graph edges    │          │
│  │ • Filter noise   │    │ • Expiry TTL     │    │ • Bi-temporal    │          │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘          │
│           │                       │                       │                     │
│           │                       │                       │                     │
│           ▼                       ▼                       ▼                     │
│  ┌────────────────────────────────────────────────────────────────────┐        │
│  │                       MEMORY MANAGER                                │        │
│  │                                                                     │        │
│  │  Cron Jobs:           │  On-Demand:          │  Decay Function:    │        │
│  │  • Consolidation (1h) │  • Entity extraction │  R = e^(-t/S)       │        │
│  │  • Decay calc (15m)   │  • Embedding gen     │  S increases with   │        │
│  │  • Cleanup (30m)      │  • Summarization     │  each retrieval     │        │
│  │  • Reflection (daily) │  • Graph linking     │                     │        │
│  └────────────────────────────────────────────────────────────────────┘        │
│                                      │                                          │
│                                      ▼                                          │
│                        ┌──────────────────┐                                     │
│                        │   CORE MEMORY    │                                     │
│                        │                  │                                     │
│                        │ • Identity facts │                                     │
│                        │ • Preferences    │                                     │
│                        │ • Relationships  │                                     │
│                        │ • Behaviors      │                                     │
│                        └──────────────────┘                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Convex Schema Design

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ==========================================
  // USERS
  // ==========================================
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
  }),

  // ==========================================
  // CONVERSATIONS (Session tracking)
  // ==========================================
  conversations: defineTable({
    userId: v.id('users'),
    title: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  }).index('by_user', ['userId', 'startedAt']),

  // ==========================================
  // MESSAGES (Raw conversation log)
  // ==========================================
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

  // ==========================================
  // SENSORY MEMORY (Input buffer)
  // ==========================================
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
    sourceMessageId: v.optional(v.id('messages')),
    createdAt: v.number(),
  })
    .index('by_user_unprocessed', ['userId', 'processed', 'createdAt'])
    .index('by_conversation', ['conversationId', 'createdAt']),

  // ==========================================
  // SHORT-TERM MEMORY (Active context)
  // ==========================================
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
    importance: v.float64(), // 0-1 scale
    accessCount: v.number(),
    lastAccessed: v.number(),
    conversationId: v.id('conversations'),
    userId: v.id('users'),
    sourceIds: v.array(v.id('sensoryMemories')),
    expiresAt: v.number(), // TTL for auto-cleanup
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

  // ==========================================
  // LONG-TERM MEMORY (Consolidated knowledge)
  // ==========================================
  longTermMemories: defineTable({
    content: v.string(),
    summary: v.optional(v.string()),
    embedding: v.array(v.float64()),
    memoryType: v.union(v.literal('episodic'), v.literal('semantic')),
    entityType: v.optional(v.string()), // person, place, concept, event
    importance: v.float64(),
    effectiveImportance: v.float64(), // After decay
    stability: v.float64(), // Increases with retrieval, slows decay
    accessCount: v.number(),
    lastAccessed: v.number(),
    consolidatedFrom: v.optional(v.array(v.id('shortTermMemories'))),
    userId: v.id('users'),
    // Bi-temporal tracking
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

  // ==========================================
  // MEMORY EDGES (Relationships/Graph)
  // ==========================================
  memoryEdges: defineTable({
    sourceId: v.id('longTermMemories'),
    targetId: v.id('longTermMemories'),
    relationType: v.string(), // "works_at", "likes", "knows", "related_to"
    fact: v.string(), // Human-readable: "Alice works at Acme Corp"
    embedding: v.array(v.float64()),
    strength: v.float64(), // 0-1, increases with reinforcement
    userId: v.id('users'),
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

  // ==========================================
  // CORE MEMORY (Stable identity)
  // ==========================================
  coreMemories: defineTable({
    content: v.string(),
    embedding: v.array(v.float64()),
    category: v.union(
      v.literal('identity'), // "User is a software engineer"
      v.literal('preference'), // "User prefers concise responses"
      v.literal('relationship'), // "User has a dog named Max"
      v.literal('behavioral'), // "User often works late"
    ),
    confidence: v.float64(), // 0-1, how certain we are
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

  // ==========================================
  // MEMORY CONSOLIDATION LOG
  // ==========================================
  consolidationLogs: defineTable({
    userId: v.id('users'),
    runType: v.union(
      v.literal('promotion'),
      v.literal('decay'),
      v.literal('pruning'),
      v.literal('reflection'),
    ),
    memoriesProcessed: v.number(),
    memoriesPromoted: v.number(),
    memoriesMerged: v.number(),
    memoriesPruned: v.number(),
    duration: v.number(), // ms
    createdAt: v.number(),
  }).index('by_user', ['userId', 'createdAt']),
})
```

### MVP Feature Scope

For a proof-of-concept, implement these features in order:

#### Phase 1: Foundation (Week 1)

1. **Schema Setup:** Deploy the Convex schema above
2. **Basic Chat UI:** Simple chat interface with shadcn components
3. **Message Storage:** Store all messages in Convex
4. **User Management:** Basic user creation/selection

#### Phase 2: Sensory + Short-Term (Week 2)

1. **Sensory Filtering:** Implement relevance scoring heuristics
2. **Entity Extraction:** Use LLM to extract entities from messages
3. **Short-Term Buffer:** Group messages into topic-based memories
4. **Access Tracking:** Track when memories are accessed

#### Phase 3: Long-Term + Retrieval (Week 3)

1. **Embedding Generation:** Generate vectors for memories
2. **Vector Search:** Implement semantic search
3. **Consolidation Job:** Scheduled function to promote short-term → long-term
4. **Decay Implementation:** Apply importance decay over time

#### Phase 4: Core Memory + Polish (Week 4)

1. **Core Memory Extraction:** Identify stable patterns
2. **Memory Visualization:** UI to show memory state
3. **Graph Relationships:** Basic entity linking
4. **Cleanup Jobs:** Prune low-importance memories

### Key Implementation Patterns

#### Pattern 1: Sensory Filtering (No LLM Required)

```typescript
// convex/sensory.ts
function calculateRelevanceScore(content: string): number {
  let score = 0.5 // Base score

  // Personal information indicators
  const personalPatterns = [
    /\b(i am|i'm|my name is|i work|i live|i prefer|i like|i hate|i always|i never)\b/i,
    /\b(my wife|my husband|my kid|my dog|my cat|my family)\b/i,
    /\b(favorite|important|remember|don't forget)\b/i,
  ]
  personalPatterns.forEach((p) => {
    if (p.test(content)) score += 0.15
  })

  // Named entities (capitalized words)
  const namedEntities =
    content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  score += Math.min(0.2, namedEntities.length * 0.05)

  // Temporal references (suggests episodic memory)
  const temporalPatterns = [
    /\b(yesterday|today|tomorrow|last week|next month)\b/i,
    /\b(always|never|usually|sometimes|often)\b/i,
  ]
  temporalPatterns.forEach((p) => {
    if (p.test(content)) score += 0.1
  })

  // Penalize short/generic content
  if (content.length < 20) score -= 0.3
  if (
    /^(ok|thanks|yes|no|sure|got it|okay|right|hmm|ah)$/i.test(content.trim())
  ) {
    score -= 0.5
  }

  return Math.max(0, Math.min(1, score))
}
```

#### Pattern 2: Importance Decay

```typescript
// convex/consolidation.ts
function calculateEffectiveImportance(
  memory: LongTermMemory,
  now: number,
): number {
  const hoursSinceAccess = (now - memory.lastAccessed) / (1000 * 60 * 60)

  // Exponential decay: R = e^(-t/S)
  // Higher stability = slower decay
  const decayFactor = Math.exp(-hoursSinceAccess / memory.stability)

  return memory.importance * decayFactor
}

function updateStabilityOnAccess(memory: LongTermMemory): number {
  // Each retrieval increases stability by ~20%
  // Capped at 1000 hours half-life
  return Math.min(1000, memory.stability * 1.2)
}
```

#### Pattern 3: Episodic → Semantic Promotion

```typescript
// convex/reflection.ts
async function extractSemanticPatterns(ctx: ActionCtx, userId: Id<'users'>) {
  // Find episodic memories with similar content
  const episodic = await ctx.runQuery(internal.queries.getRecentEpisodic, {
    userId,
    limit: 100,
  })

  // Group by entity/topic
  const grouped = groupByEntity(episodic)

  for (const [entity, memories] of Object.entries(grouped)) {
    if (memories.length >= 3) {
      // Pattern detected - create semantic memory
      const pattern = await summarizePattern(memories)

      await ctx.runMutation(internal.core.createCoreMemory, {
        userId,
        content: pattern,
        category: 'behavioral',
        confidence: Math.min(1, memories.length / 10),
        sourceMemories: memories.map((m) => m._id),
      })
    }
  }
}
```

### Frontend Components

#### Memory Dashboard Component

```tsx
// src/components/memory-dashboard.tsx
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function MemoryDashboard({ userId }: { userId: Id<'users'> }) {
  const coreMemories = useQuery(
    convexQuery(api.core.getCoreMemories, { userId }),
  )
  const recentMemories = useQuery(
    convexQuery(api.longTerm.getRecent, { userId, limit: 10 }),
  )
  const stats = useQuery(convexQuery(api.stats.getMemoryStats, { userId }))

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Core Memory Card */}
      <Card>
        <CardHeader>
          <CardTitle>Core Identity</CardTitle>
        </CardHeader>
        <CardContent>
          {coreMemories.data?.map((memory) => (
            <div key={memory._id} className="mb-2">
              <Badge variant="outline">{memory.category}</Badge>
              <p className="text-sm">{memory.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Memory Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Short-term</span>
              <span>{stats.data?.shortTerm ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Long-term</span>
              <span>{stats.data?.longTerm ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Core</span>
              <span>{stats.data?.core ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Memories Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Memories</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMemories.data?.map((memory) => (
            <div key={memory._id} className="mb-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(memory.createdAt).toLocaleDateString()}
              </span>
              <p>{memory.summary ?? memory.content.slice(0, 100)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

### Cron Job Configuration

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Promote important short-term memories (every hour)
crons.interval(
  'consolidate_short_term',
  { minutes: 60 },
  internal.consolidation.promoteToLongTerm,
)

// Apply decay to importance scores (every 15 minutes)
crons.interval(
  'apply_memory_decay',
  { minutes: 15 },
  internal.consolidation.applyDecay,
)

// Cleanup expired short-term memories (every 30 minutes)
crons.interval(
  'cleanup_expired',
  { minutes: 30 },
  internal.consolidation.cleanupExpired,
)

// Daily reflection - extract patterns, update core memory (3 AM UTC)
crons.daily(
  'daily_reflection',
  { hourUTC: 3, minuteUTC: 0 },
  internal.reflection.runDailyReflection,
)

// Weekly pruning of very low importance memories (Sunday 4 AM UTC)
crons.weekly(
  'weekly_prune',
  { dayOfWeek: 'sunday', hourUTC: 4, minuteUTC: 0 },
  internal.consolidation.pruneMemories,
)

export default crons
```

---

## Part 5: Design Decisions & Trade-offs

### Decision 1: Convex vs Dedicated Vector DB

**Choice:** Use Convex's built-in vector search

**Rationale:**

- Convex now supports vector indexes natively
- Eliminates need for separate Pinecone/Weaviate infrastructure
- Real-time reactivity for free
- Consistent transactional guarantees

**Trade-off:** Max 256 results per query, limited to actions (not queries)

### Decision 2: LLM-Based vs Heuristic Filtering

**Choice:** Heuristic filtering in sensory layer, LLM for extraction

**Rationale:**

- Heuristics are fast and cheap for initial filtering
- LLM calls reserved for high-value operations (entity extraction, summarization)
- Reduces API costs significantly at scale

**Trade-off:** May miss some nuanced relevance that LLM would catch

### Decision 3: Soft Delete vs Hard Delete

**Choice:** Soft delete with `validUntil` timestamp (bi-temporal)

**Rationale:**

- Allows "time travel" queries (what did we know at time X?)
- Supports fact correction without losing history
- Pruning can be aggressive since data isn't truly lost

**Trade-off:** Storage grows over time, need periodic archival

### Decision 4: Per-User vs Shared Core Memory

**Choice:** Per-user core memory only (for MVP)

**Rationale:**

- Simpler implementation
- Clearer privacy boundaries
- Organizational memory can be added later as a layer

**Trade-off:** Can't share patterns across users initially

### Decision 5: Graph DB vs Graph-in-Relational

**Choice:** Store edges in Convex table, not separate graph DB

**Rationale:**

- Avoid infrastructure complexity
- Relationship queries are simple enough for table + indexes
- Can migrate to Neo4j later if graph queries become complex

**Trade-off:** Complex graph traversals will be slower

---

## Part 6: Success Metrics for MVP

### Quantitative Metrics

| Metric                           | Target          | Measurement                               |
| -------------------------------- | --------------- | ----------------------------------------- |
| Sensory filter rejection rate    | 30-50%          | Messages filtered / total messages        |
| Short → Long-term promotion rate | 20-40%          | Promoted / total short-term               |
| Core memory stability            | <5% change/week | Core memory updates / total               |
| Retrieval relevance              | >70% useful     | User feedback on retrieved context        |
| Memory decay coverage            | 100%            | Memories with updated effectiveImportance |

### Qualitative Metrics

1. **Coherence:** Does the agent maintain consistent personality across sessions?
2. **Personalization:** Does retrieved context feel relevant to the conversation?
3. **Evolution:** Do core memories reflect actual user patterns over time?
4. **Forgetting:** Are outdated/irrelevant memories successfully pruned?

---

## Part 7: Future Enhancements (Post-MVP)

1. **Multi-Modal Sensory:** Process images, files, audio
2. **Organizational Memory:** Shared memory across user groups
3. **Confidence Calibration:** Use user feedback to adjust extraction confidence
4. **Active Forgetting:** User-triggered memory deletion with cascading updates
5. **Memory Explanations:** Show why certain memories were retrieved
6. **Compression Engine:** Summarize long-term memories to reduce storage
7. **Cross-User Patterns:** Learn from aggregate patterns (privacy-preserving)
8. **Memory Search UI:** Let users browse and edit their memory graph

---

## Appendix A: API Reference (Draft)

### Sensory Layer

- `sensory.ingest(message)` - Ingest a new message
- `sensory.getUnprocessed(userId)` - Get pending sensory items

### Short-Term Memory

- `shortTerm.getActive(conversationId)` - Get current session context
- `shortTerm.recordAccess(memoryId)` - Mark memory as accessed

### Long-Term Memory

- `longTerm.search(query, userId)` - Semantic search
- `longTerm.getRecent(userId, limit)` - Get recent memories
- `longTerm.getForEntity(entityType, userId)` - Get by entity

### Core Memory

- `core.get(userId)` - Get all core memories for user
- `core.getByCategory(userId, category)` - Filter by category

### Memory Management

- `consolidation.promoteToLongTerm()` - Run promotion cycle
- `consolidation.applyDecay()` - Update effective importance
- `reflection.runDailyReflection()` - Extract patterns

---

## Appendix B: File Structure

```
convex/
  schema.ts              # Database schema (above)
  sensory.ts             # Sensory layer mutations/queries
  shortTerm.ts           # Short-term memory operations
  longTerm.ts            # Long-term memory operations
  core.ts                # Core memory operations
  edges.ts               # Memory graph relationships
  consolidation.ts       # Background consolidation jobs
  reflection.ts          # Pattern extraction, insights
  search.ts              # Vector search actions
  embedding.ts           # Embedding generation actions
  crons.ts               # Scheduled job definitions
  _generated/            # Convex generated files

src/
  routes/
    index.tsx            # Home page
    chat.tsx             # Chat interface
    memory.tsx           # Memory dashboard
  components/
    ui/                  # shadcn components
    chat/
      chat-input.tsx
      chat-messages.tsx
      message-bubble.tsx
    memory/
      memory-dashboard.tsx
      memory-card.tsx
      core-memory-list.tsx
      memory-graph.tsx   # Optional: D3 visualization
  lib/
    utils.ts
    memory-utils.ts      # Client-side memory helpers
```

---

## Conclusion

This architecture implements the five memory layers from the blog post using Convex's real-time database with vector search, scheduled functions for consolidation, and a TanStack + shadcn frontend. The key innovations are:

1. **Cognitive-inspired decay:** Exponential forgetting with retrieval-based reinforcement
2. **Automatic promotion:** Short-term patterns that persist become long-term memories
3. **Core identity extraction:** Stable user patterns emerge from repeated observations
4. **Background consolidation:** "Sleep cycles" that reorganize and prune memory

The MVP scope is achievable in 4 weeks and provides a working demonstration of human-like memory management that goes beyond simple vector retrieval.
