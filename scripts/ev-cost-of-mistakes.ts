import { calculateEV, generateStrategyTable } from "../app/lib/ev-calculator";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";

const CARD_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const N = 10;
const INFINITE_DECK_PROBS = [
  1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 4 / 13, 1 / 13,
];

const currentProbs = INFINITE_DECK_PROBS.slice();

function addCard(total: number, isSoft: boolean, cardValue: number): [number, boolean] {
  let softAces = isSoft ? 1 : 0;
  let t = total + cardValue;
  if (cardValue === 11) softAces++;
  while (t > 21 && softAces > 0) {
    t -= 10;
    softAces--;
  }
  return [t, softAces > 0];
}

interface MistakeCost {
  playerHand: string;
  dealerUpcard: number;
  optimalAction: string;
  wrongAction: string;
  optimalEV: number;
  wrongEV: number;
  evLoss: number;
  evLossPercent: string;
}

function analyzeMistakeCosts(rules: HouseRules): MistakeCost[] {
  const strategy = generateStrategyTable(rules);
  const mistakes: MistakeCost[] = [];

  const dealerUpcards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const allActions = ["H", "S", "D", "P", "Rh", "Rs"];

  for (const dealerUp of dealerUpcards) {
    const hardMap = strategy.hard;
    for (let total = 5; total <= 21; total++) {
      const row = hardMap.get(total)?.get(dealerUp);
      if (!row) continue;

      const optimalAction = row.action;
      const optimalEV = row.ev;

      for (const wrongAction of allActions) {
        if (wrongAction === optimalAction) continue;

        const wrongEV = computeActionEV(total, false, wrongAction, dealerUp, rules);
        if (wrongEV === null || wrongEV === optimalEV) continue;

        const evLoss = optimalEV - wrongEV;
        if (evLoss <= 0) continue;

        mistakes.push({
          playerHand: String(total),
          dealerUpcard: dealerUp,
          optimalAction,
          wrongAction,
          optimalEV,
          wrongEV,
          evLoss,
          evLossPercent: ((evLoss / (Math.abs(optimalEV) + 0.01)) * 100).toFixed(1),
        });
      }
    }

    const softMap = strategy.soft;
    for (let total = 13; total <= 21; total++) {
      const row = softMap.get(total)?.get(dealerUp);
      if (!row) continue;

      const optimalAction = row.action;
      const optimalEV = row.ev;

      for (const wrongAction of allActions) {
        if (wrongAction === optimalAction) continue;

        const wrongEV = computeActionEV(total, true, wrongAction, dealerUp, rules);
        if (wrongEV === null || wrongEV === optimalEV) continue;

        const evLoss = optimalEV - wrongEV;
        if (evLoss <= 0) continue;

        mistakes.push({
          playerHand: `A${total - 11}`,
          dealerUpcard: dealerUp,
          optimalAction,
          wrongAction,
          optimalEV,
          wrongEV,
          evLoss,
          evLossPercent: ((evLoss / (Math.abs(optimalEV) + 0.01)) * 100).toFixed(1),
        });
      }
    }

    const pairMap = strategy.pairs;
    const pairLabels: [string, number][] = [
      ["AA", 11], ["TT", 10], ["99", 9], ["88", 8], ["77", 7],
      ["66", 6], ["55", 5], ["44", 4], ["33", 3], ["22", 2],
    ];
    for (const [label, cv] of pairLabels) {
      const row = pairMap.get(cv)?.get(dealerUp);
      if (!row) continue;

      const optimalAction = row.action;
      const optimalEV = row.ev;

      for (const wrongAction of allActions) {
        if (wrongAction === optimalAction) continue;

        const [total, isSoft] = addCard(cv, cv === 11, cv);
        const wrongEV = computeActionEV(total, isSoft, wrongAction, dealerUp, rules, cv);
        if (wrongEV === null || wrongEV === optimalEV) continue;

        const evLoss = optimalEV - wrongEV;
        if (evLoss <= 0) continue;

        mistakes.push({
          playerHand: label,
          dealerUpcard: dealerUp,
          optimalAction,
          wrongAction,
          optimalEV,
          wrongEV,
          evLoss,
          evLossPercent: ((evLoss / (Math.abs(optimalEV) + 0.01)) * 100).toFixed(1),
        });
      }
    }
  }

  return mistakes.sort((a, b) => b.evLoss - a.evLoss);
}

