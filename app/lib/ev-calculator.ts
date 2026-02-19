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
import { CARD_VALUES, INFINITE_DECK_PROBS, N, addCard } from "./ev-common";

// Module-level mutable probability source (defaults to infinite deck)
const currentProbs = INFINITE_DECK_PROBS.slice();

// Dealer distribution array indices: [P(17), P(18), P(19), P(20), P(21), P(bust)]
const D21 = 4,
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
  if (totalWeight > 1e-10) {
    totalEV /= totalWeight;
  }

  return {
    playerEV: totalEV,
    houseEdge: -totalEV,
    houseEdgePercent: -totalEV * 100,
  };
}

// === Composition-dependent (CD) EV calculation ===
// Tracks exact shoe state through every draw for exact results.
// Dealer and player draws each independently deplete the shoe.

const dealerCDMemo = new Map<string, DealerDist>();
let playerCDMemo = new Map<string, number>();

function shoeKey(s: number[]): string {
  return `${s[0]}.${s[1]}.${s[2]}.${s[3]}.${s[4]}.${s[5]}.${s[6]}.${s[7]}.${s[8]}.${s[9]}`;
}

// CD dealer: track exact shoe composition through all dealer draws
function dealerRecCD(
  total: number,
  isSoft: boolean,
  shoe: number[],
  st: number,
): DealerDist {
  if (total > 21) {
    const d = new Float64Array(6);
    d[DBUST] = 1;
    return d;
  }
  const mustStand =
    total > 17 || (total === 17 && !(isSoft && currentRules.hitSoft17));
  if (mustStand) {
    const d = new Float64Array(6);
    d[total - 17] = 1;
    return d;
  }
  const key = `${total * 2 + (isSoft ? 1 : 0)}|${shoeKey(shoe)}`;
  const cached = dealerCDMemo.get(key);
  if (cached) return cached;

  const d = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const p = shoe[i] / st;
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    shoe[i]--;
    const sub = dealerRecCD(nt, ns, shoe, st - 1);
    shoe[i]++;
    for (let j = 0; j < 6; j++) d[j] += p * sub[j];
  }
  dealerCDMemo.set(key, d);
  return d;
}

// CD player: track exact shoe composition through all player draws
function evOptimalCD(
  total: number,
  isSoft: boolean,
  canDouble: boolean,
  canSurrender: boolean,
  shoe: number[],
  st: number,
): number {
  if (total > 21) return -1;
  const hk =
    (total << 3) |
    ((isSoft ? 1 : 0) << 2) |
    ((canDouble ? 1 : 0) << 1) |
    (canSurrender ? 1 : 0);
  const key = `${hk}|${shoeKey(shoe)}`;
  const cached = playerCDMemo.get(key);
  if (cached !== undefined) return cached;

  let best = evStand(total);

  // Hit
  let hitEV = 0;
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const p = shoe[i] / st;
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    shoe[i]--;
    hitEV += p * evOptimalCD(nt, ns, false, false, shoe, st - 1);
    shoe[i]++;
  }
  if (hitEV > best) best = hitEV;

  // Double
  if (canDouble) {
    const r = currentRules.doubleRestriction;
    let allowed = true;
    if (r === "9-11") allowed = total >= 9 && total <= 11;
    else if (r === "10-11") allowed = total >= 10 && total <= 11;
    if (allowed) {
      let dblEV = 0;
      for (let i = 0; i < N; i++) {
        if (shoe[i] === 0) continue;
        const p = shoe[i] / st;
        const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
        dblEV += p * (nt > 21 ? -1 : evStand(nt));
      }
      dblEV *= 2;
      if (dblEV > best) best = dblEV;
    }
  }

  if (canSurrender && -0.5 > best) best = -0.5;
  playerCDMemo.set(key, best);
  return best;
}

