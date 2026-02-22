import { describe, expect, it } from "vitest";
import { computeActionEVs } from "@/app/lib/ev-utils";
import { createEmptyHand } from "@/app/lib/game";
import { DEFAULT_HOUSE_RULES, type Card, type Hand, type HouseRules } from "@/app/lib/types";

function createHand(cards: Card[], overrides: Partial<Hand> = {}): Hand {
  return { ...createEmptyHand(), cards, ...overrides };
}

function card(rank: string, suit: string = "hearts"): Card {
  return { rank: rank as Card["rank"], suit: suit as Card["suit"] };
}

function actionEV(results: ReturnType<typeof computeActionEVs>, action: string): number {
  const value = results.find((a: { action: string; ev: number }) => a.action === action)?.ev;
  if (value === undefined) {
    throw new Error(`Action ${action} not found in result set`);
  }
  return value;
}

const EARLY_SURRENDER_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  decks: 6,
  hitSoft17: false,
  surrenderAllowed: "early",
  doubleAfterSplit: true,
  doubleRestriction: "any",
};

describe("early surrender EV behavior", () => {
  it("includes continue action when requested", () => {
    const results = computeActionEVs(createHand([card("10"), card("6")]), createHand([card("A"), card("5")]), EARLY_SURRENDER_RULES, true);
    const continueAction = results.find((a: { action: string }) => a.action === "continue");

    expect(continueAction).toBeDefined();
    expect(continueAction?.isAvailable).toBe(true);
  });

  it("omits continue action when disabled", () => {
    const results = computeActionEVs(createHand([card("10"), card("6")]), createHand([card("A"), card("5")]), EARLY_SURRENDER_RULES, false);
    expect(results.find((a: { action: string }) => a.action === "continue")).toBeUndefined();
  });

  it("keeps surrender EV at -0.5", () => {
    const results = computeActionEVs(createHand([card("10"), card("6")]), createHand([card("A"), card("5")]), EARLY_SURRENDER_RULES, true);
    expect(actionEV(results, "surrender")).toBeCloseTo(-0.5, 3);
  });

  it("makes hard 16 vs A favor surrender over continue", () => {
    const results = computeActionEVs(createHand([card("10"), card("6")]), createHand([card("A"), card("5")]), EARLY_SURRENDER_RULES, true);
    expect(actionEV(results, "continue")).toBeLessThan(actionEV(results, "surrender"));
  });

  it("makes hard 11 vs A favor continue over surrender", () => {
    const results = computeActionEVs(createHand([card("9"), card("2")]), createHand([card("A"), card("5")]), EARLY_SURRENDER_RULES, true);
    expect(actionEV(results, "continue")).toBeGreaterThan(actionEV(results, "surrender"));
  });

  it("applies dealer BJ risk to continue EV against Ace", () => {
    const results = computeActionEVs(createHand([card("10"), card("7")]), createHand([card("A"), card("5")]), EARLY_SURRENDER_RULES, true);
    expect(actionEV(results, "continue")).toBeLessThan(actionEV(results, "stand"));
  });

  it("applies dealer BJ risk to continue EV against ten-value upcard", () => {
    const results = computeActionEVs(createHand([card("10"), card("6")]), createHand([card("10"), card("5")]), EARLY_SURRENDER_RULES, true);
    expect(actionEV(results, "continue")).toBeLessThanOrEqual(actionEV(results, "hit"));
  });

  it("matches best sub-action EV for non-10/A dealer upcard", () => {
    const results = computeActionEVs(createHand([card("10"), card("6")]), createHand([card("9"), card("5")]), EARLY_SURRENDER_RULES, true);
    const bestSubActionEV = Math.max(
      ...results
        .filter((a: { action: string; isAvailable: boolean }) => a.action !== "continue" && a.action !== "surrender" && a.isAvailable)
        .map((a: { ev: number }) => a.ev),
    );

    expect(actionEV(results, "continue")).toBeCloseTo(bestSubActionEV, 4);
  });

  it("does not use early-surrender chart when rules are late-surrender", () => {
    const lateSurrenderRules: HouseRules = {
      ...EARLY_SURRENDER_RULES,
      surrenderAllowed: "late",
    };
    const results = computeActionEVs(createHand([card("3"), card("2")]), createHand([card("A"), card("5")]), lateSurrenderRules, true);
    expect(actionEV(results, "continue")).toBeGreaterThan(actionEV(results, "surrender"));
  });
});
