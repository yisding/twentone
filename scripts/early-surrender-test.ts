import { getBasicStrategyAction } from "../app/lib/strategy";
import { computeActionEVs } from "../app/lib/ev-utils";
import { Hand, HouseRules, DEFAULT_HOUSE_RULES, Card } from "../app/lib/types";
import { createEmptyHand } from "../app/lib/game";

function createHand(cards: Card[], overrides: Partial<Hand> = {}): Hand {
  return {
    ...createEmptyHand(),
    cards,
    ...overrides,
  };
}

function card(rank: string, suit: string = "hearts"): Card {
  return { rank: rank as Card["rank"], suit: suit as Card["suit"] };
}

interface TestCase {
  playerCards: Card[];
  dealerUpCard: Card;
  expected: string;
  category: string;
  playerOverrides?: Partial<Hand>;
}

const EARLY_SURRENDER_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  decks: 6,
  hitSoft17: true,
  surrenderAllowed: "early",
  doubleAfterSplit: true,
  doubleRestriction: "any",
  noHoleCard: false,
};

function runTestSuite(
  name: string,
  testCases: TestCase[],
  rules: HouseRules,
): string[] {
  const discrepancies: string[] = [];
  console.log(`Testing ${name}:\n`);

  for (const tc of testCases) {
    const playerHand = createHand(tc.playerCards, tc.playerOverrides);
    const dealerHand = createHand([tc.dealerUpCard, card("2")]);
    const actual = getBasicStrategyAction(playerHand, dealerHand, rules);

    if (actual !== tc.expected) {
      discrepancies.push(
        `[${tc.category}] Player: ${tc.playerCards.map((c) => c.rank).join(",")} vs Dealer: ${tc.dealerUpCard.rank} - Expected: ${tc.expected}, Got: ${actual}`,
      );
    }
  }

  return discrepancies;
}

