// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    externalId: v.string(), // External auth ID (e.g., Clerk)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    lastActiveAt: v.number(), // For finding active users in reflection
    createdAt: v.number(),
  })
    .index('by_externalId', ['externalId'])
    .index('by_lastActive', ['lastActiveAt']),

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

  topics: defineTable({
    userId: v.id('users'),
    label: v.string(),
    centroid: v.array(v.float64()),
    memberCount: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

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
