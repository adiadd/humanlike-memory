# Test Flows for Human-like Memory MVP

This document outlines example flows to validate the memory system implementation. Each flow tests specific aspects of the five-layer architecture.

---

## Architecture Overview

```
User Message
    ↓
┌─────────────────────────────────────────────────────────────┐
│ SENSORY MEMORY (Immediate)                                  │
│ - Attention scoring (0-100%)                                │
│ - Threshold: >= 30% passes, < 30% discarded                 │
│ - Duplicate detection (same content within 1 hour)         │
└─────────────────────────────────────────────────────────────┘
    ↓ (extractAndEmbed action)
┌─────────────────────────────────────────────────────────────┐
│ SHORT-TERM MEMORY (Seconds)                                 │
│ - Entity extraction (person, place, org, skill, preference) │
│ - Relationship extraction (knows, works_at, prefers, etc.) │
│ - Topic clustering (similarity >= 0.82)                     │
│ - Expires after 4 hours                                     │
└─────────────────────────────────────────────────────────────┘
    ↓ (15-minute consolidation cron)
┌─────────────────────────────────────────────────────────────┐
│ LONG-TERM MEMORY (Minutes to Hours)                         │
│ - Promotion threshold: importance >= 0.6                    │
│ - Deduplication (similarity >= 0.95 reinforces existing)   │
│ - Ebbinghaus decay curve applied                           │
│ - Pruning threshold: < 0.1 importance                      │
└─────────────────────────────────────────────────────────────┘
    ↓ (daily reflection cron @ 3 AM UTC)
┌─────────────────────────────────────────────────────────────┐
│ CORE MEMORY (Persistent)                                    │
│ - Pattern detection via LLM                                 │
│ - Requires 3+ occurrences, 0.7+ confidence                 │
│ - Categories: identity, preference, relationship,          │
│   behavioral, goal, constraint                              │
│ - Always included in agent context                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Pre-Test Setup

### 1. Start the Development Server

```bash
bun run dev
```

### 2. Create a New User

- Navigate to `http://localhost:3000`
- Enter a unique name (e.g., "TestUser1") to create fresh memories
- This ensures no contamination from previous test sessions

### 3. Access the Memory Dashboard

- Click "Memory Dashboard" in the sidebar or navigate to `/memory`
- Use this to verify memory states after each test

---

## Table of Contents