function runEarlySurrenderTests(): string[] {
  const allDiscrepancies: string[] = [];

  // =============================================
  // Hard totals with early surrender vs Ace
  // =============================================
  const hardVsAceTestCases: TestCase[] = [
    // Hard 5-7 vs Ace: surrender
    { playerCards: [card("3"), card("2")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 5 vs A" },
    { playerCards: [card("4"), card("2")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 6 vs A" },
    { playerCards: [card("5"), card("2")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 7 vs A" },
    // Hard 12-17 vs Ace: surrender
    { playerCards: [card("10"), card("2")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 12 vs A" },
    { playerCards: [card("10"), card("3")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 13 vs A" },
    { playerCards: [card("10"), card("4")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 14 vs A" },
    { playerCards: [card("10"), card("5")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 15 vs A" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 16 vs A" },
    { playerCards: [card("10"), card("7")], dealerUpCard: card("A"), expected: "surrender", category: "ES Hard 17 vs A" },
    // Hard 8-11 vs Ace: NOT surrender (good hands to play)
    { playerCards: [card("6"), card("2")], dealerUpCard: card("A"), expected: "hit", category: "ES Hard 8 vs A - hit" },
    { playerCards: [card("6"), card("3")], dealerUpCard: card("A"), expected: "hit", category: "ES Hard 9 vs A - hit" },
    { playerCards: [card("8"), card("2")], dealerUpCard: card("A"), expected: "hit", category: "ES Hard 10 vs A - hit" },
    { playerCards: [card("9"), card("2")], dealerUpCard: card("A"), expected: "double", category: "ES Hard 11 vs A - double" },
  ];

  allDiscrepancies.push(
    ...runTestSuite("Early Surrender - Hard totals vs Ace", hardVsAceTestCases, EARLY_SURRENDER_RULES),
  );

  // =============================================
  // Hard totals with early surrender vs 10
  // =============================================
  const hardVs10TestCases: TestCase[] = [
    // Hard 14-16 vs 10: surrender
    { playerCards: [card("10"), card("4")], dealerUpCard: card("10"), expected: "surrender", category: "ES Hard 14 vs 10" },
    { playerCards: [card("10"), card("5")], dealerUpCard: card("10"), expected: "surrender", category: "ES Hard 15 vs 10" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("10"), expected: "surrender", category: "ES Hard 16 vs 10" },
    // Hard 12-13 vs 10: NOT surrender
    { playerCards: [card("10"), card("2")], dealerUpCard: card("10"), expected: "hit", category: "ES Hard 12 vs 10 - hit" },
    { playerCards: [card("10"), card("3")], dealerUpCard: card("10"), expected: "hit", category: "ES Hard 13 vs 10 - hit" },
    // Hard 17 vs 10: NOT surrender
    { playerCards: [card("10"), card("7")], dealerUpCard: card("10"), expected: "stand", category: "ES Hard 17 vs 10 - stand" },
  ];

  allDiscrepancies.push(
    ...runTestSuite("Early Surrender - Hard totals vs 10", hardVs10TestCases, EARLY_SURRENDER_RULES),
  );

  // =============================================
  // Pair hands with early surrender
  // =============================================
  const pairTestCases: TestCase[] = [
    // 8,8 vs 10 and Ace: surrender
    { playerCards: [card("8"), card("8")], dealerUpCard: card("10"), expected: "surrender", category: "ES Pair 8s vs 10" },
    { playerCards: [card("8"), card("8")], dealerUpCard: card("A"), expected: "surrender", category: "ES Pair 8s vs A" },
    // 8,8 vs 9: split (not surrender)
    { playerCards: [card("8"), card("8")], dealerUpCard: card("9"), expected: "split", category: "ES Pair 8s vs 9 - split" },
    // 7,7 vs 10 and Ace: surrender
    { playerCards: [card("7"), card("7")], dealerUpCard: card("10"), expected: "surrender", category: "ES Pair 7s vs 10" },
    { playerCards: [card("7"), card("7")], dealerUpCard: card("A"), expected: "surrender", category: "ES Pair 7s vs A" },
    // 6,6 vs Ace: surrender
    { playerCards: [card("6"), card("6")], dealerUpCard: card("A"), expected: "surrender", category: "ES Pair 6s vs A" },
    // 6,6 vs 10: NOT surrender (hit)
    { playerCards: [card("6"), card("6")], dealerUpCard: card("10"), expected: "hit", category: "ES Pair 6s vs 10 - hit" },
    // 3,3 vs Ace: surrender
    { playerCards: [card("3"), card("3")], dealerUpCard: card("A"), expected: "surrender", category: "ES Pair 3s vs A" },
    // 3,3 vs 10: NOT surrender
    { playerCards: [card("3"), card("3")], dealerUpCard: card("10"), expected: "hit", category: "ES Pair 3s vs 10 - hit" },
  ];

  allDiscrepancies.push(
    ...runTestSuite("Early Surrender - Pairs", pairTestCases, EARLY_SURRENDER_RULES),
  );

  // =============================================
  // Non-surrender dealer upcards (2-9 except 10/A)
  // Should behave like normal strategy (no surrender)
  // =============================================
  const nonSurrenderDealerTestCases: TestCase[] = [
    { playerCards: [card("10"), card("6")], dealerUpCard: card("9"), expected: "hit", category: "ES Hard 16 vs 9 - no surrender available" },
    { playerCards: [card("10"), card("5")], dealerUpCard: card("8"), expected: "hit", category: "ES Hard 15 vs 8 - hit" },
    { playerCards: [card("10"), card("4")], dealerUpCard: card("7"), expected: "hit", category: "ES Hard 14 vs 7 - hit" },
  ];

  allDiscrepancies.push(
    ...runTestSuite("Early Surrender - Non-surrender dealer upcards", nonSurrenderDealerTestCases, EARLY_SURRENDER_RULES),
  );

  // =============================================
  // Late surrender should NOT use early surrender rules
  // =============================================
  const lateSurrenderRules: HouseRules = {
    ...EARLY_SURRENDER_RULES,
    surrenderAllowed: "late",
  };

  const lateSurrenderTestCases: TestCase[] = [
    // With late surrender, hard 5 vs A should NOT surrender
    { playerCards: [card("3"), card("2")], dealerUpCard: card("A"), expected: "hit", category: "Late - Hard 5 vs A should hit" },
    // With late surrender, hard 14 vs 10 should NOT surrender (only 15-16 surrender vs 10)
    { playerCards: [card("10"), card("4")], dealerUpCard: card("10"), expected: "hit", category: "Late - Hard 14 vs 10 should hit" },
    // 8,8 vs 10 should split, not surrender (late surrender)
    { playerCards: [card("8"), card("8")], dealerUpCard: card("10"), expected: "split", category: "Late - 8,8 vs 10 should split" },
  ];

  allDiscrepancies.push(
    ...runTestSuite("Late Surrender - Should NOT use early surrender rules", lateSurrenderTestCases, lateSurrenderRules),
  );

  return allDiscrepancies;
}

// =============================================
// Continue EV tests
// =============================================
function runContinueEVTests(): string[] {
  const discrepancies: string[] = [];
  console.log("Testing Continue EV calculations:\n");

  // Test 1: continueEV should be present when includeContinueAction is true
  {
    const playerHand = createHand([card("10"), card("6")]);
    const dealerHand = createHand([card("A"), card("5")]);
    const resultsWithContinue = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, true);
    const continueAction = resultsWithContinue.find(a => a.action === "continue");
    if (!continueAction) {
      discrepancies.push("Continue action missing when includeContinueAction=true");
    } else if (!continueAction.isAvailable) {
      discrepancies.push("Continue action should always be available");
    }
  }

  // Test 2: continueEV should NOT be present when includeContinueAction is false
  {
    const playerHand = createHand([card("10"), card("6")]);
    const dealerHand = createHand([card("A"), card("5")]);
    const resultsWithoutContinue = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, false);
    const continueAction = resultsWithoutContinue.find(a => a.action === "continue");
    if (continueAction) {
      discrepancies.push("Continue action should not be present when includeContinueAction=false");
    }
  }

  // Test 3: surrender EV is always -0.5
  {
    const playerHand = createHand([card("10"), card("6")]);
    const dealerHand = createHand([card("A"), card("5")]);
    const results = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, true);
    const surrenderAction = results.find(a => a.action === "surrender");
    if (!surrenderAction || Math.abs(surrenderAction.ev - (-0.5)) > 0.001) {
      discrepancies.push(`Surrender EV should be -0.5, got ${surrenderAction?.ev}`);
    }
  }

  // Test 4: For a hand that should surrender (hard 16 vs A with early surrender),
  // continueEV should be worse than surrender EV (-0.5)
  {
    const playerHand = createHand([card("10"), card("6")]);
    const dealerHand = createHand([card("A"), card("5")]);
    const results = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, true);
    const continueAction = results.find(a => a.action === "continue");
    const surrenderAction = results.find(a => a.action === "surrender");
    if (continueAction && surrenderAction && continueAction.ev >= surrenderAction.ev) {
      discrepancies.push(
        `Hard 16 vs A: continueEV (${continueAction.ev.toFixed(4)}) should be < surrenderEV (${surrenderAction.ev.toFixed(4)}) for early surrender`,
      );
    }
  }

  // Test 5: For a hand that should NOT surrender (hard 11 vs A with early surrender),
  // continueEV should be better than surrender EV (-0.5)
  {
    const playerHand = createHand([card("9"), card("2")]);
    const dealerHand = createHand([card("A"), card("5")]);
    const results = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, true);
    const continueAction = results.find(a => a.action === "continue");
    const surrenderAction = results.find(a => a.action === "surrender");
    if (continueAction && surrenderAction && continueAction.ev <= surrenderAction.ev) {
      discrepancies.push(
        `Hard 11 vs A: continueEV (${continueAction.ev.toFixed(4)}) should be > surrenderEV (${surrenderAction.ev.toFixed(4)})`,
      );
    }
  }

  // Test 6: continueEV should account for dealer BJ probability
  // For a peek game vs Ace, continueEV should be lower than the best conditioned
  // sub-action EV because it includes the probability of losing to dealer BJ.
  {
    const playerHand = createHand([card("10"), card("7")]);
    const dealerHand = createHand([card("A"), card("5")]);
    const results = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, true);

    const continueAction = results.find(a => a.action === "continue");
    const standAction = results.find(a => a.action === "stand");

    // For hard 17 vs A, stand is the best play. The conditioned standEV (given no dealer BJ)
    // should be higher than continueEV, because continueEV mixes in the -1 for dealer BJ.
    if (continueAction && standAction && continueAction.ev >= standAction.ev) {
      discrepancies.push(
        `Hard 17 vs A: continueEV (${continueAction.ev.toFixed(4)}) should be < conditioned standEV (${standAction.ev.toFixed(4)}) due to dealer BJ risk`,
      );
    }
  }

  // Test 7: For a non-10/A dealer upcard, continueEV should equal the best sub-action EV
  // (no dealer BJ adjustment needed)
  {
    const playerHand = createHand([card("10"), card("6")]);
    const dealerHand = createHand([card("9"), card("5")]);
    const results = computeActionEVs(playerHand, dealerHand, EARLY_SURRENDER_RULES, true);

    const continueAction = results.find(a => a.action === "continue");
    const availableActions = results.filter(a => a.action !== "continue" && a.action !== "surrender" && a.isAvailable);
    const bestEV = Math.max(...availableActions.map(a => a.ev));

    if (continueAction && Math.abs(continueAction.ev - bestEV) > 0.0001) {
      discrepancies.push(
        `Hard 16 vs 9: continueEV (${continueAction.ev.toFixed(4)}) should equal best sub-action EV (${bestEV.toFixed(4)}) with no BJ risk`,
      );
    }
  }

  return discrepancies;
}

// =============================================
// Run all tests
// =============================================
const allDiscrepancies: string[] = [];

allDiscrepancies.push(...runEarlySurrenderTests());
allDiscrepancies.push(...runContinueEVTests());

if (allDiscrepancies.length === 0) {
  console.log("\nAll early surrender tests passed!");
} else {
  console.log(`\nFound ${allDiscrepancies.length} discrepancies:\n`);
  allDiscrepancies.forEach((d, i) => console.log(`${i + 1}. ${d}`));
  process.exit(1);
}

export {};
