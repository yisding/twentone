import { Hand, HouseRules, PlayerAction } from "./types";
import { calculateHandValue, getCardValue, getDealerUpCard } from "./deck";
import { CARD_VALUES, INFINITE_DECK_PROBS, N, addCard } from "./ev-common";
import type { StrategyTable, StrategyEntry } from "./ev-calculator";

// =========================================================================
// Infinite-deck helpers (fixed probabilities, used when decks < 1 or > 8)
// =========================================================================

const infProbs = INFINITE_DECK_PROBS.slice();

const infDealerMemo = new Map<string, Float64Array>();

function infDealerRec(total: number, isSoft: boolean, hitSoft17: boolean): Float64Array {
  if (total > 21) {
    const d = new Float64Array(6);
    d[5] = 1;
    return d;
  }
  const mustStand = total > 17 || (total === 17 && !(isSoft && hitSoft17));
  if (mustStand) {
    const d = new Float64Array(6);
    d[total - 17] = 1;
    return d;
  }
  const key = `${total}-${isSoft}-${hitSoft17}`;
  const cached = infDealerMemo.get(key);
  if (cached) return cached;

  const d = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    const sub = infDealerRec(nt, ns, hitSoft17);
    for (let j = 0; j < 6; j++) d[j] += infProbs[i] * sub[j];
  }
  infDealerMemo.set(key, d);
  return d;
}

function infDealerDist(upcard: number, hitSoft17: boolean): Float64Array {
  const key = `dist-${upcard}-${hitSoft17}`;
  const cached = infDealerMemo.get(key);
  if (cached) return cached;

  const dist = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    const hc = CARD_VALUES[i];
    const [t1, s1] = addCard(upcard, upcard === 11, hc);
    const sub = infDealerRec(t1, s1, hitSoft17);
    for (let j = 0; j < 6; j++) dist[j] += infProbs[i] * sub[j];
  }

  // Condition on no dealer blackjack (peek game)
  let bjProb = 0;
  if (upcard === 11) bjProb = infProbs[8];
  else if (upcard === 10) bjProb = infProbs[9];
  if (bjProb > 0) {
    dist[4] -= bjProb;
    const scale = 1 / (1 - bjProb);
    for (let j = 0; j < 6; j++) dist[j] *= scale;
  }

  infDealerMemo.set(key, dist);
  return dist;
}

function evStand(playerTotal: number, dd: Float64Array): number {
  if (playerTotal > 21) return -1;
  let ev = dd[5]; // dealer busts → win
  for (let dt = 17; dt <= 21; dt++) {
    const dp = dd[dt - 17];
    if (playerTotal > dt) ev += dp;
    else if (playerTotal < dt) ev -= dp;
  }
  return ev;
}

const infHitMemo = new Map<string, number>();

function infHitEV(total: number, isSoft: boolean, dd: Float64Array, ddKey: string): number {
  const key = `${total}-${isSoft}-${ddKey}`;
  const cached = infHitMemo.get(key);
  if (cached !== undefined) return cached;

  let ev = 0;
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    if (nt > 21) {
      ev += infProbs[i] * (-1);
    } else {
      const sEV = evStand(nt, dd);
      const hEV = infHitEV(nt, ns, dd, ddKey);
      ev += infProbs[i] * Math.max(sEV, hEV);
    }
  }

  infHitMemo.set(key, ev);
  return ev;
}

function infDoubleEV(total: number, isSoft: boolean, dd: Float64Array): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
    ev += infProbs[i] * (nt > 21 ? -1 : evStand(nt, dd));
  }
  return ev * 2;
}

const infOptMemo = new Map<string, number>();

function infOptimalEV(total: number, isSoft: boolean, dd: Float64Array, ddKey: string, rules: HouseRules, canDbl: boolean): number {
  if (total > 21) return -1;
  const key = `${total}-${isSoft}-${ddKey}-${canDbl}`;
  const cached = infOptMemo.get(key);
  if (cached !== undefined) return cached;

  let best = evStand(total, dd);
  const hEV = infHitEV(total, isSoft, dd, ddKey);
  if (hEV > best) best = hEV;

  if (canDbl) {
    let allowed = true;
    if (rules.doubleRestriction === "9-11") allowed = total >= 9 && total <= 11;
    else if (rules.doubleRestriction === "10-11") allowed = total >= 10 && total <= 11;
    if (allowed) {
      const dEV = infDoubleEV(total, isSoft, dd);
      if (dEV > best) best = dEV;
    }
  }

  infOptMemo.set(key, best);
  return best;
}

