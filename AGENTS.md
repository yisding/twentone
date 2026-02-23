# Repository Guidelines

## Project Structure & Module Organization
This repository is a single Next.js 16 + TypeScript app.
- `app/`: App Router entrypoints and feature code.
  - `app/components/`: game and training UI (`GameArea`, `StatsBar`, `TrainingMode`, etc.).
  - `app/hooks/`: React hooks for game state, session stats, and training flow.
  - `app/lib/`: core blackjack/domain logic (strategy, deck, surrender, EV, simulation).
  - `app/api/simulate/`: API route for server-side simulation.
  - `app/workers/`: worker-based simulation support.
- `components/ui/`: shared shadcn/ui primitives.
- `lib/`: cross-cutting utilities.
- `scripts/`: executable TypeScript validation and analysis scripts.
- `tests/`: Vitest suites for strategy and rules regressions.
- `public/`: static assets.

Use the `@/*` path alias from `tsconfig.json` for root-based imports when helpful.

## Build, Test, and Development Commands
Use `pnpm` (lockfile is `pnpm-lock.yaml`).
- `pnpm dev`: run local dev server at `http://localhost:3000`.
- `pnpm build`: create production build.
- `pnpm start`: serve the production build.
- `pnpm lint`: run ESLint (Next.js core-web-vitals + TypeScript rules).
- `pnpm test`: run the Vitest suite once.
- `pnpm test:watch`: run Vitest in watch mode.
- `pnpm test:strategy`: run script-based strategy correctness checks.
- `pnpm test:house-edge`: run script-based house-edge regression checks.
- `pnpm test:early-surrender`: run script-based early surrender checks.

## Coding Style & Naming Conventions
- Language: TypeScript with `strict` mode enabled.
- Indentation: 2 spaces; keep formatting consistent with existing files.
- Components: PascalCase file/function names (for example, `SettingsPanel.tsx`).
- Hooks/utilities: camelCase names (for example, `useGameState.ts`).
- Prefer small, focused modules and colocate feature UI under `app/components`.

## Testing Guidelines
Test coverage is split between Vitest suites (`tests/`) and script runners (`scripts/*.ts`).
- Add or update Vitest coverage when changing deterministic logic that can be unit tested.
- Add or update script test cases when changing strategy tables, rule handling, simulation, or EV calculations.
- Keep test case names descriptive and tied to blackjack rule variants.
- Run `pnpm lint`, `pnpm test`, and relevant script checks before opening a PR.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects (for example: `refactor`, `track amount`, `better edge calculation`).
- Keep commit messages concise and action-oriented.
- PRs should include: purpose, key logic/UI changes, commands run (`pnpm lint`, tests), and screenshots for visible UI updates.
- Link related issues/tasks when available.
