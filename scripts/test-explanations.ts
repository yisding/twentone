import { getBasicStrategyAction, getStrategyExplanation } from "../app/lib/strategy";
import { HouseRules, Card, Hand } from "../app/lib/types";

const baseRules: HouseRules = {
  hitSoft17: false,
  surrenderAllowed: "late",
  doubleAfterSplit: true,
  doubleRestriction: "any",
  resplitAces: false,
  blackjackPays: "3:2",
  decks: 6,
  noHoleCard: false,
  maxSplitHands: 4,
};

function createHand(cards: Card[]): Hand {
  return {
    cards,
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
}

function createCard(rank: string): Card {
  return { suit: "hearts", rank: rank as Card["rank"] };
}

function createDealerHand(upCardValue: number): Hand {
  const rankMap: Record<number, Card["rank"]> = {
    2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "A"
  };
  return createHand([
    { suit: "spades", rank: rankMap[upCardValue] },
    { suit: "spades", rank: "2" },
  ]);
}

let passed = 0;
let failed = 0;

function test(name: string, rules: HouseRules, playerCards: Card[], dealerUpCard: number, expectedAction: string) {
  const playerHand = createHand(playerCards);
  const dealerHand = createDealerHand(dealerUpCard);
  const action = getBasicStrategyAction(playerHand, dealerHand, rules);
  if (action === expectedAction) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name}`);
    console.log(`  Expected: ${expectedAction}, Got: ${action}`);
  }
}

console.log("\n=== Testing Pair 6s with DAS rules ===");
test("Pair 6s vs 2 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("6"), createCard("6")], 2, "split");
test("Pair 6s vs 2 without DAS = hit", { ...baseRules, doubleAfterSplit: false }, [createCard("6"), createCard("6")], 2, "hit");
test("Pair 6s vs 3 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("6"), createCard("6")], 3, "split");
test("Pair 6s vs 3 without DAS = split", { ...baseRules, doubleAfterSplit: false }, [createCard("6"), createCard("6")], 3, "split");

console.log("\n=== Testing Pair 4s with DAS rules ===");
test("Pair 4s vs 5 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("4"), createCard("4")], 5, "split");
test("Pair 4s vs 5 without DAS = hit", { ...baseRules, doubleAfterSplit: false }, [createCard("4"), createCard("4")], 5, "hit");
test("Pair 4s vs 6 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("4"), createCard("4")], 6, "split");
test("Pair 4s vs 6 without DAS = hit", { ...baseRules, doubleAfterSplit: false }, [createCard("4"), createCard("4")], 6, "hit");

console.log("\n=== Testing Pair 2s/3s with DAS rules ===");
test("Pair 2s vs 2 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("2"), createCard("2")], 2, "split");
test("Pair 2s vs 2 without DAS = hit", { ...baseRules, doubleAfterSplit: false }, [createCard("2"), createCard("2")], 2, "hit");
test("Pair 2s vs 3 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("2"), createCard("2")], 3, "split");
test("Pair 2s vs 3 without DAS = hit", { ...baseRules, doubleAfterSplit: false }, [createCard("2"), createCard("2")], 3, "hit");
test("Pair 2s vs 4 with DAS = split", { ...baseRules, doubleAfterSplit: true }, [createCard("2"), createCard("2")], 4, "split");
test("Pair 2s vs 4 without DAS = split", { ...baseRules, doubleAfterSplit: false }, [createCard("2"), createCard("2")], 4, "split");

console.log("\n=== Testing Soft 19 vs 6 with H17 ===");
test("Soft 19 vs 6 with H17 = double", { ...baseRules, hitSoft17: true }, [createCard("A"), createCard("8")], 6, "double");
test("Soft 19 vs 6 with S17 = stand", { ...baseRules, hitSoft17: false }, [createCard("A"), createCard("8")], 6, "stand");

console.log("\n=== Testing Soft 18 vs 2 with H17 ===");
test("Soft 18 vs 2 with H17 = double", { ...baseRules, hitSoft17: true }, [createCard("A"), createCard("7")], 2, "double");
test("Soft 18 vs 2 with S17 = stand", { ...baseRules, hitSoft17: false }, [createCard("A"), createCard("7")], 2, "stand");

console.log("\n=== Testing Hard 16 surrender vs 9 with H17 ===");
test("Hard 16 vs 9 with H17 + surrender = surrender", { ...baseRules, hitSoft17: true, surrenderAllowed: "late" }, [createCard("10"), createCard("6")], 9, "surrender");
test("Hard 16 vs 9 with S17 + surrender = hit", { ...baseRules, hitSoft17: false, surrenderAllowed: "late" }, [createCard("10"), createCard("6")], 9, "hit");
test("Hard 16 vs 10 with H17 + surrender = surrender", { ...baseRules, hitSoft17: true, surrenderAllowed: "late" }, [createCard("10"), createCard("6")], 10, "surrender");
test("Hard 16 vs A with H17 + surrender = surrender", { ...baseRules, hitSoft17: true, surrenderAllowed: "late" }, [createCard("10"), createCard("6")], 11, "surrender");

console.log("\n=== Testing Hard 15 vs Ace with H17 ===");
test("Hard 15 vs A with H17 + surrender = surrender", { ...baseRules, hitSoft17: true, surrenderAllowed: "late" }, [createCard("10"), createCard("5")], 11, "surrender");
test("Hard 15 vs A with S17 + surrender = hit", { ...baseRules, hitSoft17: false, surrenderAllowed: "late" }, [createCard("10"), createCard("5")], 11, "hit");

console.log("\n=== Testing Hard 17 vs Ace with H17 ===");
test("Hard 17 vs A with H17 + surrender = surrender", { ...baseRules, hitSoft17: true, surrenderAllowed: "late" }, [createCard("10"), createCard("7")], 11, "surrender");
test("Hard 17 vs A with S17 + surrender = stand", { ...baseRules, hitSoft17: false, surrenderAllowed: "late" }, [createCard("10"), createCard("7")], 11, "stand");

console.log("\n=== Testing Hard 11 vs Ace ===");
test("Hard 11 vs A with H17 (6 deck) = double", { ...baseRules, hitSoft17: true, decks: 6 }, [createCard("6"), createCard("5")], 11, "double");
test("Hard 11 vs A with S17 (6 deck) = hit", { ...baseRules, hitSoft17: false, decks: 6 }, [createCard("6"), createCard("5")], 11, "hit");
test("Hard 11 vs A with S17 (1 deck) = double", { ...baseRules, hitSoft17: false, decks: 1 }, [createCard("6"), createCard("5")], 11, "double");
test("Hard 11 vs A with S17 (2 deck) = double", { ...baseRules, hitSoft17: false, decks: 2 }, [createCard("6"), createCard("5")], 11, "double");

console.log("\n=== Testing explanation notes ===");

let explanationTests = 0;
let explanationPassed = 0;

function testExplanation(name: string, rules: HouseRules, playerCards: Card[], dealerUpCard: number, expectedNote: string, shouldContain: boolean = true) {
  explanationTests++;
  const playerHand = createHand(playerCards);
  const dealerHand = createDealerHand(dealerUpCard);
  const action = getBasicStrategyAction(playerHand, dealerHand, rules);
  const explanation = getStrategyExplanation(playerHand, dealerUpCard, action, rules);
  
  const contains = explanation.includes(expectedNote);
  const testPassed = shouldContain ? contains : !contains;
  
  if (testPassed) {
    explanationPassed++;
    console.log(`✓ ${name}`);
  } else {
    console.log(`✗ ${name}`);
    console.log(`  Expected note ${shouldContain ? 'to contain' : 'to NOT contain'}: "${expectedNote}"`);
    console.log(`  Got: "${explanation}"`);
  }
}

console.log("\n--- Pair 6s DAS notes ---");
testExplanation(
  "Pair 6s vs 2 with DAS should NOT mention 'Note:'",
  { ...baseRules, doubleAfterSplit: true },
  [createCard("6"), createCard("6")], 2,
  "Note:",
  false
);
testExplanation(
  "Pair 6s vs 2 without DAS should have DAS note",
  { ...baseRules, doubleAfterSplit: false },
  [createCard("6"), createCard("6")], 2,
  "With DAS",
  true
);

console.log("\n--- Pair 4s DAS notes ---");
testExplanation(
  "Pair 4s vs 5 with DAS should NOT have 'Note:'",
  { ...baseRules, doubleAfterSplit: true },
  [createCard("4"), createCard("4")], 5,
  "Note:",
  false
);
testExplanation(
  "Pair 4s vs 5 without DAS should have DAS note",
  { ...baseRules, doubleAfterSplit: false },
  [createCard("4"), createCard("4")], 5,
  "With DAS",
  true
);

console.log("\n--- Soft 19 vs 6 H17 note ---");
testExplanation(
  "Soft 19 vs 6 with S17 (stand) should have H17 note",
  { ...baseRules, hitSoft17: false },
  [createCard("A"), createCard("8")], 6,
  "H17",
  true
);
testExplanation(
  "Soft 19 vs 6 with H17 (double) should have H17 note",
  { ...baseRules, hitSoft17: true },
  [createCard("A"), createCard("8")], 6,
  "H17",
  true
);

console.log("\n--- Hard 16 vs 9 S17 note ---");
testExplanation(
  "Hard 16 vs 9 with S17 (hit) should have H17 surrender note",
  { ...baseRules, hitSoft17: false, surrenderAllowed: "late" },
  [createCard("10"), createCard("6")], 9,
  "H17",
  true
);

console.log("\n--- Hard 15 vs Ace H17 note ---");
testExplanation(
  "Hard 15 vs A with H17 (surrender) should have H17 note",
  { ...baseRules, hitSoft17: true, surrenderAllowed: "late" },
  [createCard("10"), createCard("5")], 11,
  "H17",
  true
);

console.log("\n--- Hard 11 vs Ace deck note ---");
testExplanation(
  "Hard 11 vs A with S17 6-deck (hit) should have deck note",
  { ...baseRules, hitSoft17: false, decks: 6 },
  [createCard("6"), createCard("5")], 11,
  "single/double deck",
  true
);

console.log("\n========================================");
console.log(`Strategy tests: ${passed} passed, ${failed} failed`);
console.log(`Explanation tests: ${explanationPassed}/${explanationTests} passed`);
const totalPassed = passed + explanationPassed;
const totalFailed = failed + (explanationTests - explanationPassed);
console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
if (failed > 0 || explanationPassed < explanationTests) {
  process.exit(1);
}