function infSplitHandEV(card: number, resplitsLeft: number, isAces: boolean, dd: Float64Array, ddKey: string, rules: HouseRules): number {
  let ev = 0;
  const canDAS = !isAces && rules.doubleAfterSplit;
  for (let i = 0; i < N; i++) {
    const c2 = CARD_VALUES[i];
    const [total, soft] = addCard(card, card === 11, c2);
    const canRS = c2 === card && resplitsLeft > 0 && (!isAces || rules.resplitAces);

    if (isAces && !canRS) {
      ev += infProbs[i] * evStand(total, dd);
    } else if (canRS) {
      const playEV = infOptimalEV(total, soft, dd, ddKey, rules, canDAS);
      const rsEV = 2 * infSplitHandEV(card, resplitsLeft - 1, isAces, dd, ddKey, rules);
      ev += infProbs[i] * Math.max(playEV, rsEV);
    } else {
      ev += infProbs[i] * infOptimalEV(total, soft, dd, ddKey, rules, canDAS);
    }
  }
  return ev;
}

function infSplitEV(cardValue: number, dd: Float64Array, ddKey: string, rules: HouseRules): number {
  return 2 * infSplitHandEV(cardValue, rules.maxSplitHands - 2, cardValue === 11, dd, ddKey, rules);
}

// =========================================================================
// Composition-dependent (CD) helpers — track shoe through every draw
// =========================================================================

function shoeKey(s: number[]): string {
  return `${s[0]}.${s[1]}.${s[2]}.${s[3]}.${s[4]}.${s[5]}.${s[6]}.${s[7]}.${s[8]}.${s[9]}`;
}

const cdDealerMemo = new Map<string, Float64Array>();

function cdDealerRec(total: number, isSoft: boolean, hitSoft17: boolean, shoe: number[], st: number): Float64Array {
  if (total > 21) {
    const d = new Float64Array(6);
    d[5] = 1;
    return d;
  }
  const mustStand = total > 17 || (total === 17 && !(isSoft && hitSoft17));
  if (mustStand) {
    const d = new Float64Array(6);
    d[total - 17] = 1;
    return d;
  }

  const key = `${total * 2 + (isSoft ? 1 : 0)}|${shoeKey(shoe)}`;
  const cached = cdDealerMemo.get(key);
  if (cached) return cached;

  const d = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const p = shoe[i] / st;
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    shoe[i]--;
    const sub = cdDealerRec(nt, ns, hitSoft17, shoe, st - 1);
    shoe[i]++;
    for (let j = 0; j < 6; j++) d[j] += p * sub[j];
  }

  cdDealerMemo.set(key, d);
  return d;
}

function cdDealerDist(upcard: number, hitSoft17: boolean, shoe: number[], st: number, noHoleCard: boolean): Float64Array {
  cdDealerMemo.clear();

  const dist = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const pH = shoe[i] / st;
    const hc = CARD_VALUES[i];
    const [t1, s1] = addCard(upcard, upcard === 11, hc);
    shoe[i]--;
    const sub = cdDealerRec(t1, s1, hitSoft17, shoe, st - 1);
    shoe[i]++;
    for (let j = 0; j < 6; j++) dist[j] += pH * sub[j];
  }

  // Condition on no dealer blackjack (peek game only)
  if (!noHoleCard) {
    let bjProb = 0;
    if (upcard === 11 && shoe[8] > 0) bjProb = shoe[8] / st;
    else if (upcard === 10 && shoe[9] > 0) bjProb = shoe[9] / st;
    if (bjProb > 0) {
      dist[4] -= bjProb;
      const scale = 1 / (1 - bjProb);
      for (let j = 0; j < 6; j++) dist[j] *= scale;
    }
  }

  return dist;
}

const cdHitMemo = new Map<string, number>();

function cdHitEV(total: number, isSoft: boolean, dd: Float64Array, shoe: number[], st: number): number {
  const hk = total * 2 + (isSoft ? 1 : 0);
  const key = `${hk}|${shoeKey(shoe)}`;
  const cached = cdHitMemo.get(key);
  if (cached !== undefined) return cached;

  let ev = 0;
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const p = shoe[i] / st;
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    if (nt > 21) {
      ev += p * (-1);
    } else {
      shoe[i]--;
      const sEV = evStand(nt, dd);
      const hEV = cdHitEV(nt, ns, dd, shoe, st - 1);
      shoe[i]++;
      ev += p * Math.max(sEV, hEV);
    }
  }

  cdHitMemo.set(key, ev);
  return ev;
}

