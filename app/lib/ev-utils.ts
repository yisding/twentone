import { Hand, HouseRules, PlayerAction } from "./types";
import { calculateHandValue, getCardValue, getDealerUpCard } from "./deck";
import { CARD_VALUES, INFINITE_DECK_PROBS, N, addCard } from "./ev-common";

const currentProbs = INFINITE_DECK_PROBS.slice();

const dealerMemo = new Map<string, Float64Array>();

function computeDealerDist(dealerUpcard: number, hitSoft17: boolean): Float64Array {
  const key = `${dealerUpcard}-${hitSoft17}`;
  const cached = dealerMemo.get(key);
  if (cached) return cached;

  const dist = new Float64Array(6);

  for (let i = 0; i < N; i++) {
    const holeCard = CARD_VALUES[i];
    const [t1, s1] = addCard(dealerUpcard, dealerUpcard === 11, holeCard);
    const sub = dealerRec(t1, s1, hitSoft17);
    for (let j = 0; j < 6; j++) dist[j] += currentProbs[i] * sub[j];
  }

  // Condition on no dealer blackjack (peek game)
  let bjProb = 0;
  if (dealerUpcard === 11) bjProb = currentProbs[8]; // Ace up, 10-value hole
  else if (dealerUpcard === 10) bjProb = currentProbs[9]; // 10 up, Ace hole
  if (bjProb > 0) {
    dist[4] -= bjProb; // remove BJ from 21 bucket (index 4 = total 21)
    const scale = 1 / (1 - bjProb);
    for (let j = 0; j < 6; j++) dist[j] *= scale;
  }

  dealerMemo.set(key, dist);
  return dist;
}

function dealerRec(total: number, isSoft: boolean, hitSoft17: boolean): Float64Array {
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
  const cached = dealerMemo.get(key);
  if (cached) return cached;

  const d = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    const sub = dealerRec(nt, ns, hitSoft17);
    for (let j = 0; j < 6; j++) d[j] += currentProbs[i] * sub[j];
  }

  dealerMemo.set(key, d);
  return d;
}

function computeStandEV(total: number, dealerUpcard: number, hitSoft17: boolean): number {
  if (total > 21) return -1;
  const dd = computeDealerDist(dealerUpcard, hitSoft17);
  let ev = dd[5];
  for (let dt = 17; dt <= 21; dt++) {
    const dp = dd[dt - 17];
    if (total > dt) ev += dp;
    else if (total < dt) ev -= dp;
  }
  return ev;
}

const hitMemo = new Map<string, number>();

function computeHitEV(total: number, isSoft: boolean, dealerUpcard: number, hitSoft17: boolean): number {
  const key = `${total}-${isSoft}-${dealerUpcard}-${hitSoft17}`;
  const cached = hitMemo.get(key);
  if (cached !== undefined) return cached;

  let ev = 0;
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    if (nt > 21) {
      ev += currentProbs[i] * (-1);
    } else {
      const standEV = computeStandEV(nt, dealerUpcard, hitSoft17);
      const hitAgainEV = computeHitEV(nt, ns, dealerUpcard, hitSoft17);
      ev += currentProbs[i] * Math.max(standEV, hitAgainEV);
    }
  }

  hitMemo.set(key, ev);
  return ev;
}

function computeDoubleEV(total: number, isSoft: boolean, dealerUpcard: number, hitSoft17: boolean): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
    ev += currentProbs[i] * (nt > 21 ? -1 : computeStandEV(nt, dealerUpcard, hitSoft17));
  }
  return ev * 2;
}

function computeSplitEV(cardValue: number, dealerUpcard: number, rules: HouseRules): number {
  const isAces = cardValue === 11;
  return 2 * splitHandEV(cardValue, rules.maxSplitHands - 2, isAces, dealerUpcard, rules);
}

