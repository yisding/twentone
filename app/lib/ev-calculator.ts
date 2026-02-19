/**
 * Combinatorial EV calculator for blackjack using dynamic programming.
 *
 * Supports two modes:
 * - Infinite deck: fixed card probabilities, very fast (~2ms)
 * - Finite deck: 3-card removal from shoe, accounts for composition effects (~50-200ms)
 *
 * Approach:
 * 1. Precompute dealer outcome distributions for each upcard
 * 2. Compute player EV for each action using recursion + memoization
 * 3. Sum over all initial deals weighted by probability to get total game EV
 */

import { HouseRules, DEFAULT_HOUSE_RULES } from "./types";

// === Card value probabilities ===
// 10, J, Q, K all have value 10 → combined probability 4/13 (infinite deck)
// Ace starts as value 11 → probability 1/13 (infinite deck)
const CARD_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const INFINITE_DECK_PROBS = [
  1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 4 / 13,
  1 / 13,
];
const N = 10; // number of distinct card values

// Module-level mutable probability source (defaults to infinite deck)
const currentProbs = INFINITE_DECK_PROBS.slice();

// Dealer distribution array indices
const D17 = 0,
  D18 = 1,
  D19 = 2,
  D20 = 3,
  D21 = 4,
  DBUST = 5;
type DealerDist = Float64Array; // length 6: [P(17), P(18), P(19), P(20), P(21), P(bust)]

// Module-level state set during calculation
const dealerMemo = new Map<number, DealerDist>();
let playerMemo = new Map<number, number>();
let currentDD: DealerDist;
let currentRules: HouseRules;

// === Shoe utilities ===

function makeShoe(decks: number): number[] {
  // Card counts for each of the 10 distinct values
  // Values 2-9: 4 cards per deck each
  // Value 10 (10,J,Q,K): 16 cards per deck
  // Value 11 (Ace): 4 cards per deck
  const shoe = new Array(N);
  for (let i = 0; i < 8; i++) shoe[i] = 4 * decks; // 2-9
  shoe[8] = 16 * decks; // 10-value
  shoe[9] = 4 * decks; // Ace
  return shoe;
}

function shoeToProbs(shoe: number[], total: number): void {
  for (let i = 0; i < N; i++) {
    currentProbs[i] = shoe[i] / total;
  }
}

function setInfiniteProbs(): void {
  for (let i = 0; i < N; i++) currentProbs[i] = INFINITE_DECK_PROBS[i];
}

// === Hand arithmetic ===

function addCard(
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

// === Dealer outcome distributions ===

// Recursively compute dealer outcome probabilities from a given hand state
function dealerRec(total: number, isSoft: boolean): DealerDist {
  // Busted
  if (total > 21) {
    const d = new Float64Array(6);
    d[DBUST] = 1;
    return d;
  }

  // Must stand?
  const mustStand =
    total > 17 || (total === 17 && !(isSoft && currentRules.hitSoft17));
  if (mustStand) {
    const d = new Float64Array(6);
    d[total - 17] = 1;
    return d;
  }

  // Check memo
  const key = total * 2 + (isSoft ? 1 : 0);
  const cached = dealerMemo.get(key);
  if (cached) return cached;

  // Must hit: sum over all possible next cards
  const d = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    const sub = dealerRec(nt, ns);
    const p = currentProbs[i];
    for (let j = 0; j < 6; j++) d[j] += p * sub[j];
  }

  dealerMemo.set(key, d);
  return d;
}

// For each upcard, compute distribution by enumerating hole cards
function computeAllDealerDists(): Map<number, DealerDist> {
  dealerMemo.clear();
  const result = new Map<number, DealerDist>();

  for (const upcard of CARD_VALUES) {
    const dist = new Float64Array(6);

    for (let i = 0; i < N; i++) {
      const holeCard = CARD_VALUES[i];
      // Build two-card hand
      const [t1, s1] = addCard(upcard, upcard === 11, holeCard);
      const sub = dealerRec(t1, s1);
      const p = currentProbs[i];
      for (let j = 0; j < 6; j++) dist[j] += p * sub[j];
    }

    result.set(upcard, dist);
  }

  return result;
}

