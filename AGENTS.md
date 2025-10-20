# Repository Guidelines

## Project Structure & Module Organization
This Next.js App Router project keeps routed pages under `app/`, with route groups like `(chat)` and `(auth)`. Shared components live in `components/` (UI primitives in `components/ui`) and hooks in `hooks/`. Database logic and Drizzle schemas sit in `lib/db`, while cross-cutting utilities remain in `lib/`. Config files such as `middleware.ts` and `instrumentation.ts` stay at the root. Static assets live in `public/`, and Playwright fixtures, prompts, and page objects reside in `tests/`.

## Build, Test, and Development Commands
- `pnpm dev`: run the hot-reloading dev server (Turbo enabled).
- `pnpm build`: apply pending Drizzle migrations via `tsx lib/db/migrate` and compile the production bundle.
- `pnpm start`: serve the compiled Next.js build.
- `pnpm lint` / `pnpm format`: check or fix formatting with Ultracite (Biome).
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`: manage schema snapshots, run typed migrations, and inspect the database.
- `pnpm test`: execute Playwright tests (`PLAYWRIGHT=True` is set automatically).

## Coding Style & Naming Conventions
Use TypeScript throughout with two-space indentation. Prefer server components unless client-only features require `"use client"`. Name components with PascalCase, hooks with `use`-prefixed camelCase, and directories with lowercase kebab-case (route groups may use parentheses). Colocate helpers in feature folders or `lib/` to keep imports shallow. Fix lint warnings before submitting and let `pnpm format` resolve stylistic issues.

## Testing Guidelines
E2E specs live in `tests/e2e/*.test.ts`; share fixtures in `tests/fixtures.ts` and page objects under `tests/pages/`. Cover key flows that create chats, stream responses, and manage artifacts. Run `pnpm test -- --ui` for an interactive runner while debugging. Document any new fixtures or prompts and keep assertions resilient to streaming order.

## Commit & Pull Request Guidelines
Git history uses short, imperative subject lines (`Initial commit`). Follow that tone, optionally adding a scope (`feat(chat): add session toolbar`). Describe user-facing behavior and migration impacts in the commit body when needed. Pull requests should link issues, list acceptance criteria, call out schema or env changes, and attach screenshots for UI tweaks. Confirm `pnpm lint` and `pnpm test` in the PR description before requesting review.

## Security & Configuration Tips
Duplicate `.env.example` to `.env.local` for local runs and never commit secrets. Prefer Vercel-managed environment variables in production. Add new configuration keys to `.env.example` and reference them via `process.env` so deployments stay consistent.
