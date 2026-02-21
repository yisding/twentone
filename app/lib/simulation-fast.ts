import { HouseRules, DEFAULT_HOUSE_RULES } from "./types";
import { isEarlySurrender } from "./surrender";

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
  isEarlySurrender: boolean;
  blockSurrenderVsAce: boolean;
  isDAS: boolean;
  isSingleOrDoubleDeck: boolean;
  doubleRestriction: string;
  doubleRestrictionMode: 0 | 1 | 2; // 0:any, 1:9-11, 2:10-11
  resplitAces: boolean;
  maxSplitHands: number;
  noHoleCard: boolean;
  bjPayMultiplier: number;
  minCards: number;
  decks: number;
  hardTableNoDouble: Uint8Array;
  hardTableCanDouble: Uint8Array;
  softTableNoDouble: Uint8Array;
  softTableCanDouble: Uint8Array;
  pairTable: Uint8Array;
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

const DEALER_DIM = 12;
const TOTAL_DIM = 22;

function tableIndex(totalOrPair: number, dealerUpValue: number): number {
  return totalOrPair * DEALER_DIM + dealerUpValue;
}

function buildHardTables(): { noDouble: Uint8Array; canDouble: Uint8Array } {
  const noDouble = new Uint8Array(TOTAL_DIM * DEALER_DIM);
  const canDouble = new Uint8Array(TOTAL_DIM * DEALER_DIM);
  noDouble.fill(Action.Hit);
  canDouble.fill(Action.Hit);

  for (let dealer = 2; dealer <= 11; dealer++) {
    for (let total = 17; total <= 21; total++) {
      noDouble[tableIndex(total, dealer)] = Action.Stand;
      canDouble[tableIndex(total, dealer)] = Action.Stand;
    }

    for (let total = 13; total <= 16; total++) {
      const action = dealer <= 6 ? Action.Stand : Action.Hit;
      noDouble[tableIndex(total, dealer)] = action;
      canDouble[tableIndex(total, dealer)] = action;
    }

    const hard12Action = dealer >= 4 && dealer <= 6 ? Action.Stand : Action.Hit;
    noDouble[tableIndex(12, dealer)] = hard12Action;
    canDouble[tableIndex(12, dealer)] = hard12Action;

    noDouble[tableIndex(11, dealer)] = Action.Hit;
    canDouble[tableIndex(11, dealer)] = Action.Double;

    noDouble[tableIndex(10, dealer)] = Action.Hit;
    canDouble[tableIndex(10, dealer)] = dealer <= 9 ? Action.Double : Action.Hit;

    noDouble[tableIndex(9, dealer)] = Action.Hit;
    canDouble[tableIndex(9, dealer)] = dealer >= 3 && dealer <= 6 ? Action.Double : Action.Hit;
  }

  return { noDouble, canDouble };
}

function buildSoftTables(hitSoft17: boolean): { noDouble: Uint8Array; canDouble: Uint8Array } {
  const noDouble = new Uint8Array(TOTAL_DIM * DEALER_DIM);
  const canDouble = new Uint8Array(TOTAL_DIM * DEALER_DIM);
  noDouble.fill(Action.Hit);
  canDouble.fill(Action.Hit);

  for (let dealer = 2; dealer <= 11; dealer++) {
    for (let total = 19; total <= 21; total++) {
      noDouble[tableIndex(total, dealer)] = Action.Stand;
      canDouble[tableIndex(total, dealer)] = Action.Stand;
    }

    noDouble[tableIndex(18, dealer)] = dealer >= 9 ? Action.Hit : Action.Stand;
    canDouble[tableIndex(18, dealer)] = dealer >= 9 ? Action.Hit : dealer >= 7 ? Action.Stand : Action.Double;

    noDouble[tableIndex(17, dealer)] = Action.Hit;
    canDouble[tableIndex(17, dealer)] = dealer >= 3 && dealer <= 6 ? Action.Double : Action.Hit;

    noDouble[tableIndex(16, dealer)] = Action.Hit;
    noDouble[tableIndex(15, dealer)] = Action.Hit;
    canDouble[tableIndex(16, dealer)] = dealer >= 4 && dealer <= 6 ? Action.Double : Action.Hit;
    canDouble[tableIndex(15, dealer)] = dealer >= 4 && dealer <= 6 ? Action.Double : Action.Hit;

    noDouble[tableIndex(14, dealer)] = Action.Hit;
    noDouble[tableIndex(13, dealer)] = Action.Hit;
    canDouble[tableIndex(14, dealer)] = dealer >= 5 && dealer <= 6 ? Action.Double : Action.Hit;
    canDouble[tableIndex(13, dealer)] = dealer >= 5 && dealer <= 6 ? Action.Double : Action.Hit;
  }

  if (hitSoft17) {
    canDouble[tableIndex(19, 6)] = Action.Double;
    canDouble[tableIndex(18, 2)] = Action.Double;
  }

  return { noDouble, canDouble };
}