// Condition dealer distribution on no-blackjack (for peek games)
function conditionOnNoBJ(
  rawDist: DealerDist,
  upcard: number,
  noHoleCard: boolean,
): { dist: DealerDist; bjProb: number } {
  // Probability of dealer blackjack from this upcard (uses current probs)
  let bjProb = 0;
  if (upcard === 11) bjProb = currentProbs[8]; // Ace up, hole card is 10-value
  else if (upcard === 10) bjProb = currentProbs[9]; // 10 up, hole card is Ace

  if (bjProb === 0) {
    return { dist: rawDist, bjProb: 0 };
  }

  // Remove BJ contribution from dist[D21] and renormalize
  const dist = new Float64Array(6);
  for (let j = 0; j < 6; j++) dist[j] = rawDist[j];
  dist[D21] -= bjProb;

  if (!noHoleCard) {
    // Peek game: condition on no BJ
    const scale = 1 / (1 - bjProb);
    for (let j = 0; j < 6; j++) dist[j] *= scale;
  }
  // For ENHC (noHoleCard): don't renormalize, bjProb handled separately

  return { dist, bjProb };
}

// === Player EV computation ===

// EV of standing with a given total
function evStand(playerTotal: number): number {
  if (playerTotal > 21) return -1;
  const dd = currentDD;
  let ev = dd[DBUST]; // dealer busts → win
  for (let dt = 17; dt <= 21; dt++) {
    const dp = dd[dt - 17];
    if (playerTotal > dt) ev += dp;
    else if (playerTotal < dt) ev -= dp;
    // push: 0
  }
  return ev;
}

// Optimal EV for a player hand (hit/stand/double/surrender)
// Split is handled separately since it needs specific card values
function evOptimal(
  total: number,
  isSoft: boolean,
  canDouble: boolean,
  canSurrender: boolean,
): number {
  if (total > 21) return -1;

  // Pack state into integer key: total(5 bits) | soft(1) | dbl(1) | surr(1)
  const key =
    (total << 3) |
    ((isSoft ? 1 : 0) << 2) |
    ((canDouble ? 1 : 0) << 1) |
    (canSurrender ? 1 : 0);
  const cached = playerMemo.get(key);
  if (cached !== undefined) return cached;

  // Stand
  let best = evStand(total);

  // Hit (after hitting, can no longer double or surrender)
  let hitEV = 0;
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    hitEV += currentProbs[i] * evOptimal(nt, ns, false, false);
  }
  if (hitEV > best) best = hitEV;

  // Double (only on first two cards)
  if (canDouble) {
    const r = currentRules.doubleRestriction;
    let allowed = true;
    if (r === "9-11") allowed = total >= 9 && total <= 11;
    else if (r === "10-11") allowed = total >= 10 && total <= 11;

    if (allowed) {
      let dblEV = 0;
      for (let i = 0; i < N; i++) {
        const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
        dblEV += currentProbs[i] * (nt > 21 ? -1 : evStand(nt));
      }
      dblEV *= 2; // doubled bet
      if (dblEV > best) best = dblEV;
    }
  }

  // Surrender
  if (canSurrender) {
    if (-0.5 > best) best = -0.5;
  }

  playerMemo.set(key, best);
  return best;
}

// EV of one hand after splitting, before drawing second card
function splitHandEV(
  splitCard: number,
  resplitsLeft: number,
  isAces: boolean,
): number {
  let ev = 0;

  for (let i = 0; i < N; i++) {
    const secondCard = CARD_VALUES[i];
    const [total, soft] = addCard(splitCard, splitCard === 11, secondCard);

    // Can re-split? Same card value, slots available, and aces can resplit if rule allows
    const canResplit =
      secondCard === splitCard &&
      resplitsLeft > 0 &&
      (!isAces || currentRules.resplitAces);

    if (isAces && !canResplit) {
      // Split aces: one card only, must stand
      ev += currentProbs[i] * evStand(total);
    } else if (canResplit) {
      // Option A: play this hand normally
      const playEV = evOptimal(
        total,
        soft,
        !isAces && currentRules.doubleAfterSplit,
        false,
      );
      // Option B: re-split (this hand becomes 2 new hands)
      const resplitEV = 2 * splitHandEV(splitCard, resplitsLeft - 1, isAces);
      ev += currentProbs[i] * Math.max(playEV, resplitEV);
    } else {
      // Play normally
      ev +=
        currentProbs[i] *
        evOptimal(
          total,
          soft,
          !isAces && currentRules.doubleAfterSplit,
          false,
        );
    }
  }

  return ev;
}

