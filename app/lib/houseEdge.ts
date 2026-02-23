import { HouseRules } from "./types";
import { calculateEV } from "./ev-calculator";
import { getCalculationSurrenderAllowed } from "./surrender";

const houseEdgeCache = new Map<string, number>();

function getHouseEdgeCacheKey(rules: HouseRules): string {
  return JSON.stringify([
    rules.decks,
    rules.hitSoft17,
    rules.blackjackPays,
    rules.doubleAfterSplit,
    rules.doubleRestriction,
    getCalculationSurrenderAllowed(rules),
    rules.resplitAces,
    rules.noHoleCard,
    rules.maxSplitHands,
  ]);
}

export function calculateHouseEdge(rules: HouseRules): number {
  const cacheKey = getHouseEdgeCacheKey(rules);
  const cachedEdge = houseEdgeCache.get(cacheKey);
  if (cachedEdge !== undefined) {
    return cachedEdge;
  }

  const edge = calculateEV(rules).houseEdgePercent;
  houseEdgeCache.set(cacheKey, edge);
  return edge;
}

export function formatHouseEdge(edge: number): string {
  return `${edge.toFixed(2)}%`;
}
