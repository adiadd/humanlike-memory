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
    if (storedUserId) {
      setUserId(storedUserId as Id<'users'>)
    } else {
      navigate({ to: '/' })
    }
  }, [navigate])

  return { userId, setUserId, navigate }
}
