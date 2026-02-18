import { calculateEV, generateStrategyTable } from "../app/lib/ev-calculator";
import { simulateHouseEdge } from "../app/lib/simulation-fast";
import { calculateHouseEdge } from "../app/lib/houseEdge";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

interface TestCase {
  name: string;
  rules: HouseRules;
}

const testCases: TestCase[] = [
  {
    name: "Default (H17, 3:2, DAS, RSA, no surrender)",
    rules: DEFAULT_HOUSE_RULES,
  },
  {
    name: "S17, 3:2, DAS, no RSA, late surrender",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 6,
      hitSoft17: false,
      resplitAces: false,
      surrenderAllowed: "late" as const,
      maxSplitHands: 4 as const,
    },
  },
  {
    name: "H17, 6:5, no DAS, no surrender",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 6,
      hitSoft17: true,
      blackjackPays: "6:5" as const,
      doubleAfterSplit: false,
      surrenderAllowed: "none" as const,
      resplitAces: false,
    },
  },
  {
    name: "S17, 3:2, DAS, RSA, no surrender",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 8,
      hitSoft17: false,
      doubleAfterSplit: true,
      resplitAces: true,
      surrenderAllowed: "none" as const,
    },
  },
  {
    name: "H17, 3:2, no DAS, double 10-11",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 1,
      hitSoft17: true,
      doubleAfterSplit: false,
      doubleRestriction: "10-11" as const,
      surrenderAllowed: "none" as const,
      resplitAces: false,
    },
  },
  {
    name: "H17, 3:2, DAS, early surrender",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 6,
      hitSoft17: true,
      surrenderAllowed: "early" as const,
    },
  },
];

console.log("Blackjack EV Calculator - Combinatorial (DP) vs Simulation");
console.log("=".repeat(70));
console.log("DP uses infinite deck. Sim uses finite shoe with basic strategy.");
console.log(
  'Sim "per hand" = (totalBet - totalReturned) / numHands * 100',
);
console.log(
  '    "per wager" = (totalBet - totalReturned) / totalBet * 100',
);
console.log("DP computes per initial bet (= per hand).\n");

for (const tc of testCases) {
  console.log(tc.name);
  console.log("-".repeat(tc.name.length));

  const r = tc.rules;
  console.log(
    `  ${r.decks}D ${r.hitSoft17 ? "H17" : "S17"} BJ=${r.blackjackPays} DAS=${r.doubleAfterSplit} ` +
      `Dbl=${r.doubleRestriction} Surr=${r.surrenderAllowed} RSA=${r.resplitAces} Split=${r.maxSplitHands}`,
  );

  // Combinatorial EV (infinite deck)
  const t0 = performance.now();
  const evResult = calculateEV(r);
  const evTime = performance.now() - t0;

  // Formula-based estimate
  const formulaEdge = calculateHouseEdge(r);

  // Simulation (1M hands for speed)
  const simHands = 1_000_000;
  const t1 = performance.now();
  const simResult = simulateHouseEdge(simHands, r);
  const simTime = performance.now() - t1;

  // Compute simulation house edge per hand (same basis as DP)
  const simNetLoss = simResult.totalBet - simResult.totalReturned;
  const simEdgePerHand = (simNetLoss / simHands) * 100;
  const simEdgePerWager = simResult.houseEdge; // already per-wager
  const avgWagerPerHand = simResult.totalBet / simHands;

  console.log(`  DP (infinite deck):  ${evResult.houseEdgePercent.toFixed(4)}%  (${evTime.toFixed(1)}ms)`);
  console.log(`  Sim per hand (1M):   ${simEdgePerHand.toFixed(4)}%  (${simTime.toFixed(0)}ms)`);
  console.log(`  Sim per wager:       ${simEdgePerWager.toFixed(4)}%`);
  console.log(`  Sim avg wager/hand:  ${avgWagerPerHand.toFixed(4)}`);
  console.log(`  Formula estimate:    ${formulaEdge.toFixed(4)}%`);
  console.log(`  DP vs Sim(hand):     ${(evResult.houseEdgePercent - simEdgePerHand).toFixed(4)}%`);
  console.log("");
}

// Strategy table for default rules
console.log("=".repeat(70));
console.log("Optimal Strategy Table (infinite deck, default rules)");
console.log("=".repeat(70));

const strategy = generateStrategyTable(DEFAULT_HOUSE_RULES);
const dealerUpcards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const upcardLabels = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "A"];

function printTable(
  title: string,
  rows: [string, number][],
  table: Map<number, Map<number, { action: string; ev: number }>>,
) {
  console.log(`\n${title}:`);
  console.log("      " + upcardLabels.map((l) => l.padStart(4)).join(""));
  console.log("      " + "-".repeat(4 * upcardLabels.length));
  for (const [label, key] of rows) {
    const row = table.get(key);
    if (!row) continue;
    const cells = dealerUpcards.map((u) => {
      const entry = row.get(u);
      return entry ? entry.action.padStart(4) : "   ?";
    });
    console.log(`  ${label.padStart(3)} |${cells.join("")}`);
  }
}

const hardRows: [string, number][] = [];
for (let t = 21; t >= 5; t--) hardRows.push([String(t), t]);
printTable("Hard Totals", hardRows, strategy.hard);

const softRows: [string, number][] = [];
for (let t = 21; t >= 13; t--) softRows.push([`A${t - 11}`, t]);
printTable("Soft Totals", softRows, strategy.soft);

const pairLabels: [string, number][] = [
  ["AA", 11], ["TT", 10], ["99", 9], ["88", 8], ["77", 7],
  ["66", 6], ["55", 5], ["44", 4], ["33", 3], ["22", 2],
];
printTable("Pairs", pairLabels, strategy.pairs);

console.log(
  "\nLegend: H=Hit S=Stand D=Double P=Split Rh=Surrender(else hit) Rs=Surrender(else stand)",
);

export {};
