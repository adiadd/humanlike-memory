# AGENTS.md

## Build & Dev Commands

- `bun run dev` - Start dev server with Convex backend
- `bun run build` - Build for production (vite build + tsc)
- `bun run lint` - TypeScript check + ESLint
- `bun run format` - Format with Prettier
- `bun run test` - Run tests with Vitest (`vitest run <file>` for single test)

## Code Style

- **No semicolons**, single quotes, trailing commas (Prettier)
- **Strict TypeScript**: no unused locals/params, no fallthrough cases
- **Path aliases**: Use `@/*` for `./src/*` imports
- **Imports**: External deps first, then `@/` aliased imports, then relative
- **Components**: Function declarations, props typed inline or with `VariantProps`
- **Naming**: PascalCase components, camelCase functions/variables, kebab-case files

## Stack

- React 19 + TanStack Router/Start + Convex backend
- Tailwind CSS v4 + Base UI + class-variance-authority (cva) = shadcn/ui
- Vitest for testing, ESLint (TanStack config)

## Conventions

- UI components in `src/components/ui/`, use `cn()` from `@/lib/utils` for classnames
- Routes in `src/routes/`, use `createFileRoute` from TanStack Router
