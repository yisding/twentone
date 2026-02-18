import { Hand, PlayerAction, HouseRules } from "./types";
import {
  calculateHandValue,
  isPair,
  getCardValue,
  getDealerUpCard,
} from "./deck";

export function getBasicStrategyAction(
  playerHand: Hand,
  dealerHand: Hand,
  rules: HouseRules,
): PlayerAction {
  const { total, isSoft } = calculateHandValue(playerHand);
  const dealerUpCard = getDealerUpCard(dealerHand);
  if (!dealerUpCard) return "stand";

  const dealerValue = getCardValue(dealerUpCard);
  const canSurrender =
    rules.surrenderAllowed !== "none" && playerHand.cards.length === 2;

  if (isPair(playerHand) && playerHand.cards.length === 2) {
    const pairAction = getPairStrategy(
      playerHand,
      dealerValue,
      rules,
      canSurrender,
    );
    if (pairAction) return pairAction;
  }

  if (isSoft && total <= 21) {
    return getSoftTotalStrategy(playerHand, total, dealerValue, rules);
  }

  return getHardTotalStrategy(
    playerHand,
    total,
    dealerValue,
    rules,
    canSurrender,
  );
}

function getPairStrategy(
  hand: Hand,
  dealerValue: number,
  rules: HouseRules,
  canSurrender: boolean,
): PlayerAction | null {
  const pairValue = getCardValue(hand.cards[0]);
  const isSingleOrDoubleDeck = rules.decks <= 2;

  if (pairValue === 11) {
    return "split";
  }

  if (pairValue === 10) {
    return "stand";
  }

  if (pairValue === 9) {
    if (dealerValue === 7 || dealerValue === 10 || dealerValue === 11)
      return "stand";
    return "split";
  }

  if (pairValue === 8) {
    if (rules.hitSoft17 && dealerValue === 11 && canSurrender) {
      return "surrender";
    }
    return "split";
  }

  if (pairValue === 7) {
    if (dealerValue <= 7) return "split";
    if (dealerValue === 8 && isSingleOrDoubleDeck) return "split";
    return "hit";
  }

  if (pairValue === 6) {
    if (rules.doubleAfterSplit) {
      if (dealerValue >= 2 && dealerValue <= 6) return "split";
    } else {
      if (dealerValue >= 3 && dealerValue <= 6) return "split";
    }
    return "hit";
  }

  if (pairValue === 5) {
    if (dealerValue <= 9 && hand.cards.length === 2) return "double";
    return "hit";
  }

  if (pairValue === 4) {
    if (rules.doubleAfterSplit && (dealerValue === 5 || dealerValue === 6))
      return "split";
    return "hit";
  }

  if (pairValue === 3 || pairValue === 2) {
    if (rules.doubleAfterSplit) {
      if (dealerValue >= 2 && dealerValue <= 7) return "split";
    } else {
      if (dealerValue >= 4 && dealerValue <= 7) return "split";
    }
    return "hit";
  }

  return null;
}

function getSoftTotalStrategy(
  hand: Hand,
  total: number,
  dealerValue: number,
  rules: HouseRules,
): PlayerAction {
  const canDouble = hand.cards.length === 2;

  if (total >= 19) {
    if (rules.hitSoft17 && total === 19 && dealerValue === 6 && canDouble) {
      return "double";
    }
    return "stand";
  }

  if (total === 18) {
    if (dealerValue >= 9) return "hit";
    if (dealerValue === 7 || dealerValue === 8) return "stand";
    if (dealerValue <= 6) {
      if (rules.hitSoft17 && dealerValue === 2 && canDouble) {
        return "double";
      }
      if (dealerValue >= 3 && canDouble) return "double";
      return "stand";
    }
    return "stand";
  }

  if (total === 17) {
    if (dealerValue >= 3 && dealerValue <= 6 && canDouble) return "double";
    return "hit";
  }

  if (total === 16 || total === 15) {
    if (dealerValue >= 4 && dealerValue <= 6 && canDouble) return "double";
    return "hit";
  }

  if (total === 14 || total === 13) {
    if (dealerValue >= 5 && dealerValue <= 6 && canDouble) return "double";
    return "hit";
  }

  return "hit";
}

function getHardTotalStrategy(
  hand: Hand,
  total: number,
  dealerValue: number,
  rules: HouseRules,
  canSurrender: boolean,
): PlayerAction {
  const isSingleOrDoubleDeck = rules.decks <= 2;

  if (canSurrender) {
    if (
      total === 16 &&
      dealerValue >= 9 &&
      !(dealerValue === 9 && rules.hitSoft17)
    ) {
      return "surrender";
    }
    if (total === 15 && dealerValue === 10) return "surrender";
    if (rules.hitSoft17) {
      if (total === 15 && dealerValue === 11) return "surrender";
      if (total === 17 && dealerValue === 11) return "surrender";
    }
  }

  if (total >= 17) return "stand";

  if (total >= 13 && total <= 16) {
    if (dealerValue <= 6) return "stand";
    return "hit";
  }

  if (total === 12) {
    if (dealerValue >= 4 && dealerValue <= 6) return "stand";
    return "hit";
  }

  if (total === 11) {
    if (hand.cards.length === 2) {
      if (rules.hitSoft17) return "double";
      if (dealerValue !== 11) return "double";
      if (isSingleOrDoubleDeck) return "double";
    }
    return "hit";
  }

  if (total === 10) {
    if (dealerValue <= 9 && hand.cards.length === 2) return "double";
    return "hit";
  }

  if (total === 9) {
    if (dealerValue >= 3 && dealerValue <= 6 && hand.cards.length === 2)
      return "double";
    return "hit";
  }

  if (total <= 8) {
    return "hit";
  }

  return "hit";
}

export function actionToString(action: PlayerAction): string {
  const map: Record<PlayerAction, string> = {
    hit: "Hit",
    stand: "Stand",
    double: "Double Down",
    split: "Split",
    surrender: "Surrender",
  };
  return map[action];
}
