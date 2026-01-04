# Human-like Memory System for AI Agents

## CC_RECOMMENDATIONS.md

A comprehensive implementation guide for building an MVP/proof of concept of a human-like memory system, leveraging your existing TanStack Start + Convex + shadcn stack.

---

## Table of Contents

1. [Understanding Memory Types](#1-understanding-memory-types)
2. [Why Current Memory Systems Fail](#2-why-current-memory-systems-fail)
3. [Architecture Overview](#3-architecture-overview)
4. [Implementation Recommendations](#4-implementation-recommendations)
5. [Convex Schema Design](#5-convex-schema-design)
6. [Frontend Components](#6-frontend-components)
7. [Phased Implementation Plan](#7-phased-implementation-plan)
8. [Open Source References](#8-open-source-references)

---

## 1. Understanding Memory Types

The blog describes a **five-layer memory architecture** modeled after human cognition. Here's a breakdown of each layer:

### 1.1 Core Memory (Foundation Layer)

**Human analog:** Sense of self, personality, stable beliefs

| Aspect          | Description                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| **Purpose**     | Defines who the user IS - stable identity, preferences, biases                   |
| **Persistence** | Most persistent - evolves slowly over weeks/months                               |
| **Examples**    | "User prefers concise answers", "User is a developer", "User lives in Bangalore" |
| **Access**      | Always in context, never evicted                                                 |

**Key Insight:** This is NOT a cache - it's the agent's "personality profile" of the user that shapes ALL interactions.

### 1.2 Sensory Memory (Input Layer)

**Human analog:** Brief sensory impressions before attention filters them

| Aspect          | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| **Purpose**     | Captures raw input, filters noise, extracts entities/topics  |
| **Persistence** | Very brief - seconds to minutes                              |
| **Examples**    | "User just mentioned they're vegetarian" → Extract and score |
| **Processing**  | Attention scoring determines what passes through             |

**Key Insight:** This layer PREVENTS vector database clutter by filtering before storage.

### 1.3 Short-Term Memory (Working Memory)

**Human analog:** Active thoughts during a conversation

| Aspect          | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| **Purpose**     | Buffer for active reasoning, current context, topic continuity   |
| **Persistence** | Minutes to hours - single session or short span                  |
| **Examples**    | Current conversation topics, reasoning traces, transient context |
| **Promotion**   | If topic persists across interactions → promote to long-term     |

**Key Insight:** Actively manages focus and groups related messages under shared topics.

### 1.4 Long-Term Memory (Knowledge Store)

**Human analog:** Semantic and episodic memory

| Aspect          | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| **Purpose**     | Consolidated knowledge indexed by entity, topic, relationship     |
| **Persistence** | Days to months - survives sessions                                |
| **Types**       | **Semantic** (facts/concepts) + **Episodic** (experiences/events) |
| **Structure**   | Forms conceptual graphs, not flat vector dumps                    |

**Key Insight:** Unlike vector databases, this layer organizes information into STRUCTURED knowledge graphs.

### 1.5 Memory Managers (Background Processes)

**Human analog:** Sleep-based memory consolidation

| Aspect         | Description                                               |
| -------------- | --------------------------------------------------------- |
| **Purpose**    | Periodic review, promotion, demotion, pruning, reflection |
| **Timing**     | Background processes - not during active conversation     |
| **Operations** | Consolidate, compress, archive, delete, reflect           |
| **Output**     | Meta-summaries, refined memories, pruned clutter          |

**Key Insight:** This is the "sleep cycle" - critical for preventing memory degradation.

---

## 2. Why Current Memory Systems Fail

### The Problem with Vector-Only Approaches

```
Traditional Approach:
User Message → Embed → Store in Vector DB → Retrieve by Similarity

Problems:
1. No filtering = clutter accumulates
2. No structure = relationships lost
3. No consolidation = redundancy grows
4. No forgetting = relevance drifts
```

### What's Missing

| Missing Element           | Consequence                                          |
| ------------------------- | ---------------------------------------------------- |
| **Attention filtering**   | Every message stored, even "hmm, let me think"       |
| **Topic grouping**        | Related thoughts scattered across embeddings         |
| **Temporal awareness**    | "User was vegetarian" vs "User is vegetarian"        |
| **Relationship modeling** | "Bob works at Acme" is just text, not a relationship |
| **Decay/forgetting**      | Old irrelevant data competes with current context    |
| **Consolidation**         | 10 similar memories instead of 1 refined one         |

### The Goal

Move from **reactive retrieval** to **active cognition**:

```
Human-like Approach:
Input → Filter → Short-Term Buffer → Consolidate → Long-Term Graph
                                            ↓
                                    Core Memory (Identity)
                                            ↑
                            Background: Prune, Promote, Reflect
```

---

## 3. Architecture Overview

### 3.1 System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                               │
│                                  │                                       │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      1. SENSORY MEMORY                             │  │
│  │  ┌─────────────┐   ┌──────────────┐   ┌───────────────┐           │  │
│  │  │   Extract   │──▶│   Classify   │──▶│    Score      │           │  │
│  │  │  Entities   │   │   Topics     │   │  Attention    │           │  │
│  │  └─────────────┘   └──────────────┘   └───────┬───────┘           │  │
│  │                                               │                    │  │
│  │                          score < threshold ───┴─── score >= threshold
│  │                                    │                      │        │  │
│  │                                    ▼                      ▼        │  │
│  │                               [DISCARD]           [PASS THROUGH]   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                              │           │
│                                                              ▼           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    2. SHORT-TERM MEMORY                            │  │
│  │                                                                    │  │
│  │    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │  │
│  │    │ Topic A │  │ Topic B │  │ Topic C │  │  ...    │   Buffer    │  │
│  │    │ Group   │  │ Group   │  │ Group   │  │         │   (8K tok)  │  │
│  │    └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘             │  │
│  │         │            │            │                                │  │
│  │         └────────────┴────────────┴─── Persists? ──▶ PROMOTE      │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                              │           │
│                                                              ▼           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    3. LONG-TERM MEMORY                             │  │
│  │                                                                    │  │
│  │   ┌─────────────────────────────────────────────────────────┐     │  │
│  │   │              TEMPORAL KNOWLEDGE GRAPH                    │     │  │
│  │   │                                                          │     │  │
│  │   │    [Bob]──works_at──▶[Acme Corp]                        │     │  │
│  │   │      │                    │                              │     │  │
│  │   │      │                    └──located_in──▶[San Francisco]│     │  │
│  │   │      │                                                   │     │  │
│  │   │      └──knows──▶[Alice]──prefers──▶[Python]             │     │  │
│  │   │                                                          │     │  │
│  │   └─────────────────────────────────────────────────────────┘     │  │
│  │                                                                    │  │
│  │   ┌─────────────────┐  ┌──────────────────┐                       │  │
│  │   │ SEMANTIC        │  │ EPISODIC         │                       │  │
│  │   │ Facts, concepts │  │ Experiences      │                       │  │
│  │   └─────────────────┘  └──────────────────┘                       │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                              │           │
│                                                              ▼           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      5. CORE MEMORY                                │  │
│  │                                                                    │  │
│  │   ┌──────────────────────┐  ┌────────────────────────────┐        │  │
│  │   │    USER PROFILE      │  │    AGENT PERSONA           │        │  │
│  │   │                      │  │                            │        │  │
│  │   │  • Name: Bob         │  │  • Style: Concise          │        │  │
│  │   │  • Role: Developer   │  │  • Personality: Helpful    │        │  │
│  │   │  • Prefers: Python   │  │  • Values: Accuracy        │        │  │
│  │   │  • Timezone: PST     │  │                            │        │  │
│  │   └──────────────────────┘  └────────────────────────────┘        │  │
│  │                                                                    │  │
│  │                    [ALWAYS IN CONTEXT]                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      4. MEMORY MANAGERS (Background)                       │
│                                                                            │
│   ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐   │
│   │  CONSOLIDATE   │  │  DECAY/FORGET   │  │  PROMOTE/DEMOTE          │   │
│   │                │  │                 │  │                          │   │
│   │  • Merge       │  │  • Apply decay  │  │  • STM → LTM if persist  │   │
│   │    similar     │  │  • Prune unused │  │  • LTM → Core if stable  │   │
│   │  • Summarize   │  │  • Archive old  │  │  • Demote if stale       │   │
│   │  • Deduplicate │  │                 │  │                          │   │
│   └────────────────┘  └─────────────────┘  └──────────────────────────┘   │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │  REFLECT                                                          │    │
│   │  • Generate meta-summaries                                        │    │
│   │  • Identify patterns                                              │    │
│   │  • Update user profile                                            │    │
│   └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│                           [RUNS VIA CRON JOBS]                             │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
1. INPUT arrives
      │
      ▼
2. SENSORY MEMORY filters & extracts entities
      │
      ├─── Low attention → Discard
      │
      └─── High attention → Continue
                │
                ▼
3. SHORT-TERM MEMORY buffers active context
      │
      ├─── Transient → Decay after session
      │
      └─── Persistent → Promote to Long-Term
                │
                ▼
4. LONG-TERM MEMORY stores as graph
      │
      ├─── Semantic facts → Knowledge base
      │
      └─── Episodic events → Experience log
                │
                ▼
5. MEMORY MANAGER consolidates (async)
      │
      └─── Significant patterns → Update Core Memory
```

---

## 4. Implementation Recommendations

### 4.1 Technology Choices

| Component             | Recommended Approach         | Why                                            |
| --------------------- | ---------------------------- | ---------------------------------------------- |
| **Sensory Memory**    | Convex action with LLM       | Real-time entity extraction, attention scoring |
| **Short-Term Memory** | Convex table with TTL        | Real-time subscriptions, automatic cleanup     |
| **Long-Term Memory**  | Convex + Vector Index        | Hybrid semantic + keyword search               |
| **Knowledge Graph**   | Convex relational tables     | Entity-relationship modeling                   |
| **Memory Managers**   | Convex cron jobs             | Background consolidation, decay                |
| **Core Memory**       | Convex table (always loaded) | Persistent user/agent profiles                 |
| **Frontend**          | TanStack Query + shadcn      | Real-time UI updates                           |

### 4.2 Why Convex Fits Well

1. **Real-time subscriptions** - Memory updates stream to UI automatically
2. **Scheduled functions** - Perfect for background consolidation jobs
3. **Vector search** - Built-in semantic similarity search
4. **Full-text search** - Keyword matching for hybrid retrieval
5. **Transactions** - Atomic updates when promoting memories
6. **TypeScript native** - End-to-end type safety

### 4.3 Hybrid Retrieval Strategy

Don't rely on vectors alone. Use **Reciprocal Rank Fusion (RRF)**:

```typescript
// Combine vector similarity + keyword matching + graph traversal
const hybridSearch = async (query: string) => {
  const [vectorResults, textResults, graphResults] = await Promise.all([
    vectorSearch(queryEmbedding, limit: 20),
    fullTextSearch(query, limit: 20),
    graphTraversal(extractedEntities, depth: 2),
  ]);

  // RRF scoring
  const k = 60;
  return mergeResults(vectorResults, textResults, graphResults)
    .map(r => ({
      ...r,
      score: (1 / (k + r.vectorRank)) +
             (1 / (k + r.textRank)) +
             (1 / (k + r.graphRank))
    }))
    .sort((a, b) => b.score - a.score);
};
```

### 4.4 Attention Scoring Heuristics

For MVP, use simple heuristics before adding LLM-based scoring:

```typescript
const scoreAttention = (input: string, entities: Entity[]): number => {
  let score = 0

  // Entity-based scoring
  score += entities.length * 0.1
  score += entities.filter((e) => e.type === 'person').length * 0.2
  score += entities.filter((e) => e.type === 'preference').length * 0.3

  // Pattern-based scoring
  if (input.includes('always') || input.includes('never')) score += 0.2
  if (input.includes('prefer') || input.includes('like')) score += 0.25
  if (input.includes('I am') || input.includes("I'm")) score += 0.3

  // Penalize low-value patterns
  if (input.length < 20) score -= 0.2
  if (input.match(/^(ok|sure|thanks|hmm)/i)) score -= 0.3

  return Math.max(0, Math.min(1, score))
}
```

---

## 5. Convex Schema Design

### 5.1 Core Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ============================================
  // AGENTS & CONVERSATIONS
  // ============================================

  agents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  }),

  conversations: defineTable({
    agentId: v.id('agents'),
    title: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    messageCount: v.number(),
  })
    .index('by_agent', ['agentId'])
    .index('by_agent_and_time', ['agentId', 'startedAt']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    timestamp: v.number(),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_conversation_and_time', ['conversationId', 'timestamp']),

  // ============================================
  // MEMORY TIERS
  // ============================================

  memories: defineTable({
    // Memory tier
    tier: v.union(
      v.literal('sensory'),
      v.literal('short_term'),
      v.literal('long_term'),
    ),

    // Content
    content: v.string(),
    summary: v.optional(v.string()),

    // Metadata
    importance: v.float64(), // 0.0 to 1.0
    accessCount: v.number(), // Times retrieved
    lastAccessedAt: v.number(), // For decay calculation

    // Vector embedding for semantic search
    embedding: v.optional(v.array(v.float64())),

    // Categorization
    memoryType: v.union(
      v.literal('semantic'), // Facts, knowledge
      v.literal('episodic'), // Experiences, events
      v.literal('procedural'), // How-to, behaviors
    ),

    // Relationships
    agentId: v.id('agents'),
    conversationId: v.optional(v.id('conversations')),
    sourceMemoryId: v.optional(v.id('memories')), // Consolidation lineage

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    consolidatedAt: v.optional(v.number()),
  })
    .index('by_tier', ['tier'])
    .index('by_agent', ['agentId'])
    .index('by_agent_and_tier', ['agentId', 'tier'])
    .index('by_importance', ['importance'])
    .index('by_last_accessed', ['lastAccessedAt'])
    .index('by_conversation', ['conversationId'])
    .searchIndex('search_content', {
      searchField: 'content',
      filterFields: ['tier', 'agentId', 'memoryType'],
    })
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['tier', 'agentId', 'memoryType'],
    }),

  // ============================================
  // CORE MEMORY (Always in context)
  // ============================================

  coreMemory: defineTable({
    agentId: v.id('agents'),

    // User profile - static attributes
    userProfile: v.object({
      name: v.optional(v.string()),
      preferredName: v.optional(v.string()),
      timezone: v.optional(v.string()),
      language: v.optional(v.string()),
      role: v.optional(v.string()),
    }),

    // User traits - dynamic, evolving
    userTraits: v.object({
      interests: v.array(v.string()),
      preferences: v.array(
        v.object({
          key: v.string(),
          value: v.string(),
          confidence: v.float64(),
        }),
      ),
      habits: v.array(v.string()),
      communicationStyle: v.optional(v.string()),
    }),

    // Agent persona - how agent should behave
    agentPersona: v.object({
      name: v.string(),
      personality: v.string(),
      communicationStyle: v.string(),
      values: v.array(v.string()),
    }),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_agent', ['agentId']),

  // ============================================
  // ENTITY GRAPH (Knowledge Graph)
  // ============================================

  entities: defineTable({
    name: v.string(),
    type: v.string(), // person, organization, concept, location, event, etc.
    description: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),

    // Vector for semantic matching
    embedding: v.optional(v.array(v.float64())),

    // Statistics
    mentionCount: v.number(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),

    // Ownership
    agentId: v.id('agents'),

    // Soft delete
    deletedAt: v.optional(v.number()),
  })
    .index('by_name', ['name'])
    .index('by_type', ['type'])
    .index('by_agent', ['agentId'])
    .index('by_agent_and_name', ['agentId', 'name'])
    .index('by_mention_count', ['mentionCount'])
    .searchIndex('search_entities', {
      searchField: 'name',
      filterFields: ['type', 'agentId'],
    })
    .vectorIndex('entity_embedding', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['type', 'agentId'],
    }),

  entityRelationships: defineTable({
    fromEntityId: v.id('entities'),
    toEntityId: v.id('entities'),
    relationshipType: v.string(), // works_at, knows, prefers, located_in, etc.

    // Relationship strength/confidence
    strength: v.float64(),

    // Evidence supporting this relationship
    evidence: v.array(v.id('memories')),

    // Temporal validity
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()), // null = still valid

    // Ownership
    agentId: v.id('agents'),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_from_entity', ['fromEntityId'])
    .index('by_to_entity', ['toEntityId'])
    .index('by_relationship_type', ['relationshipType'])
    .index('by_agent', ['agentId']),

  // Memory <-> Entity associations
  memoryEntities: defineTable({
    memoryId: v.id('memories'),
    entityId: v.id('entities'),
    role: v.string(), // subject, object, context, mention
    salience: v.float64(), // How prominent in the memory
  })
    .index('by_memory', ['memoryId'])
    .index('by_entity', ['entityId']),

  // ============================================
  // MEMORY MANAGEMENT
  // ============================================

  consolidationJobs: defineTable({
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    jobType: v.union(
      v.literal('consolidate'),
      v.literal('decay'),
      v.literal('promote'),
      v.literal('reflect'),
      v.literal('cleanup'),
    ),
    sourceTier: v.optional(v.string()),
    targetTier: v.optional(v.string()),
    processedCount: v.number(),
    agentId: v.optional(v.id('agents')),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index('by_status', ['status'])
    .index('by_type', ['jobType']),

  // Archived memories (cold storage)
  archives: defineTable({
    originalId: v.string(),
    data: v.any(),
    archivedAt: v.number(),
    reason: v.string(),
    agentId: v.id('agents'),
  })
    .index('by_original_id', ['originalId'])
    .index('by_agent', ['agentId']),
})
```

### 5.2 Cron Jobs Configuration

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Sensory → Short-term: Every 5 minutes
crons.interval(
  'consolidate-sensory',
  { minutes: 5 },
  internal.memoryManager.consolidateSensoryToShortTerm,
)

// Short-term → Long-term: Every hour
crons.interval(
  'consolidate-short-term',
  { hours: 1 },
  internal.memoryManager.consolidateShortTermToLongTerm,
)

// Decay unused memories: Every 6 hours
crons.interval(
  'decay-memories',
  { hours: 6 },
  internal.memoryManager.applyDecay,
)

// Cleanup deleted memories: Daily at 3 AM UTC
crons.daily(
  'cleanup-deleted',
  { hourUTC: 3, minuteUTC: 0 },
  internal.memoryManager.purgeDeletedMemories,
)

// Generate reflections: Daily at 4 AM UTC
crons.daily(
  'generate-reflections',
  { hourUTC: 4, minuteUTC: 0 },
  internal.memoryManager.generateReflections,
)

// Update core memory from patterns: Weekly
crons.weekly(
  'update-core-memory',
  { dayOfWeek: 'sunday', hourUTC: 5, minuteUTC: 0 },
  internal.memoryManager.updateCoreMemoryFromPatterns,
)

export default crons
```

---

## 6. Frontend Components

### 6.1 Recommended Component Structure

```
src/
├── routes/
│   ├── index.tsx                    # Dashboard/home
│   ├── agents/
│   │   ├── index.tsx                # Agent list
│   │   ├── $agentId/
│   │   │   ├── index.tsx            # Agent detail
│   │   │   ├── chat.tsx             # Chat interface
│   │   │   └── memory.tsx           # Memory explorer
│   └── memory/
│       ├── index.tsx                # Memory dashboard
│       ├── graph.tsx                # Knowledge graph viz
│       └── consolidation.tsx        # Consolidation logs
├── components/
│   ├── memory/
│   │   ├── MemoryTierCard.tsx       # Display single memory
│   │   ├── MemoryTimeline.tsx       # Timeline of memories
│   │   ├── MemoryGraph.tsx          # Knowledge graph
│   │   ├── CoreMemoryEditor.tsx     # Edit core memory
│   │   ├── EntityList.tsx           # Entity explorer
│   │   └── ConsolidationLog.tsx     # Show job history
│   ├── chat/
│   │   ├── ChatWindow.tsx           # Main chat interface
│   │   ├── MessageBubble.tsx        # Individual message
│   │   └── MemoryContext.tsx        # Show retrieved memories
│   └── dashboard/
│       ├── MemoryStats.tsx          # Memory statistics
│       └── TierDistribution.tsx     # Visual tier breakdown
└── lib/
    ├── hooks/
    │   ├── useMemories.ts           # Memory CRUD hooks
    │   ├── useEntities.ts           # Entity hooks
    │   └── useCoreMemory.ts         # Core memory hooks
    └── utils/
        └── memory.ts                 # Memory utilities
```

### 6.2 Key UI Components

**Memory Tier Visualization:**

```tsx
// Visual representation of memory flowing through tiers
<MemoryTierDiagram>
  <TierColumn tier="sensory" count={sensoryCount} />
  <Arrow direction="right" />
  <TierColumn tier="short_term" count={stmCount} />
  <Arrow direction="right" />
  <TierColumn tier="long_term" count={ltmCount} />
  <Arrow direction="down" />
  <CoreMemoryCard data={coreMemory} />
</MemoryTierDiagram>
```

**Knowledge Graph (using react-force-graph or vis-network):**

```tsx
// Interactive graph visualization of entities and relationships
<KnowledgeGraph
  entities={entities}
  relationships={relationships}
  onNodeClick={handleEntityClick}
  onEdgeClick={handleRelationshipClick}
/>
```

**Chat with Memory Context:**

```tsx
// Show which memories were used for response
<ChatWindow>
  <MessageList messages={messages} />
  <MemoryContextPanel>
    <RetrievedMemories memories={usedMemories} />
    <RelevanceScores scores={memoryScores} />
  </MemoryContextPanel>
  <MessageInput onSend={handleSend} />
</ChatWindow>
```

---

## 7. Phased Implementation Plan

### Phase 1: Foundation (MVP Core)

**Goal:** Basic memory storage and retrieval

| Task                                                  | Priority | Complexity |
| ----------------------------------------------------- | -------- | ---------- |
| Create Convex schema (memories, entities, coreMemory) | High     | Medium     |
| Implement basic CRUD mutations                        | High     | Low        |
| Add vector embeddings to memories                     | High     | Medium     |
| Create simple chat interface                          | High     | Low        |
| Implement memory retrieval (vector search)            | High     | Medium     |

**Deliverables:**

- Working schema with all tables
- Chat that stores messages as memories
- Basic semantic search retrieval
- Simple UI to view memories

### Phase 2: Tier System

**Goal:** Implement memory tiers and promotion

| Task                               | Priority | Complexity |
| ---------------------------------- | -------- | ---------- |
| Implement sensory memory filtering | High     | Medium     |
| Add attention scoring logic        | High     | Medium     |
| Create short-term memory buffer    | High     | Low        |
| Implement STM → LTM promotion      | High     | Medium     |
| Add cron jobs for consolidation    | Medium   | Low        |

**Deliverables:**

- Automatic filtering of low-value input
- Topic grouping in short-term memory
- Automatic promotion to long-term
- Background consolidation running

### Phase 3: Knowledge Graph

**Goal:** Entity extraction and relationships

| Task                                    | Priority | Complexity |
| --------------------------------------- | -------- | ---------- |
| Implement entity extraction (LLM-based) | High     | High       |
| Create entity storage and deduplication | High     | Medium     |
| Implement relationship extraction       | High     | High       |
| Add graph traversal queries             | Medium   | Medium     |
| Build knowledge graph UI                | Medium   | High       |

**Deliverables:**

- Entities automatically extracted from messages
- Relationships between entities captured
- Graph visualization of knowledge
- Graph-aware retrieval

### Phase 4: Core Memory & Personalization

**Goal:** Persistent user understanding

| Task                            | Priority | Complexity |
| ------------------------------- | -------- | ---------- |
| Implement core memory structure | High     | Low        |
| Add user profile extraction     | High     | Medium     |
| Implement preference learning   | High     | High       |
| Core memory always in context   | High     | Low        |
| Add core memory editing UI      | Medium   | Low        |

**Deliverables:**

- Core memory persisting user traits
- Automatic profile updates from patterns
- Preferences influencing responses
- UI to view/edit core memory

### Phase 5: Memory Management

**Goal:** Decay, forgetting, reflection

| Task                             | Priority | Complexity |
| -------------------------------- | -------- | ---------- |
| Implement memory decay algorithm | Medium   | Medium     |
| Add forgetting/pruning logic     | Medium   | Medium     |
| Create reflection generation     | Medium   | High       |
| Implement memory consolidation   | Medium   | High       |
| Add management dashboard         | Low      | Medium     |

**Deliverables:**

- Unused memories decay over time
- Automatic pruning of stale data
- Meta-summaries generated
- Admin dashboard for management

### Phase 6: Advanced Features

**Goal:** Polish and optimization

| Task                           | Priority | Complexity |
| ------------------------------ | -------- | ---------- |
| Hybrid retrieval (RRF)         | Medium   | Medium     |
| Temporal queries ("last week") | Medium   | High       |
| Conflict resolution            | Medium   | High       |
| Memory versioning              | Low      | Medium     |
| Export/import functionality    | Low      | Low        |

---

## 8. Open Source References

### Projects to Study

| Project          | What to Learn                            | Link                                                                     |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| **Mem0**         | Hybrid storage, graph + vector           | [github.com/mem0ai/mem0](https://github.com/mem0ai/mem0)                 |
| **Graphiti**     | Temporal knowledge graphs                | [github.com/getzep/graphiti](https://github.com/getzep/graphiti)         |
| **MemGPT/Letta** | Self-editing memory, tiered architecture | [docs.letta.com](https://docs.letta.com)                                 |
| **LangMem**      | Memory SDK patterns                      | [langchain-ai.github.io/langmem](https://langchain-ai.github.io/langmem) |

### Key Papers

1. **MemGPT** - "Towards LLMs as Operating Systems" - Self-editing memory
2. **Zep** - "A Temporal Knowledge Graph Architecture for Agent Memory"
3. **Reflexion** - Self-reflection for improved reasoning

### Benchmarks

- **LongMemEval** - Long-term memory evaluation
- **Deep Memory Retrieval (DMR)** - Multi-session retrieval quality
- Target: 90%+ accuracy, <300ms P95 latency

---

## Summary

This MVP should demonstrate:

1. **Filtered input** - Not everything gets stored
2. **Tiered memory** - Sensory → Short-term → Long-term → Core
3. **Knowledge graphs** - Entities and relationships, not just vectors
4. **Background consolidation** - Cron jobs that prune and promote
5. **Core identity** - Persistent user understanding that shapes all interactions

The key insight: **Memory is not retrieval. Memory is cognition.** This system should think about what to remember, not just store everything and search.

Start with Phase 1 to get a working foundation, then iterate. The existing Convex + TanStack Start + shadcn stack is well-suited for this architecture.

---

_Last updated: January 2025_