1. [Sensory Memory Flows](#sensory-memory-flows)
2. [Short-Term Memory Flows](#short-term-memory-flows)
3. [Long-Term Memory Flows](#long-term-memory-flows)
4. [Core Memory Flows](#core-memory-flows)
5. [Consolidation & Reflection Flows](#consolidation--reflection-flows)
6. [End-to-End User Journeys](#end-to-end-user-journeys)

---

## Sensory Memory Flows

### Flow 1: Attention Filtering - High-Value Message

**Purpose:** Validate that meaningful messages pass the attention threshold.

**Steps:**

1. Send message: "I'm a software engineer working in Bangalore. I prefer TypeScript over JavaScript."
2. Check Memory Dashboard → Sensory tab

**Expected Results:**

| Field           | Expected Value                                            |
| --------------- | --------------------------------------------------------- |
| Attention Score | ~95% (high due to personal info + entities + length)      |
| Status          | `pending` → `processing` → `promoted`                     |
| Entities        | Bangalore (place), TypeScript (skill), JavaScript (skill) |

**Attention Score Breakdown:**

- Base score: 40%
- Personal info patterns ("I'm", "I prefer"): +25%
- Named entities (Bangalore, TypeScript): +15%
- Length >= 50 chars: +15%
- **Total: ~95%**

---

### Flow 2: Attention Filtering - Low-Value Message

**Purpose:** Validate that noise is filtered out.

**Steps:**

1. Send message: "ok"
2. Check Memory Dashboard → Sensory tab

**Expected Results:**

| Field           | Expected Value              |
| --------------- | --------------------------- |
| Attention Score | 0%                          |
| Status          | `discarded`                 |
| Discard Reason  | "Low attention score: 0.00" |

**Why it's discarded:**

- Base score: 40%
- Length < 20 chars: -30%
- Low-value pattern match ("ok"): -50%
- **Total: 0% (clamped)**

---

### Flow 3: Duplicate Detection

**Purpose:** Validate that duplicate messages within 1 hour are detected.

**Steps:**

1. Send message: "I love React and Next.js"
2. Wait 30 seconds
3. Send exact same message: "I love React and Next.js"
4. Check Memory Dashboard → Sensory tab

**Expected Results:**

- First message: Creates new sensory memory with status `processing`
- Second message: Either not shown separately OR marked as duplicate
- Sensory count should only increase by 1 (not 2)

**Note:** Duplicate detection uses content hashing. Messages with identical content within the same hour from the same user are deduplicated.

---

## Short-Term Memory Flows

### Flow 4: Topic Clustering

**Purpose:** Validate that related messages are grouped under shared topics.

**Steps:**

1. Send: "I'm learning React hooks"
2. Wait 5 seconds
3. Send: "useState and useEffect are my favorites"
4. Wait 5 seconds
5. Send: "React Context API is powerful too"
6. Check Memory Dashboard → Short-Term tab

**Expected Results:**

- All three messages appear in STM (after extraction completes)
- Messages may share the same `topicId` if similarity >= 0.82
- Topic label should include "React" or "skill"

**Note:** If STM count is 0, check:

1. Sensory status - should show `promoted` (not stuck in `processing`)
2. Convex logs for extraction errors

---

### Flow 5: Entity Extraction

**Purpose:** Validate that entities and relationships are extracted.

**Steps:**

1. Send: "My friend Sarah works at Google. She's a data scientist."
2. Check Memory Dashboard → Short-Term tab (click on the entry to see details)

**Expected Entities:**

| Name           | Type   | Salience |
| -------------- | ------ | -------- |
| Sarah          | person | ~0.8     |
| Google         | org    | ~0.6     |
| data scientist | skill  | ~0.5     |

**Expected Relationships:**

| Subject | Predicate | Object | Confidence |
| ------- | --------- | ------ | ---------- |
| user    | knows     | Sarah  | ~0.9       |
| Sarah   | works_at  | Google | ~0.85      |

---

### Flow 6: STM Expiration

**Purpose:** Validate that short-term memories expire after 4 hours.

**Steps:**

1. Send: "I'm working on a project"
2. Note the entry's `expiresAt` timestamp in the database
3. Wait for consolidation workflow (or manually verify calculation)

**Expected Results:**

- `expiresAt` = `createdAt + 4 hours` (14,400,000 ms)
- After 4 hours + consolidation run: STM entry removed
- Consolidation logs show cleanup

**Testing Tip:** Use Convex dashboard to manually set `expiresAt` to a past timestamp, then trigger consolidation.

---

## Long-Term Memory Flows

### Flow 7: Promotion from STM to LTM

**Purpose:** Validate that high-importance STM memories are promoted.

**Steps:**

1. Send multiple high-importance messages:
   - "I'm a vegetarian"
   - "I prefer dark mode in all apps"
   - "I work remotely from home"
2. Wait for consolidation workflow (runs every 15 min)
3. Check Memory Dashboard → Long-Term tab

**Expected Results:**

- STM entries with `importance >= 0.6` promoted to LTM
- LTM entries have `memoryType: 'semantic'`
- Long-term memory count increases

**Note:** This requires waiting for the 15-minute consolidation cron OR manually triggering it via Convex dashboard.

---

### Flow 8: Deduplication on Consolidation

**Purpose:** Validate that similar memories are deduplicated.

**Steps:**

1. Send: "I love Python programming"
2. Wait for STM → LTM promotion (15 min)
3. Send: "Python is my favorite language"
4. Wait for second promotion
5. Check Memory Dashboard → Long-Term tab

**Expected Results:**

- First message: Creates new LTM entry
- Second message: Reinforces existing LTM (similarity > 0.95)
- `reinforcementCount` increases
- Only ONE LTM entry exists for Python preference

---

### Flow 9: Memory Decay

**Purpose:** Validate Ebbinghaus decay curve application.

**Formula:** `newImportance = baseImportance * exp(-decayRate * hoursSinceAccess)`

Where `decayRate = 0.01 / stability`

**Testing:** Requires manual database manipulation to set `lastAccessed` to past dates, then triggering decay workflow.

---

### Flow 10: Memory Pruning

**Purpose:** Validate that low-importance memories are pruned weekly.

**Pruning Threshold:** `currentImportance < 0.1`

**Expected Results:**

- Low-importance memories marked `isActive: false`
- Soft delete preserves data
- Pruned memories excluded from retrieval

---

## Core Memory Flows

### Flow 11: Pattern Detection & Core Promotion

**Purpose:** Validate reflection workflow detects patterns and promotes to core.

**Requirements:**

- 10+ LTM entries with `importance >= 0.7`
- Some patterns repeat 3+ times
- Daily reflection workflow runs (3 AM UTC)

**Expected Results:**

- LLM analyzes patterns across LTM
- Patterns with `confidence >= 0.7` promoted to core
- Categories assigned: identity, preference, relationship, behavioral, goal, constraint

---

### Flow 12: Core Memory Reinforcement

**Purpose:** Validate existing core memories are reinforced, not duplicated.

**Expected Results:**

- Same pattern detected again → existing core memory reinforced
- `confidence` increases: `min(1, existing + 0.05)`
- `evidenceCount` increases
- No duplicate core memories created

---

### Flow 13: Core Memory in Context

**Purpose:** Validate core memories are always included in agent context.

**Steps:**

1. Ensure core memories exist (from previous tests or manually created)
2. Send message: "What do you know about me?"
3. Check AI response

**Expected Results:**

- Agent response lists all core memories
- Response shows "Memory-informed response" indicator
- All active core memories visible in "Active Context" panel

**Example Response:**

```
Here's everything I know about you:
1. Name: [name]
2. Profession: [profession]
3. Location: [location]
4. Preferences: [preferences]
...
```

---

## Consolidation & Reflection Flows

### Flow 14: Consolidation Workflow

**Schedule:** Every 15 minutes

**Steps Performed:**

1. Clean up expired STM entries
2. Apply decay to LTM entries
3. Promote high-importance STM to LTM
4. Log consolidation stats

**Validation:**

- Check Convex logs for `consolidation` function executions
- Verify consolidationLogs table has entries

---

### Flow 15: Reflection Workflow

**Schedule:** Daily at 3 AM UTC

**Steps Performed:**

1. Get active users (last 7 days)
2. Fetch high-importance LTM for each user
3. Run LLM pattern detection
4. Promote confident patterns to core
5. Log reflection insights

**Validation:**

- Check Convex logs for `reflection` function executions
- Verify reflectionLogs table has entries

---

## End-to-End User Journeys

### Journey 1: New User Onboarding (Immediate)

**Test Duration:** ~5 minutes

**Steps:**

1. Create new user with unique name
2. Send: "Hi, I'm Alice. I'm a data scientist from San Francisco."
3. Send: "I work with Python and SQL daily"
4. Send: "My favorite framework is TensorFlow"
5. Check Memory Dashboard

**Expected State After Test:**

| Layer      | Count | Notes                                      |
| ---------- | ----- | ------------------------------------------ |
| Sensory    | 3     | All with status `processing` or `promoted` |
| Short-Term | 0-3   | Depends on extraction completion           |
| Long-Term  | 0     | Requires consolidation cron                |
| Core       | 0     | Requires reflection cron                   |

---

### Journey 2: Memory Recall Test

**Purpose:** Verify agent uses memories in responses.

**Steps:**

1. Complete Journey 1
2. Wait for sensory → STM promotion
3. Ask: "What's my name?"
4. Ask: "What do I do for work?"
5. Ask: "What programming languages do I use?"

**Expected Results:**

- Agent correctly recalls name, profession, skills
- Responses marked as "Memory-informed response"
- Core memories shown in "Active Context" panel

---

### Journey 3: Full Pipeline Test (Long Duration)

**Test Duration:** 15+ minutes (requires consolidation cron)

**Steps:**

1. Complete Journey 1
2. Wait 15 minutes for consolidation
3. Check LTM count increases
4. Send more messages reinforcing same topics
5. Check reinforcement in LTM

**Expected State After 15 Minutes:**

| Layer      | Count | Notes                             |
| ---------- | ----- | --------------------------------- |
| Sensory    | 3+    | Mix of `promoted` and `discarded` |
| Short-Term | 3+    | Active memories                   |
| Long-Term  | 1+    | Consolidated from STM             |
| Core       | 0     | Requires daily reflection         |

---

## Troubleshooting Guide

### Issue: Sensory memories stuck in "processing"

**Cause:** Extraction action failed (LLM error, rate limiting, network issue)

**Solution:**

1. Check Convex logs for `extraction` errors
2. Verify ANTHROPIC_API_KEY is set
3. Check rate limiter state
4. New messages will retry with exponential backoff (1s, 2s, 4s)
5. After 3 retries, status changes to "discarded" with error reason

---

### Issue: STM count always 0

**Cause:** Extraction not completing successfully

**Diagnosis:**

1. Check sensory status - should be `promoted` not `processing`
2. Check Convex logs for errors
3. Verify embedding service is working

---

### Issue: LTM count always 0

**Cause:** Consolidation cron hasn't run OR no STM with importance >= 0.6

**Diagnosis:**

1. Wait 15 minutes for cron
2. Check STM importance scores
3. Manually trigger consolidation via Convex dashboard

---

### Issue: Core memories not being created through pipeline

**Expected Behavior:** Core memories are created via:

- Daily reflection workflow (3 AM UTC) - analyzes LTM patterns
- Pattern requires 3+ occurrences with 0.7+ confidence

**Note:** Direct `saveToCore` tool has been removed. All memories must flow through the pipeline.

---

## Quick Validation Checklist

### Sensory Memory

- [ ] High-attention messages pass threshold (>= 30%)
- [ ] Low-attention messages are discarded (< 30%)
- [ ] Duplicates detected within 1 hour
- [ ] Attention scoring includes personal info (+25%), entities (+15%), length (+15%)
- [ ] Failed extractions retry with backoff and eventually mark as discarded

### Short-Term Memory

- [ ] Messages promoted from sensory after extraction
- [ ] Entities and relationships extracted
- [ ] Topic clustering groups similar messages (>= 0.82 similarity)
- [ ] STM expires after 4 hours

### Long-Term Memory

- [ ] High-importance STM promoted (>= 0.6) every 15 min
- [ ] Deduplication prevents duplicates (>= 0.95 similarity)
- [ ] Memory decay follows Ebbinghaus curve
- [ ] Low-importance memories pruned (< 0.1)

### Core Memory

- [ ] Patterns detected via LLM reflection
- [ ] Core promotion requires 3+ occurrences, 0.7+ confidence
- [ ] Core memories always in context
- [ ] Existing core memories reinforced (not duplicated)

### Pipeline Health

- [ ] Consolidation workflow runs every 15 min
- [ ] Reflection workflow runs daily at 3 AM UTC
- [ ] Pruning workflow runs weekly (Sunday 4 AM UTC)
- [ ] Extraction errors handled with retry and failure logging

---

## Expected Metrics After Full Testing

After running all flows with proper cron execution:

| Metric             | Expected Range            |
| ------------------ | ------------------------- |
| Sensory Memory     | 10-50 entries             |
| Short-Term Memory  | 5-20 active entries       |
| Long-Term Memory   | 5-30 consolidated entries |
| Core Memory        | 3-10 stable facts         |
| Consolidation Logs | Entry every 15 min        |
| Reflection Logs    | Entry daily               |

---

## Testing Tips

1. **Use Fresh Users:** Create a new user for each test session to avoid state contamination

2. **Manual Workflow Triggers:** Use Convex dashboard to trigger workflows manually:
   - `consolidation.triggerConsolidation`
   - `reflection.triggerDailyReflection`

3. **Time Manipulation:** For expiry/decay testing, manually set timestamps in Convex dashboard

4. **Check Convex Logs:** Monitor real-time logs for extraction errors and workflow execution

5. **Rate Limiting:** If testing rapidly, you may hit rate limits. Wait a few seconds between messages.

6. **Attention Score Testing:** Use the formula to predict scores:
   ```
   base (40%) + personal_info (25%) + entities (15%) + length>=50 (15%) - low_value (50%)
   ```
