import { describe, expect, it } from "vitest";
import { computeAvailableActionEVs } from "@/app/lib/ev-utils";
import { generateStrategyTable } from "@/app/lib/ev-calculator";
import { createEmptyHand } from "@/app/lib/game";
import { DEFAULT_HOUSE_RULES, type Card, type Hand, type HouseRules } from "@/app/lib/types";

function card(rank: string, suit: string = "hearts"): Card {
  return { rank: rank as Card["rank"], suit: suit as Card["suit"] };
}

function createHand(cards: Card[], overrides: Partial<Hand> = {}): Hand {
  return {
    ...createEmptyHand(),
    cards,
    ...overrides,
  };
}

const TWO_DECK_H17_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  decks: 2,
  hitSoft17: true,
  doubleAfterSplit: true,
  doubleRestriction: "any",
  surrenderAllowed: "none",
  noHoleCard: false,
};

describe("computeAvailableActionEVs", () => {
  it("uses strategy table EVs for hard 11 vs Ace in a peek game", () => {
    const playerHand = createHand([card("6"), card("5")]);
    const dealerHand = createHand([card("A"), card("9")]);

    const table = generateStrategyTable(TWO_DECK_H17_RULES);
    const hardEntry = table.hard.get(11)?.get(11);
    expect(hardEntry?.action).toBe("D");
    expect(hardEntry?.evs?.double).toBeDefined();

    const actionEvs = computeAvailableActionEVs(playerHand, dealerHand, TWO_DECK_H17_RULES, table);
    const hitEV = actionEvs.find((a) => a.action === "hit")?.ev;
    const doubleEV = actionEvs.find((a) => a.action === "double")?.ev;

    expect(doubleEV).toBeCloseTo(hardEntry!.evs!.double!, 10);
    expect(hitEV).toBeCloseTo(hardEntry!.evs!.hit, 10);
    expect(doubleEV).toBeGreaterThan(hitEV!);
  });
});
