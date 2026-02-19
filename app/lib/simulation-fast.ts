import { HouseRules, DEFAULT_HOUSE_RULES } from "./types";

// --- Rank encoding ---
// Ranks 1-13: A=1, 2=2, ..., 10=10, J=11, Q=12, K=13
// Card value: A=11, 2-10=face, J/Q/K=10

const RANK_VALUE = new Uint8Array(14); // index 0 unused
RANK_VALUE[1] = 11; // Ace
for (let i = 2; i <= 10; i++) RANK_VALUE[i] = i;
RANK_VALUE[11] = 10; // J
RANK_VALUE[12] = 10; // Q
RANK_VALUE[13] = 10; // K

// --- Shoe ---

function createShoe(numDecks: number): Uint8Array {
  const size = 52 * numDecks;
  const shoe = new Uint8Array(size);
  let idx = 0;
  for (let d = 0; d < numDecks; d++) {
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        shoe[idx++] = rank;
      }
    }
  }
  return shoe;
}

function shuffleShoe(shoe: Uint8Array): void {
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = tmp;
  }
}

// --- SimHand: mutable hand with incremental totals ---

const MAX_CARDS = 21; // max cards possible in a hand

class SimHand {
  cards = new Uint8Array(MAX_CARDS); // rank IDs
  cardCount = 0;
  total = 0;
  softAces = 0;
  isDoubledDown = false;
  isSplit = false;
  isSplitAces = false;
  isSurrendered = false;
  isStanding = false;

  reset(): void {
    this.cardCount = 0;
    this.total = 0;
    this.softAces = 0;
    this.isDoubledDown = false;
    this.isSplit = false;
    this.isSplitAces = false;
    this.isSurrendered = false;
    this.isStanding = false;
  }

  addCard(rank: number): void {
    this.cards[this.cardCount++] = rank;
    const val = RANK_VALUE[rank];
    this.total += val;
    if (rank === 1) this.softAces++;
    while (this.total > 21 && this.softAces > 0) {
      this.total -= 10;
      this.softAces--;
    }
  }

  // Set first card directly (used after split)
  setFirstCard(rank: number): void {
    this.cards[0] = rank;
    this.cardCount = 1;
    const val = RANK_VALUE[rank];
    this.total = val;
    this.softAces = rank === 1 ? 1 : 0;
  }

  get isSoft(): boolean {
    return this.softAces > 0;
  }

  get isBusted(): boolean {
    return this.total > 21;
  }

  get isBlackjack(): boolean {
    return this.cardCount === 2 && this.total === 21;
  }

  get isPair(): boolean {
    return this.cardCount === 2 && this.cards[0] === this.cards[1];
  }

  get firstCardValue(): number {
    return RANK_VALUE[this.cards[0]];
  }
}

// --- Hand pool (avoid allocations) ---

const HAND_POOL_SIZE = 8;

class HandPool {
  private hands: SimHand[] = [];

  constructor() {
    for (let i = 0; i < HAND_POOL_SIZE; i++) {
      this.hands.push(new SimHand());
    }
  }

  get(index: number): SimHand {
    return this.hands[index];
  }
}

// --- Pre-computed rule constants ---

interface RuleConstants {
  hitSoft17: boolean;
  canSurrender: boolean;
  isDAS: boolean;
  isSingleOrDoubleDeck: boolean;
  doubleRestriction: string;
  resplitAces: boolean;
  maxSplitHands: number;
  noHoleCard: boolean;
  bjPayMultiplier: number;
  minCards: number;
  decks: number;
}

function precomputeRules(rules: HouseRules): RuleConstants {
  return {
    hitSoft17: rules.hitSoft17,
    canSurrender: rules.surrenderAllowed !== "none",
    isDAS: rules.doubleAfterSplit,
    isSingleOrDoubleDeck: rules.decks <= 2,
    doubleRestriction: rules.doubleRestriction,
    resplitAces: rules.resplitAces,
    maxSplitHands: rules.maxSplitHands,
    noHoleCard: rules.noHoleCard,
    bjPayMultiplier: rules.blackjackPays === "3:2" ? 1.5 : rules.blackjackPays === "6:5" ? 1.2 : 1,
    minCards: (52 * rules.decks * 0.25) | 0,
    decks: rules.decks,
  };
}

