import actionCache from '@convex-dev/action-cache/convex.config'
import agent from '@convex-dev/agent/convex.config'
import aggregate from '@convex-dev/aggregate/convex.config'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import workflow from '@convex-dev/workflow/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(agent)
app.use(workflow)
app.use(actionCache)
app.use(rateLimiter)
app.use(aggregate, { name: 'memoryStats' })

export default app
