# Logic Audit Notes

## Key Findings

1. **Winnings are displayed with dollars only (no cents), which can visibly misreport bankroll totals.**
   - Session bankroll tracks fractional outcomes like surrender (half-bet) and 6:5 blackjack payouts.
   - The UI rounds to whole dollars, so users can see amounts that do not match the internally tracked value.

2. **`simulation-fast` does not fully match `strategy.ts` for surrender decisions.**
   - It omits multiple early-surrender conditions present in the main strategy implementation.
   - It also allows surrender in validation without checking dealer-upcard restrictions (e.g. ENHC no-ace surrender limits).
   - This can skew the simulated edge returned by `/api/simulate` for surrender-heavy rulesets.

3. **The simulation panel is wired to the fast simulator path.**
   - Any strategy mismatch in `simulation-fast` directly affects the reported “Simulated Edge” in the UI.

## Suggested Remediations

- Show at least one fractional digit (preferably two) for bankroll display.
- Align surrender logic in `simulation-fast` to the canonical `getBasicStrategyAction` behavior, including:
  - early-surrender ranges,
  - pair-specific early surrender cases,
  - dealer-upcard gating for `es10`.
- Add targeted regression tests that compare `simulation.ts` and `simulation-fast.ts` on surrender-centric rulesets.
