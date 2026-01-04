import type { ReactNode } from 'react'

export type DataStateWrapperProps<T> = {
  /** Data that may be undefined (loading) or an array */
  data: Array<T> | undefined
  /** Content to show while loading */
  loading: ReactNode
  /** Content to show when data is empty */
  empty: ReactNode
  /** Render function for when data is available */
  render: (items: Array<T>) => ReactNode
}

/**
 * A wrapper component that handles the common loading/empty/data pattern.
 * Reduces repetitive ternary structures across the codebase.
 */
export function DataStateWrapper<T>({
  data,
  loading,
  empty,
  render,
}: DataStateWrapperProps<T>) {
  if (data === undefined) {
    return <>{loading}</>
  }

  if (data.length === 0) {
    return <>{empty}</>
  }

  return <>{render(data)}</>
}