// Total EV of choosing to split a pair
function evSplit(cardValue: number): number {
  const isAces = cardValue === 11;
  const resplitsLeft = currentRules.maxSplitHands - 2;
  return 2 * splitHandEV(cardValue, resplitsLeft, isAces);
}

// === Main EV calculation ===

export interface EVResult {
  playerEV: number;
  houseEdge: number;
  houseEdgePercent: number;
}

// Infinite deck EV calculation (original algorithm)
export function calculateInfiniteDeckEV(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): EVResult {
  currentRules = rules;
  setInfiniteProbs();

  // Step 1: precompute dealer distributions for all upcards
  const allDealerDists = computeAllDealerDists();

  let totalEV = 0;

  // Step 2: iterate over each dealer upcard
  for (let ui = 0; ui < N; ui++) {
    const upcard = CARD_VALUES[ui];
    const upcardProb = currentProbs[ui];

    const rawDist = allDealerDists.get(upcard)!;
    const { dist: dd, bjProb } = conditionOnNoBJ(
      rawDist,
      upcard,
      rules.noHoleCard,
    );

    // Set per-upcard state
    currentDD = dd;
    playerMemo = new Map();

    // Step 3: iterate over all player initial hands
    for (let c1i = 0; c1i < N; c1i++) {
      for (let c2i = 0; c2i < N; c2i++) {
        const c1 = CARD_VALUES[c1i];
        const c2 = CARD_VALUES[c2i];
        const dealProb = currentProbs[c1i] * currentProbs[c2i];

        const [pTotal, pSoft] = addCard(c1, c1 === 11, c2);
        const isPlayerBJ = pTotal === 21; // 2-card 21 = natural
        const isPair = c1 === c2;

        let handEV: number;

        if (isPlayerBJ) {
          // Player blackjack
          const bjPayout =
            rules.blackjackPays === "3:2"
              ? 1.5
              : rules.blackjackPays === "6:5"
                ? 1.2
                : 1.0;
          // Push vs dealer BJ, paid bjPayout otherwise
          handEV = bjProb * 0 + (1 - bjProb) * bjPayout;
        } else {
          // Non-blackjack player hand
          // Determine best play EV (conditioned on no dealer BJ)
          const canSurrenderLate = rules.surrenderAllowed === "late";
          let playEV = evOptimal(pTotal, pSoft, true, canSurrenderLate);

          // Check if splitting is better
          if (isPair && rules.maxSplitHands >= 2) {
            const splitEv = evSplit(c1);
            if (splitEv > playEV) playEV = splitEv;
          }

          if (rules.surrenderAllowed === "early") {
            // Early surrender: decide before dealer peek
            // Surrender EV = -0.5 (unconditional)
            // Play EV = P(dealer BJ)*(-1) + P(no BJ)*playEV
            const playOnEV = bjProb * -1 + (1 - bjProb) * playEV;
            handEV = Math.max(-0.5, playOnEV);
          } else {
            // Late/no surrender: dealer BJ resolved first (peek), then play
            handEV = bjProb * -1 + (1 - bjProb) * playEV;
          }
        }

        totalEV += upcardProb * dealProb * handEV;
      }
    }
  }

  return {
    playerEV: totalEV,
    houseEdge: -totalEV,
    houseEdgePercent: -totalEV * 100,
  };
}

