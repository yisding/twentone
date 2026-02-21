# Logic audit (gaming, strategy, and edge calculation)

## High-impact findings

1. **ENHC "all upcards" surrender was treated as late surrender in strategy decisions.**
   - `enhcAll` is early-equivalent in surrender helpers, but strategy branching checked only `rules.surrenderAllowed === "early"` in key paths.
   - This could produce late-surrender recommendations instead of early-surrender recommendations for ENHC all-upcards configurations.

2. **House-edge formula applies additive rule deltas and omits interaction effects.**
   - `calculateHouseEdge` is a linear model and cannot fully capture second-order interactions between rules.
   - This can produce noticeable drift for unusual combinations even if baseline test cases pass.

## Additional notes

- Early surrender of hard 5/6/7 vs Ace is expected per Wizard of Odds and is now intentionally retained.
- Existing strategy and house-edge tests pass for covered cases; new ENHC all-upcards test coverage should remain in place to prevent regressions.
- The EV engine (`ev-calculator.ts`) is materially more robust for edge estimation than the additive formula in `houseEdge.ts`.
