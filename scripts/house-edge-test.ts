import { calculateHouseEdge } from "../app/lib/houseEdge";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

interface TestCase {
  name: string;
  rules: HouseRules;
  expected: number;
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
    name: "1-deck S17 (player advantage)",
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
    expected: 0.00,
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
    expected: 0.00,
  },
  {
    name: "6-deck S17, European no hole card",
    rules: {
      ...BASE_TEST_RULES,
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: true,
      doubleRestriction: "any",
      surrenderAllowed: "late",
      blackjackPays: "3:2",
      maxSplitHands: 4,
      noHoleCard: true,
    },
    expected: 0.52,
  },
];

console.log("House Edge Calculator Tests\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const calculated = calculateHouseEdge(tc.rules);
  const diff = Math.abs(calculated - tc.expected);
  const tolerance = 0.05;
  const status = diff <= tolerance ? "PASS" : "FAIL";

  if (diff <= tolerance) {
    passed++;
  } else {
    failed++;
  }

  console.log(`\n${tc.name}:`);
  console.log(`  Expected:  ${tc.expected.toFixed(2)}%`);
  console.log(`  Calculated: ${calculated.toFixed(2)}%`);
  console.log(`  Diff: ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`);
  console.log(`  Status: ${status}`);
}

console.log("\n" + "=".repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

export {};