// Finite deck EV calculation (3-card removal)
// For each (upcard, c1, c2): remove 3 cards from shoe, compute draw probabilities
// from the modified shoe, build aggregate dealer distribution, and use the same
// EV computation as infinite deck. Player optimizes against aggregate distribution
// (not per-hole-card), matching real play where hole card is unknown.
export function calculateFiniteDeckEV(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): EVResult {
  currentRules = rules;
  const shoe = makeShoe(rules.decks);
  const totalCards = rules.decks * 52;

  const bjPayout =
    rules.blackjackPays === "3:2"
      ? 1.5
      : rules.blackjackPays === "6:5"
        ? 1.2
        : 1.0;
  const canSurrLate = rules.surrenderAllowed === "late";
  const isEarlySurr = rules.surrenderAllowed === "early";

  let totalEV = 0;
  let totalWeight = 0;

  // For each dealer upcard
  for (let ui = 0; ui < N; ui++) {
    if (shoe[ui] === 0) continue;
    const upcard = CARD_VALUES[ui];
    const pU = shoe[ui] / totalCards;
    shoe[ui]--;
    const total1 = totalCards - 1;

    // For each player card 1
    for (let c1i = 0; c1i < N; c1i++) {
      if (shoe[c1i] === 0) continue;
      const c1 = CARD_VALUES[c1i];
      const pC1 = shoe[c1i] / total1;
      shoe[c1i]--;
      const total2 = total1 - 1;

      // For each player card 2
      for (let c2i = 0; c2i < N; c2i++) {
        if (shoe[c2i] === 0) continue;
        const c2 = CARD_VALUES[c2i];
        const pC2 = shoe[c2i] / total2;
        shoe[c2i]--;
        const total3 = total2 - 1;

        const dealProb = pU * pC1 * pC2;

        // Set draw probabilities from shoe after removing 3 cards
        shoeToProbs(shoe, total3);
        dealerMemo.clear();

        // Build aggregate dealer distribution by enumerating hole cards
        const aggDist = new Float64Array(6);
        for (let hi = 0; hi < N; hi++) {
          if (shoe[hi] === 0) continue;
          const holeCard = CARD_VALUES[hi];
          const [t1, s1] = addCard(upcard, upcard === 11, holeCard);
          const sub = dealerRec(t1, s1);
          const p = currentProbs[hi];
          for (let j = 0; j < 6; j++) aggDist[j] += p * sub[j];
        }

        // Condition on no-BJ (same as infinite deck path)
        const { dist: dd, bjProb } = conditionOnNoBJ(
          aggDist,
          upcard,
          rules.noHoleCard,
        );

        currentDD = dd;
        playerMemo = new Map();

        // Player hand
        const [pTotal, pSoft] = addCard(c1, c1 === 11, c2);
        const isPlayerBJ = pTotal === 21;
        const isPair = c1 === c2;

        let handEV: number;

        if (isPlayerBJ) {
          handEV = bjProb * 0 + (1 - bjProb) * bjPayout;
        } else {
          let playEV = evOptimal(pTotal, pSoft, true, canSurrLate);

          if (isPair && rules.maxSplitHands >= 2) {
            const splitEv = evSplit(c1);
            if (splitEv > playEV) playEV = splitEv;
          }

          if (isEarlySurr) {
            const playOnEV = bjProb * -1 + (1 - bjProb) * playEV;
            handEV = Math.max(-0.5, playOnEV);
          } else {
            handEV = bjProb * -1 + (1 - bjProb) * playEV;
          }
        }

        totalEV += dealProb * handEV;
        totalWeight += dealProb;

        shoe[c2i]++; // undo
      }
      shoe[c1i]++; // undo
    }
    shoe[ui]++; // undo
  }

  // Normalize (totalWeight ≈ 1, but normalize for floating point safety)
  totalEV /= totalWeight;

  return {
    playerEV: totalEV,
    houseEdge: -totalEV,
    houseEdgePercent: -totalEV * 100,
  };
}

// Main entry point: dispatches to finite or infinite deck
export function calculateEV(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): EVResult {
  const decks = rules.decks;
  if (Number.isInteger(decks) && decks >= 1 && decks <= 8) {
    return calculateFiniteDeckEV(rules);
  }
  return calculateInfiniteDeckEV(rules);
}

