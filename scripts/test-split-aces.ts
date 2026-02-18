import { getAvailableActions, playerSplit, initGame, getHandResult } from "../app/lib/game";
import { HouseRules, DEFAULT_HOUSE_RULES, GameState, Card, Hand } from "../app/lib/types";

const baseRules: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  surrenderAllowed: "late",
};

function card(suit: Card["suit"], rank: Card["rank"]): Card {
  return { suit, rank };
}

function hand(cards: Card[], overrides: Partial<Hand> = {}): Hand {
  return {
    cards,
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name}`);
  }
}

console.log("\n=== Testing Split Aces Logic ===\n");

// Test 1: After splitting aces, only stand and split (if another ace) are available
console.log("--- Available actions after splitting aces ---");

let game = initGame(baseRules);
// Manually set up a split aces scenario
game = {
  ...game,
  playerHands: [hand([card("hearts", "A"), card("hearts", "10")], { isSplit: true, isSplitAces: true })],
  currentHandIndex: 0,
};

let actions = getAvailableActions(game, baseRules);
test("Split Aces + 10: only stand available (no resplit)", 
  actions.length === 1 && actions[0] === "stand");

// Test 2: Resplit aces when another ace is dealt
const resplitRules: HouseRules = { ...baseRules, resplitAces: true };
game = {
  ...game,
  playerHands: [hand([card("hearts", "A"), card("spades", "A")], { isSplit: true, isSplitAces: true })],
  currentHandIndex: 0,
};

actions = getAvailableActions(game, resplitRules);
test("Split Aces + Ace with resplitAces=true: stand and split available", 
  actions.includes("stand") && actions.includes("split"));

actions = getAvailableActions(game, baseRules); // no resplit
test("Split Aces + Ace with resplitAces=false: only stand available", 
  actions.length === 1 && actions[0] === "stand");

// Test 3: Cannot hit after splitting aces
test("Split Aces + 10: hit is NOT available", 
  !actions.includes("hit"));

// Test 4: Cannot double after splitting aces
test("Split Aces + 10: double is NOT available", 
  !actions.includes("double"));

// Test 5: Non-split-aces hand still has all actions
game = {
  ...game,
  playerHands: [hand([card("hearts", "A"), card("hearts", "7")], { isSplit: true, isSplitAces: false })],
  currentHandIndex: 0,
};

actions = getAvailableActions(game, baseRules);
test("Non-aces split hand: hit and stand available", 
  actions.includes("hit") && actions.includes("stand"));

console.log("\n--- Blackjack pays 1:1 after split ---");

// Test 6: Blackjack after split aces is treated as regular 21, not 3:2 blackjack
const splitAcesBlackjack = hand([card("hearts", "A"), card("hearts", "K")], { isSplit: true, isSplitAces: true });

const dealerHand = hand([card("spades", "10"), card("spades", "9")]);

const result = getHandResult(splitAcesBlackjack, dealerHand);
test("Split Aces + 10 vs dealer 19 = win (not blackjack)", 
  result === "win");

// Test 7: Natural blackjack still pays 3:2
const naturalBlackjack = hand([card("hearts", "A"), card("hearts", "K")]);

const naturalResult = getHandResult(naturalBlackjack, dealerHand);
test("Natural blackjack vs dealer 19 = blackjack (3:2 payout)", 
  naturalResult === "blackjack");

console.log("\n--- playerSplit sets isSplitAces correctly ---");

// Test 8: Splitting aces sets isSplitAces to true
const gameWithAces = initGame(baseRules);
gameWithAces.playerHands[0] = hand([card("hearts", "A"), card("spades", "A")]);

const afterSplit = playerSplit(gameWithAces);
test("After splitting aces: first hand has isSplitAces=true", 
  afterSplit.playerHands[0].isSplitAces === true);
test("After splitting aces: second hand has isSplitAces=true", 
  afterSplit.playerHands[1].isSplitAces === true);
test("After splitting aces: both hands have isSplit=true", 
  afterSplit.playerHands[0].isSplit === true && afterSplit.playerHands[1].isSplit === true);

// Test 9: Splitting non-aces does NOT set isSplitAces
const gameWithKings = initGame(baseRules);
gameWithKings.playerHands[0] = hand([card("hearts", "K"), card("spades", "K")]);

const afterKingsSplit = playerSplit(gameWithKings);
test("After splitting kings: first hand has isSplitAces=false", 
  afterKingsSplit.playerHands[0].isSplitAces === false);
test("After splitting kings: second hand has isSplitAces=false", 
  afterKingsSplit.playerHands[1].isSplitAces === false);

console.log("\n--- Max split hands limit ---");

// Test 10: Cannot resplit aces if already at max hands
const maxSplitRules: HouseRules = { ...resplitRules, maxSplitHands: 2 };
const gameAtMax: GameState = {
  ...game,
  playerHands: [
    hand([card("hearts", "A"), card("spades", "A")], { isSplit: true, isSplitAces: true }),
    hand([card("diamonds", "A"), card("clubs", "5")], { isSplit: true, isSplitAces: true }),
  ],
  currentHandIndex: 0,
};

actions = getAvailableActions(gameAtMax, maxSplitRules);
test("At max split hands: cannot split even with resplitAces", 
  !actions.includes("split") && actions.includes("stand"));

console.log("\n========================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
