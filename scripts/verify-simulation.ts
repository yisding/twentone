import { simulateHouseEdge as simulateSlow } from "../app/lib/simulation";
import { simulateHouseEdge as simulateFast } from "../app/lib/simulation-fast";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

const HANDS_PER_CONFIG = 10_000_000;
const HOUSE_EDGE_TOLERANCE = 0.1; // percentage points
const RATIO_TOLERANCE = 0.5; // percentage points

interface Config {
  name: string;
  rules: HouseRules;
}

const configs: Config[] = [
  {
    name: "Default (2-deck, H17, DAS, no surrender)",
    rules: { ...DEFAULT_HOUSE_RULES },
  },
  {
    name: "S17 (stand on soft 17)",
    rules: { ...DEFAULT_HOUSE_RULES, hitSoft17: false },
  },
  {
    name: "6:5 Blackjack",
    rules: { ...DEFAULT_HOUSE_RULES, blackjackPays: "6:5" as const },
  },
  {
    name: "Late Surrender",
    rules: { ...DEFAULT_HOUSE_RULES, surrenderAllowed: "late" as const },
  },
  {
    name: "No Hole Card (European)",
    rules: { ...DEFAULT_HOUSE_RULES, noHoleCard: true },
  },
  {
    name: "6-deck shoe",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 6 },
  },
  {
    name: "Restrictive (no DAS, double 10-11 only, no resplit aces)",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      doubleAfterSplit: false,
      doubleRestriction: "10-11" as const,
      resplitAces: false,
    },
  },
];

function formatPct(n: number): string {
  return n.toFixed(3) + "%";
}

function runBenchmark(rules: HouseRules): void {
  console.log("\n========================================");
  console.log("BENCHMARK (default rules)");
  console.log("========================================");

  // Compare both engines at 1M and 10M
  for (const n of [1_000_000, 10_000_000]) {
    const startSlow = Date.now();
    simulateSlow(n, rules);
    const slowMs = Date.now() - startSlow;

    const startFast = Date.now();
    simulateFast(n, rules);
    const fastMs = Date.now() - startFast;

    const speedup = slowMs / fastMs;
    console.log(
      `  ${(n / 1e6).toFixed(0)}M hands: slow=${slowMs}ms, fast=${fastMs}ms, speedup=${speedup.toFixed(1)}x`,
    );
  }

  // Fast engine only at 100M (slow engine would take too long)
  const n = 100_000_000;
  const startFast = Date.now();
  simulateFast(n, rules);
  const fastMs = Date.now() - startFast;
  console.log(
    `  100M hands: fast=${fastMs}ms (${((n / fastMs) * 1000 / 1e6).toFixed(1)}M hands/sec)`,
  );
}

console.log("Blackjack Simulation Verification");
console.log("==================================");
console.log(`Hands per config: ${HANDS_PER_CONFIG.toLocaleString()}`);
console.log(`House edge tolerance: ±${HOUSE_EDGE_TOLERANCE}%`);
console.log(`Win/loss/push ratio tolerance: ±${RATIO_TOLERANCE}%\n`);

let allPassed = true;

for (const config of configs) {
  console.log(`--- ${config.name} ---`);

  const startSlow = Date.now();
  const slow = simulateSlow(HANDS_PER_CONFIG, config.rules);
  const slowMs = Date.now() - startSlow;

  const startFast = Date.now();
  const fast = simulateFast(HANDS_PER_CONFIG, config.rules);
  const fastMs = Date.now() - startFast;

  const edgeDiff = Math.abs(slow.houseEdge - fast.houseEdge);
  const winRateSlow = (slow.wins / slow.handsPlayed) * 100;
  const winRateFast = (fast.wins / fast.handsPlayed) * 100;
  const lossRateSlow = (slow.losses / slow.handsPlayed) * 100;
  const lossRateFast = (fast.losses / fast.handsPlayed) * 100;
  const pushRateSlow = (slow.pushes / slow.handsPlayed) * 100;
  const pushRateFast = (fast.pushes / fast.handsPlayed) * 100;

  const winDiff = Math.abs(winRateSlow - winRateFast);
  const lossDiff = Math.abs(lossRateSlow - lossRateFast);
  const pushDiff = Math.abs(pushRateSlow - pushRateFast);

  const edgeOk = edgeDiff <= HOUSE_EDGE_TOLERANCE;
  const winOk = winDiff <= RATIO_TOLERANCE;
  const lossOk = lossDiff <= RATIO_TOLERANCE;
  const pushOk = pushDiff <= RATIO_TOLERANCE;
  const passed = edgeOk && winOk && lossOk && pushOk;

  if (!passed) allPassed = false;

  console.log(`  House Edge:  slow=${formatPct(slow.houseEdge)}  fast=${formatPct(fast.houseEdge)}  diff=${formatPct(edgeDiff)}  ${edgeOk ? "OK" : "FAIL"}`);
  console.log(`  Win Rate:    slow=${formatPct(winRateSlow)}  fast=${formatPct(winRateFast)}  diff=${formatPct(winDiff)}  ${winOk ? "OK" : "FAIL"}`);
  console.log(`  Loss Rate:   slow=${formatPct(lossRateSlow)}  fast=${formatPct(lossRateFast)}  diff=${formatPct(lossDiff)}  ${lossOk ? "OK" : "FAIL"}`);
  console.log(`  Push Rate:   slow=${formatPct(pushRateSlow)}  fast=${formatPct(pushRateFast)}  diff=${formatPct(pushDiff)}  ${pushOk ? "OK" : "FAIL"}`);
  console.log(`  Time:        slow=${slowMs}ms  fast=${fastMs}ms  speedup=${(slowMs / fastMs).toFixed(1)}x`);
  console.log(`  Result:      ${passed ? "PASS" : "FAIL"}`);
  console.log();
}

console.log("========================================");
console.log(`Overall: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);
console.log("========================================");

runBenchmark(DEFAULT_HOUSE_RULES);

export {};
