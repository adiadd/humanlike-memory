import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { WorkflowManager } from '@convex-dev/workflow'
import { ActionCache } from '@convex-dev/action-cache'
import { TableAggregate } from '@convex-dev/aggregate'

import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'

export const workflowManager = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  },
})

export const embeddingCache: any = new ActionCache(components.actionCache, {
  action: internal.embedding.generateEmbedding,
  name: 'embeddings-v1',
  ttl: 1000 * 60 * 60 * 24 * 7,
})

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  extraction: {
    kind: 'token bucket',
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  embedding: {
    kind: 'token bucket',
    rate: 100,
    period: MINUTE,
    capacity: 20,
  },
  llmTokens: {
    kind: 'token bucket',
    rate: 50000,
    period: HOUR,
    capacity: 10000,
    shards: 5,
  },
  chatMessages: {
    kind: 'token bucket',
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
})

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
