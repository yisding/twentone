# Repository Guidelines

## Project Structure & Module Organization
This repository is a single Next.js 16 + TypeScript app.
- `app/`: App Router entrypoints and feature code.
  - `app/components/`: game UI components (`GameArea`, `StatsBar`, etc.).
  - `app/hooks/`: React hooks for state/session logic.
  - `app/lib/`: core blackjack/domain logic (strategy, deck, rules, house edge).
- `components/ui/`: shared shadcn/ui primitives.
- `lib/`: cross-cutting utilities.
- `scripts/`: executable TypeScript validation scripts (`strategy-test.ts`, `house-edge-test.ts`).
- `public/`: static assets.

Use the `@/*` path alias from `tsconfig.json` for root-based imports when helpful.

## Build, Test, and Development Commands
Use `pnpm` (lockfile is `pnpm-lock.yaml`).
- `pnpm dev`: run local dev server at `http://localhost:3000`.
- `pnpm build`: create production build.
- `pnpm start`: serve the production build.
- `pnpm lint`: run ESLint (Next.js core-web-vitals + TypeScript rules).
- `pnpm test:strategy`: run strategy correctness checks against expected actions.
- `pnpm test:house-edge`: run house-edge regression checks.

## Coding Style & Naming Conventions
- Language: TypeScript with `strict` mode enabled.
- Indentation: 2 spaces; keep formatting consistent with existing files.
- Components: PascalCase file/function names (for example, `SettingsPanel.tsx`).
- Hooks/utilities: camelCase names (for example, `useGameState.ts`).
- Prefer small, focused modules and colocate feature UI under `app/components`.

## Testing Guidelines
There is no Jest/Vitest suite yet; test coverage is maintained through the `scripts/*.ts` runners.
- Add or update script test cases when changing strategy tables, rule handling, or edge calculations.
- Keep test case names descriptive and tied to blackjack rule variants.
- Run both test scripts and `pnpm lint` before opening a PR.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects (for example: `refactor`, `track amount`, `better edge calculation`).
- Keep commit messages concise and action-oriented.
- PRs should include: purpose, key logic/UI changes, commands run (`pnpm lint`, tests), and screenshots for visible UI updates.
- Link related issues/tasks when available.
