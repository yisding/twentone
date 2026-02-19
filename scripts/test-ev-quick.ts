import {
  calculateEV,
  calculateInfiniteDeckEV,
  calculateFiniteDeckEV,
  generateStrategyTable,
} from "../app/lib/ev-calculator";
import { calculateHouseEdge } from "../app/lib/houseEdge";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

// Quick test: DP (infinite deck, finite deck) and formula, no simulation

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

console.log(
  "EV Calculator: Infinite Deck vs Finite Deck (3-card removal) vs Formula\n",
);
console.log(
  "Rule Set                                Infinite%  Finite%    Diff     Formula%   Time(inf) Time(fin)",
);
console.log("-".repeat(105));

for (const tc of testCases) {
  const t0 = performance.now();
  const infEV = calculateInfiniteDeckEV(tc.rules);
  const msInf = performance.now() - t0;

  const t1 = performance.now();
  const finEV = calculateFiniteDeckEV(tc.rules);
  const msFin = performance.now() - t1;

  const formula = calculateHouseEdge(tc.rules);
  const diff = finEV.houseEdgePercent - infEV.houseEdgePercent;

  console.log(
    `${tc.name.padEnd(40)}${infEV.houseEdgePercent.toFixed(4).padStart(9)}  ${finEV.houseEdgePercent.toFixed(4).padStart(8)}  ${diff >= 0 ? "+" : ""}${diff.toFixed(4).padStart(7)}  ${formula.toFixed(4).padStart(9)}  ${msInf.toFixed(1).padStart(8)}ms ${msFin.toFixed(1).padStart(8)}ms`,
  );
}

// Verify: finite deck should have lower house edge than infinite deck
console.log("\n" + "=".repeat(105));
console.log("Verification:");
let allPass = true;
for (const tc of testCases) {
  const infEV = calculateInfiniteDeckEV(tc.rules);
  const finEV = calculateFiniteDeckEV(tc.rules);
  const diff = finEV.houseEdgePercent - infEV.houseEdgePercent;
  const pass = diff < 0;
  if (!pass) allPass = false;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}: ${tc.name} — finite ${diff >= 0 ? "+" : ""}${diff.toFixed(4)}% vs infinite`,
  );
}

// 6-8 deck: finite ≈ infinite within ~0.15% (3-card removal has small residual)
for (const tc of testCases) {
  if (tc.rules.decks >= 6) {
    const infEV = calculateInfiniteDeckEV(tc.rules);
    const finEV = calculateFiniteDeckEV(tc.rules);
    const diff = Math.abs(
      finEV.houseEdgePercent - infEV.houseEdgePercent,
    );
    const pass = diff < 0.15;
    if (!pass) allPass = false;
    console.log(
      `  ${pass ? "PASS" : "FAIL"}: ${tc.name} — 6+ deck diff ${diff.toFixed(4)}% < 0.15%`,
    );
  }
}

// 1-2 deck: finite significantly lower (by ~0.1-0.5%)
for (const tc of testCases) {
  if (tc.rules.decks <= 2) {
    const infEV = calculateInfiniteDeckEV(tc.rules);
    const finEV = calculateFiniteDeckEV(tc.rules);
    const diff = infEV.houseEdgePercent - finEV.houseEdgePercent;
    const pass = diff > 0.05;
    if (!pass) allPass = false;
    console.log(
      `  ${pass ? "PASS" : "FAIL"}: ${tc.name} — 1-2 deck improvement ${diff.toFixed(4)}% > 0.05%`,
    );
  }
}

console.log(`\nOverall: ${allPass ? "ALL PASS" : "SOME FAILURES"}`);

// Dispatch test: calculateEV should use finite deck for 1-8
console.log("\n" + "=".repeat(105));
console.log("Dispatch test (calculateEV should use finite deck for 1-8):");
const dispatchEV = calculateEV(DEFAULT_HOUSE_RULES);
const finiteEV = calculateFiniteDeckEV(DEFAULT_HOUSE_RULES);
const dispatchMatch =
  Math.abs(dispatchEV.houseEdgePercent - finiteEV.houseEdgePercent) < 1e-10;
console.log(
  `  ${dispatchMatch ? "PASS" : "FAIL"}: calculateEV(2D) = calculateFiniteDeckEV(2D): ${dispatchEV.houseEdgePercent.toFixed(6)} vs ${finiteEV.houseEdgePercent.toFixed(6)}`,
);

// Strategy table
console.log("\n" + "=".repeat(105));
console.log("Optimal Strategy (2-deck, H17, 3:2, DAS, RSA, no surr)");
console.log("=".repeat(105));

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
  ["AA", 11],
  ["TT", 10],
  ["99", 9],
  ["88", 8],
  ["77", 7],
  ["66", 6],
  ["55", 5],
  ["44", 4],
  ["33", 3],
  ["22", 2],
];
printTable("Pairs", pairLabels, strategy.pairs);

console.log(
  "\nH=Hit S=Stand D=Double P=Split Rh=Surr(hit) Rs=Surr(stand)",
);

// Compare strategy tables: infinite vs finite deck for 2-deck
console.log("\n" + "=".repeat(105));
console.log(
  "Strategy differences: infinite vs finite deck (2-deck, H17, 3:2, DAS, RSA)",
);
console.log("=".repeat(105));

const infStrategy = generateStrategyTable({
  ...DEFAULT_HOUSE_RULES,
  decks: 999,
}); // force infinite
const finStrategy = generateStrategyTable(DEFAULT_HOUSE_RULES); // 2-deck finite

let diffCount = 0;
for (const [section, sectionName] of [
  [["hard", "Hard"], ["soft", "Soft"], ["pairs", "Pairs"]] as const,
].flat()) {
  const infTable = infStrategy[section as keyof typeof infStrategy];
  const finTable = finStrategy[section as keyof typeof finStrategy];
  for (const [key, infRow] of infTable) {
    const finRow = finTable.get(key);
    if (!finRow) continue;
    for (const uc of upcards) {
      const infAction = infRow.get(uc)?.action;
      const finAction = finRow.get(uc)?.action;
      if (infAction !== finAction) {
        const label =
          section === "pairs"
            ? `${key === 11 ? "A" : key},${key === 11 ? "A" : key}`
            : `${sectionName} ${key}`;
        console.log(
          `  ${label} vs ${uc === 11 ? "A" : uc}: infinite=${infAction} finite=${finAction}`,
        );
        diffCount++;
      }
    }
  }
}
console.log(
  `\nTotal strategy differences: ${diffCount} (expect only borderline hands)`,
);
