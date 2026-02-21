import { getCardValue, getDealerUpCard } from "./deck";
import { Hand, HouseRules } from "./types";

export function isEarlySurrender(rules: HouseRules): boolean {
  return rules.surrenderAllowed === "early" || rules.surrenderAllowed === "enhcAll";
}

export function isLateSurrender(rules: HouseRules): boolean {
  return rules.surrenderAllowed === "late" || rules.surrenderAllowed === "enhcNoAce";
}

export function canSurrenderAgainstDealerUpCard(rules: HouseRules, dealerHand: Hand): boolean {
  if (rules.surrenderAllowed === "none") return false;

  if (rules.surrenderAllowed === "enhcNoAce") {
    const upCard = getDealerUpCard(dealerHand);
    const upCardValue = upCard ? getCardValue(upCard) : 0;
    return upCardValue !== 11;
  }

  return true;
}
