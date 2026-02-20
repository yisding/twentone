import { HouseRules, Hand, Card, DEFAULT_HOUSE_RULES } from "./types";
import {
  createShoe,
  dealCard,
  calculateHandValue,
  isBlackjack,
  isBusted,
  canSplit,
  canDouble,
} from "./deck";
import { getBasicStrategyAction } from "./strategy";

function createEmptyHand(): Hand {
  return {
    cards: [],
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
}

function getAvailableActions(
  hand: Hand,
  allHands: Hand[],
  rules: HouseRules,
): ("hit" | "stand" | "double" | "split" | "surrender")[] {
  const actions: ("hit" | "stand" | "double" | "split" | "surrender")[] = [];

  if (!hand || hand.isStanding || hand.isSurrendered || isBusted(hand)) {
    return actions;
  }

  const { total } = calculateHandValue(hand);

  if (hand.isSplitAces && hand.cards.length === 2) {
    actions.push("stand");
    const canResplitAces =
      hand.cards[0].rank === "A" &&
      hand.cards[1].rank === "A" &&
      rules.resplitAces &&
      allHands.length < rules.maxSplitHands;
    if (canResplitAces) {
      actions.push("split");
    }
    return actions;
  }

  actions.push("hit", "stand");

  if (canDouble(hand)) {
    const canDoubleByRestriction =
      rules.doubleRestriction === "any" ||
      (rules.doubleRestriction === "9-11" && total >= 9 && total <= 11) ||
      (rules.doubleRestriction === "10-11" && total >= 10 && total <= 11);

    if (canDoubleByRestriction) {
      if (!hand.isSplit || rules.doubleAfterSplit) {
        actions.push("double");
      }
    }
  }

  if (canSplit(hand) && allHands.length < rules.maxSplitHands) {
    actions.push("split");
  }

  if (
    rules.surrenderAllowed !== "none" &&
    hand.cards.length === 2 &&
    !hand.isSplit
  ) {
    actions.push("surrender");
  }

  return actions;
}

interface SimulationResult {
  handsPlayed: number;
  totalBet: number;
  totalReturned: number;
  houseEdge: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  surrenders: number;
}

function playHand(hand: Hand, dealerHand: Hand, rules: HouseRules): number {
  const result = getHandResult(hand, dealerHand);
  const bet = hand.isDoubledDown ? 2 : 1;

  switch (result) {
    case "blackjack":
      const bjPays = rules.blackjackPays === "3:2" ? 1.5 : rules.blackjackPays === "6:5" ? 1.2 : 1;
      return bet + bet * bjPays;
    case "win":
      return bet * 2;
    case "push":
      return bet;
    case "surrender":
      return bet * 0.5;
    case "lose":
      return 0;
  }
}

function getHandResult(
  playerHand: Hand,
  dealerHand: Hand,
): "win" | "lose" | "push" | "blackjack" | "surrender" {
  if (playerHand.isSurrendered) return "surrender";

  const playerValue = calculateHandValue(playerHand).total;
  const dealerValue = calculateHandValue(dealerHand).total;
  const playerIsBlackjack = isBlackjack(playerHand) && !playerHand.isSplitAces;
  const dealerIsBlackjack = isBlackjack(dealerHand);

  if (isBusted(playerHand)) return "lose";
  if (playerIsBlackjack && !dealerIsBlackjack) return "blackjack";
  if (dealerIsBlackjack && !playerIsBlackjack) return "lose";
  if (playerValue > 21) return "lose";
  if (dealerValue > 21) return "win";
  if (playerValue > dealerValue) return "win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}

function simulateHand(deck: Card[], rules: HouseRules): { returned: number; bet: number; deck: Card[]; surrenders: number } {
  let currentDeck = deck;
  
  const playerHand = createEmptyHand();
  const dealerHand = createEmptyHand();

  const deal1 = dealCard(currentDeck);
  playerHand.cards.push(deal1.card);
  currentDeck = deal1.remainingDeck;

  const deal2 = dealCard(currentDeck);
  dealerHand.cards.push(deal2.card);
  currentDeck = deal2.remainingDeck;

  const deal3 = dealCard(currentDeck);
  playerHand.cards.push(deal3.card);
  currentDeck = deal3.remainingDeck;

  if (!rules.noHoleCard) {
    const deal4 = dealCard(currentDeck);
    dealerHand.cards.push(deal4.card);
    currentDeck = deal4.remainingDeck;
  }

  const playerIsBlackjack = isBlackjack(playerHand) && !playerHand.isSplitAces;
  const dealerIsBlackjack = isBlackjack(dealerHand);

  if (playerIsBlackjack || dealerIsBlackjack) {
    getHandResult(playerHand, dealerHand);
    const bet = 1;
    const returned = playHand(playerHand, dealerHand, rules);
    return { returned, bet, deck: currentDeck, surrenders: 0 };
  }

  const playerHands: Hand[] = [playerHand];
  let currentHandIndex = 0;

  while (currentHandIndex < playerHands.length) {
    let hand = playerHands[currentHandIndex];

    while (!hand.isStanding && !hand.isSurrendered && !isBusted(hand)) {
      const action = getBasicStrategyAction(hand, dealerHand, rules);
      const availableActions = getAvailableActions(hand, playerHands, rules);

      if (!availableActions.includes(action)) {
        if ((action === "double" || action === "split") && availableActions.includes("hit")) {
          const hitDeal = dealCard(currentDeck);
          hand = {
            ...hand,
            cards: [...hand.cards, hitDeal.card],
          };
          currentDeck = hitDeal.remainingDeck;
          playerHands[currentHandIndex] = hand;
          continue;
        }
        hand = { ...hand, isStanding: true };
        playerHands[currentHandIndex] = hand;
        break;
      }

      if (action === "stand") {
        hand = { ...hand, isStanding: true };
        playerHands[currentHandIndex] = hand;
        break;
      }

      if (action === "surrender") {
        hand = { ...hand, isSurrendered: true };
        playerHands[currentHandIndex] = hand;
        break;
      }

      if (action === "hit") {
        const hitDeal = dealCard(currentDeck);
        hand = {
          ...hand,
          cards: [...hand.cards, hitDeal.card],
        };
        currentDeck = hitDeal.remainingDeck;
        playerHands[currentHandIndex] = hand;
        continue;
      }

      if (action === "double") {
        const doubleDeal = dealCard(currentDeck);
        hand = {
          ...hand,
          cards: [...hand.cards, doubleDeal.card],
          isDoubledDown: true,
          isStanding: true,
        };
        currentDeck = doubleDeal.remainingDeck;
        playerHands[currentHandIndex] = hand;
        break;
      }

      if (action === "split") {
        const [card1, card2] = hand.cards;
        const isSplittingAces = card1.rank === "A";

        const splitDeal1 = dealCard(currentDeck);
        currentDeck = splitDeal1.remainingDeck;
        const splitDeal2 = dealCard(currentDeck);
        currentDeck = splitDeal2.remainingDeck;

        const newHand1: Hand = {
          cards: [card1, splitDeal1.card],
          isDoubledDown: false,
          isSplit: true,
          isSplitAces: isSplittingAces || hand.isSplitAces,
          isSurrendered: false,
          isStanding: false,
        };

        const newHand2: Hand = {
          cards: [card2, splitDeal2.card],
          isDoubledDown: false,
          isSplit: true,
          isSplitAces: isSplittingAces || hand.isSplitAces,
          isSurrendered: false,
          isStanding: false,
        };

        playerHands.splice(currentHandIndex, 1, newHand1, newHand2);
        hand = newHand1;
        continue;
      }
    }

    currentHandIndex++;
  }

  const allResolved = playerHands.every(
    (h) => h.isStanding || isBusted(h) || h.isSurrendered,
  );

  let finalDealerHand = dealerHand;
  if (allResolved && !playerHands.every((h) => isBusted(h) || h.isSurrendered)) {
    if (rules.noHoleCard && finalDealerHand.cards.length === 1) {
      const holeDeal = dealCard(currentDeck);
      finalDealerHand = {
        ...finalDealerHand,
        cards: [...finalDealerHand.cards, holeDeal.card],
      };
      currentDeck = holeDeal.remainingDeck;
    }

    while (true) {
      const { total, isSoft } = calculateHandValue(finalDealerHand);

      if (total > 21) break;
      if (total > 17) break;
      if (total === 17 && !isSoft) break;
      if (total === 17 && isSoft && !rules.hitSoft17) break;

      const dealerDeal = dealCard(currentDeck);
      finalDealerHand = {
        ...finalDealerHand,
        cards: [...finalDealerHand.cards, dealerDeal.card],
      };
      currentDeck = dealerDeal.remainingDeck;
    }
  }

  let totalBet = 0;
  let totalReturned = 0;
  let surrenderCount = 0;

  for (const h of playerHands) {
    totalBet += h.isDoubledDown ? 2 : 1;
    totalReturned += playHand(h, finalDealerHand, rules);
    if (h.isSurrendered) surrenderCount++;
  }

  return { returned: totalReturned, bet: totalBet, deck: currentDeck, surrenders: surrenderCount };
}

export function simulateHouseEdge(
  numHands: number = 10000,
  rules: HouseRules = DEFAULT_HOUSE_RULES,
  onProgress?: (completed: number, total: number) => void,
): SimulationResult {
  let totalBet = 0;
  let totalReturned = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let blackjacks = 0;
  let surrenders = 0;

  let deck = createShoe(rules.decks);
  const minCards = 52 * rules.decks * 0.25;

  for (let i = 0; i < numHands; i++) {
    if (deck.length < minCards) {
      deck = createShoe(rules.decks);
    }

    const { returned, bet, deck: newDeck, surrenders: handSurrenders } = simulateHand(deck, rules);
    deck = newDeck;

    totalBet += bet;
    totalReturned += returned;
    surrenders += handSurrenders;

    const netResult = returned - bet;
    if (netResult >= bet * 1.4) {
      blackjacks++;
      wins++;
    } else if (netResult > 0) {
      wins++;
    } else if (netResult === 0) {
      pushes++;
    } else if (handSurrenders > 0) {
      losses += handSurrenders;
    } else {
      losses++;
    }

    if (onProgress && i % 1000 === 0) {
      onProgress(i, numHands);
    }
  }

  const houseEdge = totalBet > 0 ? ((totalBet - totalReturned) / totalBet) * 100 : 0;

  return {
    handsPlayed: numHands,
    totalBet,
    totalReturned,
    houseEdge,
    wins,
    losses,
    pushes,
    blackjacks,
    surrenders,
  };
}

export type { SimulationResult };
