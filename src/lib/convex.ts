import { useAction, useMutation, useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// Re-export api for convenience
export { api }
export type { Id }

// ============================================
// USER HOOKS
// ============================================

export function useGetOrCreateUser() {
  return useMutation(api.users.getOrCreate)
}

export function useUser(userId: Id<'users'> | undefined) {
  return useQuery(api.users.get, userId ? { userId } : 'skip')
}

// ============================================
// CHAT HOOKS
// ============================================

export function useCreateConversation() {
  return useAction(api.chat.createConversation)
}

export function useSendMessage() {
  return useMutation(api.chat.sendMessage)
}

export function useMessages(threadId: string | undefined) {
  return useQuery(api.chat.getMessages, threadId ? { threadId } : 'skip')
}

export function useMemoryStats(userId: Id<'users'> | undefined) {
  return useQuery(api.chat.getMemoryStats, userId ? { userId } : 'skip')
}

// ============================================
// THREAD HOOKS
// ============================================

export function useThreads(userId: Id<'users'> | undefined) {
  return useQuery(api.threads.list, userId ? { userId } : 'skip')
}

// ============================================
// CORE MEMORY HOOKS
// ============================================

export function useCoreMemories(userId: Id<'users'> | undefined) {
  return useQuery(api.core.listActive, userId ? { userId } : 'skip')
}

export function useRemoveCoreMemory() {
  return useMutation(api.core.remove)
}

// ============================================
// SHORT-TERM MEMORY HOOKS
// ============================================

export function useShortTermMemories(threadId: string | undefined) {
  return useQuery(api.shortTerm.byThread, threadId ? { threadId } : 'skip')
}

// ============================================
// LONG-TERM MEMORY HOOKS
// ============================================

export function useLongTermMemories(userId: Id<'users'> | undefined) {
  return useQuery(api.longTerm.listActive, userId ? { userId } : 'skip')
}

// ============================================
// SENSORY MEMORY HOOKS
// ============================================

export function useSensoryMemories(userId: Id<'users'> | undefined) {
  return useQuery(api.sensory.listRecent, userId ? { userId } : 'skip')
}
