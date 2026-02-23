import { describe, expect, it } from "vitest";
import { createEmptyHand, getHandResult } from "@/app/lib/game";
import { getBasicStrategyAction, getBestActionWithoutSurrender } from "@/app/lib/strategy";
import { DEFAULT_HOUSE_RULES, type Card, type Hand, type HouseRules } from "@/app/lib/types";

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

interface StrategyCase {
  name: string;
  playerCards: Card[];
  dealerUpCard: Card;
  expected: string;
  rules?: HouseRules;
  playerOverrides?: Partial<Hand>;
}

const strategyCases: StrategyCase[] = [
  { name: "surrenders 16 vs 10 in S17 late surrender", playerCards: [card("10"), card("6")], dealerUpCard: card("10"), expected: "surrender" },
  { name: "splits aces", playerCards: [card("A"), card("A")], dealerUpCard: card("10"), expected: "split" },
  { name: "stands on pair of tens", playerCards: [card("10"), card("10")], dealerUpCard: card("6"), expected: "stand" },
  { name: "doubles hard 11 vs 6", playerCards: [card("5"), card("6")], dealerUpCard: card("6"), expected: "double" },
  { name: "hits hard 16 vs 10 when surrender is disabled", playerCards: [card("10"), card("6")], dealerUpCard: card("10"), expected: "hit", rules: { ...S17_RULES, surrenderAllowed: "none" } },
  { name: "uses H17 rules for A,7 vs A", playerCards: [card("A"), card("7")], dealerUpCard: card("A"), expected: "hit", rules: H17_RULES },
  { name: "double 10-11 only: hard 9 vs 6 is hit", playerCards: [card("5"), card("4")], dealerUpCard: card("6"), expected: "hit", rules: { ...H17_RULES, doubleRestriction: "10-11" } },
  { name: "double 9-11 only: hard 9 vs 6 is double", playerCards: [card("5"), card("4")], dealerUpCard: card("6"), expected: "double", rules: { ...H17_RULES, doubleRestriction: "9-11" } },
  {
    name: "prevents surrender on split hands",
    playerCards: [card("10"), card("6")],
    dealerUpCard: card("10"),
    expected: "hit",
    rules: { ...S17_RULES, surrenderAllowed: "late" },
    playerOverrides: { isSplit: true },
  },
  {
    name: "prevents doubles after split when DAS is disabled",
    playerCards: [card("5"), card("5")],
    dealerUpCard: card("6"),
    expected: "hit",
    rules: { ...S17_RULES, doubleAfterSplit: false },
    playerOverrides: { isSplit: true },
  },
  {
    name: "ENHC all-upcard surrender allows 12 vs A surrender",
    playerCards: [card("10"), card("2")],
    dealerUpCard: card("A"),
    expected: "surrender",
    rules: { ...S17_RULES, noHoleCard: true, surrenderAllowed: "enhcAll" },
  },
];

describe("basic strategy actions", () => {
  it.each(strategyCases)("$name", ({ playerCards, dealerUpCard, expected, rules = S17_RULES, playerOverrides }: StrategyCase) => {
    const playerHand = createHand(playerCards, playerOverrides);
    const dealerHand = createHand([dealerUpCard, card("2")]);
    expect(getBasicStrategyAction(playerHand, dealerHand, rules)).toBe(expected);
  });

  it("uses fallback action when surrender is not allowed by ENHC ES10 restriction", () => {
    const fallbackRules: HouseRules = {
      ...S17_RULES,
      noHoleCard: true,
      surrenderAllowed: "es10",
      doubleRestriction: "any",
    };

    const playerHand = createHand([card("10"), card("6")]);
    const dealerHand = createHand([card("A"), card("9")]);

    expect(getBestActionWithoutSurrender(playerHand, dealerHand, fallbackRules)).toBe("hit");
  });

  it("scores split 21 as a normal win (not blackjack)", () => {
    const splitTwentyOne = createHand([card("K"), card("A")], { isSplit: true });
    const dealerNineteen = createHand([card("10"), card("9")]);
    expect(getHandResult(splitTwentyOne, dealerNineteen)).toBe("win");
  });
});
