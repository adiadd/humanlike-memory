# Test Flows for Human-like Memory MVP

This document outlines example flows to validate the memory system implementation. Each flow tests specific aspects of the five-layer architecture inspired by how the human brain manages memory.

---

## Architecture Overview

The architecture follows how the human mind processes experience over time—moving from fleeting impressions to stable knowledge, guided by identity.

```
User Message
    ↓
┌─────────────────────────────────────────────────────────────┐
│ SENSORY MEMORY (Immediate)                                  │
│ "Every thought begins with a signal from our senses"        │
│ - Attention scoring (0-100%)                                │
│ - Threshold: >= 30% passes, < 30% discarded                 │
│ - Duplicate detection (same content within 1 hour)          │
│ - Filters noise before ingestion                            │
└─────────────────────────────────────────────────────────────┘
    ↓ (extractAndEmbed action)
┌─────────────────────────────────────────────────────────────┐
│ SHORT-TERM MEMORY (Seconds to Hours)                        │
│ "Where we reason, compare, and combine thoughts"            │
│ - Entity extraction (person, place, org, skill, preference) │
│ - Relationship extraction (knows, works_at, prefers, etc.)  │
│ - Topic clustering (similarity >= 0.82)                     │
│ - Maintains continuity across short spans                   │
│ - Expires after 4 hours                                     │
└─────────────────────────────────────────────────────────────┘
    ↓ (15-minute consolidation cron)
┌─────────────────────────────────────────────────────────────┐
│ LONG-TERM MEMORY (Hours to Days)                            │
│ "Information that proves meaningful is encoded permanently" │
│ - Promotion threshold: importance >= 0.6                    │
│ - Deduplication (similarity >= 0.95 reinforces existing)    │
│ - Ebbinghaus decay curve applied                            │
│ - Semantic memory: facts, concepts, relationships           │
│ - Pruning threshold: < 0.1 importance                       │
└─────────────────────────────────────────────────────────────┘
    ↓ (daily reflection cron @ 3 AM UTC)
┌─────────────────────────────────────────────────────────────┐
│ CORE MEMORY (Persistent)                                    │
│ "Defines who the user is—the most persistent layer"         │
│ - Pattern detection via LLM reflection                      │
│ - Requires 3+ occurrences, 0.7+ confidence                  │
│ - Categories: identity, preference, relationship,           │
│   behavioral, goal, constraint                              │
│ - Always included in agent context                          │
│ - Evolves slowly as new long-term patterns emerge           │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Concepts from the Architecture

### Why This Matters

Most memory systems are glorified caches—they store tokens, not thoughts. They rely on brute force retrieval: dumping everything into a vector database. This approach scales clutter, not cognition.

This architecture implements **metacognition**—the ability to reflect on memories, deciding what helped, what didn't, and what to learn.

### Key Principles

1. **Selective Forgetting**: Real intelligence depends on what we choose to forget. Without it, retrieval becomes slower and relevance drifts.

2. **Consolidation Over Storage**: The system doesn't just store more—it thinks better through periodic consolidation cycles.

3. **Identity-Anchored Retrieval**: Core memory shapes how all other memories are interpreted and retrieved.

4. **Pipeline, Not Dump**: Information flows through encoding → storage → consolidation → retrieval → forgetting.

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
5. [Memory Manager Flows](#memory-manager-flows)
6. [End-to-End User Journeys](#end-to-end-user-journeys)

---

## Sensory Memory Flows

> "Sensory memory is brief, lasting only for a few seconds, but acts as a filter... deciding what's worth noticing before ingestion."

### Flow 1: Attention Filtering - High-Value Message

**Purpose:** Validate that meaningful messages pass the attention threshold, preventing vector database overload.

**Steps:**

1. Send message: "I'm a software engineer working in New York City. I prefer TypeScript over JavaScript and I'm a huge Cowboys fan, though I used to live in Dallas."
2. Check Memory Dashboard → Sensory tab

**Expected Results:**

| Field           | Expected Value                                                                               |
| --------------- | -------------------------------------------------------------------------------------------- |
| Attention Score | ~95% (high due to personal info + entities + length)                                         |
| Status          | `pending` → `processing` → `promoted`                                                        |
| Entities        | New York City (place), Dallas (place), TypeScript (skill), JavaScript (skill), Cowboys (org) |

**Attention Score Breakdown:**

- Base score: 40%
- Personal info patterns ("I'm", "I prefer"): +25%
- Named entities (New York City, Dallas, TypeScript, Cowboys): +15%
- Length >= 50 chars: +15%
- Temporal references ("always", "never", etc.): +10% (if present)
- **Total: ~95%**

---

### Flow 2: Attention Filtering - Low-Value Message (Noise Filtering)

**Purpose:** Validate that noise is filtered out. This prevents "context bloat" and ensures only meaningful units of cognition enter memory.

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

**Purpose:** Validate that duplicate messages within 1 hour are detected, preventing redundant embeddings competing for relevance.

**Steps:**

1. Send message: "I love React and Next.js for building web apps"
2. Wait 30 seconds
3. Send exact same message: "I love React and Next.js for building web apps"
4. Check Memory Dashboard → Sensory tab

**Expected Results:**

- First message: Creates new sensory memory with status `processing`
- Second message: Returns `{ status: 'duplicate', id: <existing_id> }` - no new record created
- Sensory count should only increase by 1 (not 2)

**Note:** Duplicate detection uses content hashing. Messages with identical content within the same hour from the same user are deduplicated at ingestion time.

---

## Short-Term Memory Flows

> "Once information is filtered, it enters short-term memory. Here we reason, compare, and combine thoughts in real-time."

### Flow 4: Topic Clustering (Continuity Across Interactions)

**Purpose:** Validate that related messages are grouped under shared topics, maintaining continuity across short spans of interaction.

**Steps:**

1. Send: "I'm learning React hooks for my side project"
2. Wait 5 seconds
3. Send: "useState and useEffect are my favorites so far"
4. Wait 5 seconds
5. Send: "React Context API is powerful for state management"
6. Check Memory Dashboard → Short-Term tab

**Expected Results:**

- All three messages appear in STM (after extraction completes)
- Messages may share the same `topicId` if similarity >= 0.82
- Topic label should include "React" or "skill"
- Topic centroid updated incrementally with each new member

**Note:** If STM count is 0, check:

1. Sensory status - should show `promoted` (not stuck in `processing`)
2. Convex logs for extraction errors

---

### Flow 5: Entity and Relationship Extraction

**Purpose:** Validate that entities and relationships are extracted to build a conceptual graph.

**Steps:**

1. Send: "My friend Sidd works at Baton in SF. He's a ML software engineer and we went to high school together and did International Baccalaureate."
2. Check Memory Dashboard → Short-Term tab (click on the entry to see details)

**Expected Entities:**

| Name                        | Type   | Salience |
| --------------------------- | ------ | -------- |
| Sidd                        | person | ~0.8     |
| Baton                       | org    | ~0.7     |
| SF (San Francisco)          | place  | ~0.6     |
| International Baccalaureate | org    | ~0.5     |
| ML software engineer        | skill  | ~0.5     |

**Expected Relationships:**

| Subject | Predicate | Object                      | Confidence |
| ------- | --------- | --------------------------- | ---------- |
| user    | knows     | Sidd                        | ~0.9       |
| Sidd    | works_at  | Baton                       | ~0.85      |
| user    | went_to   | high school                 | ~0.8       |
| Sidd    | went_to   | high school                 | ~0.8       |
| user    | did       | International Baccalaureate | ~0.75      |
| Sidd    | did       | International Baccalaureate | ~0.75      |

---

### Flow 6: STM Expiration (Transient Context)

**Purpose:** Validate that short-term memories expire after 4 hours, freeing cognitive space for new information.

**Steps:**

1. Send: "I'm working on a side project building a mobile app"
2. Note the entry's `expiresAt` timestamp in the database
3. Wait for consolidation workflow (or manually verify calculation)

**Expected Results:**

- `expiresAt` = `createdAt + 4 hours` (14,400,000 ms)
- After 4 hours + consolidation run: STM entry removed
- Consolidation logs show cleanup

**Testing Tip:** Use Convex dashboard to manually set `expiresAt` to a past timestamp, then trigger consolidation.

---

## Long-Term Memory Flows

> "Information that proves meaningful or is repeatedly reinforced is encoded into long-term memory... forming conceptual graphs that grow over time."

### Flow 7: Promotion from STM to LTM (Meaningful Encoding)

**Purpose:** Validate that high-importance STM memories are promoted to permanent storage.

**Steps:**

1. Send multiple high-importance messages:
   - "I love working out and am a chocolate connoisseur"
   - "I prefer dark mode in all my apps and devices"
   - "I work hybrid from my apartment in New York City, New York"
2. Wait for consolidation workflow (runs every 15 min)
3. Check Memory Dashboard → Long-Term tab

**Expected Results:**

- STM entries with `importance >= 0.6` promoted to LTM
- LTM entries have `memoryType: 'semantic'` (facts and concepts)
- Long-term memory count increases
- `consolidatedFrom` array tracks source STM IDs

**Note:** This requires waiting for the 15-minute consolidation cron OR manually triggering it via Convex dashboard.

---

### Flow 8: Deduplication and Reinforcement

**Purpose:** Validate that similar memories are deduplicated through reinforcement, not duplication.

**Steps:**

1. Send: "I love Python programming for building AI models and training neural networks"
2. Wait for STM → LTM promotion (15 min)
3. Send: "Python is my favorite programming language for AI engineering and ML pipelines"
4. Wait for second promotion
5. Check Memory Dashboard → Long-Term tab

**Expected Results:**

- First message: Creates new LTM entry
- Second message: Reinforces existing LTM (similarity > 0.95)
- `reinforcementCount` increases
- `currentImportance` gets +0.05 boost
- `stability` increases by +10
- Only ONE LTM entry exists for Python preference

---

### Flow 9: Memory Decay (Ebbinghaus Forgetting Curve)

**Purpose:** Validate that unreinforced memories decay over time, enabling selective forgetting.

**Formula:** `retention = exp(-hoursSinceAccess / stability)`

Where initial `stability = 100`

**Testing:** Requires manual database manipulation to set `lastAccessed` to past dates, then triggering decay workflow.

**Expected Results:**

- Memories accessed recently maintain high `currentImportance`
- Old, unreinforced memories decay toward pruning threshold
- Higher `stability` (from reinforcement) slows decay rate

---

### Flow 10: Memory Pruning (Selective Forgetting)

**Purpose:** Validate that low-importance memories are pruned, freeing cognitive space.

**Schedule:** Weekly (Sunday 4 AM UTC)

**Pruning Threshold:** `currentImportance < 0.1`

**Expected Results:**

- Low-importance memories marked `isActive: false`
- Soft delete preserves data for potential recovery
- Pruned memories excluded from retrieval
- Retrieval becomes faster with less clutter

---

## Core Memory Flows

> "Core memory defines who the user is... It's what makes memories coherent. An agent should have its own core memory per user—a structured, evolving representation of the user's identity."

### Flow 11: Pattern Detection & Core Promotion

**Purpose:** Validate reflection workflow detects patterns and promotes stable facts to core memory.

**Requirements:**

- 10+ LTM entries with `importance >= 0.7`
- Some patterns repeat 3+ times
- Daily reflection workflow runs (3 AM UTC)

**Expected Results:**

- LLM analyzes patterns across LTM (metacognition)
- Patterns with `confidence >= 0.7` promoted to core
- Categories assigned: identity, preference, relationship, behavioral, goal, constraint

---

### Flow 12: Core Memory Reinforcement (Slow Evolution)

**Purpose:** Validate existing core memories are reinforced, not duplicated—core memory evolves slowly.

**Expected Results:**

- Same pattern detected again → existing core memory reinforced
- `confidence` increases: `min(1, existing + 0.05)`
- `evidenceCount` increases
- No duplicate core memories created

---

### Flow 13: Core Memory in Context (Identity-Anchored Retrieval)

**Purpose:** Validate core memories are always included in agent context, shaping how all other memories are interpreted.

**Steps:**

1. Ensure core memories exist (from previous tests or manually created)
2. Send message: "What do you know about me?"
3. Check AI response

**Expected Results:**

- Agent response references core memory facts
- Response shows "Memory-informed response" indicator
- All active core memories visible in "Active Context" panel
- Core memories shape interpretation of other retrieved memories

**Example Response:**

```
Based on what I know about you:
1. You're a software engineer (identity)
2. You live in New York City (identity)
3. You prefer dark mode (preference)
4. You're a Cowboys fan (preference)
5. You work with Python and TypeScript (behavioral)
...
```

---

## Memory Manager Flows

> "At night, the human brain replays, reorganizes, and compresses the day's experiences. This consolidation decides what to store permanently and what to discard."

### Flow 14: Consolidation Workflow (The Agent's Sleep Cycle)

**Schedule:** Every 15 minutes

**Steps Performed:**

1. **cleanupExpiredSTM**: Deletes STMs past `expiresAt` (batch of 100)
2. **applyDecay**: Applies Ebbinghaus forgetting curve to LTM
3. **promoteToLongTerm**: Promotes high-importance STM to LTM (with dedup check)
4. **logRun**: Records consolidation statistics

**Validation:**

- Check Convex logs for `consolidation` function executions
- Verify consolidationLogs table has entries with stats

---

### Flow 15: Reflection Workflow (Metacognition)

**Schedule:** Daily at 3 AM UTC

**Purpose:** This is where intelligence begins—not in retrieval, but in reflection.

**Steps Performed:**

1. Get active users (last 7 days)
2. Fetch high-importance LTM for each user (importance >= 0.7)
3. **LLM pattern detection**: Analyzes memories for stable patterns
4. Promote confident patterns to core memory
5. Log reflection insights

**Validation:**

- Check Convex logs for `reflection` function executions
- Verify reflectionLogs table has entries
- New core memories appear after reflection runs

---

### Flow 16: Weekly Pruning (Aggressive Forgetting)

**Schedule:** Sunday 4 AM UTC

**Purpose:** Prune unused pathways, preventing the system from becoming a stale mirror of early data.

**Steps Performed:**

1. Find LTM entries with `currentImportance < 0.1`
2. Soft delete by setting `isActive: false`
3. Log pruning statistics

**Validation:**

- Check for pruned memories in LTM table
- Verify they're excluded from retrieval
- Memory stats reflect active-only counts

---

## End-to-End User Journeys

### Journey 1: New User Onboarding (Immediate)

**Test Duration:** ~5 minutes

**Purpose:** Validate the complete sensory → STM pipeline for initial user interaction.

**Steps:**

1. Create new user with unique name
2. Send: "Hi, I'm Aditya. I'm a software engineer from New York City, New York. I work at Amazon. I used to live in Dallas, Texas."
3. Send: "I work with Python and SQL daily for building ML models"
4. Send: "My favorite framework is TensorFlow and I'm a Cowboys fan"
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

**Purpose:** Verify agent uses memories in responses (identity-anchored retrieval).

**Steps:**

1. Complete Journey 1
2. Wait for sensory → STM promotion
3. Ask: "What's my name?"
4. Ask: "What do I do for work?"
5. Ask: "What programming languages do I use?"
6. Ask: "What sports team do I root for?"

**Expected Results:**

- Agent correctly recalls name, profession, skills, location, and preferences
- Responses marked as "Memory-informed response"
- Core memories shown in "Active Context" panel
- Agent demonstrates understanding, not just retrieval

---

### Journey 3: Full Pipeline Test (Long Duration)

**Test Duration:** 15+ minutes (requires consolidation cron)

**Purpose:** Validate the complete memory pipeline from sensory to long-term.

**Steps:**

1. Complete Journey 1
2. Wait 15 minutes for consolidation
3. Check LTM count increases
4. Send more messages reinforcing same topics
5. Check reinforcement in LTM (not duplication)

**Expected State After 15 Minutes:**

| Layer      | Count | Notes                             |
| ---------- | ----- | --------------------------------- |
| Sensory    | 3+    | Mix of `promoted` and `discarded` |
| Short-Term | 3+    | Active memories                   |
| Long-Term  | 1+    | Consolidated from STM             |
| Core       | 0     | Requires daily reflection         |

---

### Journey 4: Pattern Emergence Test (24+ Hours)

**Test Duration:** 24+ hours (requires reflection cron)

**Purpose:** Validate the complete pipeline including core memory promotion through metacognition.

**Steps:**

1. Over multiple sessions, repeatedly mention:
   - Your profession (3+ times)
   - Your location (3+ times)
   - A strong preference (3+ times)
2. Wait for daily reflection (3 AM UTC)
3. Check Core Memory tab

**Expected Results:**

- Reflection workflow detects patterns
- Core memories created for repeated themes
- Categories appropriately assigned
- Future interactions shaped by core memory

---

## Troubleshooting Guide

### Issue: Sensory memories stuck in "processing"

**Cause:** Extraction action failed (LLM error, rate limiting, network issue)

**Solution:**

1. Check Convex logs for `extraction` errors
2. Verify ANTHROPIC_API_KEY is set
3. Check rate limiter state (30 extractions/min, capacity 10)
4. New messages will retry with exponential backoff (1s, 2s, 4s)
5. After 3 retries, status changes to "discarded" with error reason

---

### Issue: STM count always 0

**Cause:** Extraction not completing successfully

**Diagnosis:**

1. Check sensory status - should be `promoted` not `processing`
2. Check Convex logs for errors
3. Verify embedding service is working (OpenAI text-embedding-3-small)
4. Check rate limiter (100 embeddings/min, capacity 20)

---

### Issue: LTM count always 0

**Cause:** Consolidation cron hasn't run OR no STM with importance >= 0.6

**Diagnosis:**

1. Wait 15 minutes for cron
2. Check STM importance scores
3. Manually trigger consolidation via Convex dashboard

---

### Issue: Core memories not being created

**Expected Behavior:** Core memories are created ONLY via:

- Daily reflection workflow (3 AM UTC) - analyzes LTM patterns
- Pattern requires 3+ occurrences with 0.7+ confidence

**Note:** There is no direct `saveToCore` tool. All memories must flow through the proper pipeline: Sensory → STM → LTM → Core (via reflection). This is by design—core memory should evolve slowly through pattern detection, not be directly written.

---

## Quick Validation Checklist

### Sensory Memory (Noise Filtering)

- [ ] High-attention messages pass threshold (>= 30%)
- [ ] Low-attention messages are discarded (< 30%)
- [ ] Duplicates detected within 1 hour
- [ ] Attention scoring includes personal info (+25%), entities (+15%), length (+15%), temporal (+10%)
- [ ] Failed extractions retry with backoff and eventually mark as discarded

### Short-Term Memory (Active Reasoning)

- [ ] Messages promoted from sensory after extraction
- [ ] Entities and relationships extracted via LLM
- [ ] Topic clustering groups similar messages (>= 0.82 similarity)
- [ ] Topic centroids update incrementally
- [ ] STM expires after 4 hours

### Long-Term Memory (Semantic Encoding)

- [ ] High-importance STM promoted (>= 0.6) every 15 min
- [ ] Deduplication reinforces existing (>= 0.95 similarity)
- [ ] Memory decay follows Ebbinghaus curve
- [ ] Low-importance memories pruned (< 0.1)
- [ ] Reinforcement increases stability and importance

### Core Memory (Identity Layer)

- [ ] Patterns detected via LLM reflection (metacognition)
- [ ] Core promotion requires 3+ occurrences, 0.7+ confidence
- [ ] Core memories always in context
- [ ] Existing core memories reinforced (not duplicated)
- [ ] Categories: identity, preference, relationship, behavioral, goal, constraint

### Memory Managers (The Sleep Cycle)

- [ ] Consolidation workflow runs every 15 min
- [ ] Reflection workflow runs daily at 3 AM UTC
- [ ] Pruning workflow runs weekly (Sunday 4 AM UTC)
- [ ] Extraction errors handled with retry and failure logging
- [ ] Logs recorded for all workflows

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

5. **Rate Limiting:** If testing rapidly, you may hit rate limits:
   - Extraction: 30/min
   - Embedding: 100/min
   - LLM tokens: 50000/hour
   - Chat messages: 60/min

6. **Attention Score Testing:** Use the formula to predict scores:
   ```
   base (40%) + personal_info (25%) + entities (15%) + temporal (10%) + length>=50 (15%) - length<20 (30%) - low_value (50%)
   ```

---

## Architecture Alignment

This implementation follows the blog post's five-layer architecture:

| Blog Concept         | Implementation                    | Status      |
| -------------------- | --------------------------------- | ----------- |
| Sensory Memory       | `sensoryMemories` table + filters | Implemented |
| Short-Term Memory    | `shortTermMemories` + `topics`    | Implemented |
| Long-Term Memory     | `longTermMemories` + decay/prune  | Implemented |
| Memory Managers      | Consolidation + Reflection crons  | Implemented |
| Core Memory          | `coreMemories` + pattern detect   | Implemented |
| Selective Forgetting | Decay curve + pruning             | Implemented |
| Metacognition        | LLM reflection workflow           | Implemented |
| Deduplication        | Vector similarity (0.95)          | Implemented |
| Topic Clustering     | Embedding similarity (0.82)       | Implemented |