function cdDoubleEV(total: number, isSoft: boolean, dd: Float64Array, shoe: number[], st: number): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const p = shoe[i] / st;
    const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
    ev += p * (nt > 21 ? -1 : evStand(nt, dd));
  }
  return ev * 2;
}

const cdOptMemo = new Map<string, number>();

function cdOptimalEV(total: number, isSoft: boolean, dd: Float64Array, shoe: number[], st: number, rules: HouseRules, canDbl: boolean): number {
  if (total > 21) return -1;
  const hk = (total << 1) | (isSoft ? 1 : 0);
  const key = `${hk}-${canDbl ? 1 : 0}|${shoeKey(shoe)}`;
  const cached = cdOptMemo.get(key);
  if (cached !== undefined) return cached;

  let best = evStand(total, dd);
  const hEV = cdHitEV(total, isSoft, dd, shoe, st);
  if (hEV > best) best = hEV;

  if (canDbl) {
    let allowed = true;
    if (rules.doubleRestriction === "9-11") allowed = total >= 9 && total <= 11;
    else if (rules.doubleRestriction === "10-11") allowed = total >= 10 && total <= 11;
    if (allowed) {
      const dEV = cdDoubleEV(total, isSoft, dd, shoe, st);
      if (dEV > best) best = dEV;
    }
  }

  cdOptMemo.set(key, best);
  return best;
}

function cdSplitHandEV(card: number, resplitsLeft: number, isAces: boolean, dd: Float64Array, shoe: number[], st: number, rules: HouseRules): number {
  let ev = 0;
  const canDAS = !isAces && rules.doubleAfterSplit;
  for (let i = 0; i < N; i++) {
    if (shoe[i] === 0) continue;
    const c2 = CARD_VALUES[i];
    const p = shoe[i] / st;
    const [total, soft] = addCard(card, card === 11, c2);
    const canRS = c2 === card && resplitsLeft > 0 && (!isAces || rules.resplitAces);

    shoe[i]--;
    if (isAces && !canRS) {
      ev += p * evStand(total, dd);
    } else if (canRS) {
      const playEV = cdOptimalEV(total, soft, dd, shoe, st - 1, rules, canDAS);
      const rsEV = 2 * cdSplitHandEV(card, resplitsLeft - 1, isAces, dd, shoe, st - 1, rules);
      ev += p * Math.max(playEV, rsEV);
    } else {
      ev += p * cdOptimalEV(total, soft, dd, shoe, st - 1, rules, canDAS);
    }
    shoe[i]++;
  }
  return ev;
}

function cdSplitEV(cardValue: number, dd: Float64Array, shoe: number[], st: number, rules: HouseRules): number {
  return 2 * cdSplitHandEV(cardValue, rules.maxSplitHands - 2, cardValue === 11, dd, shoe, st, rules);
}

// =========================================================================
// Shoe setup
// =========================================================================

function makeShoe(decks: number): number[] {
  const shoe = new Array(N);
  for (let i = 0; i < 8; i++) shoe[i] = 4 * decks;
  shoe[8] = 16 * decks;
  shoe[9] = 4 * decks;
  return shoe;
}

function canDouble(total: number, rules: HouseRules): boolean {
  if (rules.doubleRestriction === "9-11") return total >= 9 && total <= 11;
  if (rules.doubleRestriction === "10-11") return total >= 10 && total <= 11;
  return true;
}

// =========================================================================
// Public API
// =========================================================================

export interface ActionEV {
  action: PlayerAction;
  ev: number;
  isAvailable: boolean;
}

