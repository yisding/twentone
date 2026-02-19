import { HouseRules } from "./types";

export function calculateHouseEdge(rules: HouseRules): number {
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

  if (deckAdjustments[rules.decks] !== undefined) {
    edge += deckAdjustments[rules.decks];
  } else if (rules.decks > 8) {
    edge += 0.01 * (rules.decks - 8);
  }

  if (rules.hitSoft17) {
    edge += 0.22;
  }

  if (rules.blackjackPays === "6:5") {
    edge += 1.39;
  } else if (rules.blackjackPays === "1:1") {
    edge += 2.27;
  }

  if (!rules.doubleAfterSplit) {
    edge += 0.14;
  }

  if (rules.doubleRestriction === "9-11") {
    edge += 0.09;
  } else if (rules.doubleRestriction === "10-11") {
    edge += 0.18;
  }

  if (rules.surrenderAllowed === "none") {
    edge += 0.07;
  } else if (rules.surrenderAllowed === "early") {
    edge -= 0.63;
  }

  if (rules.resplitAces) {
    edge -= 0.08;
  }

  if (rules.noHoleCard) {
    edge += 0.11;
  }

  if (rules.maxSplitHands === 3) {
    edge += 0.01;
  } else if (rules.maxSplitHands === 2) {
    edge += 0.02;
  }

  return edge;
}

export function formatHouseEdge(edge: number): string {
  return `${edge.toFixed(2)}%`;
}
