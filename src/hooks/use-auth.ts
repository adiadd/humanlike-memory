import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'

import type { Id } from '@/lib/convex'

/**
 * Hook that loads userId from localStorage and redirects to home if not found.
 * Returns the userId state and setter for components that need auth.
 */
export function useRequireAuth() {
  const navigate = useNavigate()
  const [userId, setUserId] = React.useState<Id<'users'> | null>(null)

  React.useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    // Validate that the stored value looks like a valid Convex ID before casting
    if (storedUserId && /^[a-z0-9]{32}$/.test(storedUserId)) {
      setUserId(storedUserId as Id<'users'>)
    } else {
      // Clear invalid stored value if present
      if (storedUserId) localStorage.removeItem('userId')
      navigate({ to: '/' })
    }
  }, [navigate])

  return { userId, setUserId, navigate }
}
