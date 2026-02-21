# TwentyOne — Blackjack Strategy Trainer

TwentyOne is a **Next.js 16 + TypeScript** blackjack trainer focused on helping players learn and drill mathematically correct basic strategy under configurable casino rules.

## What this app does

- Practice full blackjack hands with immediate action feedback.
- Train with scenario-based drills and category focus (splits, doubles, surrender, tricky totals, etc.).
- Track session accuracy and incorrect plays.
- Adjust house rules (H17/S17, surrender variants, DAS, deck count, payout, no-hole-card, split limits).
- Run house-edge simulations and strategy/EV validation scripts.

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **UI:** React 19 + shadcn/ui primitives
- **Styling:** Tailwind CSS v4
- **Package manager:** pnpm

## Project structure

```text
.
├── app/
│   ├── api/simulate/        # Simulation API route
│   ├── components/          # Game UI and training UI
│   ├── hooks/               # Session/game/training hooks
│   └── lib/                 # Blackjack domain logic (strategy, EV, simulation, rules)
├── components/ui/           # Shared UI primitives
├── lib/                     # Shared utility helpers
├── public/                  # Static assets
└── scripts/                 # Script-based test and analysis runners
```

## Getting started

### 1) Install dependencies

```bash
pnpm install
```

### 2) Run the app locally

```bash
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Available scripts

### App lifecycle

- `pnpm dev` — Start local development server.
- `pnpm build` — Build production bundle.
- `pnpm start` — Run production server.
- `pnpm lint` — Run ESLint checks.

### Strategy / simulation checks

- `pnpm test:strategy` — Validate strategy decisions against expected cases.
- `pnpm test:house-edge` — Run house-edge regression checks.
- `pnpm test:ev-mistakes` — Evaluate EV cost of incorrect decisions.
- `pnpm test:early-surrender` — Validate early surrender behavior.
- `pnpm simulate` — Run standalone house-edge simulation script.

> Note: Additional analysis scripts are available under `scripts/` and can be run with `pnpm tsx <script-path>`.

## Core blackjack rules modeled

The app supports configurable house rules via the `HouseRules` model, including:

- Dealer hits/stands on soft 17
- Early/late surrender variants (including ENHC variants)
- Double after split and double restrictions
- Resplitting aces
- Blackjack payout variants (3:2, 6:5, 1:1)
- Deck count
- No-hole-card mode
- Maximum split hands

## API

### `POST /api/simulate`

Runs a server-side house-edge simulation.

**Request body**

```json
{
  "numHands": 10000,
  "rules": {
    "hitSoft17": true,
    "surrenderAllowed": "none",
    "doubleAfterSplit": true,
    "doubleRestriction": "any",
    "resplitAces": true,
    "blackjackPays": "3:2",
    "decks": 2,
    "noHoleCard": false,
    "maxSplitHands": 4
  }
}
```

- `numHands` is optional and defaults to `10000`.
- `rules` is optional and defaults to the app's default ruleset.

## Development notes

- Use `@/*` imports for root-relative paths when useful.
- Keep components small and focused; feature UI belongs in `app/components`.
- If changing strategy/rules logic, run:
  - `pnpm lint`
  - `pnpm test:strategy`
  - `pnpm test:house-edge`

## License

No license file is currently included in this repository. Add one if you intend to distribute or open-source the project.
