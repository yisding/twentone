import { describe, expect, it } from "vitest";
import { calculateHouseEdge } from "@/app/lib/houseEdge";
import { DEFAULT_HOUSE_RULES, type HouseRules } from "@/app/lib/types";

interface HouseEdgeCase {
  name: string;
  rules: HouseRules;
  expected: number;
  tolerance?: number;
}

const BASE_TEST_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  resplitAces: false,
};

const houseEdgeCases: HouseEdgeCase[] = [
  {
    name: "8-deck S17 standard (baseline)",
    rules: { ...BASE_TEST_RULES, decks: 8, hitSoft17: false, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "late", blackjackPays: "3:2", maxSplitHands: 4, noHoleCard: false, resplitAces: false },
    expected: 0.43,
  },
  {
    name: "6-deck S17 standard",
    rules: { ...BASE_TEST_RULES, decks: 6, hitSoft17: false, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "late", blackjackPays: "3:2", maxSplitHands: 4 },
    expected: 0.41,
  },
  {
    name: "6-deck H17 standard",
    rules: { ...BASE_TEST_RULES, decks: 6, hitSoft17: true, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "late", blackjackPays: "3:2", maxSplitHands: 4 },
    expected: 0.63,
  },
  {
    name: "6-deck S17, BJ pays 6:5",
    rules: { ...BASE_TEST_RULES, decks: 6, hitSoft17: false, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "late", blackjackPays: "6:5", maxSplitHands: 4 },
    expected: 1.8,
  },
  {
    name: "1-deck S17 (near player advantage)",
    rules: { ...BASE_TEST_RULES, decks: 1, hitSoft17: false, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "late", blackjackPays: "3:2", maxSplitHands: 4 },
    expected: -0.02,
    tolerance: 0.1,
  },
  {
    name: "6-deck S17, ENHC, DAS, RSA, ES10 surrender",
    rules: { ...BASE_TEST_RULES, decks: 6, hitSoft17: false, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "enhcNoAce", blackjackPays: "3:2", maxSplitHands: 4, noHoleCard: true, resplitAces: true },
    expected: 0.21,
  },
  {
    name: "6-deck S17, BJ pays 1:1",
    rules: { ...BASE_TEST_RULES, decks: 6, hitSoft17: false, doubleAfterSplit: true, doubleRestriction: "any", surrenderAllowed: "late", blackjackPays: "1:1", maxSplitHands: 4 },
    expected: 2.68,
  },
];

describe("house edge regression", () => {
  it.each(houseEdgeCases)("matches baseline: $name", ({ rules, expected, tolerance = 0.05 }) => {
    const calculated = calculateHouseEdge(rules);
    expect(Math.abs(calculated - expected)).toBeLessThanOrEqual(tolerance);
  });

  it("is monotonic by deck count for S17 baseline", () => {
    const deckCounts = [1, 2, 4, 6, 8];
    let prevEdge = -Infinity;

    for (const decks of deckCounts) {
      const edge = calculateHouseEdge({
        ...BASE_TEST_RULES,
        decks,
        hitSoft17: false,
        doubleAfterSplit: true,
        doubleRestriction: "any",
        surrenderAllowed: "late",
        blackjackPays: "3:2",
        maxSplitHands: 4,
      });
      expect(edge).toBeGreaterThanOrEqual(prevEdge - 0.01);
      prevEdge = edge;
    }
  });

  it("captures expected rule-direction deltas", () => {
    const s17Late = calculateHouseEdge({ ...BASE_TEST_RULES, decks: 6, hitSoft17: false, surrenderAllowed: "late", blackjackPays: "3:2", doubleAfterSplit: true, doubleRestriction: "any", maxSplitHands: 4 });
    const h17Late = calculateHouseEdge({ ...BASE_TEST_RULES, decks: 6, hitSoft17: true, surrenderAllowed: "late", blackjackPays: "3:2", doubleAfterSplit: true, doubleRestriction: "any", maxSplitHands: 4 });
    const sixToFive = calculateHouseEdge({ ...BASE_TEST_RULES, decks: 6, hitSoft17: false, surrenderAllowed: "late", blackjackPays: "6:5", doubleAfterSplit: true, doubleRestriction: "any", maxSplitHands: 4 });
    const noDas = calculateHouseEdge({ ...BASE_TEST_RULES, decks: 6, hitSoft17: false, surrenderAllowed: "late", blackjackPays: "3:2", doubleAfterSplit: false, doubleRestriction: "any", maxSplitHands: 4 });
    const noSurrender = calculateHouseEdge({ ...BASE_TEST_RULES, decks: 6, hitSoft17: false, surrenderAllowed: "none", blackjackPays: "3:2", doubleAfterSplit: true, doubleRestriction: "any", maxSplitHands: 4 });
    const earlySurrender = calculateHouseEdge({ ...BASE_TEST_RULES, decks: 6, hitSoft17: false, surrenderAllowed: "early", blackjackPays: "3:2", doubleAfterSplit: true, doubleRestriction: "any", maxSplitHands: 4 });

    expect(h17Late).toBeGreaterThan(s17Late);
    expect(sixToFive).toBeGreaterThan(s17Late);
    expect(noDas).toBeGreaterThan(s17Late);
    expect(noSurrender).toBeGreaterThan(s17Late);
    expect(earlySurrender).toBeLessThan(s17Late);
  });
});