export function computeActionEVs(
  playerHand: Hand,
  dealerHand: Hand,
  rules: HouseRules,
): ActionEV[] {
  const { total, isSoft } = calculateHandValue(playerHand);
  const dealerUpCard = getDealerUpCard(dealerHand);
  if (!dealerUpCard) return [];

  const dealerValue = getCardValue(dealerUpCard);
  const isPair = playerHand.cards.length === 2 &&
                 playerHand.cards[0].rank === playerHand.cards[1].rank;
  const pairValue = isPair ? getCardValue(playerHand.cards[0]) : null;
  const isTwoCardHand = playerHand.cards.length === 2;
  const dblAllowed =
    isTwoCardHand &&
    canDouble(total, rules) &&
    (!playerHand.isSplit || rules.doubleAfterSplit);
  const splitAllowed = isPair && rules.maxSplitHands >= 2 && !playerHand.isSplit;
  const surrAllowed = rules.surrenderAllowed !== "none" && isTwoCardHand && !playerHand.isSplit;

  const useCD = Number.isInteger(rules.decks) && rules.decks >= 1 && rules.decks <= 8;

  let standEV: number;
  let hitEV: number;
  let dblEV = 0;
  let splitEv = 0;

  if (useCD) {
    // Composition-dependent: track shoe through every draw
    const shoe = makeShoe(rules.decks);
    const totalCards = rules.decks * 52;

    // Remove known cards (player cards + dealer upcard)
    for (const card of playerHand.cards) {
      const idx = getCardValue(card) - 2;
      shoe[idx] = Math.max(0, shoe[idx] - 1);
    }
    const uIdx = dealerValue - 2;
    shoe[uIdx] = Math.max(0, shoe[uIdx] - 1);
    const st = totalCards - playerHand.cards.length - 1;

    // Clear CD memos
    cdDealerMemo.clear();
    cdHitMemo.clear();
    cdOptMemo.clear();

    const forbiddenHoleIdx = dealerValue === 11 ? 8 : dealerValue === 10 ? 9 : -1;
    const shouldConditionHoleCard = !rules.noHoleCard && forbiddenHoleIdx >= 0;

    if (shouldConditionHoleCard) {
      // Peek game with a 10/A upcard: condition on the revealed fact that dealer
      // does not have blackjack by explicitly averaging over legal hole cards.
      // This improves CD decision EV accuracy because player-draw probabilities
      // are also conditioned by the hidden-card information.
      const legalHoleMass = st - shoe[forbiddenHoleIdx];

      if (legalHoleMass <= 0) {
        // Degenerate: every remaining card is the forbidden type.
        // This is an impossible state in real play; return neutral EVs.
        standEV = 0;
        hitEV = 0;
        dblEV = 0;
        splitEv = 0;
      } else {
        let aggStand = 0;
        let aggHit = 0;
        let aggDbl = 0;
        let aggSplit = 0;

        for (let hi = 0; hi < N; hi++) {
          if (hi === forbiddenHoleIdx || shoe[hi] === 0) continue;
          const pHole = shoe[hi] / legalHoleMass;

          shoe[hi]--;
          const stAfterHole = st - 1;

          cdHitMemo.clear();
          cdOptMemo.clear();

          const holeCard = CARD_VALUES[hi];
          const [t1, s1] = addCard(dealerValue, dealerValue === 11, holeCard);
          const dd = cdDealerRec(t1, s1, rules.hitSoft17, shoe, stAfterHole);

          aggStand += pHole * evStand(total, dd);
          aggHit += pHole * cdHitEV(total, isSoft, dd, shoe, stAfterHole);
          if (dblAllowed) {
            aggDbl += pHole * cdDoubleEV(total, isSoft, dd, shoe, stAfterHole);
          }
          if (splitAllowed && pairValue !== null) {
            aggSplit += pHole * cdSplitEV(pairValue, dd, shoe, stAfterHole, rules);
          }

          shoe[hi]++;
        }

        standEV = aggStand;
        hitEV = aggHit;
        dblEV = aggDbl;
        splitEv = aggSplit;
      }
    } else {
      // Build dealer distribution with shoe tracking
      const dd = cdDealerDist(dealerValue, rules.hitSoft17, shoe, st, rules.noHoleCard);

      // Player EVs with shoe tracking
      standEV = evStand(total, dd);
      hitEV = cdHitEV(total, isSoft, dd, shoe, st);
      if (dblAllowed) {
        dblEV = cdDoubleEV(total, isSoft, dd, shoe, st);
      }
      if (splitAllowed && pairValue !== null) {
        splitEv = cdSplitEV(pairValue, dd, shoe, st, rules);
      }
    }
  } else {
    // Infinite deck: fixed probabilities
    infDealerMemo.clear();
    infHitMemo.clear();
    infOptMemo.clear();

    const dd = infDealerDist(dealerValue, rules.hitSoft17);
    const ddKey = `${dealerValue}-${rules.hitSoft17}`;

    standEV = evStand(total, dd);
    hitEV = infHitEV(total, isSoft, dd, ddKey);
    if (dblAllowed) {
      dblEV = infDoubleEV(total, isSoft, dd);
    }
    if (splitAllowed && pairValue !== null) {
      splitEv = infSplitEV(pairValue, dd, ddKey, rules);
    }
  }

  const results: ActionEV[] = [];
  results.push({ action: "stand", ev: standEV, isAvailable: true });
  results.push({ action: "hit", ev: hitEV, isAvailable: true });
  results.push({ action: "double", ev: dblEV, isAvailable: dblAllowed });
  results.push({ action: "split", ev: splitEv, isAvailable: splitAllowed });
  results.push({ action: "surrender", ev: -0.5, isAvailable: surrAllowed });

  return results;
}

