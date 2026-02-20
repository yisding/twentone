import { getBasicStrategyAction } from "../app/lib/strategy";
import { Hand, HouseRules, DEFAULT_HOUSE_RULES, Card } from "../app/lib/types";
import { createEmptyHand } from "../app/lib/game";

function createHand(cards: Card[]): Hand {
  return {
    ...createEmptyHand(),
    cards,
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
}

const S17_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  decks: 6,
  hitSoft17: false,
  surrenderAllowed: "late",
  doubleAfterSplit: true,
  doubleRestriction: "any",
};

const H17_RULES: HouseRules = {
  ...S17_RULES,
  hitSoft17: true,
};

const NO_DAS_RULES: HouseRules = {
  ...S17_RULES,
  doubleAfterSplit: false,
};

const TWO_DECK_RULES: HouseRules = {
  ...S17_RULES,
  decks: 2,
};

const SIX_DECK_RULES: HouseRules = {
  ...S17_RULES,
  decks: 6,
};

const NO_SURRENDER_RULES: HouseRules = {
  ...S17_RULES,
  surrenderAllowed: "none",
};

function runTestSuite(
  name: string,
  testCases: TestCase[],
  rules: HouseRules,
): string[] {
  const discrepancies: string[] = [];
  console.log(`Testing ${name}:\n`);

  for (const tc of testCases) {
    const playerHand = createHand(tc.playerCards);
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

function runComparison() {
  const allDiscrepancies: string[] = [];

  // S17 tests
  const s17TestCases: TestCase[] = [
    // Surrender (dealer stands on soft 17)
    { playerCards: [card("10"), card("6")], dealerUpCard: card("9"), expected: "surrender", category: "Surrender - 16 vs 9 surrender (6D)" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("K"), expected: "surrender", category: "Surrender" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("A"), expected: "surrender", category: "Surrender" },
    { playerCards: [card("10"), card("5")], dealerUpCard: card("10"), expected: "surrender", category: "Surrender" },
    { playerCards: [card("8"), card("8")], dealerUpCard: card("9"), expected: "split", category: "Surrender - 8,8 is split not surrender" },

    // Split - Always
    { playerCards: [card("A"), card("A")], dealerUpCard: card("2"), expected: "split", category: "Split - Aces" },
    { playerCards: [card("A"), card("A")], dealerUpCard: card("10"), expected: "split", category: "Split - Aces" },
    { playerCards: [card("8"), card("8")], dealerUpCard: card("10"), expected: "split", category: "Split - 8s" },

    // Split - Never
    { playerCards: [card("10"), card("10")], dealerUpCard: card("6"), expected: "stand", category: "Split - 10s never split" },
    { playerCards: [card("5"), card("5")], dealerUpCard: card("6"), expected: "double", category: "Split - 5s never split, double" },

    // Split - 2s and 3s with DAS
    { playerCards: [card("2"), card("2")], dealerUpCard: card("2"), expected: "split", category: "Split - 2s vs 2 with DAS" },
    { playerCards: [card("2"), card("2")], dealerUpCard: card("3"), expected: "split", category: "Split - 2s vs 3 with DAS" },
    { playerCards: [card("2"), card("2")], dealerUpCard: card("4"), expected: "split", category: "Split - 2s vs 4" },
    { playerCards: [card("2"), card("2")], dealerUpCard: card("7"), expected: "split", category: "Split - 2s vs 7 split" },
    { playerCards: [card("3"), card("3")], dealerUpCard: card("2"), expected: "split", category: "Split - 3s vs 2 with DAS" },

    // Split - 4s with DAS
    { playerCards: [card("4"), card("4")], dealerUpCard: card("5"), expected: "split", category: "Split - 4s vs 5 with DAS" },
    { playerCards: [card("4"), card("4")], dealerUpCard: card("6"), expected: "split", category: "Split - 4s vs 6 with DAS" },
    { playerCards: [card("4"), card("4")], dealerUpCard: card("4"), expected: "hit", category: "Split - 4s vs 4 hit" },

    // Split - 6s with DAS
    { playerCards: [card("6"), card("6")], dealerUpCard: card("2"), expected: "split", category: "Split - 6s vs 2 with DAS" },
    { playerCards: [card("6"), card("6")], dealerUpCard: card("3"), expected: "split", category: "Split - 6s vs 3" },
    { playerCards: [card("6"), card("6")], dealerUpCard: card("7"), expected: "hit", category: "Split - 6s vs 7 hit" },

    // Split - 7s
    { playerCards: [card("7"), card("7")], dealerUpCard: card("2"), expected: "split", category: "Split - 7s vs 2" },
    { playerCards: [card("7"), card("7")], dealerUpCard: card("7"), expected: "split", category: "Split - 7s vs 7" },
    { playerCards: [card("7"), card("7")], dealerUpCard: card("8"), expected: "hit", category: "Split - 7s vs 8 hit" },

    // Split - 9s
    { playerCards: [card("9"), card("9")], dealerUpCard: card("2"), expected: "split", category: "Split - 9s vs 2" },
    { playerCards: [card("9"), card("9")], dealerUpCard: card("7"), expected: "stand", category: "Split - 9s vs 7 stand" },
    { playerCards: [card("9"), card("9")], dealerUpCard: card("10"), expected: "stand", category: "Split - 9s vs 10 stand" },
    { playerCards: [card("9"), card("9")], dealerUpCard: card("A"), expected: "stand", category: "Split - 9s vs A stand" },

    // Double - Hard
    { playerCards: [card("6"), card("3")], dealerUpCard: card("3"), expected: "double", category: "Double - Hard 9 vs 3" },
    { playerCards: [card("6"), card("3")], dealerUpCard: card("6"), expected: "double", category: "Double - Hard 9 vs 6" },
    { playerCards: [card("6"), card("3")], dealerUpCard: card("2"), expected: "hit", category: "Double - Hard 9 vs 2 hit" },
    { playerCards: [card("6"), card("3")], dealerUpCard: card("7"), expected: "hit", category: "Double - Hard 9 vs 7 hit" },
    { playerCards: [card("8"), card("2")], dealerUpCard: card("2"), expected: "double", category: "Double - Hard 10 vs 2" },
    { playerCards: [card("8"), card("2")], dealerUpCard: card("9"), expected: "double", category: "Double - Hard 10 vs 9" },
    { playerCards: [card("8"), card("2")], dealerUpCard: card("10"), expected: "hit", category: "Double - Hard 10 vs 10 hit" },
    { playerCards: [card("8"), card("2")], dealerUpCard: card("A"), expected: "hit", category: "Double - Hard 10 vs A hit" },
    { playerCards: [card("9"), card("2")], dealerUpCard: card("2"), expected: "double", category: "Double - Hard 11 vs 2" },
    { playerCards: [card("9"), card("2")], dealerUpCard: card("10"), expected: "double", category: "Double - Hard 11 vs 10" },
    { playerCards: [card("9"), card("2")], dealerUpCard: card("A"), expected: "hit", category: "Double - Hard 11 vs A hit (S17 6-deck)" },

    // Double - Soft
    { playerCards: [card("A"), card("2")], dealerUpCard: card("5"), expected: "double", category: "Double - Soft 13 vs 5" },
    { playerCards: [card("A"), card("2")], dealerUpCard: card("6"), expected: "double", category: "Double - Soft 13 vs 6" },
    { playerCards: [card("A"), card("3")], dealerUpCard: card("5"), expected: "double", category: "Double - Soft 14 vs 5" },
    { playerCards: [card("A"), card("4")], dealerUpCard: card("4"), expected: "double", category: "Double - Soft 15 vs 4" },
    { playerCards: [card("A"), card("5")], dealerUpCard: card("4"), expected: "double", category: "Double - Soft 16 vs 4" },
    { playerCards: [card("A"), card("6")], dealerUpCard: card("3"), expected: "double", category: "Double - Soft 17 vs 3" },
    { playerCards: [card("A"), card("6")], dealerUpCard: card("2"), expected: "hit", category: "Soft 17 vs 2 hit" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("3"), expected: "double", category: "Double - Soft 18 vs 3" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("6"), expected: "double", category: "Double - Soft 18 vs 6" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("7"), expected: "stand", category: "Soft 18 vs 7 stand" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("9"), expected: "hit", category: "Soft 18 vs 9 hit" },

    // Hit or Stand - Hard
    { playerCards: [card("10"), card("2")], dealerUpCard: card("2"), expected: "hit", category: "Hard 12 vs 2 hit" },
    { playerCards: [card("10"), card("2")], dealerUpCard: card("3"), expected: "hit", category: "Hard 12 vs 3 hit" },
    { playerCards: [card("10"), card("2")], dealerUpCard: card("4"), expected: "stand", category: "Hard 12 vs 4 stand" },
    { playerCards: [card("10"), card("2")], dealerUpCard: card("6"), expected: "stand", category: "Hard 12 vs 6 stand" },
    { playerCards: [card("10"), card("2")], dealerUpCard: card("7"), expected: "hit", category: "Hard 12 vs 7 hit" },
    { playerCards: [card("10"), card("3")], dealerUpCard: card("2"), expected: "stand", category: "Hard 13 vs 2 stand" },
    { playerCards: [card("10"), card("3")], dealerUpCard: card("7"), expected: "hit", category: "Hard 13 vs 7 hit" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("7"), expected: "hit", category: "Hard 16 vs 7 hit" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("10"), expected: "surrender", category: "Hard 16 vs 10 surrender" },
    { playerCards: [card("10"), card("7")], dealerUpCard: card("A"), expected: "stand", category: "Hard 17 vs A stand (S17)" },

    // Hit or Stand - Soft
    { playerCards: [card("A"), card("2")], dealerUpCard: card("2"), expected: "hit", category: "Soft 13 vs 2 hit" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("2"), expected: "stand", category: "Soft 18 vs 2 stand (S17)" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("A"), expected: "hit", category: "Soft 18 vs A hit" },
    { playerCards: [card("A"), card("8")], dealerUpCard: card("6"), expected: "stand", category: "Soft 19 vs 6 stand (S17)" },
  ];

  allDiscrepancies.push(...runTestSuite("S17 rules (Dealer stands on soft 17)", s17TestCases, S17_RULES));

  // H17 specific tests (expanded)
  const h17TestCases: TestCase[] = [
    { playerCards: [card("9"), card("2")], dealerUpCard: card("A"), expected: "double", category: "H17 - Hard 11 vs A double" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("2"), expected: "double", category: "H17 - Soft 18 vs 2 double" },
    { playerCards: [card("A"), card("8")], dealerUpCard: card("6"), expected: "double", category: "H17 - Soft 19 vs 6 double" },
    { playerCards: [card("10"), card("5")], dealerUpCard: card("A"), expected: "surrender", category: "H17 - 15 vs A surrender" },
    { playerCards: [card("8"), card("8")], dealerUpCard: card("A"), expected: "surrender", category: "H17 - 8,8 vs A surrender" },
    { playerCards: [card("10"), card("7")], dealerUpCard: card("A"), expected: "surrender", category: "H17 - 17 vs A surrender" },
    // Additional H17 tests
    { playerCards: [card("10"), card("6")], dealerUpCard: card("A"), expected: "surrender", category: "H17 - 16 vs A surrender" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("9"), expected: "surrender", category: "H17 - 16 vs 9 surrender" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("8"), expected: "stand", category: "H17 - Soft 18 vs 8 stand" },
    { playerCards: [card("A"), card("7")], dealerUpCard: card("9"), expected: "hit", category: "H17 - Soft 18 vs 9 hit" },
    { playerCards: [card("A"), card("6")], dealerUpCard: card("3"), expected: "double", category: "H17 - Soft 17 vs 3 double" },
    { playerCards: [card("A"), card("6")], dealerUpCard: card("6"), expected: "double", category: "H17 - Soft 17 vs 6 double" },
    { playerCards: [card("A"), card("6")], dealerUpCard: card("2"), expected: "hit", category: "H17 - Soft 17 vs 2 hit" },
  ];

  allDiscrepancies.push(...runTestSuite("H17 rules (Dealer hits on soft 17)", h17TestCases, H17_RULES));

  // No DAS tests
  const noDasTestCases: TestCase[] = [
    { playerCards: [card("2"), card("2")], dealerUpCard: card("2"), expected: "hit", category: "No DAS - 2s vs 2 hit" },
    { playerCards: [card("2"), card("2")], dealerUpCard: card("4"), expected: "split", category: "No DAS - 2s vs 4 split" },
    { playerCards: [card("4"), card("4")], dealerUpCard: card("5"), expected: "hit", category: "No DAS - 4s vs 5 hit" },
    { playerCards: [card("6"), card("6")], dealerUpCard: card("2"), expected: "hit", category: "No DAS - 6s vs 2 hit" },
    { playerCards: [card("6"), card("6")], dealerUpCard: card("3"), expected: "split", category: "No DAS - 6s vs 3 split" },
    { playerCards: [card("3"), card("3")], dealerUpCard: card("2"), expected: "hit", category: "No DAS - 3s vs 2 hit" },
    { playerCards: [card("3"), card("3")], dealerUpCard: card("4"), expected: "split", category: "No DAS - 3s vs 4 split" },
  ];

  allDiscrepancies.push(...runTestSuite("No DAS rules", noDasTestCases, NO_DAS_RULES));

  // 2-deck specific tests
  const twoDeckTestCases: TestCase[] = [
    { playerCards: [card("9"), card("2")], dealerUpCard: card("A"), expected: "double", category: "2-Deck - Hard 11 vs A double" },
    { playerCards: [card("7"), card("7")], dealerUpCard: card("8"), expected: "split", category: "2-Deck - 7,7 vs 8 split" },
  ];

  allDiscrepancies.push(...runTestSuite("2-deck specific rules", twoDeckTestCases, TWO_DECK_RULES));

  // 6-deck specific tests
  const sixDeckTestCases: TestCase[] = [
    { playerCards: [card("9"), card("2")], dealerUpCard: card("A"), expected: "hit", category: "6-Deck - Hard 11 vs A hit" },
    { playerCards: [card("7"), card("7")], dealerUpCard: card("8"), expected: "hit", category: "6-Deck - 7,7 vs 8 hit" },
  ];

  allDiscrepancies.push(...runTestSuite("6-deck specific rules", sixDeckTestCases, SIX_DECK_RULES));

  // No surrender fallback tests
  const noSurrenderTestCases: TestCase[] = [
    { playerCards: [card("10"), card("6")], dealerUpCard: card("10"), expected: "hit", category: "No Surr - 16 vs 10 hit" },
    { playerCards: [card("10"), card("5")], dealerUpCard: card("10"), expected: "hit", category: "No Surr - 15 vs 10 hit" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("9"), expected: "hit", category: "No Surr - 16 vs 9 hit" },
    { playerCards: [card("10"), card("6")], dealerUpCard: card("A"), expected: "hit", category: "No Surr - 16 vs A hit" },
  ];

  allDiscrepancies.push(...runTestSuite("No surrender rules", noSurrenderTestCases, NO_SURRENDER_RULES));

  return allDiscrepancies;
}

const discrepancies = runComparison();

if (discrepancies.length === 0) {
  console.log("\nAll tests passed! Strategy matches Wizard of Odds.");
} else {
  console.log(`\nFound ${discrepancies.length} discrepancies:\n`);
  discrepancies.forEach((d, i) => console.log(`${i + 1}. ${d}`));
  process.exit(1);
}

export {};