// --- Inlined strategy ---
// Matches strategy.ts logic exactly (lines 9-220)

const enum Action {
  Hit = 0,
  Stand = 1,
  Double = 2,
  Split = 3,
  Surrender = 4,
}

function getStrategyAction(
  hand: SimHand,
  dealerUpValue: number, // 2-11 (ace=11)
  rc: RuleConstants,
): Action {
  const canSurrenderHand = rc.canSurrender && hand.cardCount === 2 && !hand.isSplit;

  // Pair strategy
  if (hand.isPair) {
    const pairVal = hand.firstCardValue; // RANK_VALUE already maps A->11

    if (pairVal === 11) return Action.Split; // Always split aces

    if (pairVal === 10) return Action.Stand;

    if (pairVal === 9) {
      if (dealerUpValue === 7 || dealerUpValue === 10 || dealerUpValue === 11) return Action.Stand;
      return Action.Split;
    }

    if (pairVal === 8) {
      if (rc.hitSoft17 && dealerUpValue === 11 && canSurrenderHand) return Action.Surrender;
      return Action.Split;
    }

    if (pairVal === 7) {
      if (dealerUpValue <= 7) return Action.Split;
      if (dealerUpValue === 8 && rc.isSingleOrDoubleDeck) return Action.Split;
      return Action.Hit;
    }

    if (pairVal === 6) {
      if (rc.isDAS) {
        if (dealerUpValue >= 2 && dealerUpValue <= 6) return Action.Split;
      } else {
        if (dealerUpValue >= 3 && dealerUpValue <= 6) return Action.Split;
      }
      return Action.Hit;
    }

    if (pairVal === 5) {
      // Pair of 5s: treat as hard 10, double or hit (never split)
      if (dealerUpValue <= 9 && hand.cardCount === 2) return Action.Double;
      return Action.Hit;
    }

    if (pairVal === 4) {
      if (rc.isDAS && (dealerUpValue === 5 || dealerUpValue === 6)) return Action.Split;
      return Action.Hit;
    }

    if (pairVal === 3 || pairVal === 2) {
      if (rc.isDAS) {
        if (dealerUpValue >= 2 && dealerUpValue <= 7) return Action.Split;
      } else {
        if (dealerUpValue >= 4 && dealerUpValue <= 7) return Action.Split;
      }
      return Action.Hit;
    }
  }

  const total = hand.total;
  const canDouble = hand.cardCount === 2;

  // Soft total strategy
  if (hand.isSoft && total <= 21) {
    if (total >= 19) {
      if (rc.hitSoft17 && total === 19 && dealerUpValue === 6 && canDouble) return Action.Double;
      return Action.Stand;
    }

    if (total === 18) {
      if (dealerUpValue >= 9) return Action.Hit;
      if (dealerUpValue === 7 || dealerUpValue === 8) return Action.Stand;
      if (dealerUpValue <= 6) {
        if (rc.hitSoft17 && dealerUpValue === 2 && canDouble) return Action.Double;
        if (dealerUpValue >= 3 && canDouble) return Action.Double;
        return Action.Stand;
      }
      return Action.Stand;
    }

    if (total === 17) {
      if (dealerUpValue >= 3 && dealerUpValue <= 6 && canDouble) return Action.Double;
      return Action.Hit;
    }

    if (total === 16 || total === 15) {
      if (dealerUpValue >= 4 && dealerUpValue <= 6 && canDouble) return Action.Double;
      return Action.Hit;
    }

    if (total === 14 || total === 13) {
      if (dealerUpValue >= 5 && dealerUpValue <= 6 && canDouble) return Action.Double;
      return Action.Hit;
    }

    return Action.Hit;
  }

  // Hard total strategy
  if (canSurrenderHand) {
    if (total === 16 && dealerUpValue >= 9 && !(dealerUpValue === 9 && rc.hitSoft17)) {
      return Action.Surrender;
    }
    if (total === 15 && dealerUpValue === 10) return Action.Surrender;
    if (rc.hitSoft17) {
      if (total === 15 && dealerUpValue === 11) return Action.Surrender;
      if (total === 17 && dealerUpValue === 11) return Action.Surrender;
    }
  }

  if (total >= 17) return Action.Stand;

  if (total >= 13 && total <= 16) {
    if (dealerUpValue <= 6) return Action.Stand;
    return Action.Hit;
  }

  if (total === 12) {
    if (dealerUpValue >= 4 && dealerUpValue <= 6) return Action.Stand;
    return Action.Hit;
  }

  if (total === 11) {
    if (canDouble) {
      if (rc.hitSoft17) return Action.Double;
      if (dealerUpValue !== 11) return Action.Double;
      if (rc.isSingleOrDoubleDeck) return Action.Double;
    }
    return Action.Hit;
  }

  if (total === 10) {
    if (dealerUpValue <= 9 && canDouble) return Action.Double;
    return Action.Hit;
  }

  if (total === 9) {
    if (dealerUpValue >= 3 && dealerUpValue <= 6 && canDouble) return Action.Double;
    return Action.Hit;
  }

  return Action.Hit;
}