function splitHandEVCD(
  splitCard: number,
  resplitsLeft: number,
  isAces: boolean,
  shoe: number[],
  st: number,
): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const c2 = CARD_VALUES[i];
    const p = shoe[i] / st;
    const [total, soft] = addCard(splitCard, splitCard === 11, c2);
    const canRS =
      c2 === splitCard &&
      resplitsLeft > 0 &&
      (!isAces || currentRules.resplitAces);

    shoe[i]--;
    if (isAces && !canRS) {
      ev += p * evStand(total);
    } else if (canRS) {
      const playEV = evOptimalCD(
        total, soft, !isAces && currentRules.doubleAfterSplit, false,
        shoe, st - 1,
      );
      const rsEV = 2 * splitHandEVCD(splitCard, resplitsLeft - 1, isAces, shoe, st - 1);
      ev += p * Math.max(playEV, rsEV);
    } else {
      ev += p * evOptimalCD(
        total, soft, !isAces && currentRules.doubleAfterSplit, false,
        shoe, st - 1,
      );
    }
    shoe[i]++;
  }
  return ev;
}

function evSplitCD(cv: number, shoe: number[], st: number): number {
  return 2 * splitHandEVCD(cv, currentRules.maxSplitHands - 2, cv === 11, shoe, st);
}

// Full composition-dependent EV: exact shoe tracking through all draws
export function calculateCDEV(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): EVResult {
  currentRules = rules;
  const shoe = makeShoe(rules.decks);
  const tc = rules.decks * 52;
  const bjPay =
    rules.blackjackPays === "3:2"
      ? 1.5
      : rules.blackjackPays === "6:5"
        ? 1.2
        : 1.0;
  const surrLate = rules.surrenderAllowed === "late";
  const surrEarly = rules.surrenderAllowed === "early";

  dealerCDMemo.clear();
  let totalEV = 0;
  let totalW = 0;

  for (let ui = 0; ui < N; ui++) {
    if (shoe[ui] === 0) continue;
    const uc = CARD_VALUES[ui];
    const pU = shoe[ui] / tc;
    shoe[ui]--;
    const t1 = tc - 1;

    for (let c1i = 0; c1i < N; c1i++) {
      if (shoe[c1i] === 0) continue;
      const c1 = CARD_VALUES[c1i];
      const pC1 = shoe[c1i] / t1;
      shoe[c1i]--;
      const t2 = t1 - 1;

      for (let c2i = 0; c2i < N; c2i++) {
        if (shoe[c2i] === 0) continue;
        const c2 = CARD_VALUES[c2i];
        const pC2 = shoe[c2i] / t2;
        shoe[c2i]--;
        const t3 = t2 - 1;
        const dp = pU * pC1 * pC2;

        // Build aggregate CD dealer distribution
        const agg = new Float64Array(6);
        for (let hi = 0; hi < N; hi++) {
          if (shoe[hi] === 0) continue;
          const pH = shoe[hi] / t3;
          const hc = CARD_VALUES[hi];
          const [dt, ds] = addCard(uc, uc === 11, hc);
          shoe[hi]--;
          const sub = dealerRecCD(dt, ds, shoe, t3 - 1);
          shoe[hi]++;
          for (let j = 0; j < 6; j++) agg[j] += pH * sub[j];
        }

        // Condition on no-BJ
        let bjP = 0;
        if (uc === 11 && shoe[8] > 0) bjP = shoe[8] / t3;
        else if (uc === 10 && shoe[9] > 0) bjP = shoe[9] / t3;

        let dd: DealerDist;
        if (bjP > 0) {
          dd = new Float64Array(6);
          for (let j = 0; j < 6; j++) dd[j] = agg[j];
          dd[D21] -= bjP;
          if (!rules.noHoleCard) {
            const scale = 1 / (1 - bjP);
            for (let j = 0; j < 6; j++) dd[j] *= scale;
          }
        } else {
          dd = agg;
        }

        currentDD = dd;
        playerCDMemo = new Map();

        const [pt, ps] = addCard(c1, c1 === 11, c2);
        const pbj = pt === 21;
        const pair = c1 === c2;
        let hev: number;

        if (pbj) {
          hev = (1 - bjP) * bjPay;
        } else {
          let pev = evOptimalCD(pt, ps, true, surrLate, shoe, t3);
          if (pair && rules.maxSplitHands >= 2) {
            const sev = evSplitCD(c1, shoe, t3);
            if (sev > pev) pev = sev;
          }
          if (surrEarly) {
            hev = Math.max(-0.5, bjP * -1 + (1 - bjP) * pev);
          } else {
            hev = bjP * -1 + (1 - bjP) * pev;
          }
        }

        totalEV += dp * hev;
        totalW += dp;
        shoe[c2i]++;
      }
      shoe[c1i]++;
    }
    shoe[ui]++;
  }

  if (totalW > 1e-10) {
    totalEV /= totalW;
  }
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
    return calculateCDEV(rules);
  }
  return calculateInfiniteDeckEV(rules);
}

