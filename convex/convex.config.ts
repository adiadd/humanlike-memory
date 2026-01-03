import actionCache from '@convex-dev/action-cache/convex.config'
import agent from '@convex-dev/agent/convex.config'
import aggregate from '@convex-dev/aggregate/convex.config'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import workflow from '@convex-dev/workflow/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()

// Core AI agent functionality
app.use(agent)

// Durable workflow execution for memory consolidation
app.use(workflow)

// Cache expensive LLM/embedding calls
app.use(actionCache)

// Rate limiting for LLM APIs
app.use(rateLimiter)

// Efficient memory statistics (counts, sums)
app.use(aggregate, { name: 'memoryStats' })

export default app
