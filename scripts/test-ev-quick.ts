import {
  calculateEV,
  calculateInfiniteDeckEV,
  calculateFiniteDeckEV,
  calculateCDEV,
  generateStrategyTable,
} from "../app/lib/ev-calculator";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

// Quick test: DP (infinite deck, 3-card removal, full CD) and formula

const testCases: { name: string; rules: HouseRules }[] = [
  { name: "H17, 3:2, DAS, RSA, no surr (2D)", rules: DEFAULT_HOUSE_RULES },
  {
    name: "S17, 3:2, DAS, no RSA, late surr (6D)",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 6,
      hitSoft17: false,
      resplitAces: false,
      surrenderAllowed: "late" as const,
    },
  },
  {
    name: "H17, 6:5, no DAS, no surr (6D)",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 6,
      blackjackPays: "6:5" as const,
      doubleAfterSplit: false,
      resplitAces: false,
    },
  },
  {
    name: "S17, 3:2, DAS, RSA, no surr (8D)",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 8, hitSoft17: false },
  },
  {
    name: "H17, 3:2, no DAS, dbl 10-11 (1D)",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 1,
      doubleAfterSplit: false,
      doubleRestriction: "10-11" as const,
      resplitAces: false,
    },
  },
  {
    name: "H17, 3:2, DAS, early surr (6D)",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 6,
      surrenderAllowed: "early" as const,
    },
  },
  {
    name: "H17, 3:2, DAS, RSA, no surr (1D)",
    rules: { ...DEFAULT_HOUSE_RULES, decks: 1 },
  },
  {
    name: "S17, 3:2, DAS, RSA, late surr (2D)",
    rules: {
      ...DEFAULT_HOUSE_RULES,
      decks: 2,
      hitSoft17: false,
      surrenderAllowed: "late" as const,
    },
  },
];

// Run 1-2 deck cases with all three modes, 6-8 deck with infinite + 3-card only
console.log("EV Calculator: Infinite vs 3-Card Removal vs Full CD\n");
console.log(
  "Rule Set                                Infinite%  3-Card%    CD%        Time(3cr)  Time(CD)",
);
console.log("-".repeat(100));

for (const tc of testCases) {
  const infEV = calculateInfiniteDeckEV(tc.rules);
  const t0 = performance.now();
  const finEV = calculateFiniteDeckEV(tc.rules);
  const msFin = performance.now() - t0;

  let cdStr = "     N/A";
  let msCDStr = "      N/A";
  if (tc.rules.decks <= 2) {
    const t1 = performance.now();
    const cdEV = calculateCDEV(tc.rules);
    const msCD = performance.now() - t1;
    cdStr = cdEV.houseEdgePercent.toFixed(4).padStart(8);
    msCDStr = `${msCD.toFixed(0).padStart(7)}ms`;
  }

  console.log(
    `${tc.name.padEnd(40)}${infEV.houseEdgePercent.toFixed(4).padStart(9)}  ${finEV.houseEdgePercent.toFixed(4).padStart(8)}  ${cdStr}  ${msFin.toFixed(0).padStart(7)}ms ${msCDStr}`,
  );
}

// Verification
console.log("\n" + "=".repeat(100));
console.log("Verification:");
let allPass = true;

// Finite deck house edge < infinite deck
for (const tc of testCases) {
  const infEV = calculateInfiniteDeckEV(tc.rules);
  const finEV = calculateFiniteDeckEV(tc.rules);
  const diff = finEV.houseEdgePercent - infEV.houseEdgePercent;
  const pass = diff < 0;
  if (!pass) allPass = false;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}: ${tc.name} — 3-card ${diff >= 0 ? "+" : ""}${diff.toFixed(4)}% vs infinite`,
  );
}

// CD house edge < infinite deck (for 1-2 deck cases)
for (const tc of testCases) {
  if (tc.rules.decks > 2) continue;
  const infEV = calculateInfiniteDeckEV(tc.rules);
  const cdEV = calculateCDEV(tc.rules);
  const diff = cdEV.houseEdgePercent - infEV.houseEdgePercent;
  const pass = diff < 0;
  if (!pass) allPass = false;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}: ${tc.name} — CD ${diff >= 0 ? "+" : ""}${diff.toFixed(4)}% vs infinite`,
  );
}

// CD vs 3-card removal: should be close (within ~0.05%)
for (const tc of testCases) {
  if (tc.rules.decks > 2) continue;
  const finEV = calculateFiniteDeckEV(tc.rules);
  const cdEV = calculateCDEV(tc.rules);
  const diff = Math.abs(cdEV.houseEdgePercent - finEV.houseEdgePercent);
  const pass = diff < 0.1;
  if (!pass) allPass = false;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}: ${tc.name} — CD vs 3-card diff ${diff.toFixed(4)}% < 0.1%`,
  );
}

// Dispatch: calculateEV should use CD for 1-8 decks
const dispatchEV = calculateEV(DEFAULT_HOUSE_RULES);
const cdEV = calculateCDEV(DEFAULT_HOUSE_RULES);
const match =
  Math.abs(dispatchEV.houseEdgePercent - cdEV.houseEdgePercent) < 1e-10;
console.log(
  `  ${match ? "PASS" : "FAIL"}: calculateEV dispatches to CD: ${dispatchEV.houseEdgePercent.toFixed(6)} vs ${cdEV.houseEdgePercent.toFixed(6)}`,
);

console.log(`\nOverall: ${allPass ? "ALL PASS" : "SOME FAILURES"}`);

// Strategy table (uses 3-card removal, not CD — fast)
console.log("\n" + "=".repeat(100));
console.log("Optimal Strategy (2-deck, H17, 3:2, DAS, RSA, no surr)");
console.log("=".repeat(100));

const strategy = generateStrategyTable(DEFAULT_HOUSE_RULES);
const upcards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const labels = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "A"];

function printTable(
  title: string,
  rows: [string, number][],
  table: Map<number, Map<number, { action: string }>>,
) {
  console.log(`\n${title}:`);
  console.log("      " + labels.map((l) => l.padStart(3)).join(""));
  console.log("      " + "-".repeat(3 * labels.length));
  for (const [label, key] of rows) {
    const row = table.get(key);
    if (!row) continue;
    const cells = upcards.map((u) =>
      (row.get(u)?.action ?? "?").padStart(3),
    );
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
  "\nH=Hit S=Stand D=Double P=Split Rh=Surr(hit) Rs=Surr(stand)",
);
