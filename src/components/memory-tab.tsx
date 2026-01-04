import type { ReactNode } from 'react'

import { DataStateWrapper } from '@/components/data-state-wrapper'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

export type MemoryTabProps<T> = {
  /** Icon element for the tab header */
  icon: ReactNode
  /** Title of the memory type */
  title: string
  /** Description of the memory type */
  description: string
  /** The data array (undefined = loading, empty = no data) */
  data: Array<T> | undefined
  /** Empty state configuration */
  emptyState: {
    message: string
    icon: ReactNode
    hint: string
  }
  /** Render function for each memory item */
  renderItem: (item: T) => ReactNode
  /** Optional custom key extractor (defaults to using _id) */
  getKey?: (item: T) => string
}

function MemoryListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-3">
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="mb-2 h-3 w-1/2" />
          <Skeleton className="h-1 w-full" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  message,
  icon,
  hint,
}: {
  message: string
  icon: ReactNode
  hint: string
}) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center px-4 text-center">
      {icon}
      <p className="mb-2 text-sm text-muted-foreground">{message}</p>
      <p className="max-w-sm text-xs text-muted-foreground/70">{hint}</p>
    </div>
  )
}

/**
 * A generic component for rendering memory tab content.
 * Handles loading, empty, and data states uniformly.
 */
export function MemoryTab<T extends { _id: string }>({
  icon,
  title,
  description,
  data,
  emptyState,
  renderItem,
  getKey,
}: MemoryTabProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <DataStateWrapper
            data={data}
            loading={<MemoryListSkeleton />}
            empty={
              <EmptyState
                message={emptyState.message}
                icon={emptyState.icon}
                hint={emptyState.hint}
              />
            }
            render={(items) => (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={getKey ? getKey(item) : item._id}>
                    {renderItem(item)}
                  </div>
                ))}
              </div>
            )}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