// --- Inlined action validation ---
// Returns the action to actually execute, falling back when requested action is unavailable

function validateAction(
  action: Action,
  hand: SimHand,
  numHands: number,
  rc: RuleConstants,
): Action {
  if (action === Action.Hit || action === Action.Stand) return action;

  if (action === Action.Surrender) {
    // Surrender requires: allowed by rules, 2 cards, not split
    if (rc.canSurrender && hand.cardCount === 2 && !hand.isSplit) return Action.Surrender;
    return Action.Stand;
  }

  if (action === Action.Double) {
    if (hand.cardCount !== 2 || hand.isDoubledDown) return Action.Hit;

    const total = hand.total;
    let canDoubleByRestriction = false;
    if (rc.doubleRestriction === "any") {
      canDoubleByRestriction = true;
    } else if (rc.doubleRestriction === "9-11") {
      canDoubleByRestriction = total >= 9 && total <= 11;
    } else if (rc.doubleRestriction === "10-11") {
      canDoubleByRestriction = total >= 10 && total <= 11;
    }

    if (!canDoubleByRestriction) return Action.Hit;
    if (hand.isSplit && !rc.isDAS) return Action.Hit;

    return Action.Double;
  }

  if (action === Action.Split) {
    if (hand.cardCount !== 2 || hand.cards[0] !== hand.cards[1]) return Action.Hit;
    if (numHands >= rc.maxSplitHands) return Action.Hit;
    // Split aces re-split check
    if (hand.isSplitAces) {
      if (hand.cards[0] === 1 && hand.cards[1] === 1 && rc.resplitAces && numHands < rc.maxSplitHands) {
        return Action.Split;
      }
      return Action.Stand;
    }
    return Action.Split;
  }

  return Action.Stand;
}

// --- Simulation Result ---

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

// --- Main simulation ---