export interface EVCostInfo {
  optimalAction: PlayerAction;
  optimalEV: number;
  chosenAction: PlayerAction;
  chosenEV: number;
  evLoss: number;
  evLossPercent: string;
}

function applyTableEvs(available: ActionEV[], tableEvs: NonNullable<StrategyEntry["evs"]>): void {
  for (const a of available) {
    if (a.action === "stand") a.ev = tableEvs.stand;
    else if (a.action === "hit") a.ev = tableEvs.hit;
    else if (a.action === "double" && tableEvs.double !== undefined) a.ev = tableEvs.double;
    else if (a.action === "split" && tableEvs.split !== undefined) a.ev = tableEvs.split;
    else if (a.action === "surrender" && tableEvs.surrender !== undefined) a.ev = tableEvs.surrender;
  }
}

export function computeAvailableActionEVs(
  playerHand: Hand,
  dealerHand: Hand,
  rules: HouseRules,
  strategyTable?: StrategyTable | null,
): ActionEV[] {
  const available = computeActionEVs(playerHand, dealerHand, rules).filter(a => a.isAvailable);

  // For pairs with a strategy table, use the strategy table's EVs which are
  // computed with full composition-dependent tracking from the strategy table
  // generation pass. This ensures pair EVs are consistent with the strategy
  // table's split/no-split recommendations.
  if (strategyTable && playerHand.cards.length === 2) {
    const isPair = playerHand.cards[0].rank === playerHand.cards[1].rank;
    if (isPair) {
      const dealerUpCard = getDealerUpCard(dealerHand);
      if (dealerUpCard) {
        const pairValue = getCardValue(playerHand.cards[0]);
        const dealerValue = getCardValue(dealerUpCard);
        const entry = strategyTable.pairs.get(pairValue)?.get(dealerValue);
        if (entry?.evs) {
          applyTableEvs(available, entry.evs);
        }
      }
    }
  }

  return available;
}

export function computeEVCost(
  playerHand: Hand,
  dealerHand: Hand,
  chosenAction: PlayerAction,
  rules: HouseRules,
  strategyTable?: StrategyTable | null,
): EVCostInfo | null {
  const availableActions = computeAvailableActionEVs(
    playerHand,
    dealerHand,
    rules,
    strategyTable,
  );
  if (availableActions.length === 0) return null;

  const optimal = availableActions.reduce((best, curr) =>
    curr.ev > best.ev ? curr : best
  );

  const chosen = availableActions.find(a => a.action === chosenAction);
  if (!chosen) return null;

  const evLoss = optimal.ev - chosen.ev;
  return {
    optimalAction: optimal.action,
    optimalEV: optimal.ev,
    chosenAction: chosen.action,
    chosenEV: chosen.ev,
    evLoss,
    evLossPercent: formatEvLossPercent(evLoss),
  };
}

function formatEvLossPercent(evLoss: number): string {
  if (Math.abs(evLoss) <= 0.00001) return "0%";
  return `${evLoss >= 0 ? "-" : "+"}${(Math.abs(evLoss) * 100).toFixed(2)}%`;
}

export function formatEV(ev: number): string {
  const sign = ev >= 0 ? "+" : "";
  return `${sign}${(ev * 100).toFixed(2)}%`;
}

export function formatEVLoss(evLoss: number): string {
  if (Math.abs(evLoss) < 0.00001) return "0%";
  return `-${(evLoss * 100).toFixed(2)}%`;
}
