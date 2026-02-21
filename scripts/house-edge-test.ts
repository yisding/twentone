import { calculateHouseEdge } from "../app/lib/houseEdge";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

interface TestCase {
  name: string;
  rules: HouseRules;
  expected: number;
  tolerance?: number; // absolute tolerance override
}

const BASE_TEST_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  resplitAces: false,
};

const testCases: TestCase[] = [
  {
    name: "8-deck S17 standard (baseline)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 8,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: false,
      resplitAces: false,
    },
    expected: 0.43,
  },
  {
    name: "6-deck S17 standard",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.41,
  },
  {
    name: "6-deck H17 standard",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: true,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.63,
  },
  {
    name: "6-deck S17, BJ pays 6:5",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "6:5",
      maxSplitHands: 4,
    },
    expected: 1.80,
  },
  {
    name: "1-deck S17 (near player advantage)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 1,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: -0.02,
    tolerance: 0.10, // 1-deck edge is very sensitive to exact rules modeling
  },
  {
    name: "2-deck S17",
    rules: {
      ...BASE_TEST_RULES,
      decks: 2,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.24,
  },
  {
    name: "6-deck S17, double 10-11 only",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "10-11",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.59,
  },
  {
    name: "6-deck S17, double 9-11 only",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "9-11",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.50,
  },
  {
    name: "6-deck S17, no DAS",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: false,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.55,
  },
  {
    name: "6-deck S17, early surrender",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "early",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: -0.24,
    tolerance: 0.15,
  },
  {
    name: "6-deck S17, no surrender",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "none",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    },
    expected: 0.48,
  },
  {
    name: "6-deck S17, ENHC, DAS, no surrender (qfit ref: 0.540)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "none",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
    },
    expected: 0.54,
  },
  {
    name: "8-deck S17, ENHC, DAS, no surrender (qfit ref: 0.562)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 8,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "none",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
    },
    expected: 0.56,
  },
  {
    name: "6-deck H17, ENHC, DAS, RSA, no surrender (qfit ref: 0.672)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: true,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "none",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
      resplitAces: true,
    },
    expected: 0.67,
  },
  {
    name: "8-deck S17, ENHC, no DAS, no surrender (qfit ref: 0.700)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 8,
      hitSoft17: false,
      doubleAfterSplit: false,
      doubleRestriction: "any",
      surrenderAllowed: "none",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
    },
    expected: 0.70,
  },
  {
    name: "6-deck S17, ENHC, DAS, RSA, ES10 surrender (qfit ref: 0.211)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "enhcNoAce",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
      resplitAces: true,
    },
    expected: 0.21,
  },
  {
    name: "8-deck H17, ENHC, DAS, RSA, ES10 surrender (qfit ref: 0.441)",
    rules: {
      ...BASE_TEST_RULES,
      decks: 8,
      hitSoft17: true,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "enhcNoAce",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
      resplitAces: true,
    },
    expected: 0.44,
  },
  {
    name: "6-deck S17, BJ pays 1:1",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "1:1",
      maxSplitHands: 4,
    },
    expected: 2.68,
  },
  {
    name: "6-deck S17, max split 2 hands",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 2,
    },
    expected: 0.43,
  },
];

function runTests() {
  console.log("House Edge Calculator Tests\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const calculated = calculateHouseEdge(tc.rules);
    const diff = Math.abs(calculated - tc.expected);
    const tolerance = tc.tolerance ?? 0.05;
    const status = diff <= tolerance ? "PASS" : "FAIL";

    if (diff <= tolerance) {
      passed++;
    } else {
      failed++;
    }

    console.log(`\n${tc.name}:`);
    console.log(`  Expected:   ${tc.expected.toFixed(2)}%`);
    console.log(`  Calculated: ${calculated.toFixed(2)}%`);
    console.log(`  Diff:       ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`);
    console.log(`  Tolerance:  ±${tolerance.toFixed(2)}%`);
    console.log(`  Status:     ${status}`);
  }

  // Monotonicity check: house edge should generally increase with deck count
  console.log("\n\nMonotonicity check (deck count vs edge):");
  const deckCounts = [1, 2, 4, 6, 8];
  let prevEdge = -Infinity;
  let monotonic = true;
  for (const d of deckCounts) {
    const edge = calculateHouseEdge({
      ...BASE_TEST_RULES,
      decks: d,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
    });
    const ok = edge >= prevEdge - 0.01; // small tolerance for rounding
    if (!ok) monotonic = false;
    console.log(`  ${d} deck(s): ${edge.toFixed(2)}% ${ok ? "✓" : "✗ NOT MONOTONIC"}`);
    prevEdge = edge;
  }
  if (!monotonic) {
    failed++;
    console.log("  FAIL: Deck count monotonicity violated");
  } else {
    passed++;
    console.log("  PASS");
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests();

export {};