function computeActionEV(
  total: number,
  isSoft: boolean,
  action: string,
  dealerUpcard: number,
  rules: HouseRules,
  pairCard?: number,
): number | null {
  if (action === "P") {
    if (pairCard === undefined || rules.maxSplitHands < 2) return null;
    return computeSplitEV(pairCard, rules);
  }
  if (action === "Rh" || action === "Rs") {
    return -0.5;
  }
  if (action === "S") {
    return computeStandEV(total, dealerUpcard, rules);
  }
  if (action === "H") {
    return computeHitEV(total, isSoft, dealerUpcard, rules);
  }
  if (action === "D") {
    if (total >= 21) return null;
    let dblAllowed = true;
    if (rules.doubleRestriction === "9-11") dblAllowed = total >= 9 && total <= 11;
    else if (rules.doubleRestriction === "10-11") dblAllowed = total >= 10 && total <= 11;
    if (!dblAllowed) return null;
    return computeDoubleEV(total, isSoft, dealerUpcard, rules);
  }
  return null;
}

const dealerMemo = new Map<string, Float64Array>();

function computeDealerDist(dealerUpcard: number, rules: HouseRules): Float64Array {
  const key = `${dealerUpcard}-${rules.hitSoft17}`;
  const cached = dealerMemo.get(key);
  if (cached) return cached;

  const dist = new Float64Array(6);

  for (let i = 0; i < N; i++) {
    const holeCard = CARD_VALUES[i];
    const [t1, s1] = addCard(dealerUpcard, dealerUpcard === 11, holeCard);
    const sub = dealerRec(t1, s1, rules);
    for (let j = 0; j < 6; j++) dist[j] += currentProbs[i] * sub[j];
  }

  dealerMemo.set(key, dist);
  return dist;
}

function dealerRec(total: number, isSoft: boolean, rules: HouseRules): Float64Array {
  if (total > 21) {
    const d = new Float64Array(6);
    d[5] = 1;
    return d;
  }
  const mustStand = total > 17 || (total === 17 && !(isSoft && rules.hitSoft17));
  if (mustStand) {
    const d = new Float64Array(6);
    d[total - 17] = 1;
    return d;
  }

  const key = `${total}-${isSoft}-${rules.hitSoft17}`;
  const cached = dealerMemo.get(key);
  if (cached) return cached;

  const d = new Float64Array(6);
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    const sub = dealerRec(nt, ns, rules);
    for (let j = 0; j < 6; j++) d[j] += currentProbs[i] * sub[j];
  }

  dealerMemo.set(key, d);
  return d;
}

function computeStandEV(total: number, dealerUpcard: number, rules: HouseRules): number {
  if (total > 21) return -1;
  const dd = computeDealerDist(dealerUpcard, rules);
  let ev = dd[5];
  for (let dt = 17; dt <= 21; dt++) {
    const dp = dd[dt - 17];
    if (total > dt) ev += dp;
    else if (total < dt) ev -= dp;
  }
  return ev;
}

const hitMemo = new Map<string, number>();

function computeHitEV(total: number, isSoft: boolean, dealerUpcard: number, rules: HouseRules): number {
  const key = `${total}-${isSoft}-${dealerUpcard}`;
  const cached = hitMemo.get(key);
  if (cached !== undefined) return cached;

  let ev = 0;
  for (let i = 0; i < N; i++) {
    const [nt, ns] = addCard(total, isSoft, CARD_VALUES[i]);
    if (nt > 21) {
      ev += currentProbs[i] * (-1);
    } else {
      const standEV = computeStandEV(nt, dealerUpcard, rules);
      const hitAgainEV = computeHitEV(nt, ns, dealerUpcard, rules);
      ev += currentProbs[i] * Math.max(standEV, hitAgainEV);
    }
  }

  hitMemo.set(key, ev);
  return ev;
}

function computeDoubleEV(total: number, isSoft: boolean, dealerUpcard: number, rules: HouseRules): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    const [nt] = addCard(total, isSoft, CARD_VALUES[i]);
    ev += currentProbs[i] * (nt > 21 ? -1 : computeStandEV(nt, dealerUpcard, rules));
  }
  return ev * 2;
}

function computeSplitEV(cardValue: number, rules: HouseRules): number {
  const isAces = cardValue === 11;
  return 2 * splitHandEV(cardValue, rules.maxSplitHands - 2, isAces, rules);
}

function splitHandEV(card: number, resplitsLeft: number, isAces: boolean, rules: HouseRules): number {
  let ev = 0;
  for (let i = 0; i < N; i++) {
    const secondCard = CARD_VALUES[i];
    const [total, soft] = addCard(card, card === 11, secondCard);
    const canResplit = secondCard === card && resplitsLeft > 0 && (!isAces || rules.resplitAces);

    if (isAces && !canResplit) {
      ev += currentProbs[i] * computeStandEV(total, 11, rules);
    } else if (canResplit) {
      const playEV = computeOptimalEV(total, soft, 11, rules);
      const resplitEV = 2 * splitHandEV(card, resplitsLeft - 1, isAces, rules);
      ev += currentProbs[i] * Math.max(playEV, resplitEV);
    } else {
      ev += currentProbs[i] * computeOptimalEV(total, soft, 11, rules);
    }
  }
  return ev;
}

