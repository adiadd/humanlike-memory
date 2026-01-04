import * as React from 'react'
import {
  optimisticallySendMessage,
  useSmoothText,
  useUIMessages,
} from '@convex-dev/agent/react'
import {
  Brain,
  CaretLeft,
  ChartBar,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  Spinner,
} from '@phosphor-icons/react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { UIMessage } from '@convex-dev/agent/react'

import type { Id } from '@/lib/convex'
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

  const handleLogout = () => {
    localStorage.removeItem('userId')
    navigate({ to: '/' })
  }

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="size-6 animate-spin" />
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
            <Brain className="size-5 text-primary" weight="duotone" />
            <span className="text-sm font-semibold">Humanlike Memory</span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={handleNewThread}>
            <Plus className="size-4" />
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
                <button
                  type="button"
                  key={thread._id}
                  onClick={() => setSelectedThreadId(thread._id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                    selectedThreadId === thread._id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {thread.title || 'Untitled'}
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Memory Stats */}
        <div className="border-t p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Memory Stats</span>
            <Link to="/memory" className="text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Core</div>
              <div className="font-medium">{memoryStats?.core ?? 0}</div>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Long-term</div>
              <div className="font-medium">{memoryStats?.total ?? 0}</div>
            </div>
          </div>
          <Link
            to="/memory"
            className="mt-3 flex w-full items-center justify-start gap-2 rounded-md border bg-background px-3 py-2 text-xs hover:bg-muted"
          >
            <ChartBar className="size-4" />
            Memory Dashboard
          </Link>
        </div>

        {/* User Actions */}
        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-3 py-2"
            onClick={handleLogout}
          >
            <CaretLeft className="size-4" />
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
          />
        ) : (
          /* No Thread Selected */
          <div className="flex flex-1 flex-col items-center justify-center">
            <Brain className="mb-4 size-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-medium">
              Welcome to Humanlike Memory
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Select a conversation or start a new one
            </p>
            <Button onClick={handleNewThread}>
              <Plus className="size-4" />
              New Conversation
            </Button>

            {/* Core Memories Display */}
            {coreMemories && coreMemories.length > 0 && (
              <Card className="mt-8 w-full max-w-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkle className="size-4 text-primary" weight="fill" />
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
    </div>
  )
}

// Separate component for chat area to use hooks properly
function ChatArea({
  threadId,
  userId,
  message,
  setMessage,
}: {
  threadId: string
  userId: Id<'users'>
  message: string
  setMessage: (message: string) => void
}) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

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
              <Sparkle className="mb-4 size-8 text-muted-foreground" />
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
              <Spinner className="size-4 animate-spin" />
            ) : (
              <PaperPlaneTilt className="size-4" />
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        } ${message.status === 'streaming' ? 'animate-pulse' : ''}`}
      >
        {visibleText || (message.status === 'streaming' ? '...' : '')}
        {message.status === 'failed' && (
          <span className="ml-2 text-xs text-red-500">(failed)</span>
        )}
      </div>
    </div>
  )
}
