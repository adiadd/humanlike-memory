import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  BrainIcon,
  CaretLeftIcon,
  ClockIcon,
  DatabaseIcon,
  EyeIcon,
  LightningIcon,
  SparkleIcon,
} from '@phosphor-icons/react'

import type { Id } from '@/lib/convex'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/convex'

export const Route = createFileRoute('/memory')({
  component: MemoryDashboard,
})

// Types for memories (inferred from Convex schema)
type SensoryMemory = {
  _id: string
  content: string
  attentionScore: number
  status: 'pending' | 'processing' | 'promoted' | 'discarded'
  createdAt: number
}

type ShortTermMemory = {
  _id: string
  content: string
  summary?: string
  importance: number
  expiresAt: number
  entities: Array<{ name: string; type: string; salience: number }>
  createdAt: number
}

type LongTermMemory = {
  _id: string
  content: string
  summary: string
  memoryType: 'episodic' | 'semantic'
  currentImportance: number
  stability: number
  accessCount: number
  createdAt: number
}

type CoreMemory = {
  _id: string
  content: string
  category: string
  confidence: number
  evidenceCount: number
  createdAt: number
}

function MemoryDashboard() {
  const navigate = useNavigate()
  const [userId, setUserId] = React.useState<Id<'users'> | null>(null)

  // Load userId from localStorage on mount
  React.useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      setUserId(storedUserId as Id<'users'>)
    } else {
      navigate({ to: '/' })
    }
  }, [navigate])

  // Queries for each memory layer
  const memoryStats = useQuery(
    api.chat.getMemoryStats,
    userId ? { userId } : 'skip',
  ) as
    | { core?: number; total?: number; semantic?: number; episodic?: number }
    | undefined

  const sensoryMemories = useQuery(
    api.sensory.listRecent,
    userId ? { userId } : 'skip',
  ) as Array<SensoryMemory> | undefined

  const shortTermMemories = useQuery(
    api.shortTerm.listActive,
    userId ? { userId } : 'skip',
  ) as Array<ShortTermMemory> | undefined

  const longTermMemories = useQuery(
    api.longTerm.listActive,
    userId ? { userId } : 'skip',
  ) as Array<LongTermMemory> | undefined

  const coreMemories = useQuery(
    api.core.listActive,
    userId ? { userId } : 'skip',
  ) as Array<CoreMemory> | undefined

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/chat' })}
            >
              <CaretLeftIcon className="size-4" />
              Back to Chat
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <BrainIcon className="size-5 text-primary" weight="duotone" />
              <span className="font-semibold">Memory Dashboard</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Stats Overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<EyeIcon weight="duotone" />}
            title="Sensory Buffer"
            value={sensoryMemories?.length ?? 0}
            description="Recent inputs"
            color="blue"
          />
          <StatCard
            icon={<ClockIcon weight="duotone" />}
            title="Short-Term"
            value={shortTermMemories?.length ?? 0}
            description="Active context"
            color="amber"
          />
          <StatCard
            icon={<DatabaseIcon weight="duotone" />}
            title="Long-Term"
            value={memoryStats?.total ?? 0}
            description="Consolidated"
            color="green"
          />
          <StatCard
            icon={<SparkleIcon weight="duotone" />}
            title="Core Memory"
            value={memoryStats?.core ?? 0}
            description="Identity facts"
            color="purple"
          />
        </div>

        {/* Memory Tabs */}
        <Tabs defaultValue="sensory" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sensory" className="text-xs">
              <EyeIcon className="mr-1.5 size-3" />
              Sensory
            </TabsTrigger>
            <TabsTrigger value="short-term" className="text-xs">
              <ClockIcon className="mr-1.5 size-3" />
              Short-Term
            </TabsTrigger>
            <TabsTrigger value="long-term" className="text-xs">
              <DatabaseIcon className="mr-1.5 size-3" />
              Long-Term
            </TabsTrigger>
            <TabsTrigger value="core" className="text-xs">
              <SparkleIcon className="mr-1.5 size-3" />
              Core
            </TabsTrigger>
          </TabsList>

          {/* Sensory Memory Tab */}
          <TabsContent value="sensory">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <EyeIcon className="size-4 text-blue-500" weight="duotone" />
                  Sensory Memory
                </CardTitle>
                <CardDescription>
                  Raw input buffer with attention filtering. Low-attention
                  inputs are discarded.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {sensoryMemories === undefined ? (
                    <MemoryListSkeleton />
                  ) : sensoryMemories.length === 0 ? (
                    <EmptyState
                      message="No sensory memories yet"
                      icon={<EyeIcon className="mb-4 size-12 text-blue-500/30" />}
                      hint="Send messages in the chat to populate the sensory buffer. Each message is scored for attention - meaningful content passes through while noise is filtered out."
                    />
                  ) : (
                    <div className="space-y-3">
                      {sensoryMemories.map((memory) => (
                        <div
                          key={memory._id}
                          className="rounded-lg border bg-card p-3 text-sm"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="line-clamp-2 flex-1">
                              {memory.content}
                            </p>
                            <Badge
                              variant={
                                memory.status === 'promoted'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="shrink-0"
                            >
                              {memory.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <LightningIcon className="size-3" />
                              <span>
                                Attention:{' '}
                                {(memory.attentionScore * 100).toFixed(0)}%
                              </span>
                            </div>
                            <span>{formatTimestamp(memory.createdAt)}</span>
                          </div>
                          <Progress
                            value={memory.attentionScore * 100}
                            className="mt-2 h-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Short-Term Memory Tab */}
          <TabsContent value="short-term">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClockIcon className="size-4 text-amber-500" weight="duotone" />
                  Short-Term Memory
                </CardTitle>
                <CardDescription>
                  Active working memory with extracted entities and topic
                  clustering.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {shortTermMemories === undefined ? (
                    <MemoryListSkeleton />
                  ) : shortTermMemories.length === 0 ? (
                    <EmptyState
                      message="No short-term memories"
                      icon={
                        <ClockIcon className="mb-4 size-12 text-amber-500/30" />
                      }
                      hint="Messages that pass the attention filter (typically >30% attention score) are promoted here. Short-term memory groups related messages by topic and extracts entities."
                    />
                  ) : (
                    <div className="space-y-3">
                      {shortTermMemories.map((memory) => (
                        <div
                          key={memory._id}
                          className="rounded-lg border bg-card p-3 text-sm"
                        >
                          <p className="mb-2 line-clamp-2">
                            {memory.summary || memory.content}
                          </p>
                          {memory.entities.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1">
                              {memory.entities.slice(0, 5).map((entity) => (
                                <Badge
                                  key={`${entity.type}-${entity.name}`}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {entity.type}: {entity.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span>
                                Importance:{' '}
                                {(memory.importance * 100).toFixed(0)}%
                              </span>
                              <span>
                                Expires: {formatTimestamp(memory.expiresAt)}
                              </span>
                            </div>
                          </div>
                          <Progress
                            value={memory.importance * 100}
                            className="mt-2 h-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Long-Term Memory Tab */}
          <TabsContent value="long-term">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DatabaseIcon
                    className="size-4 text-green-500"
                    weight="duotone"
                  />
                  Long-Term Memory
                </CardTitle>
                <CardDescription>
                  Consolidated knowledge with semantic deduplication and decay
                  tracking.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {longTermMemories === undefined ? (
                    <MemoryListSkeleton />
                  ) : longTermMemories.length === 0 ? (
                    <EmptyState
                      message="No long-term memories yet"
                      icon={
                        <DatabaseIcon className="mb-4 size-12 text-green-500/30" />
                      }
                      hint="Short-term memories that persist across conversations and show recurring patterns are consolidated here. Long-term memories are categorized as episodic (events) or semantic (facts)."
                    />
                  ) : (
                    <div className="space-y-3">
                      {longTermMemories.map((memory) => (
                        <div
                          key={memory._id}
                          className="rounded-lg border bg-card p-3 text-sm"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="line-clamp-2 flex-1">
                              {memory.summary}
                            </p>
                            <Badge
                              variant={
                                memory.memoryType === 'semantic'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="shrink-0"
                            >
                              {memory.memoryType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Importance:{' '}
                              {(memory.currentImportance * 100).toFixed(0)}%
                            </span>
                            <span>Stability: {memory.stability}</span>
                            <span>Accessed: {memory.accessCount}x</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <div className="mb-1 text-xs text-muted-foreground">
                                Importance
                              </div>
                              <Progress
                                value={memory.currentImportance * 100}
                                className="h-1"
                              />
                            </div>
                            <div>
                              <div className="mb-1 text-xs text-muted-foreground">
                                Stability
                              </div>
                              <Progress
                                value={Math.min(memory.stability / 10, 100)}
                                className="h-1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Core Memory Tab */}
          <TabsContent value="core">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SparkleIcon
                    className="size-4 text-purple-500"
                    weight="duotone"
                  />
                  Core Memory
                </CardTitle>
                <CardDescription>
                  Stable identity facts that are always included in context.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {coreMemories === undefined ? (
                    <MemoryListSkeleton />
                  ) : coreMemories.length === 0 ? (
                    <EmptyState
                      message="No core memories yet"
                      icon={
                        <SparkleIcon className="mb-4 size-12 text-purple-500/30" />
                      }
                      hint="The reflection engine analyzes patterns across your conversations and promotes stable identity facts here. Core memories include your name, preferences, relationships, and beliefs."
                    />
                  ) : (
                    <div className="space-y-3">
                      {coreMemories.map((memory) => (
                        <div
                          key={memory._id}
                          className="rounded-lg border bg-card p-3 text-sm"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="flex-1">{memory.content}</p>
                            <Badge
                              variant="outline"
                              className="shrink-0 capitalize"
                            >
                              {memory.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Confidence: {(memory.confidence * 100).toFixed(0)}
                              %
                            </span>
                            <span>
                              Evidence: {memory.evidenceCount} sources
                            </span>
                            <span>{formatTimestamp(memory.createdAt)}</span>
                          </div>
                          <Progress
                            value={memory.confidence * 100}
                            className="mt-2 h-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Architecture Info */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Memory Flow</CardTitle>
              <CardDescription>
                How information moves through the memory system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 text-xs sm:flex-row sm:justify-center sm:gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-blue-700 dark:text-blue-300">
                  <EyeIcon className="size-4" />
                  <span>Sensory</span>
                </div>
                <span className="text-muted-foreground">
                  → attention filter →
                </span>
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
                  <ClockIcon className="size-4" />
                  <span>Short-Term</span>
                </div>
                <span className="text-muted-foreground">→ consolidation →</span>
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-green-700 dark:text-green-300">
                  <DatabaseIcon className="size-4" />
                  <span>Long-Term</span>
                </div>
                <span className="text-muted-foreground">→ reflection →</span>
                <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-2 text-purple-700 dark:text-purple-300">
                  <SparkleIcon className="size-4" />
                  <span>Core</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

// Helper Components

function StatCard({
  icon,
  title,
  value,
  description,
  color,
}: {
  icon: React.ReactNode
  title: string
  value: number
  description: string
  color: 'blue' | 'amber' | 'green' | 'purple'
}) {
  const colorClasses = {
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`${colorClasses[color]} text-2xl`}>{icon}</div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{title}</div>
            <div className="text-xs text-muted-foreground/70">
              {description}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
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
  icon?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center text-center px-4">
      {icon || <BrainIcon className="mb-4 size-12 text-muted-foreground/30" />}
      <p className="text-sm text-muted-foreground mb-2">{message}</p>
      {hint && (
        <p className="text-xs text-muted-foreground/70 max-w-sm">{hint}</p>
      )}
    </div>
  )
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 0) {
    // Future timestamp (for expiry)
    const futureMinutes = Math.ceil(Math.abs(diff) / 60000)
    if (futureMinutes < 60) return `in ${futureMinutes}m`
    const futureHours = Math.ceil(futureMinutes / 60)
    return `in ${futureHours}h`
  }

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}