export function simulateHouseEdge(
  numHands: number = 10000,
  rules: HouseRules = DEFAULT_HOUSE_RULES,
  onProgress?: (completed: number, total: number) => void,
): SimulationResult {
  const rc = precomputeRules(rules);
  const shoe = createShoe(rc.decks);
  const shoeSize = shoe.length;
  let deckIdx = 0;

  shuffleShoe(shoe);

  const pool = new HandPool();
  const dealerHand = new SimHand();

  // Accumulator
  let totalBet = 0;
  let totalReturned = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let blackjacks = 0;
  let surrenders = 0;

  for (let i = 0; i < numHands; i++) {
    // Check reshuffle — ensure enough cards for a full round (worst case ~30 cards)
    if (shoeSize - deckIdx < Math.max(rc.minCards, 30)) {
      shuffleShoe(shoe);
      deckIdx = 0;
    }

    // Reset hands
    const playerHand = pool.get(0);
    playerHand.reset();
    dealerHand.reset();

    // Deal initial cards
    playerHand.addCard(shoe[deckIdx++]);
    dealerHand.addCard(shoe[deckIdx++]);
    playerHand.addCard(shoe[deckIdx++]);

    if (!rc.noHoleCard) {
      dealerHand.addCard(shoe[deckIdx++]);
    }

    // Check naturals
    const playerBJ = playerHand.isBlackjack && !playerHand.isSplitAces;
    const dealerBJ = dealerHand.isBlackjack;

    if (playerBJ || dealerBJ) {
      const bet = 1;
      totalBet += bet;
      if (playerBJ && !dealerBJ) {
        totalReturned += bet + bet * rc.bjPayMultiplier;
        blackjacks++;
        wins++;
      } else if (dealerBJ && !playerBJ) {
        losses++;
      } else {
        // Both blackjack = push
        totalReturned += bet;
        pushes++;
      }
      if (onProgress && i % 1000 === 0) onProgress(i, numHands);
      continue;
    }

    // Play player hands (with splits)
    let numPlayerHands = 1;
    let currentHandIndex = 0;

    // Track which pool slots are active hands
    // playerHand is pool.get(0), splits go to pool.get(1), pool.get(2), etc.

    while (currentHandIndex < numPlayerHands) {
      const hand = pool.get(currentHandIndex);

      // Split aces: auto-stand after receiving one card
      if (hand.isSplitAces && hand.cardCount === 2) {
        // Check if can resplit aces
        if (hand.cards[0] === 1 && hand.cards[1] === 1 && rc.resplitAces && numPlayerHands < rc.maxSplitHands) {
          // Strategy always splits aces
          const card1Rank = hand.cards[0];
          const card2Rank = hand.cards[1];

          const newHand1 = hand; // reuse current slot
          const newHand2Idx = numPlayerHands;
          const newHand2 = pool.get(newHand2Idx);
          newHand2.reset();

          newHand1.reset();
          newHand1.isSplit = true;
          newHand1.isSplitAces = true;
          newHand1.setFirstCard(card1Rank);
          newHand1.addCard(shoe[deckIdx++]);

          newHand2.isSplit = true;
          newHand2.isSplitAces = true;
          newHand2.setFirstCard(card2Rank);
          newHand2.addCard(shoe[deckIdx++]);

          numPlayerHands++;
          continue; // re-check current hand (it may be another pair of aces)
        }
        hand.isStanding = true;
        currentHandIndex++;
        continue;
      }

      while (!hand.isStanding && !hand.isSurrendered && !hand.isBusted) {
        const dealerUpValue = RANK_VALUE[dealerHand.cards[0]];
        const action = getStrategyAction(hand, dealerUpValue, rc);
        const validated = validateAction(action, hand, numPlayerHands, rc);

        if (validated !== action) {
          // Fallback logic matching simulation.ts behavior
          if (action === Action.Double && validated === Action.Hit) {
            // Double not available -> hit then stand
            hand.addCard(shoe[deckIdx++]);
            hand.isStanding = true;
            break;
          }
          if (action === Action.Split && validated === Action.Hit) {
            // Split not available -> hit then stand
            hand.addCard(shoe[deckIdx++]);
            hand.isStanding = true;
            break;
          }
          // Other fallback: stand
          hand.isStanding = true;
          break;
        }

        if (validated === Action.Stand) {
          hand.isStanding = true;
          break;
        }

        if (validated === Action.Surrender) {
          hand.isSurrendered = true;
          break;
        }

        if (validated === Action.Hit) {
          hand.addCard(shoe[deckIdx++]);
          continue;
        }

        if (validated === Action.Double) {
          hand.addCard(shoe[deckIdx++]);
          hand.isDoubledDown = true;
          hand.isStanding = true;
          break;
        }

        if (validated === Action.Split) {
          const card1Rank = hand.cards[0];
          const card2Rank = hand.cards[1];
          const isSplittingAces = card1Rank === 1;

          const newHand1 = hand; // reuse current slot
          const newHand2Idx = numPlayerHands;
          const newHand2 = pool.get(newHand2Idx);
          newHand2.reset();

          newHand1.reset();
          newHand1.isSplit = true;
          newHand1.isSplitAces = isSplittingAces || hand.isSplitAces;
          newHand1.setFirstCard(card1Rank);
          newHand1.addCard(shoe[deckIdx++]);

          newHand2.isSplit = true;
          newHand2.isSplitAces = isSplittingAces || hand.isSplitAces;
          newHand2.setFirstCard(card2Rank);
          newHand2.addCard(shoe[deckIdx++]);

          numPlayerHands++;
          continue;
        }
      }

      currentHandIndex++;
    }

    // Determine if dealer needs to play
    let allBustedOrSurrendered = true;
    for (let h = 0; h < numPlayerHands; h++) {
      const ph = pool.get(h);
      if (!ph.isBusted && !ph.isSurrendered) {
        allBustedOrSurrendered = false;
        break;
      }
    }

    if (!allBustedOrSurrendered) {
      // Deal hole card if no-hole-card rule
      if (rc.noHoleCard && dealerHand.cardCount === 1) {
        dealerHand.addCard(shoe[deckIdx++]);
      }

      // Dealer plays
      while (true) {
        const dt = dealerHand.total;
        if (dt > 21) break;
        if (dt > 17) break;
        if (dt === 17 && !dealerHand.isSoft) break;
        if (dt === 17 && dealerHand.isSoft && !rc.hitSoft17) break;
        dealerHand.addCard(shoe[deckIdx++]);
      }
    }

    // Score each player hand
    const dealerTotal = dealerHand.total;
    const dealerIsBJ = dealerHand.isBlackjack;

    let roundBet = 0;
    let roundReturned = 0;
    let roundSurrenders = 0;

    for (let h = 0; h < numPlayerHands; h++) {
      const ph = pool.get(h);
      const bet = ph.isDoubledDown ? 2 : 1;
      roundBet += bet;

      if (ph.isSurrendered) {
        roundReturned += bet * 0.5;
        roundSurrenders++;
        continue;
      }

      if (ph.isBusted) {
        // lose - returned 0
        continue;
      }

      const playerBJHand = ph.isBlackjack && !ph.isSplitAces;
      if (playerBJHand && !dealerIsBJ) {
        roundReturned += bet + bet * rc.bjPayMultiplier;
        continue;
      }
      if (dealerIsBJ && !playerBJHand) {
        continue; // lose
      }

      const pt = ph.total;
      if (dealerTotal > 21) {
        roundReturned += bet * 2; // win
        continue;
      }
      if (pt > dealerTotal) {
        roundReturned += bet * 2; // win
      } else if (pt === dealerTotal) {
        roundReturned += bet; // push
      }
      // else lose
    }

    totalBet += roundBet;
    totalReturned += roundReturned;
    surrenders += roundSurrenders;

    // Classify round result (matching original simulation.ts logic)
    const netResult = roundReturned - roundBet;
    if (netResult >= roundBet * 1.4) {
      blackjacks++;
      wins++;
    } else if (netResult > 0) {
      wins++;
    } else if (netResult === 0) {
      pushes++;
    } else if (roundSurrenders > 0) {
      losses += roundSurrenders;
    } else {
      losses++;
    }

    if (onProgress && i % 1000 === 0) onProgress(i, numHands);
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
