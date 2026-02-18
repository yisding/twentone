export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Hand {
  cards: Card[];
  isDoubledDown: boolean;
  isSplit: boolean;
  isSplitAces: boolean;
  isSurrendered: boolean;
  isStanding: boolean;
}

export type PlayerAction = "hit" | "stand" | "double" | "split" | "surrender";

export type DoubleRestriction = "any" | "9-11" | "10-11";

export interface HouseRules {
  hitSoft17: boolean;
  surrenderAllowed: "none" | "early" | "late";
  doubleAfterSplit: boolean;
  doubleRestriction: DoubleRestriction;
  resplitAces: boolean;
  blackjackPays: "3:2" | "6:5" | "1:1";
  decks: number;
  noHoleCard: boolean;
  maxSplitHands: 2 | 3 | 4;
}

export interface GameState {
  playerHands: Hand[];
  dealerHand: Hand;
  currentHandIndex: number;
  deck: Card[];
  phase: "betting" | "playing" | "dealer" | "resolved";
  lastAction: PlayerAction | null;
  expectedAction: PlayerAction | null;
  isCorrect: boolean | null;
  score: { correct: number; total: number };
}

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export interface SessionStats {
  correct: number;
  wrong: number;
  winnings: number;
}

export interface IncorrectPlay {
  id: string;
  timestamp: number;
  playerCards: Card[];
  dealerUpCard: Card;
  playerAction: PlayerAction;
  expectedAction: PlayerAction;
  handDescription: string;
  explanation: string;
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  hitSoft17: true,
  surrenderAllowed: "none",
  doubleAfterSplit: true,
  doubleRestriction: "any",
  resplitAces: true,
  blackjackPays: "3:2",
  decks: 2,
  noHoleCard: false,
  maxSplitHands: 4,
};
