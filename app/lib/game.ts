import {
  Hand,
  HouseRules,
  GameState,
  PlayerAction,
  DEFAULT_HOUSE_RULES,
} from "./types";
import {
  createShoe,
  dealCard,
  calculateHandValue,
  isBlackjack,
  isBusted,
  canSplit,
  canDouble,
} from "./deck";

export function createEmptyHand(): Hand {
  return {
    cards: [],
    isDoubledDown: false,
    isSplit: false,
    isSurrendered: false,
    isStanding: false,
  };
}

export function initGame(rules: HouseRules = DEFAULT_HOUSE_RULES): GameState {
  const deck = createShoe(rules.decks);
  const playerHand = createEmptyHand();
  const dealerHand = createEmptyHand();

  let remainingDeck = deck;

  const deal1 = dealCard(remainingDeck);
  playerHand.cards.push(deal1.card);
  remainingDeck = deal1.remainingDeck;

  const deal2 = dealCard(remainingDeck);
  dealerHand.cards.push(deal2.card);
  remainingDeck = deal2.remainingDeck;

  const deal3 = dealCard(remainingDeck);
  playerHand.cards.push(deal3.card);
  remainingDeck = deal3.remainingDeck;

  if (!rules.noHoleCard) {
    const deal4 = dealCard(remainingDeck);
    dealerHand.cards.push(deal4.card);
    remainingDeck = deal4.remainingDeck;
  }

  return {
    playerHands: [playerHand],
    dealerHand,
    currentHandIndex: 0,
    deck: remainingDeck,
    phase: "playing",
    lastAction: null,
    expectedAction: null,
    isCorrect: null,
    score: { correct: 0, total: 0 },
  };
}

export function getAvailableActions(
  state: GameState,
  rules: HouseRules,
): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const hand = state.playerHands[state.currentHandIndex];

  if (!hand || hand.isStanding || hand.isSurrendered || isBusted(hand)) {
    return actions;
  }

  const { total } = calculateHandValue(hand);

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

  if (canSplit(hand) && state.playerHands.length < rules.maxSplitHands) {
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

export function playerHit(state: GameState): GameState {
  const hand = state.playerHands[state.currentHandIndex];
  const { card, remainingDeck } = dealCard(state.deck);

  const newHands = [...state.playerHands];
  newHands[state.currentHandIndex] = {
    ...hand,
    cards: [...hand.cards, card],
  };

  let newPhase = state.phase;
  if (isBusted(newHands[state.currentHandIndex])) {
    newPhase =
      state.currentHandIndex === state.playerHands.length - 1
        ? "resolved"
        : state.phase;
  }

  return {
    ...state,
    playerHands: newHands,
    deck: remainingDeck,
    phase: newPhase,
  };
}

export function playerStand(state: GameState): GameState {
  const newHands = [...state.playerHands];
  newHands[state.currentHandIndex] = {
    ...newHands[state.currentHandIndex],
    isStanding: true,
  };

  const isLastHand = state.currentHandIndex === state.playerHands.length - 1;
  const allResolved = newHands.every(
    (h) => h.isStanding || isBusted(h) || h.isSurrendered,
  );

  return {
    ...state,
    playerHands: newHands,
    phase: allResolved ? "dealer" : state.phase,
    currentHandIndex: isLastHand
      ? state.currentHandIndex
      : state.currentHandIndex + 1,
  };
}

export function playerDouble(state: GameState): GameState {
  const hand = state.playerHands[state.currentHandIndex];
  const { card, remainingDeck } = dealCard(state.deck);

  const newHands = [...state.playerHands];
  newHands[state.currentHandIndex] = {
    ...hand,
    cards: [...hand.cards, card],
    isDoubledDown: true,
    isStanding: true,
  };

  const allResolved = newHands.every(
    (h) => h.isStanding || isBusted(h) || h.isSurrendered,
  );

  return {
    ...state,
    playerHands: newHands,
    deck: remainingDeck,
    phase: allResolved ? "dealer" : state.phase,
  };
}

export function playerSplit(state: GameState): GameState {
  const hand = state.playerHands[state.currentHandIndex];
  const [card1, card2] = hand.cards;

  let remainingDeck = state.deck;
  const deal1 = dealCard(remainingDeck);
  remainingDeck = deal1.remainingDeck;
  const deal2 = dealCard(remainingDeck);
  remainingDeck = deal2.remainingDeck;

  const newHand1: Hand = {
    cards: [card1, deal1.card],
    isDoubledDown: false,
    isSplit: true,
    isSurrendered: false,
    isStanding: false,
  };

  const newHand2: Hand = {
    cards: [card2, deal2.card],
    isDoubledDown: false,
    isSplit: true,
    isSurrendered: false,
    isStanding: false,
  };

  const newHands = [...state.playerHands];
  newHands.splice(state.currentHandIndex, 1, newHand1, newHand2);

  return {
    ...state,
    playerHands: newHands,
    deck: remainingDeck,
  };
}

export function playerSurrender(state: GameState): GameState {
  const newHands = [...state.playerHands];
  newHands[state.currentHandIndex] = {
    ...newHands[state.currentHandIndex],
    isSurrendered: true,
  };

  return {
    ...state,
    playerHands: newHands,
    phase: "resolved",
  };
}

export function dealerPlay(state: GameState, rules: HouseRules): GameState {
  let currentDeck = state.deck;
  let dealerHand = { ...state.dealerHand };

  if (rules.noHoleCard && dealerHand.cards.length === 1) {
    const { card, remainingDeck } = dealCard(currentDeck);
    dealerHand = {
      ...dealerHand,
      cards: [...dealerHand.cards, card],
    };
    currentDeck = remainingDeck;
  }

  while (true) {
    const { total, isSoft } = calculateHandValue(dealerHand);

    if (total > 21) break;
    if (total > 17) break;
    if (total === 17 && !isSoft) break;
    if (total === 17 && isSoft && !rules.hitSoft17) break;

    const { card, remainingDeck } = dealCard(currentDeck);
    dealerHand = {
      ...dealerHand,
      cards: [...dealerHand.cards, card],
    };
    currentDeck = remainingDeck;
  }

  return {
    ...state,
    dealerHand,
    deck: currentDeck,
    phase: "resolved",
  };
}

export function getHandResult(
  playerHand: Hand,
  dealerHand: Hand,
): "win" | "lose" | "push" | "blackjack" | "surrender" {
  if (playerHand.isSurrendered) return "surrender";

  const playerValue = calculateHandValue(playerHand).total;
  const dealerValue = calculateHandValue(dealerHand).total;

  if (isBusted(playerHand)) return "lose";
  if (isBlackjack(playerHand) && !isBlackjack(dealerHand)) return "blackjack";
  if (isBlackjack(dealerHand) && !isBlackjack(playerHand)) return "lose";
  if (playerValue > 21) return "lose";
  if (dealerValue > 21) return "win";
  if (playerValue > dealerValue) return "win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}