function splitHandEV(
  card: number,
  resplitsLeft: number,
  isAces: boolean,
  dealerUpcard: number,
  rules: HouseRules,
): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    const secondCard = CARD_VALUES[i];
    const [total, soft] = addCard(card, card === 11, secondCard);
    const canResplit = secondCard === card && resplitsLeft > 0 && (!isAces || rules.resplitAces);

    if (isAces && !canResplit) {
      ev += currentProbs[i] * computeStandEV(total, dealerUpcard, rules.hitSoft17);
    } else if (canResplit) {
      const playEV = computeOptimalEV(total, soft, dealerUpcard, rules);
      const resplitEV = 2 * splitHandEV(card, resplitsLeft - 1, isAces, dealerUpcard, rules);
      ev += currentProbs[i] * Math.max(playEV, resplitEV);
    } else {
      ev += currentProbs[i] * computeOptimalEV(total, soft, dealerUpcard, rules);
    }
  }
  return ev;
}

const optimalMemo = new Map<string, number>();

function computeOptimalEV(total: number, isSoft: boolean, dealerUpcard: number, rules: HouseRules): number {
  if (total > 21) return -1;
  const key = `${total}-${isSoft}-${dealerUpcard}-${rules.hitSoft17}`;
  const cached = optimalMemo.get(key);
  if (cached !== undefined) return cached;

  let best = computeStandEV(total, dealerUpcard, rules.hitSoft17);
  const hitEV = computeHitEV(total, isSoft, dealerUpcard, rules.hitSoft17);
  if (hitEV > best) best = hitEV;

  optimalMemo.set(key, best);
  return best;
}

function canDouble(total: number, rules: HouseRules): boolean {
  if (rules.doubleRestriction === "9-11") return total >= 9 && total <= 11;
  if (rules.doubleRestriction === "10-11") return total >= 10 && total <= 11;
  return true;
}

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

  const results: ActionEV[] = [];

  const standEV = computeStandEV(total, dealerValue, rules.hitSoft17);
  results.push({ action: "stand", ev: standEV, isAvailable: true });

  const hitEV = computeHitEV(total, isSoft, dealerValue, rules.hitSoft17);
  results.push({ action: "hit", ev: hitEV, isAvailable: true });

  const isTwoCardHand = playerHand.cards.length === 2;
  const dblAllowed =
    isTwoCardHand &&
    canDouble(total, rules) &&
    (!playerHand.isSplit || rules.doubleAfterSplit);
  const dblEV = dblAllowed ? computeDoubleEV(total, isSoft, dealerValue, rules.hitSoft17) : 0;
  results.push({ action: "double", ev: dblEV, isAvailable: dblAllowed });

  const splitAllowed = isPair && rules.maxSplitHands >= 2 && !playerHand.isSplit;
  const splitEV =
    splitAllowed && pairValue !== null ? computeSplitEV(pairValue, dealerValue, rules) : 0;
  results.push({ action: "split", ev: splitEV, isAvailable: splitAllowed });

  const surrAllowed = rules.surrenderAllowed !== "none" && isTwoCardHand && !playerHand.isSplit;
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

export function computeEVCost(
  playerHand: Hand,
  dealerHand: Hand,
  chosenAction: PlayerAction,
  rules: HouseRules,
): EVCostInfo | null {
  const actionEVs = computeActionEVs(playerHand, dealerHand, rules);
  if (actionEVs.length === 0) return null;

  const availableActions = actionEVs.filter(a => a.isAvailable);
  if (availableActions.length === 0) return null;

  const optimal = availableActions.reduce((best, curr) => 
    curr.ev > best.ev ? curr : best
  );

  const chosen = actionEVs.find(a => a.action === chosenAction);
  if (!chosen || !chosen.isAvailable) return null;

  const evLoss = optimal.ev - chosen.ev;
  const evLossPercent = Math.abs(evLoss) <= 0.001 
    ? "0%" 
    : `${evLoss >= 0 ? "-" : "+"}${(Math.abs(evLoss) * 100).toFixed(1)}%`;

  return {
    optimalAction: optimal.action,
    optimalEV: optimal.ev,
    chosenAction: chosen.action,
    chosenEV: chosen.ev,
    evLoss,
    evLossPercent,
  };
}

export function formatEV(ev: number): string {
  const sign = ev >= 0 ? "+" : "";
  return `${sign}${(ev * 100).toFixed(1)}%`;
}

export function formatEVLoss(evLoss: number): string {
  if (Math.abs(evLoss) < 0.001) return "0%";
  return `-${(evLoss * 100).toFixed(1)}%`;
}
