import { HouseRules } from "./types";
import { isEarlySurrender } from "./surrender";

function normalizeRules(rules: HouseRules): HouseRules {
  const normalizedDecks = Number.isFinite(rules.decks)
    ? Math.max(1, Math.round(rules.decks))
    : 1;

  const normalizedSplitHands =
    rules.maxSplitHands <= 2
      ? 2
      : rules.maxSplitHands >= 4
        ? 4
        : 3;

  let surrenderAllowed = rules.surrenderAllowed;
  if (rules.noHoleCard) {
    if (surrenderAllowed === "early") surrenderAllowed = "enhcAll";
    if (surrenderAllowed === "late") surrenderAllowed = "enhcNoAce";
  } else {
    if (surrenderAllowed === "enhcAll") surrenderAllowed = "early";
    if (surrenderAllowed === "enhcNoAce") surrenderAllowed = "late";
  }

  return {
    ...rules,
    decks: normalizedDecks,
    maxSplitHands: normalizedSplitHands,
    surrenderAllowed,
  };
}

export function calculateHouseEdge(rules: HouseRules): number {
  const normalizedRules = normalizeRules(rules);
  let edge = 0.43;

  const deckAdjustments: Record<number, number> = {
    1: -0.48,
    2: -0.19,
    3: -0.13,
    4: -0.06,
    5: -0.03,
    6: -0.02,
    7: -0.01,
    8: 0,
  };

  if (deckAdjustments[normalizedRules.decks] !== undefined) {
    edge += deckAdjustments[normalizedRules.decks];
  } else if (normalizedRules.decks > 8) {
    edge += 0.01 * (normalizedRules.decks - 8);
  }

  if (normalizedRules.hitSoft17) {
    edge += 0.22;
  }

  if (normalizedRules.blackjackPays === "6:5") {
    edge += 1.39;
  } else if (normalizedRules.blackjackPays === "1:1") {
    edge += 2.27;
  }

  if (!normalizedRules.doubleAfterSplit) {
    edge += 0.14;
  }

  if (normalizedRules.doubleRestriction === "9-11") {
    edge += 0.09;
  } else if (normalizedRules.doubleRestriction === "10-11") {
    edge += 0.18;
  }

  if (normalizedRules.surrenderAllowed === "none") {
    edge += 0.07;
  } else if (isEarlySurrender(normalizedRules)) {
    edge -= 0.63;
  } else if (normalizedRules.surrenderAllowed === "enhcNoAce") {
    edge -= 0.18;
  }

  if (normalizedRules.resplitAces) {
    edge -= 0.08;
  }

  if (normalizedRules.noHoleCard) {
    edge += 0.06;
  }

  if (normalizedRules.maxSplitHands === 3) {
    edge += 0.01;
  } else if (normalizedRules.maxSplitHands === 2) {
    edge += 0.02;
  }

  return edge;
}

export function formatHouseEdge(edge: number): string {
  return `${edge.toFixed(2)}%`;
}
