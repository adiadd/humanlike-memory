import { v } from 'convex/values'

/**
 * Memory context returned from retrieval, used for formatting prompts
 * Used in: chat.ts, retrieval.ts
 */
export interface MemoryContext {
  core: Array<{ content: string; category: string }>
  longTerm: Array<{ content: string; type: string; importance: number }>
  shortTerm: Array<{ content: string; importance: number }>
  totalTokens: number
}

/**
 * Category validator for core memories
 * Used in: core.ts, reflection.ts, schema.ts
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
