import { useQuery } from 'convex/react'

import type { Id } from '@/lib/convex'
import { api } from '@/lib/convex'

/**
 * Hook that fetches memory statistics and memory lists for a user.
 * Returns stats and individual memory type lists.
 */
export function useMemoryStats(userId: Id<'users'> | null) {
  const memoryStats = useQuery(
    api.chat.getMemoryStats,
    userId ? { userId } : 'skip',
  )
  const sensoryMemories = useQuery(
    api.sensory.listRecent,
    userId ? { userId } : 'skip',
  )
  const shortTermMemories = useQuery(
    api.shortTerm.listActive,
    userId ? { userId } : 'skip',
  )
  const longTermMemories = useQuery(
    api.longTerm.listActive,
    userId ? { userId } : 'skip',
  )
  const coreMemories = useQuery(
    api.core.listActive,
    userId ? { userId } : 'skip',
  )

  return {
    memoryStats,
    sensoryMemories,
    shortTermMemories,
    longTermMemories,
    coreMemories,
  }
}
