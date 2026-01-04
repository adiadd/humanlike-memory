import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import {
  Brain,
  ChatCircle,
  Database,
  Lightning,
  Sparkle,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/convex'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  const navigate = useNavigate()
  const getOrCreateUser = useMutation(api.users.getOrCreate)
  const [name, setName] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleGetStarted = async () => {
    if (!name.trim()) return

    setIsLoading(true)
    try {
      // Create a simple user with the name as external ID for MVP
      const userId = await getOrCreateUser({
        externalId: name.toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
      })
      // Store userId in localStorage for MVP (no auth)
      localStorage.setItem('userId', userId)
      // Navigate to chat
      navigate({ to: '/chat' })
    } catch (error) {
      console.error('Failed to create user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="size-6 text-primary" weight="duotone" />
            <span className="text-sm font-semibold">Human-Like Memory</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" size="sm">
              <a href="#architecture">Architecture</a>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <Sparkle className="size-3 text-primary" weight="fill" />
            <span className="text-muted-foreground">
              Memory is cognition, not storage
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Human-Like Memory
            <br />
            <span className="text-primary">for AI Agents</span>
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            Move beyond brute-force retrieval. Experience AI that filters,
            consolidates, decays, and reflects on memories - just like the human
            brain.
          </p>

          <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Enter your name to get started"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGetStarted()}
              className="h-10"
            />
            <Button
              onClick={handleGetStarted}
              disabled={!name.trim() || isLoading}
              className="h-10"
            >
              {isLoading ? 'Creating...' : 'Get Started'}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center text-2xl font-semibold">
            Five Memory Layers
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Lightning weight="duotone" />}
              title="Sensory Memory"
              description="Filters noise using attention scoring. Only meaningful signals enter the memory system."
            />
            <FeatureCard
              icon={<ChatCircle weight="duotone" />}
              title="Short-Term Memory"
              description="Active working memory that groups messages by topic and tracks conversation context."
            />
            <FeatureCard
              icon={<Database weight="duotone" />}
              title="Long-Term Memory"
              description="Consolidated knowledge organized by entity, topic, and relationship with deduplication."
            />
            <FeatureCard
              icon={<Brain weight="duotone" />}
              title="Memory Managers"
              description="Background processes that promote, decay, and prune memories during 'sleep cycles'."
            />
            <FeatureCard
              icon={<Sparkle weight="duotone" />}
              title="Core Memory"
              description="Stable identity facts - personality, preferences, and relationships that shape all responses."
            />
            <FeatureCard
              icon={<Lightning weight="duotone" />}
              title="Reflection Engine"
              description="Detects patterns across memories and promotes stable facts to core memory."
            />
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-semibold">Built for Production</h2>
          <p className="mb-8 text-muted-foreground">
            Powered by TanStack Start, Convex, and the AI SDK with durable
            workflows, cached embeddings, and rate limiting built-in.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 text-left">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Frontend
              </div>
              <div className="text-sm">TanStack Start + React 19</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-left">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Backend
              </div>
              <div className="text-sm">Convex + AI SDK</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-left">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Models
              </div>
              <div className="text-sm">Claude + OpenAI Embeddings</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
          <span>Human-Like Memory MVP</span>
          <span>Memory is cognition, not storage.</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <div className="mb-2 text-primary">{icon}</div>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  )
}
