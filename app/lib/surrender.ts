import { getCardValue, getDealerUpCard } from "./deck";
import { Hand, HouseRules } from "./types";

export function isEarlySurrender(rules: HouseRules): boolean {
  return (
    rules.surrenderAllowed === "early" ||
    rules.surrenderAllowed === "enhcAll" ||
    rules.surrenderAllowed === "es10"
  );
}

export function isLateSurrender(rules: HouseRules): boolean {
  return rules.surrenderAllowed === "late";
}

export function canSurrenderAgainstDealerUpCard(rules: HouseRules, dealerHand: Hand): boolean {
  if (rules.surrenderAllowed === "none") return false;

  if (rules.surrenderAllowed === "es10") {
    const upCard = getDealerUpCard(dealerHand);
    const upCardValue = upCard ? getCardValue(upCard) : 0;
    return upCardValue === 10;
  }

  return true;
}