function buildPairTable(isDAS: boolean, isSingleOrDoubleDeck: boolean): Uint8Array {
  const pairTable = new Uint8Array(TOTAL_DIM * DEALER_DIM);
  pairTable.fill(Action.Hit);

  for (let dealer = 2; dealer <= 11; dealer++) {
    pairTable[tableIndex(11, dealer)] = Action.Split;
    pairTable[tableIndex(10, dealer)] = Action.Stand;
    pairTable[tableIndex(9, dealer)] =
      dealer === 7 || dealer === 10 || dealer === 11 ? Action.Stand : Action.Split;
    pairTable[tableIndex(8, dealer)] = Action.Split;
    pairTable[tableIndex(7, dealer)] =
      dealer <= 7 || (dealer === 8 && isSingleOrDoubleDeck) ? Action.Split : Action.Hit;
    pairTable[tableIndex(6, dealer)] =
      isDAS ? (dealer >= 2 && dealer <= 6 ? Action.Split : Action.Hit) :
        (dealer >= 3 && dealer <= 6 ? Action.Split : Action.Hit);
    pairTable[tableIndex(5, dealer)] = dealer <= 9 ? Action.Double : Action.Hit;
    pairTable[tableIndex(4, dealer)] = isDAS && (dealer === 5 || dealer === 6) ? Action.Split : Action.Hit;
    const lowPairAction = isDAS ? (dealer >= 2 && dealer <= 7 ? Action.Split : Action.Hit) :
      (dealer >= 4 && dealer <= 7 ? Action.Split : Action.Hit);
    pairTable[tableIndex(3, dealer)] = lowPairAction;
    pairTable[tableIndex(2, dealer)] = lowPairAction;
  }

  return pairTable;
}

