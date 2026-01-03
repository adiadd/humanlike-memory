# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs Convex once, then starts web + Convex dev servers concurrently)
bun run dev

# Build & type-check
bun run build

# Linting (type-check + ESLint)
bun run lint

# Format code
bun run format

# Run tests
bun run test
```

## Architecture

This is a TanStack Start (React) application with Convex as the backend. This uses bun.sh for package management NOT npm.

**Stack:**

- **Framework**: TanStack Start with Vite + Nitro
- **Backend**: Convex (serverless database & functions)
- **Styling**: Tailwind CSS v4 with shadcn-style components using Base UI, shadcn/ui
- **State**: TanStack Query integrated with Convex via `@convex-dev/react-query`
- **Routing**: TanStack Router (file-based routing in `src/routes/`)

**Key directories:**

- `src/routes/` - File-based routes (TanStack Router auto-generates `routeTree.gen.ts`)
- `src/components/ui/` - Base UI components styled with Tailwind/CVA
- `convex/` - Convex backend functions (queries, mutations, actions)

**Router setup (`src/router.tsx`):** Creates the router with Convex + TanStack Query integration. The `ConvexQueryClient` bridges Convex subscriptions with TanStack Query's caching.

**Environment:** Requires `VITE_CONVEX_URL` environment variable for Convex connection.

## Code Style

- Uses TanStack's ESLint config
- Prettier: no semicolons, single quotes, trailing commas
- Path alias: `@/*` maps to `./src/*`
- UI components use `cn()` utility from `src/lib/utils.ts` for class merging
