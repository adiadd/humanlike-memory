/**
 * Short-term memory expiry time in hours
 * Used in: shortTerm.ts
 */
export const STM_EXPIRY_HOURS = 4

/**
 * Minimum attention score required for sensory memory to be promoted
 * Used in: sensory.ts
 */
export const ATTENTION_THRESHOLD = 0.3

/**
 * Similarity threshold for deduplicating long-term memories
 * Memories with similarity >= this threshold are considered duplicates
 * Used in: longTerm.ts
 */
export const DEDUP_SIMILARITY_THRESHOLD = 0.95

/**
 * Similarity threshold for clustering short-term memories into topics
 * Used in: extraction.ts
 */
export const TOPIC_SIMILARITY_THRESHOLD = 0.82

/**
 * Token budgets for different memory types during context assembly
 * Used in: retrieval.ts
 */
export const CONTEXT_BUDGET = {
  core: 400,
  longTerm: 1200,
  shortTerm: 400,
} as const

/**
 * Approximate characters per token for budget estimation
 * Used in: retrieval.ts
 */
export const CHARS_PER_TOKEN = 4