// === Strategy table generation ===

export type ActionName = "H" | "S" | "D" | "P" | "Rh" | "Rs" | "Rp";

export interface StrategyEntry {
  action: ActionName;
  ev: number;
  evs?: { stand: number; hit: number; double?: number; split?: number; surrender?: number };
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
      let dblEV = 0;
      if (dblAllowed) {
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

      const evs: StrategyEntry["evs"] = { stand: standEV, hit: hitEV };
      if (dblAllowed) evs.double = dblEV;
      if (canSurr) evs.surrender = -0.5;

      if (!hard.has(total)) hard.set(total, new Map());
      hard.get(total)!.set(dealerKey, { action: bestAction, ev: bestEV, evs });
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
      let dblEV = 0;
      if (dblAllowed) {
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

      const softEvs: StrategyEntry["evs"] = { stand: standEV, hit: hitEV };
      if (dblAllowed) softEvs.double = dblEV;
      if (canSurr) softEvs.surrender = -0.5;

      if (!soft.has(total)) soft.set(total, new Map());
      soft.get(total)!.set(dealerKey, { action: bestAction, ev: bestEV, evs: softEvs });
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

      // Compute stand/hit/double EVs for the pair as a regular hand
      const standEV = evStand(total);
      let hitEV = 0;
      for (let i = 0; i < N; i++) {
        const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
        hitEV += currentProbs[i] * evOptimal(nt, ns, false, false);
      }
      let dblAllowed = true;
      if (rules.doubleRestriction === "9-11")
        dblAllowed = total >= 9 && total <= 11;
      else if (rules.doubleRestriction === "10-11")
        dblAllowed = total >= 10 && total <= 11;
      let dblEV = 0;
      if (dblAllowed) {
        for (let i = 0; i < N; i++) {
          const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
          dblEV += currentProbs[i] * (nt > 21 ? -1 : evStand(nt));
        }
        dblEV *= 2;
      }

      if (splitEv > noSplitEV) {
        bestAction = "P";
        bestEV = splitEv;
      } else {
        bestAction = standEV >= hitEV ? "S" : "H";
        bestEV = Math.max(standEV, hitEV);
        if (dblAllowed && dblEV > bestEV) {
          bestAction = "D";
          bestEV = dblEV;
        }
        if (canSurr && -0.5 > bestEV) {
          bestAction = standEV >= hitEV ? "Rs" : "Rh";
          bestEV = -0.5;
        }
      }

      const pairEvs: StrategyEntry["evs"] = { stand: standEV, hit: hitEV };
      if (dblAllowed) pairEvs.double = dblEV;
      if (rules.maxSplitHands >= 2) pairEvs.split = splitEv;
      if (canSurr) pairEvs.surrender = -0.5;

      if (!pairs.has(cv)) pairs.set(cv, new Map());
      pairs.get(cv)!.set(dealerKey, { action: bestAction, ev: bestEV, evs: pairEvs });
    }

    // Restore shoe for finite deck
    if (useFiniteDeck) {
      shoe![ui]++;
    }
  }

  return { hard, soft, pairs };
}
