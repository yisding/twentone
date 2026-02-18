import { calculateEV, generateStrategyTable } from "../app/lib/ev-calculator";
import { calculateHouseEdge } from "../app/lib/houseEdge";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

// Quick test: just DP and formula, no simulation

const testCases: { name: string; rules: HouseRules }[] = [
  { name: "H17, 3:2, DAS, RSA, no surr", rules: DEFAULT_HOUSE_RULES },
  {
    name: "S17, 3:2, DAS, no RSA, late surr",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 6, hitSoft17: false, resplitAces: false, surrenderAllowed: "late" as const },
  },
  {
    name: "H17, 6:5, no DAS, no surr",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 6, blackjackPays: "6:5" as const, doubleAfterSplit: false, resplitAces: false },
  },
  {
    name: "S17, 3:2, DAS, RSA, no surr",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 8, hitSoft17: false },
  },
  {
    name: "H17, 3:2, no DAS, dbl 10-11",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 1, doubleAfterSplit: false, doubleRestriction: "10-11" as const, resplitAces: false },
  },
  {
    name: "H17, 3:2, DAS, early surr",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 6, surrenderAllowed: "early" as const },
  },
];

console.log("EV Calculator (DP, infinite deck) vs Formula\n");
console.log("Rule Set                              DP%      Formula%   Diff");
console.log("-".repeat(65));

for (const tc of testCases) {
  const t0 = performance.now();
  const ev = calculateEV(tc.rules);
  const ms = performance.now() - t0;
  const formula = calculateHouseEdge(tc.rules);
  const diff = ev.houseEdgePercent - formula;
  console.log(
    `${tc.name.padEnd(38)}${ev.houseEdgePercent.toFixed(4).padStart(7)}  ${formula.toFixed(4).padStart(9)}  ${diff >= 0 ? "+" : ""}${diff.toFixed(4)}  (${ms.toFixed(1)}ms)`,
  );
}

// Strategy table
console.log("\n" + "=".repeat(65));
console.log("Optimal Strategy (infinite deck, H17, 3:2, DAS, RSA, no surr)");
console.log("=".repeat(65));

const strategy = generateStrategyTable(DEFAULT_HOUSE_RULES);
const upcards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const labels = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "A"];

function printTable(title: string, rows: [string, number][], table: Map<number, Map<number, { action: string }>>) {
  console.log(`\n${title}:`);
  console.log("      " + labels.map((l) => l.padStart(3)).join(""));
  console.log("      " + "-".repeat(3 * labels.length));
  for (const [label, key] of rows) {
    const row = table.get(key);
    if (!row) continue;
    const cells = upcards.map((u) => (row.get(u)?.action ?? "?").padStart(3));
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

console.log("\nH=Hit S=Stand D=Double P=Split Rh=Surr(hit) Rs=Surr(stand)");
