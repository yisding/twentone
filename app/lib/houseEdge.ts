import { HouseRules } from "./types";

export function calculateHouseEdge(rules: HouseRules): number {
  let edge = 0.43;

  const deckAdjustments: Record<number, number> = {
    1: -0.48,
    2: -0.20,
    4: -0.06,
    6: 0,
    8: 0.03,
  };
  
  if (deckAdjustments[rules.decks] !== undefined) {
    edge += deckAdjustments[rules.decks];
  } else if (rules.decks < 6) {
    edge += -0.20 + (6 - rules.decks) * 0.05;
  } else if (rules.decks > 6) {
    edge += 0.03 + (rules.decks - 8) * 0.01;
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

  if (!rules.doubleOnAnyTwo) {
    edge += 0.18;
  }

  if (rules.surrenderAllowed === "none") {
    edge += 0.08;
  } else if (rules.surrenderAllowed === "early") {
    edge -= 0.63;
  }

  if (rules.resplitAces) {
    edge -= 0.08;
  }

  if (rules.noHoleCard) {
    edge += 0.11;
  }

  return Math.max(0, edge);
}

export function formatHouseEdge(edge: number): string {
  return `${edge.toFixed(2)}%`;
}
