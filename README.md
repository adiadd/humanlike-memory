# Human-like Memory

Modeled after [Manthan's blog](https://manthanguptaa.in/posts/towards_human_like_memory_for_ai_agents/)

## Tech Stack

- **Frontend**: React 19 + TanStack Start/Router
- **Backend**: Convex (serverless DB + functions)
- **AI**: Vercel AI SDK, Anthropic (Claude), OpenAI (embeddings)
- **Styling**: Tailwind CSS v4

## Memory Architecture

Five-layer memory system:

1. **Sensory** → Filters noise via attention scoring
2. **Short-Term** → Active context buffer with topic clustering
3. **Long-Term** → Consolidated knowledge with decay + deduplication
4. **Memory Managers** → Background workflows for promotion/pruning
5. **Core** → Stable identity facts, always in context

Uses `@convex-dev/agent` for chat, `@convex-dev/workflow` for durable consolidation, and `@convex-dev/action-cache` for embedding caching.

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up Convex:
   ```bash
   bunx convex dev --once
   ```

3. Add environment variables:
   - `.env.local`: `VITE_CONVEX_URL` (from Convex dashboard)
   - Convex dashboard: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

4. Start the dev server:
   ```bash
   bun run dev
   ```
