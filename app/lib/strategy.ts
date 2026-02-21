import { Hand, PlayerAction, HouseRules } from "./types";
import {
  calculateHandValue,
  isPair,
  getCardValue,
  getDealerUpCard,
} from "./deck";
import { canSurrenderAgainstDealerUpCard } from "./surrender";
import { isEarlySurrender } from "./surrender";

export function getBasicStrategyAction(
  playerHand: Hand,
  dealerHand: Hand,
  rules: HouseRules,
): PlayerAction {
  return getBasicStrategyActionInternal(playerHand, dealerHand, rules, true);
}

export function getBestActionWithoutSurrender(
  playerHand: Hand,
  dealerHand: Hand,
  rules: HouseRules,
): PlayerAction {
  return getBasicStrategyActionInternal(playerHand, dealerHand, rules, false);
}

function getBasicStrategyActionInternal(
  playerHand: Hand,
  dealerHand: Hand,
  rules: HouseRules,
  allowSurrender: boolean,
): PlayerAction {
  const { total, isSoft } = calculateHandValue(playerHand);
  const dealerUpCard = getDealerUpCard(dealerHand);
  if (!dealerUpCard) return "stand";

  const dealerValue = getCardValue(dealerUpCard);
  const canSurrender =
    allowSurrender &&
    rules.surrenderAllowed !== "none" &&
    canSurrenderAgainstDealerUpCard(rules, dealerHand) &&
    playerHand.cards.length === 2 &&
    !playerHand.isSplit;

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

function canDoubleByRules(hand: Hand, total: number, rules: HouseRules): boolean {
  if (hand.cards.length !== 2) return false;
  if (hand.isSplit && !rules.doubleAfterSplit) return false;
  if (rules.doubleRestriction === "9-11") return total >= 9 && total <= 11;
  if (rules.doubleRestriction === "10-11") return total >= 10 && total <= 11;
  return true;
}

function getPairStrategy(
  hand: Hand,
  dealerValue: number,
  rules: HouseRules,
  canSurrender: boolean,
): PlayerAction | null {
  const pairValue = getCardValue(hand.cards[0]);
  const isSingleOrDoubleDeck = rules.decks <= 2;
  const isEarlySurrenderRule = isEarlySurrender(rules);

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
    if (canSurrender) {
      if (isEarlySurrenderRule && (dealerValue === 10 || dealerValue === 11)) {
        return "surrender";
      }
      if (!isEarlySurrenderRule && rules.hitSoft17 && dealerValue === 11) {
        return "surrender";
      }
    }
    return "split";
  }

  if (pairValue === 7) {
    if (canSurrender && isEarlySurrenderRule && (dealerValue === 10 || dealerValue === 11)) {
      return "surrender";
    }
    if (dealerValue <= 7) return "split";
    if (dealerValue === 8 && isSingleOrDoubleDeck) return "split";
    return "hit";
  }

  if (pairValue === 6) {
    if (canSurrender && isEarlySurrenderRule && dealerValue === 11) {
      return "surrender";
    }
    if (rules.doubleAfterSplit) {
      if (dealerValue >= 2 && dealerValue <= 6) return "split";
    } else {
      if (dealerValue >= 3 && dealerValue <= 6) return "split";
    }
    return "hit";
  }

  if (pairValue === 5) {
    if (dealerValue <= 9 && canDoubleByRules(hand, 10, rules)) return "double";
    return "hit";
  }

  if (pairValue === 4) {
    if (rules.doubleAfterSplit && (dealerValue === 5 || dealerValue === 6))
      return "split";
    return "hit";
  }

  if (pairValue === 3 || pairValue === 2) {
    if (pairValue === 3 && canSurrender && isEarlySurrenderRule && dealerValue === 11) {
      return "surrender";
    }
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
  const canDouble = canDoubleByRules(hand, total, rules);

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
  const canDouble = canDoubleByRules(hand, total, rules);
  const isEarlySurrenderRule = isEarlySurrender(rules);

  if (canSurrender) {
    if (isEarlySurrenderRule) {
      if (dealerValue === 11 && ((total >= 5 && total <= 7) || (total >= 12 && total <= 17))) {
        return "surrender";
      }
      if (dealerValue === 10 && total >= 14 && total <= 16) {
        return "surrender";
      }
    } else {
      if (
        total === 16 &&
        dealerValue >= 9 &&
        !(dealerValue === 9 && rules.decks < 4)
      ) {
        return "surrender";
      }
      if (total === 15 && dealerValue === 10) return "surrender";
      if (rules.hitSoft17) {
        if (total === 15 && dealerValue === 11) return "surrender";
        if (total === 17 && dealerValue === 11) return "surrender";
      }
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
    if (canDouble) {
      if (rules.hitSoft17) return "double";
      if (dealerValue !== 11) return "double";
      if (isSingleOrDoubleDeck) return "double";
    }
    return "hit";
  }

  if (total === 10) {
    if (dealerValue <= 9 && canDouble) return "double";
    return "hit";
  }

  if (total === 9) {
    if (dealerValue >= 3 && dealerValue <= 6 && canDouble)
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
    continue: "Continue",
  };
  return map[action];
}

export function getStrategyExplanation(
  hand: Hand,
  dealerUpCardValue: number,
  expectedAction: PlayerAction,
  rules: HouseRules,
): string {
  const { total, isSoft } = calculateHandValue(hand);
  const pairValue = isPair(hand) && hand.cards.length === 2 ? getCardValue(hand.cards[0]) : null;

  let explanation: string;
  const ruleNotes: string[] = [];

  if (pairValue !== null) {
    explanation = getPairExplanation(pairValue, dealerUpCardValue, expectedAction, rules, ruleNotes);
  } else if (isSoft) {
    explanation = getSoftExplanation(total, dealerUpCardValue, expectedAction, rules, ruleNotes);
  } else {
    explanation = getHardExplanation(total, dealerUpCardValue, expectedAction, rules, ruleNotes);
  }

  if (ruleNotes.length > 0) {
    return `${explanation} Note: ${ruleNotes.join(" ")}`;
  }
  return explanation;
}

function getPairExplanation(
  pairValue: number,
  dealerValue: number,
  action: PlayerAction,
  rules: HouseRules,
  ruleNotes: string[],
): string {
  if (action === "split") {
    if (pairValue === 11) {
      return "Always split aces—you get two chances at blackjack, and you can't bust on the first hit.";
    }
    if (pairValue === 8) {
      return "16 is the worst hand in blackjack. Splitting gives you two chances to improve, which is better than playing 16.";
    }
    if (pairValue === 9) {
      return "18 is decent but not great. Splitting against weak dealer cards creates two potentially winning hands.";
    }
    if (pairValue === 7) {
      return "Splitting 7s against weak dealer cards creates two playable hands. 14 is a weak stiff hand.";
    }
    if (pairValue === 6) {
      if (!rules.doubleAfterSplit) {
        ruleNotes.push("With your current rules (no DAS), only split against dealer 3-6. With DAS, also split against 2.");
      }
      return "Splitting 6s against dealer bust cards gives you two chances to build decent hands.";
    }
    if (pairValue === 5) {
      return "10 is a strong starting hand. Doubling maximizes profit when you're likely to draw a high card.";
    }
    if (pairValue === 4) {
      return "Splitting 4s against dealer 5-6 lets you double down after catching a good card.";
    }
    if (pairValue === 3 || pairValue === 2) {
      if (!rules.doubleAfterSplit) {
        ruleNotes.push("With your current rules (no DAS), only split against dealer 4-7. With DAS, also split against 2-3.");
      }
      return "Splitting low pairs against weak dealer upcards creates two hands with improving potential.";
    }
    return "Splitting creates two hands with better odds than one.";
  }

  if (action === "stand" && pairValue === 10) {
    return "20 is a strong hand. Splitting would risk turning one winner into two losers.";
  }

  if (action === "surrender" && rules.surrenderAllowed === "early") {
    return "Against a strong dealer upcard, early surrender is mathematically superior to splitting or hitting this pair.";
  }

  if (action === "hit" && pairValue === 8 && rules.hitSoft17 && dealerValue === 11) {
    return "Against dealer Ace with H17, surrender if available. Otherwise, you must hit the hard 16.";
  }

  if (action === "hit" && pairValue === 6 && dealerValue === 2 && !rules.doubleAfterSplit) {
    ruleNotes.push("With DAS, you would split this hand.");
  }

  if (action === "hit" && (pairValue === 4 || pairValue === 3 || pairValue === 2)) {
    if (pairValue === 4 && (dealerValue === 5 || dealerValue === 6) && !rules.doubleAfterSplit) {
      ruleNotes.push("With DAS, you would split this hand.");
    }
    if ((pairValue === 3 || pairValue === 2) && dealerValue >= 2 && dealerValue <= 3 && !rules.doubleAfterSplit) {
      ruleNotes.push("With DAS, you would split this hand.");
    }
  }

  if (action === "hit" && pairValue === 7) {
    if (dealerValue === 8 && rules.decks > 2) {
      ruleNotes.push("With single or double deck, split 7s vs 8 due to card composition effects.");
    }
    return "Splitting 7s against a strong dealer creates two weak hands. Better to hit the 14 as a single hand.";
  }

  if (action === "hit" && pairValue === 6) {
    return "Splitting 6s against a strong dealer creates two weak starting hands. Hitting the 12 is safer.";
  }

  return getHardExplanation(pairValue * 2, dealerValue, action, rules, ruleNotes);
}

function getSoftExplanation(
  total: number,
  dealerValue: number,
  action: PlayerAction,
  rules: HouseRules,
  ruleNotes: string[],
): string {
  if (action === "stand") {
    if (total >= 19) {
      if (total === 19 && dealerValue === 6 && !rules.hitSoft17) {
        ruleNotes.push("With H17 rules, doubling soft 19 vs 6 is a close decision—but standing is still solid.");
      }
      return `Soft ${total} is already strong—standing preserves your advantage.`;
    }
    if (total === 18) {
      if (dealerValue === 7 || dealerValue === 8) {
        return "Dealer likely has 17-18, so your soft 18 pushes or wins. Standing is safe.";
      }
      if (dealerValue === 2 && !rules.hitSoft17) {
        ruleNotes.push("With H17 rules, doubling soft 18 vs 2 is correct. With S17, standing is better.");
      }
      return "Against a weak dealer, soft 18 is likely enough to win.";
    }
    return "Standing avoids the risk of worsening your hand.";
  }

  if (action === "hit") {
    return `Soft ${total} can't bust—you can always count the ace as 1. Hitting is free and may improve your hand.`;
  }

  if (action === "double") {
    if (total === 19 && dealerValue === 6 && rules.hitSoft17) {
      ruleNotes.push("This aggressive double is only correct with H17 rules. With S17, just stand.");
      return "Soft 19 can't bust, and with H17 the dealer is more likely to bust, making doubling profitable.";
    }
    if (total === 18 && dealerValue === 2 && rules.hitSoft17) {
      ruleNotes.push("This double is only correct with H17 rules. With S17, just stand.");
    }
    return `Soft ${total} can't bust, and doubling against a weak dealer maximizes profit when you're likely to improve.`;
  }

  return "Soft hands give flexibility—the ace can count as 1 or 11.";
}

function getHardExplanation(
  total: number,
  dealerValue: number,
  action: PlayerAction,
  rules: HouseRules,
  ruleNotes: string[],
): string {
  const isDealerWeak = dealerValue >= 2 && dealerValue <= 6;

  if (action === "surrender") {
    if (rules.surrenderAllowed === "early") {
      return "Early surrender allows you to escape before the dealer checks for blackjack, making it correct to surrender many hard hands against strong upcards.";
    }
    if (total === 16) {
      if (dealerValue === 9 && rules.decks >= 4) {
        ruleNotes.push("Surrendering 16 vs 9 is only correct with 4+ decks. With 1-2 decks, hit instead.");
      }
      return "16 vs dealer 9/10/Ace is a heavy underdog. Surrender saves half your bet instead of likely losing it all.";
    }
    if (total === 15) {
      if (dealerValue === 11 && rules.hitSoft17) {
        ruleNotes.push("This surrender vs Ace is only correct with H17 rules. With S17, you should hit instead.");
      }
      return "15 vs dealer 10 is a bad spot. Surrender cuts losses when odds are strongly against you.";
    }
    if (total === 17 && dealerValue === 11 && rules.hitSoft17) {
      ruleNotes.push("This surrender is only correct with H17 rules. With S17, you should stand instead.");
      return "With H17, dealer is more aggressive with Ace up, making 17 a losing proposition.";
    }
    return "The odds are heavily against you—surrender minimizes losses.";
  }

  if (action === "stand") {
    if (total >= 17) {
      return `${total} is a pat hand—hitting risks busting for no gain.`;
    }
    if (total >= 13 && total <= 16 && isDealerWeak) {
      return `Dealer busts ~${getBustRate(dealerValue)}% with ${dealerValue} showing. Let the dealer bust rather than risk it.`;
    }
    if (total === 12 && isDealerWeak) {
      return `Dealer busts ~${getBustRate(dealerValue)}% with ${dealerValue} showing. Standing lets the dealer bust.`;
    }
    return "Standing lets the dealer play and potentially bust.";
  }

  if (action === "hit") {
    if (total === 16 && dealerValue === 9 && rules.decks < 4 && rules.surrenderAllowed !== "none") {
      ruleNotes.push("With 4+ decks, you would surrender this hand instead of hitting.");
    }
    if (total === 15 && dealerValue === 11 && !rules.hitSoft17 && rules.surrenderAllowed !== "none") {
      ruleNotes.push("With H17 rules, you would surrender this hand instead of hitting.");
    }
    if (total <= 11) {
      if (total === 11 && dealerValue === 11 && !rules.hitSoft17 && rules.decks > 2) {
        ruleNotes.push("With H17 or single/double deck, you would double this hand.");
      }
      return `${total} can't bust—hitting is free and will always improve or stay the same.`;
    }
    if (total === 12) {
      return "Only a 10 will bust you (4/13 chance). Against a strong dealer, the risk is worth taking.";
    }
    if (total >= 13 && total <= 16 && dealerValue >= 7) {
      return `Standing on ${total} vs strong dealer upcard loses often. Hitting gives you a chance to improve.`;
    }
    return "Hitting gives a chance to improve against the dealer's advantage.";
  }

  if (action === "double") {
    if (total === 11) {
      if (dealerValue === 11 && !rules.hitSoft17 && rules.decks > 2) {
        ruleNotes.push("With S17 and 6+ decks, just hit vs dealer Ace. With H17 or single/double deck, doubling is correct.");
      }
      return "11 is the best doubling hand—you'll likely draw a 10 and make 21.";
    }
    if (total === 10) {
      if (dealerValue === 10 || dealerValue === 11) {
        ruleNotes.push("Don't double against dealer 10 or Ace—even 10 isn't strong enough to risk the extra bet.");
      }
      return "10 is excellent for doubling—you have good odds of making 19-21.";
    }
    if (total === 9) {
      return "9 vs weak dealer (3-6) gives you +EV on a double. You'll often make 19+.";
    }
    return "Doubling maximizes profit when you have the advantage.";
  }

  return "This play maximizes expected value based on the math.";
}

function getBustRate(dealerValue: number): string {
  const rates: Record<number, string> = {
    2: "35",
    3: "37",
    4: "40",
    5: "42",
    6: "42",
  };
  return rates[dealerValue] || "~25";
}