function precomputeRules(rules: HouseRules): RuleConstants {
  const doubleRestrictionMode =
    rules.doubleRestriction === "any" ? 0 :
    rules.doubleRestriction === "9-11" ? 1 : 2;
  const hardTables = buildHardTables();
  const softTables = buildSoftTables(rules.hitSoft17);

  return {
    hitSoft17: rules.hitSoft17,
    canSurrender: rules.surrenderAllowed !== "none",
    isEarlySurrender: isEarlySurrender(rules),
    blockSurrenderVsAce: rules.surrenderAllowed === "enhcNoAce",
    isDAS: rules.doubleAfterSplit,
    isSingleOrDoubleDeck: rules.decks <= 2,
    doubleRestriction: rules.doubleRestriction,
    doubleRestrictionMode,
    resplitAces: rules.resplitAces,
    maxSplitHands: rules.maxSplitHands,
    noHoleCard: rules.noHoleCard,
    bjPayMultiplier: rules.blackjackPays === "3:2" ? 1.5 : rules.blackjackPays === "6:5" ? 1.2 : 1,
    minCards: (52 * rules.decks * 0.25) | 0,
    decks: rules.decks,
    hardTableNoDouble: hardTables.noDouble,
    hardTableCanDouble: hardTables.canDouble,
    softTableNoDouble: softTables.noDouble,
    softTableCanDouble: softTables.canDouble,
    pairTable: buildPairTable(rules.doubleAfterSplit, rules.decks <= 2),
  };
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
    const pairAction = rc.pairTable[tableIndex(pairVal, dealerUpValue)];

    if (pairVal === 8) {
      if (canSurrenderHand) {
        if (rc.isEarlySurrender && (dealerUpValue === 10 || dealerUpValue === 11)) {
          return Action.Surrender;
        }
        if (!rc.isEarlySurrender && rc.hitSoft17 && dealerUpValue === 11) {
          return Action.Surrender;
        }
      }
      return pairAction;
    }

    if (pairVal === 7) {
      if (canSurrenderHand && rc.isEarlySurrender && (dealerUpValue === 10 || dealerUpValue === 11)) {
        return Action.Surrender;
      }
      return pairAction;
    }

    if (pairVal === 6) {
      if (canSurrenderHand && rc.isEarlySurrender && dealerUpValue === 11) {
        return Action.Surrender;
      }
      return pairAction;
    }

    if (pairVal === 3 || pairVal === 2) {
      if (pairVal === 3 && canSurrenderHand && rc.isEarlySurrender && dealerUpValue === 11) {
        return Action.Surrender;
      }
      return pairAction;
    }

    return pairAction;
  }

  const total = hand.total;
  const canDouble =
    hand.cardCount === 2 &&
    (!hand.isSplit || rc.isDAS) &&
    (rc.doubleRestrictionMode === 0 ||
      (rc.doubleRestrictionMode === 1 && total >= 9 && total <= 11) ||
      (rc.doubleRestrictionMode === 2 && total >= 10 && total <= 11));

  // Soft total strategy
  if (hand.isSoft && total <= 21) {
    return (canDouble ? rc.softTableCanDouble : rc.softTableNoDouble)[tableIndex(total, dealerUpValue)];
  }

  // Hard total strategy
  if (canSurrenderHand) {
    if (rc.isEarlySurrender) {
      if (dealerUpValue === 11 && ((total >= 5 && total <= 7) || (total >= 12 && total <= 17))) {
        return Action.Surrender;
      }
      if (dealerUpValue === 10 && total >= 14 && total <= 16) {
        return Action.Surrender;
      }
    } else {
      if (total === 16 && dealerUpValue >= 9 && !(dealerUpValue === 9 && rc.decks < 4)) {
        return Action.Surrender;
      }
      if (total === 15 && dealerUpValue === 10) return Action.Surrender;
      if (rc.hitSoft17) {
        if (total === 15 && dealerUpValue === 11) return Action.Surrender;
        if (total === 17 && dealerUpValue === 11) return Action.Surrender;
      }
    }
  }

  if (total === 11 && canDouble && !rc.hitSoft17 && dealerUpValue === 11 && !rc.isSingleOrDoubleDeck) {
    return Action.Hit;
  }

  return (canDouble ? rc.hardTableCanDouble : rc.hardTableNoDouble)[tableIndex(total, dealerUpValue)];
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

  const drawRank = (): number => {
    if (deckIdx >= shoeSize) {
      shuffleShoe(shoe);
      deckIdx = 0;
    }
    return shoe[deckIdx++];
  };

  // Accumulator
  let totalBet = 0;
  let totalReturned = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let blackjacks = 0;
  let surrenders = 0;

  for (let i = 0; i < numHands; i++) {
    // Match simulation.ts reshuffle behavior so edge comparisons are apples-to-apples.
    if (shoeSize - deckIdx < rc.minCards) {
      shuffleShoe(shoe);
      deckIdx = 0;
    }

    // Reset hands
    const playerHand = pool.get(0);
    playerHand.reset();
    dealerHand.reset();

    // Deal initial cards
    playerHand.addCard(drawRank());
    dealerHand.addCard(drawRank());
    playerHand.addCard(drawRank());

    if (!rc.noHoleCard) {
      dealerHand.addCard(drawRank());
    }

    // Check naturals
    const playerBJ = playerHand.isBlackjack && !playerHand.isSplit;
    let dealerBJ = dealerHand.isBlackjack;

    if (playerBJ || dealerBJ) {
      // Under no hole card rules: only deal one card if dealer shows 10/Ace
      if (rc.noHoleCard && playerBJ && dealerHand.cardCount === 1) {
        const upCardValue = RANK_VALUE[dealerHand.cards[0]];
        if (upCardValue === 10 || upCardValue === 11) {
          dealerHand.addCard(shoe[deckIdx++]);
          dealerBJ = dealerHand.isBlackjack;
        }
      }

      const bet = 1;
      totalBet += bet;
      if (playerBJ && !dealerBJ) {
        totalReturned += bet + bet * rc.bjPayMultiplier;
        blackjacks++;
        wins++;
      } else if (dealerBJ && !playerBJ) {
        if (!rc.noHoleCard && rc.isEarlySurrender) {
          const action = getStrategyAction(playerHand, RANK_VALUE[dealerHand.cards[0]], rc);
          if (action === Action.Surrender) {
            totalReturned += bet * 0.5;
            surrenders++;
            losses++;
          } else {
            losses++;
          }
        } else {
          losses++;
        }
      } else {
        // Both blackjack = push
        totalReturned += bet;
        pushes++;
      }
      if (onProgress && (i & 1023) === 0) onProgress(i, numHands);
      continue;
    }

    // Play player hands (with splits)
    let numPlayerHands = 1;
    let currentHandIndex = 0;

    // Track which pool slots are active hands
    // playerHand is pool.get(0), splits go to pool.get(1), pool.get(2), etc.

    const dealerUpValue = RANK_VALUE[dealerHand.cards[0]];

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
          newHand1.addCard(drawRank());

          newHand2.isSplit = true;
          newHand2.isSplitAces = true;
          newHand2.setFirstCard(card2Rank);
          newHand2.addCard(drawRank());

          numPlayerHands++;
          continue; // re-check current hand (it may be another pair of aces)
        }
        hand.isStanding = true;
        currentHandIndex++;
        continue;
      }

      while (!hand.isStanding && !hand.isSurrendered && !hand.isBusted) {
        const action = getStrategyAction(hand, dealerUpValue, rc);

        if (action === Action.Stand) {
          hand.isStanding = true;
          break;
        }

        if (action === Action.Hit) {
          hand.addCard(drawRank());
          continue;
        }

        if (action === Action.Surrender) {
          const canSurrenderByUpCard = rc.canSurrender && (!rc.blockSurrenderVsAce || dealerUpValue !== 11);
          if (canSurrenderByUpCard && hand.cardCount === 2 && !hand.isSplit) {
            hand.isSurrendered = true;
            break;
          }
          hand.isStanding = true;
          break;
        }

        if (action === Action.Double) {
          const total = hand.total;
          const canDoubleByRestriction =
            rc.doubleRestrictionMode === 0 ||
            (rc.doubleRestrictionMode === 1 && total >= 9 && total <= 11) ||
            (rc.doubleRestrictionMode === 2 && total >= 10 && total <= 11);

          if (
            hand.cardCount === 2 &&
            !hand.isDoubledDown &&
            canDoubleByRestriction &&
            (!hand.isSplit || rc.isDAS)
          ) {
            hand.addCard(drawRank());
            hand.isDoubledDown = true;
            hand.isStanding = true;
            break;
          }

          hand.addCard(drawRank());
          continue;
        }

        if (action === Action.Split) {
          if (hand.cardCount !== 2 || hand.cards[0] !== hand.cards[1] || numPlayerHands >= rc.maxSplitHands) {
            hand.addCard(drawRank());
            continue;
          }

          if (hand.isSplitAces && (!rc.resplitAces || hand.cards[0] !== 1 || hand.cards[1] !== 1)) {
            hand.isStanding = true;
            break;
          }

          const card1Rank = hand.cards[0];
          const card2Rank = hand.cards[1];
          const isSplittingAces = card1Rank === 1;
          const wasSplitAces = hand.isSplitAces;

          const newHand1 = hand; // reuse current slot
          const newHand2Idx = numPlayerHands;
          const newHand2 = pool.get(newHand2Idx);
          newHand2.reset();

          newHand1.reset();
          newHand1.isSplit = true;
          newHand1.isSplitAces = isSplittingAces || wasSplitAces;
          newHand1.setFirstCard(card1Rank);
          newHand1.addCard(drawRank());

          newHand2.isSplit = true;
          newHand2.isSplitAces = isSplittingAces || wasSplitAces;
          newHand2.setFirstCard(card2Rank);
          newHand2.addCard(drawRank());

          numPlayerHands++;
          continue;
        }

        hand.isStanding = true;
        break;
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
        dealerHand.addCard(drawRank());
      }

      // Dealer plays
      while (true) {
        const dt = dealerHand.total;
        if (dt > 21) break;
        if (dt > 17) break;
        if (dt === 17 && !dealerHand.isSoft) break;
        if (dt === 17 && dealerHand.isSoft && !rc.hitSoft17) break;
        dealerHand.addCard(drawRank());
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

      const playerBJHand = ph.isBlackjack && !ph.isSplit;
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
    } else {
      losses++;
    }

    if (onProgress && (i & 1023) === 0) onProgress(i, numHands);
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
