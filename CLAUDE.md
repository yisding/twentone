# CLAUDE.md

## Project at a glance
TwentOne is a Next.js 16 + React 19 + TypeScript blackjack trainer.

## Repo layout
- `app/`: application routes, UI, hooks, and blackjack domain logic.
  - `app/components/`: game/training interface components.
  - `app/hooks/`: game/session/training hooks.
  - `app/lib/`: rules, strategy, simulation, EV, and helper domain modules.
  - `app/api/simulate/route.ts`: simulation API endpoint.
  - `app/workers/`: simulation worker implementation.
- `components/ui/`: shared shadcn/ui primitives.
- `scripts/`: TypeScript script runners for validation and analysis.
- `tests/`: Vitest test suites.

## Key commands
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint`
- `pnpm test` (Vitest)
- `pnpm test:watch` (Vitest watch mode)
- `pnpm test:strategy`
- `pnpm test:house-edge`
- `pnpm test:early-surrender`

## Testing expectations
When logic changes, run at minimum:
1. `pnpm lint`
2. `pnpm test`
3. Relevant script checks in `scripts/` (especially strategy/house-edge/surrender related ones)

## Conventions
- Strict TypeScript.
- 2-space indentation.
- Keep components focused and colocated under `app/components`.
- Prefer descriptive test names reflecting blackjack rule variants.
