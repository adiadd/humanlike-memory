// convex/crons.ts
import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

// Trigger consolidation workflow (every 15 min)
// The workflow handles: cleanup, decay, and promotion
crons.interval(
  'memory-consolidation',
  { minutes: 15 },
  internal.consolidation.triggerConsolidation,
)

// Trigger daily reflection workflow (3 AM UTC)
// Detects patterns and promotes to core memory
crons.daily(
  'daily-reflection',
  { hourUTC: 3, minuteUTC: 0 },
  internal.reflection.triggerDailyReflection,
)

// Trigger weekly pruning workflow (Sunday 4 AM UTC)
crons.weekly(
  'weekly-prune',
  { dayOfWeek: 'sunday', hourUTC: 4, minuteUTC: 0 },
  internal.consolidation.triggerPruning,
)

export default crons
