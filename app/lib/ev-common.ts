/**
 * Shared constants and utilities for EV calculations.
 * Used by both ev-calculator.ts and ev-utils.ts.
 */

// 10 distinct card values: 2-9 (individual), 10 (10/J/Q/K combined), 11 (Ace)
export const CARD_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const N = 10;

// Infinite deck probabilities: 1/13 each for 2-9 and Ace, 4/13 for 10-value
export const INFINITE_DECK_PROBS = [
  1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 4 / 13,
  1 / 13,
];

/**
 * Add a card to a hand, tracking soft aces.
 * Returns [newTotal, isSoft].
 */
export function addCard(
  total: number,
  isSoft: boolean,
  cardValue: number,
): [number, boolean] {
  let softAces = isSoft ? 1 : 0;
  let t = total + cardValue;
  if (cardValue === 11) softAces++;
  while (t > 21 && softAces > 0) {
    t -= 10;
    softAces--;
  }
  return [t, softAces > 0];
}
