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
// Note: Type assertion needed due to circular reference during type generation

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
