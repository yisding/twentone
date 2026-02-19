import { Card, SUITS, RANKS, Hand } from "./types";

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function createShoe(numDecks: number): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < numDecks; i++) {
    shoe.push(...createDeck());
  }
  return shuffle(shoe);
}

export function shuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCard(deck: Card[]): { card: Card; remainingDeck: Card[] } {
  if (deck.length === 0) {
    throw new Error("Cannot deal from an empty deck");
  }
  const card = deck[0];
  const remainingDeck = deck.slice(1);
  return { card, remainingDeck };
}

export function getCardValue(card: Card): number {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return parseInt(card.rank, 10);
}

export function calculateCardsValue(cards: Card[]): {
  total: number;
  isSoft: boolean;
} {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === "A") {
      aces++;
      total += 11;
    } else {
      total += getCardValue(card);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { total, isSoft: aces > 0 };
}

export function calculateHandValue(hand: Hand): {
  total: number;
  isSoft: boolean;
} {
  return calculateCardsValue(hand.cards);
}

export function isCardsBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const { total } = calculateCardsValue(cards);
  return total === 21;
}

export function isBlackjack(hand: Hand): boolean {
  return isCardsBlackjack(hand.cards);
}

export function areCardsBusted(cards: Card[]): boolean {
  const { total } = calculateCardsValue(cards);
  return total > 21;
}

export function isBusted(hand: Hand): boolean {
  return areCardsBusted(hand.cards);
}

export function canSplit(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false;
  return hand.cards[0].rank === hand.cards[1].rank;
}

export function canDouble(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.isDoubledDown;
}

export function isPair(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false;
  return hand.cards[0].rank === hand.cards[1].rank;
}

export function getDealerUpCard(hand: Hand): Card | null {
  return hand.cards[0] || null;
}