// === Strategy table generation ===

export type ActionName = "H" | "S" | "D" | "P" | "Rh" | "Rs" | "Rp";

export interface StrategyEntry {
  action: ActionName;
  ev: number;
}

export interface StrategyTable {
  // Hard totals 5-21 vs dealer 2-A
  hard: Map<number, Map<number, StrategyEntry>>;
  // Soft totals 13-21 vs dealer 2-A
  soft: Map<number, Map<number, StrategyEntry>>;
  // Pairs (card value 2-11) vs dealer 2-A
  pairs: Map<number, Map<number, StrategyEntry>>;
}

export function generateStrategyTable(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): StrategyTable {
  currentRules = rules;

  const useFiniteDeck =
    Number.isInteger(rules.decks) && rules.decks >= 1 && rules.decks <= 8;

  let shoe: number[] | null = null;
  let totalCards = 0;

  if (useFiniteDeck) {
    shoe = makeShoe(rules.decks);
    totalCards = rules.decks * 52;
  } else {
    setInfiniteProbs();
  }

  // For infinite deck, precompute all dealer dists (shared memo across upcards)
  let allDealerDists: Map<number, DealerDist> | null = null;
  if (!useFiniteDeck) {
    allDealerDists = computeAllDealerDists();
  }

  const hard = new Map<number, Map<number, StrategyEntry>>();
  const soft = new Map<number, Map<number, StrategyEntry>>();
  const pairs = new Map<number, Map<number, StrategyEntry>>();

  // For each dealer upcard
  for (let ui = 0; ui < N; ui++) {
    const upcard = CARD_VALUES[ui];
    let dd: DealerDist;

    if (useFiniteDeck) {
      // Remove upcard from shoe, set probs from shoe_1
      shoe![ui]--;
      const total1 = totalCards - 1;
      shoeToProbs(shoe!, total1);
      dealerMemo.clear();

      // Build aggregate dealer distribution by enumerating hole cards
      const aggDist = new Float64Array(6);
      for (let i = 0; i < N; i++) {
        const holeCard = CARD_VALUES[i];
        const [t1, s1] = addCard(upcard, upcard === 11, holeCard);
        const sub = dealerRec(t1, s1);
        const p = currentProbs[i];
        for (let j = 0; j < 6; j++) aggDist[j] += p * sub[j];
      }

      ({ dist: dd } = conditionOnNoBJ(aggDist, upcard, rules.noHoleCard));
    } else {
      const rawDist = allDealerDists!.get(upcard)!;
      ({ dist: dd } = conditionOnNoBJ(rawDist, upcard, rules.noHoleCard));
    }

    currentDD = dd;
    playerMemo = new Map();

    const dealerKey = upcard === 11 ? 11 : upcard; // 11 = Ace

    // Hard totals 5-21
    for (let total = 5; total <= 21; total++) {
      const canSurr = rules.surrenderAllowed === "late";

      const standEV = evStand(total);
      let hitEV = 0;
      for (let i = 0; i < N; i++) {
        const [nt, ns] = addCard(total, false, CARD_VALUES[i]);
        hitEV += currentProbs[i] * evOptimal(nt, ns, false, false);
      }

      let bestAction: ActionName = standEV >= hitEV ? "S" : "H";
      let bestEV = Math.max(standEV, hitEV);

      // Double
      let dblAllowed = true;
      if (rules.doubleRestriction === "9-11")
        dblAllowed = total >= 9 && total <= 11;
      else if (rules.doubleRestriction === "10-11")
        dblAllowed = total >= 10 && total <= 11;
      if (dblAllowed) {
        let dblEV = 0;
        for (let i = 0; i < N; i++) {
          const [nt] = addCard(total, false, CARD_VALUES[i]);
          dblEV += currentProbs[i] * (nt > 21 ? -1 : evStand(nt));
        }
        dblEV *= 2;
        if (dblEV > bestEV) {
          bestAction = "D";
          bestEV = dblEV;
        }
      }

      // Surrender (fallback label: Rh = else hit, Rs = else stand)
      if (canSurr && -0.5 > bestEV) {
        bestAction = standEV >= hitEV ? "Rs" : "Rh";
        bestEV = -0.5;
      }

      if (!hard.has(total)) hard.set(total, new Map());
      hard.get(total)!.set(dealerKey, { action: bestAction, ev: bestEV });
    }

    // Soft totals 13-21 (A+2 through A+10)
    for (let total = 13; total <= 21; total++) {
      const canSurr = rules.surrenderAllowed === "late";

      const standEV = evStand(total);
      let hitEV = 0;
      for (let i = 0; i < N; i++) {
        const [nt, ns] = addCard(total, true, CARD_VALUES[i]);
        hitEV += currentProbs[i] * evOptimal(nt, ns, false, false);
      }

      let bestAction: ActionName = standEV >= hitEV ? "S" : "H";
      let bestEV = Math.max(standEV, hitEV);

      // Double
      let dblAllowed = true;
      if (rules.doubleRestriction === "9-11")
        dblAllowed = total >= 9 && total <= 11;
      else if (rules.doubleRestriction === "10-11")
        dblAllowed = total >= 10 && total <= 11;
      if (dblAllowed) {
        let dblEV = 0;
        for (let i = 0; i < N; i++) {
          const [nt] = addCard(total, true, CARD_VALUES[i]);
          dblEV += currentProbs[i] * (nt > 21 ? -1 : evStand(nt));
        }
        dblEV *= 2;
        if (dblEV > bestEV) {
          bestAction = "D";
          bestEV = dblEV;
        }
      }

      if (canSurr && -0.5 > bestEV) {
        bestAction = standEV >= hitEV ? "Rs" : "Rh";
        bestEV = -0.5;
      }

      if (!soft.has(total)) soft.set(total, new Map());
      soft.get(total)!.set(dealerKey, { action: bestAction, ev: bestEV });
    }

    // Pairs (card value 2-11)
    for (const cv of CARD_VALUES) {
      const [total, isSoft] = addCard(cv, cv === 11, cv);
      const canSurr = rules.surrenderAllowed === "late";

      // Non-split optimal EV
      const noSplitEV = evOptimal(total, isSoft, true, canSurr);

      // Split EV
      const splitEv =
        rules.maxSplitHands >= 2 ? evSplit(cv) : -Infinity;

      let bestAction: ActionName;
      let bestEV: number;

      if (splitEv > noSplitEV) {
        bestAction = "P";
        bestEV = splitEv;
      } else {
        // Determine the non-split action
        const standEV = evStand(total);
        let hitEV = 0;
        for (let i = 0; i < N; i++) {
          const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
          hitEV += currentProbs[i] * evOptimal(nt, ns, false, false);
        }
        bestAction = standEV >= hitEV ? "S" : "H";
        bestEV = Math.max(standEV, hitEV);

        let dblAllowed = true;
        if (rules.doubleRestriction === "9-11")
          dblAllowed = total >= 9 && total <= 11;
        else if (rules.doubleRestriction === "10-11")
          dblAllowed = total >= 10 && total <= 11;
        if (dblAllowed) {
          let dblEV = 0;
          for (let i = 0; i < N; i++) {
            const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
            dblEV += currentProbs[i] * (nt > 21 ? -1 : evStand(nt));
          }
          dblEV *= 2;
          if (dblEV > bestEV) {
            bestAction = "D";
            bestEV = dblEV;
          }
        }

        if (canSurr && -0.5 > bestEV) {
          bestAction = standEV >= hitEV ? "Rs" : "Rh";
          bestEV = -0.5;
        }
      }

      if (!pairs.has(cv)) pairs.set(cv, new Map());
      pairs.get(cv)!.set(dealerKey, { action: bestAction, ev: bestEV });
    }

    // Restore shoe for finite deck
    if (useFiniteDeck) {
      shoe![ui]++;
    }
  }

  return { hard, soft, pairs };
}
