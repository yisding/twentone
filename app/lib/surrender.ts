import { getCardValue, getDealerUpCard } from "./deck";
import { Hand, HouseRules } from "./types";

export function canSurrenderAgainstDealerUpCard(rules: HouseRules, dealerHand: Hand): boolean {
  if (rules.surrenderAllowed === "none") return false;

  // ENHC option mapping:
  // - early: surrender vs all upcards
  // - late: surrender vs everything except Ace
  if (rules.noHoleCard && rules.surrenderAllowed === "late") {
    const upCard = getDealerUpCard(dealerHand);
    const upCardValue = upCard ? getCardValue(upCard) : 0;
    return upCardValue !== 11;
  }

  return true;
}
