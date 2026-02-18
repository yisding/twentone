/**
 * Combinatorial EV calculator for blackjack using dynamic programming.
 * Uses infinite deck assumption for fast, exact computation.
 *
 * Approach:
 * 1. Precompute dealer outcome distributions for each upcard
 * 2. Compute player EV for each action using recursion + memoization
 * 3. Sum over all initial deals weighted by probability to get total game EV
 *
 * State space (infinite deck): only hand totals/softness matter, not specific cards
 * or remaining deck composition. This makes computation very fast.
 */

import { HouseRules, DEFAULT_HOUSE_RULES } from "./types";

// === Card value probabilities (infinite deck) ===
// 10, J, Q, K all have value 10 → combined probability 4/13
// Ace starts as value 11 → probability 1/13
const CARD_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const CARD_PROBS = [
  1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 4 / 13,
  1 / 13,
];
const N = 10; // number of distinct card values

// Dealer distribution array indices
const D17 = 0,
  D18 = 1,
  D19 = 2,
  D20 = 3,
  D21 = 4,
  DBUST = 5;
type DealerDist = Float64Array; // length 6: [P(17), P(18), P(19), P(20), P(21), P(bust)]

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

function computeAllDealerDists(hitSoft17: boolean): Map<number, DealerDist> {
  const memo = new Map<number, DealerDist>();

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
      total > 17 || (total === 17 && !(isSoft && hitSoft17));
    if (mustStand) {
      const d = new Float64Array(6);
      d[total - 17] = 1;
      return d;
    }

    // Check memo
    const key = total * 2 + (isSoft ? 1 : 0);
    const cached = memo.get(key);
    if (cached) return cached;

    // Must hit: sum over all possible next cards
    const d = new Float64Array(6);
    for (let i = 0; i < N; i++) {
      const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
      const sub = dealerRec(nt, ns);
      const p = CARD_PROBS[i];
      for (let j = 0; j < 6; j++) d[j] += p * sub[j];
    }

    memo.set(key, d);
    return d;
  }

  // For each upcard, compute distribution by enumerating hole cards
  const result = new Map<number, DealerDist>();

  for (const upcard of CARD_VALUES) {
    const dist = new Float64Array(6);

    for (let i = 0; i < N; i++) {
      const holeCard = CARD_VALUES[i];
      // Build two-card hand
      const [t1, s1] = addCard(upcard, upcard === 11, holeCard);
      const sub = dealerRec(t1, s1);
      const p = CARD_PROBS[i];
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
  // Probability of dealer blackjack from this upcard
  let bjProb = 0;
  if (upcard === 11) bjProb = 4 / 13; // Ace up, hole card is 10-value
  else if (upcard === 10) bjProb = 1 / 13; // 10 up, hole card is Ace

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

// Module-level state set per-upcard during calculation
let currentDD: DealerDist;
let currentRules: HouseRules;
let playerMemo: Map<number, number>;

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
    hitEV += CARD_PROBS[i] * evOptimal(nt, ns, false, false);
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
        dblEV += CARD_PROBS[i] * (nt > 21 ? -1 : evStand(nt));
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
      ev += CARD_PROBS[i] * evStand(total);
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
      ev += CARD_PROBS[i] * Math.max(playEV, resplitEV);
    } else {
      // Play normally
      ev += CARD_PROBS[i] * evOptimal(
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

export function calculateEV(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): EVResult {
  currentRules = rules;

  // Step 1: precompute dealer distributions for all upcards
  const allDealerDists = computeAllDealerDists(rules.hitSoft17);

  let totalEV = 0;

  // Step 2: iterate over each dealer upcard
  for (let ui = 0; ui < N; ui++) {
    const upcard = CARD_VALUES[ui];
    const upcardProb = CARD_PROBS[ui];

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
        const dealProb = CARD_PROBS[c1i] * CARD_PROBS[c2i];

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
  const allDealerDists = computeAllDealerDists(rules.hitSoft17);

  const hard = new Map<number, Map<number, StrategyEntry>>();
  const soft = new Map<number, Map<number, StrategyEntry>>();
  const pairs = new Map<number, Map<number, StrategyEntry>>();

  // For each dealer upcard
  for (const upcard of CARD_VALUES) {
    const rawDist = allDealerDists.get(upcard)!;
    const { dist: dd } = conditionOnNoBJ(rawDist, upcard, rules.noHoleCard);
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
        hitEV += CARD_PROBS[i] * evOptimal(nt, ns, false, false);
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
          dblEV += CARD_PROBS[i] * (nt > 21 ? -1 : evStand(nt));
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
        hitEV += CARD_PROBS[i] * evOptimal(nt, ns, false, false);
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
          dblEV += CARD_PROBS[i] * (nt > 21 ? -1 : evStand(nt));
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
          hitEV += CARD_PROBS[i] * evOptimal(nt, ns, false, false);
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
            dblEV += CARD_PROBS[i] * (nt > 21 ? -1 : evStand(nt));
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
  }

  return { hard, soft, pairs };
}
