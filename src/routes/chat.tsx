import {
  optimisticallySendMessage,
  useSmoothText,
  useUIMessages,
} from '@convex-dev/agent/react'
import {
  BrainIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretUpIcon,
  ChartBarIcon,
  LightningIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  SparkleIcon,
  SpinnerIcon,
  TrashIcon,
  UserIcon
} from '@phosphor-icons/react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import * as React from 'react'
import { Streamdown } from 'streamdown'
import type { UIMessage } from '@convex-dev/agent/react'

import type { Id } from '@/lib/convex'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/lib/convex'

// Types for thread and core memory
type Thread = {
  _id: string
  title?: string
  status: 'active' | 'archived'
}

type CoreMemory = {
  _id: string
  content: string
  category: string
}

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

function ChatPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = React.useState<Id<'users'> | null>(null)
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    null,
  )
  const [message, setMessage] = React.useState('')
  const [threadToDelete, setThreadToDelete] = React.useState<Thread | null>(
    null,
  )

  // Load userId from localStorage on mount
  React.useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      setUserId(storedUserId as Id<'users'>)
    } else {
      navigate({ to: '/' })
    }
  }, [navigate])

  // Queries
  const threads = useQuery(api.threads.list, userId ? { userId } : 'skip') as
    | Array<Thread>
    | undefined
  const memoryStats = useQuery(
    api.chat.getMemoryStats,
    userId ? { userId } : 'skip',
  ) as { core?: number; total?: number } | undefined
  const coreMemories = useQuery(
    api.core.listActive,
    userId ? { userId } : 'skip',
  ) as Array<CoreMemory> | undefined
  const sensoryMemories = useQuery(
    api.sensory.listRecent,
    userId ? { userId } : 'skip',
  ) as Array<{ _id: string; status: string }> | undefined
  const shortTermMemories = useQuery(
    api.shortTerm.listActive,
    userId ? { userId } : 'skip',
  ) as Array<{ _id: string }> | undefined

  // Mutations
  const archiveThread = useMutation(api.threads.archive)

  // Actions
  const createConversation = useAction(api.chat.createConversation)

  const handleNewThread = async () => {
    if (!userId) return
    try {
      const result = await createConversation({
        userId,
        title: `Conversation ${(threads?.length ?? 0) + 1}`,
      })
      setSelectedThreadId(result.threadId)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const handleDeleteThread = async () => {
    if (!threadToDelete || !userId) return
    try {
      await archiveThread({
        threadId: threadToDelete._id,
        userId,
      })
      // Clear selection if we deleted the selected thread
      if (selectedThreadId === threadToDelete._id) {
        setSelectedThreadId(null)
      }
      setThreadToDelete(null)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('userId')
    navigate({ to: '/' })
  }

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <SpinnerIcon className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r bg-muted/30">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <BrainIcon className="size-5 text-primary" weight="duotone" />
            <span className="text-sm font-semibold">Human-like Memory</span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={handleNewThread}>
            <PlusIcon className="size-4" />
          </Button>
        </div>

        {/* Threads List */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {threads === undefined ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No conversations yet.
                <br />
                Start a new one!
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread._id}
                  className={`group flex items-center gap-1 rounded-md transition-colors ${
                    selectedThreadId === thread._id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(thread._id)}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs"
                  >
                    {thread.title || 'Untitled'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setThreadToDelete(thread)
                    }}
                    className="mr-1 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete conversation"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Memory Pipeline */}
        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Memory Pipeline</span>
            <Link to="/memory" className="text-primary hover:underline">
              View All
            </Link>
          </div>

          {/* Visual Pipeline */}
          <div className="space-y-2 text-xs">
            {/* Sensory Layer */}
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded bg-blue-500/10 text-blue-600">
                <LightningIcon className="size-3" weight="fill" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sensory</span>
                  <span className="font-medium">
                    {sensoryMemories?.length ?? 0}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.min((sensoryMemories?.length ?? 0) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Short-term Layer */}
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded bg-amber-500/10 text-amber-600">
                <BrainIcon className="size-3" weight="duotone" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Short-term</span>
                  <span className="font-medium">
                    {shortTermMemories?.length ?? 0}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{
                      width: `${Math.min((shortTermMemories?.length ?? 0) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Long-term Layer */}
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded bg-green-500/10 text-green-600">
                <ChartBarIcon className="size-3" weight="fill" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Long-term</span>
                  <span className="font-medium">{memoryStats?.total ?? 0}</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: `${Math.min((memoryStats?.total ?? 0) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Core Layer */}
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary">
                <SparkleIcon className="size-3" weight="fill" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Core</span>
                  <span className="font-medium">{memoryStats?.core ?? 0}</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((memoryStats?.core ?? 0) * 20, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <Link
            to="/memory"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <ChartBarIcon className="size-4" />
            Memory Dashboard
          </Link>
        </div>

        {/* User Actions */}
        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="h-[44px] w-full justify-start gap-2 px-3"
            onClick={handleLogout}
          >
            <CaretLeftIcon className="size-4" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {selectedThreadId && userId ? (
          <ChatArea
            threadId={selectedThreadId}
            userId={userId}
            message={message}
            setMessage={setMessage}
            coreMemories={coreMemories}
          />
        ) : (
          /* No Thread Selected */
          <div className="flex flex-1 flex-col items-center justify-center">
            <BrainIcon className="mb-4 size-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-medium">
              Welcome to Human-like Memory
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Select a conversation or start a new one
            </p>
            <Button onClick={handleNewThread}>
              <PlusIcon className="size-4" />
              New Conversation
            </Button>

            {/* Core Memories Display */}
            {coreMemories && coreMemories.length > 0 && (
              <Card className="mt-8 w-full max-w-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <SparkleIcon className="size-4 text-primary" weight="fill" />
                    What I Know About You
                  </CardTitle>
                  <CardDescription>
                    Core memories that shape our conversations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-xs">
                    {coreMemories.slice(0, 5).map((memory) => (
                      <li
                        key={memory._id}
                        className="flex items-start gap-2 rounded-md bg-muted/50 p-2"
                      >
                        <span
                          className="mt-0.5 inline-block size-1.5 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                        <span>{memory.content}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={threadToDelete !== null}
        onOpenChange={(open) => !open && setThreadToDelete(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <TrashIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive &ldquo;{threadToDelete?.title || 'Untitled'}
              &rdquo; and hide it from your conversation list. Your memories
              from this conversation will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteThread}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Separate component for chat area to use hooks properly
function ChatArea({
  threadId,
  userId,
  message,
  setMessage,
  coreMemories,
}: {
  threadId: string
  userId: Id<'users'>
  message: string
  setMessage: (message: string) => void
  coreMemories: Array<CoreMemory> | undefined
}) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [showCoreMemories, setShowCoreMemories] = React.useState(true)

  // Use the streaming messages hook
  const { results: messages, status } = useUIMessages(
    api.chat.listMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  )

  // Send message mutation with optimistic update
  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listMessages),
  )

  // Scroll to bottom when messages change - using useLayoutEffect for sync scroll
  const prevMessagesRef = React.useRef(messages)
  if (messages !== prevMessagesRef.current) {
    prevMessagesRef.current = messages
    // Schedule scroll after render
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  // Check if any message is currently streaming
  const isStreaming = messages.some((m) => m.status === 'streaming')

  const handleSendMessage = async () => {
    if (!message.trim() || isStreaming) return

    const currentMessage = message
    setMessage('')

    try {
      await sendMessage({
        threadId,
        userId,
        prompt: currentMessage,
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessage(currentMessage) // Restore message on error
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Core Memory Context Banner */}
      {coreMemories && coreMemories.length > 0 && (
        <div className="border-b bg-muted/30">
          <button
            type="button"
            onClick={() => setShowCoreMemories(!showCoreMemories)}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-muted/50"
          >
            <SparkleIcon className="size-3 text-primary" weight="fill" />
            <span className="font-medium">
              Active Context: {coreMemories.length} core memories shaping this
              conversation
            </span>
            {showCoreMemories ? (
              <CaretUpIcon className="size-3 text-muted-foreground" />
            ) : (
              <CaretDownIcon className="size-3 text-muted-foreground" />
            )}
          </button>
          {showCoreMemories && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {coreMemories.map((memory) => (
                <div
                  key={memory._id}
                  className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
                >
                  <span
                    className="size-1.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <span className="max-w-[200px] truncate">
                    {memory.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {status === 'LoadingFirstPage' ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="ml-auto h-16 w-3/4" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <SparkleIcon className="mb-4 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Start the conversation by sending a message.
              </p>
            </div>
          ) : (
            messages
              .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
              .map((msg) => <Message key={msg.key} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="mx-auto flex max-w-2xl items-stretch gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="min-h-[44px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isStreaming}
            size="icon"
            className="h-auto w-auto min-w-[44px]"
          >
            {isStreaming ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <PaperPlaneTiltIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Message component with smooth text streaming
function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  const [visibleText] = useSmoothText(message.text, {
    // Start streaming immediately for messages that are actively streaming
    startStreaming: message.status === 'streaming',
  })

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {isUser ? (
          <UserIcon className="size-4" weight="bold" />
        ) : (
          <BrainIcon className="size-4" weight="duotone" />
        )}
      </div>

      {/* Message content */}
      <div
        className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted'
          } ${message.status === 'streaming' ? 'animate-pulse' : ''}`}
        >
          {visibleText ? (
            <Streamdown
              mode="streaming"
              isAnimating={message.status === 'streaming'}
              controls={message.status !== 'streaming'}
              className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            >
              {visibleText}
            </Streamdown>
          ) : (
            message.status === 'streaming' && '...'
          )}
          {message.status === 'failed' && (
            <span className="ml-2 text-xs text-red-500">(failed)</span>
          )}
        </div>

        {/* Memory indicator for assistant messages */}
        {!isUser && message.status === 'success' && (
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <SparkleIcon className="size-2.5" weight="fill" />
              <span>Memory-informed response</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              This response was shaped by core memories and conversation context
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