const optimalMemo = new Map<string, number>();

function computeOptimalEV(total: number, isSoft: boolean, dealerUpcard: number, rules: HouseRules): number {
  if (total > 21) return -1;
  const key = `${total}-${isSoft}-${dealerUpcard}`;
  const cached = optimalMemo.get(key);
  if (cached !== undefined) return cached;

  let best = computeStandEV(total, dealerUpcard, rules);
  const hitEV = computeHitEV(total, isSoft, dealerUpcard, rules);
  if (hitEV > best) best = hitEV;

  optimalMemo.set(key, best);
  return best;
}

function formatEV(ev: number): string {
  return (ev >= 0 ? "+" : "") + (ev * 100).toFixed(2) + "%";
}

console.log("Cost of Mistakes: EV Lost When Picking Wrong Action\n");
console.log("=".repeat(85));
console.log("Shows how much expected value you give up by choosing the wrong action.");
console.log("EV is expressed as percentage of your initial bet.\n");

const rules: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  decks: 6,
  hitSoft17: false,
  surrenderAllowed: "late",
};

const optimalResult = calculateEV(rules);
console.log(`Rules: 6D S17, BJ 3:2, DAS, Late Surrender`);
console.log(`Optimal house edge: ${optimalResult.houseEdgePercent.toFixed(3)}%\n`);

const mistakes = analyzeMistakeCosts(rules);

console.log("TOP 20 MOST EXPENSIVE MISTAKES (per hand)");
console.log("-".repeat(85));
console.log(
  "Hand".padEnd(6) +
  " vs ".padEnd(4) +
  "Optimal".padEnd(10) +
  "Wrong".padEnd(10) +
  "Optimal EV".padEnd(12) +
  "Wrong EV".padEnd(12) +
  "EV Loss"
);
console.log("-".repeat(85));

for (const m of mistakes.slice(0, 20)) {
  const dealer = m.dealerUpcard === 11 ? "A" : String(m.dealerUpcard);
  console.log(
    m.playerHand.padEnd(6) +
    `vs ${dealer}`.padEnd(7) +
    m.optimalAction.padEnd(8) +
    m.wrongAction.padEnd(8) +
    formatEV(m.optimalEV).padEnd(12) +
    formatEV(m.wrongEV).padEnd(12) +
    formatEV(-m.evLoss)
  );
}

console.log("\n");
console.log("COST OF COMMON MISTAKES");
console.log("-".repeat(85));

const commonMistakes = [
  { hand: "16", dealer: 10, wrong: "H", label: "Hit 16 vs 10 (should surrender)" },
  { hand: "16", dealer: 10, wrong: "S", label: "Stand 16 vs 10 (should surrender)" },
  { hand: "12", dealer: 3, wrong: "S", label: "Stand 12 vs 3 (should hit)" },
  { hand: "12", dealer: 2, wrong: "S", label: "Stand 12 vs 2 (should hit)" },
  { hand: "11", dealer: 10, wrong: "H", label: "Hit 11 vs 10 (should double)" },
  { hand: "11", dealer: 11, wrong: "H", label: "Hit 11 vs Ace (should double)" },
  { hand: "A7", dealer: 10, wrong: "S", label: "Stand soft 18 vs 10 (should hit)" },
  { hand: "A7", dealer: 9, wrong: "S", label: "Stand soft 18 vs 9 (should hit)" },
  { hand: "TT", dealer: 6, wrong: "P", label: "Split 10s vs 6 (should stand)" },
  { hand: "99", dealer: 7, wrong: "P", label: "Split 9s vs 7 (should stand)" },
  { hand: "88", dealer: 10, wrong: "S", label: "Stand 88 vs 10 (should split)" },
];

console.log(
  "Mistake".padEnd(40) +
  "Optimal EV".padEnd(12) +
  "Wrong EV".padEnd(12) +
  "Cost/Hand"
);
console.log("-".repeat(85));

for (const cm of commonMistakes) {
  const found = mistakes.find(
    m => m.playerHand === cm.hand &&
         m.dealerUpcard === cm.dealer &&
         m.wrongAction === cm.wrong
  );
  if (found) {
    console.log(
      cm.label.padEnd(40) +
      formatEV(found.optimalEV).padEnd(12) +
      formatEV(found.wrongEV).padEnd(12) +
      formatEV(-found.evLoss)
    );
  }
}

console.log("\n");
console.log("ACCUMULATED COST OF TYPICAL MISTAKES");
console.log("-".repeat(85));
console.log("If you make common mistakes at typical frequencies per 100 hands:\n");

const typicalMistakes: { mistake: string; hand: string; dealer: number; wrong: string; freq: number }[] = [
  { mistake: "Stand 16 vs 10 (should surrender)", hand: "16", dealer: 10, wrong: "S", freq: 0.3 },
  { mistake: "Hit 16 vs 10 (should surrender)", hand: "16", dealer: 10, wrong: "H", freq: 0.3 },
  { mistake: "Stand 12 vs 3 (should hit)", hand: "12", dealer: 3, wrong: "S", freq: 0.2 },
  { mistake: "Stand 12 vs 2 (should hit)", hand: "12", dealer: 2, wrong: "S", freq: 0.2 },
  { mistake: "Hit 11 vs 10 (should double)", hand: "11", dealer: 10, wrong: "H", freq: 0.15 },
  { mistake: "Stand soft 18 vs 10 (should hit)", hand: "A7", dealer: 10, wrong: "S", freq: 0.1 },
  { mistake: "Stand soft 18 vs 9 (should hit)", hand: "A7", dealer: 9, wrong: "S", freq: 0.1 },
  { mistake: "Stand 88 vs 10 (should split)", hand: "88", dealer: 10, wrong: "S", freq: 0.03 },
];

console.log("Mistake".padEnd(40) + "Freq/100   " + "Cost/Hand   " + "Added Edge");
console.log("-".repeat(85));

let totalAddedEdge = 0;
for (const tm of typicalMistakes) {
  const m = mistakes.find(m => m.playerHand === tm.hand && m.dealerUpcard === tm.dealer && m.wrongAction === tm.wrong);
  if (m) {
    const addedEdge = m.evLoss * tm.freq;
    totalAddedEdge += addedEdge;
    console.log(
      tm.mistake.padEnd(40) +
      tm.freq.toFixed(2).padEnd(11) +
      formatEV(-m.evLoss).padEnd(12) +
      formatEV(-addedEdge)
    );
  }
}

console.log("-".repeat(85));
console.log("Total added house edge from mistakes:".padEnd(40) + " ".padEnd(11) + " ".padEnd(12) + formatEV(-totalAddedEdge));
console.log(`\nOptimal edge: ${optimalResult.houseEdgePercent.toFixed(3)}% → With mistakes: ${(optimalResult.houseEdgePercent + totalAddedEdge * 100).toFixed(3)}%`);
console.log(`Edge increased by ${((totalAddedEdge * 100) / optimalResult.houseEdgePercent).toFixed(1)}x`);

console.log("\n");
console.log("PROBABILITY IMPACT");
console.log("-".repeat(85));
console.log("Every 1% of EV loss = losing 1 cent per dollar bet on average.");
console.log("A 5% mistake costs you $5 per $100 wagered.\n");

const bigMistakes = mistakes.filter(m => m.evLoss >= 0.10);
console.log(`Mistakes costing 10%+ of bet: ${bigMistakes.length} scenarios`);
const mediumMistakes = mistakes.filter(m => m.evLoss >= 0.05 && m.evLoss < 0.10);
console.log(`Mistakes costing 5-10% of bet: ${mediumMistakes.length} scenarios`);
const smallMistakes = mistakes.filter(m => m.evLoss >= 0.01 && m.evLoss < 0.05);
console.log(`Mistakes costing 1-5% of bet: ${smallMistakes.length} scenarios`);

console.log("\n");
console.log("SUMMARY: WHAT YOU GIVE UP");
console.log("-".repeat(85));
console.log("With optimal basic strategy:");
console.log(`  House edge: ~${optimalResult.houseEdgePercent.toFixed(2)}%`);
console.log(`  Expected loss: $${optimalResult.houseEdgePercent.toFixed(2)} per $100 bet\n`);

const typicalEdge = 0.5 + totalAddedEdge * 100;
console.log("With typical player mistakes:");
console.log(`  House edge: ~${typicalEdge.toFixed(2)}%`);
console.log(`  Expected loss: $${typicalEdge.toFixed(2)} per $100 bet\n`);

console.log(`Difference: You lose $${(typicalEdge - optimalResult.houseEdgePercent).toFixed(2)} MORE per $100 bet`);
console.log(`Over 1,000 hands at $25/hand: $${((typicalEdge - optimalResult.houseEdgePercent) * 25 * 10).toFixed(0)} extra lost\n`);

console.log("Key insight: Basic strategy isn't about winning more—it's about losing LESS.");
console.log("A 0.26% edge player loses ~$26 per 100 hands at $100 bets.");
console.log("A 2% edge player loses ~$200 per 100 hands at $100 bets.");

export {};
