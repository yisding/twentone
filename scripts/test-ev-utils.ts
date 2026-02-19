import { computeEVCost, computeActionEVs, formatEV, formatEVLoss } from "../app/lib/ev-utils";
import { HouseRules, DEFAULT_HOUSE_RULES, Hand, Rank } from "../app/lib/types";

function makeHand(ranks: string[]): Hand {
  const suit = "hearts" as const;
  const cards = ranks.map(rank => ({
    suit,
    rank: rank as Rank,
  }));
  return {
    cards,
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
}

function makeDealerHand(rank: string): Hand {
  return makeHand([rank]);
}

const rules: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  hitSoft17: false,
  surrenderAllowed: "late",
  decks: 6,
};

console.log("EV Calculator Tests\n");
console.log("=".repeat(70));

console.log("\nTest 1: 16 vs 10 - Surrender vs Hit");
console.log("-".repeat(70));
const h16 = makeHand(["10", "6"]);
const d10 = makeDealerHand("10");
const evs1 = computeActionEVs(h16, d10, rules);
evs1.filter(e => e.isAvailable).forEach(e => {
  console.log(`  ${e.action.padEnd(10)}: ${formatEV(e.ev)}`);
});
const cost1 = computeEVCost(h16, d10, "hit", rules);
if (cost1) {
  console.log(`\n  If you hit instead of optimal:`);
  console.log(`    Optimal (${cost1.optimalAction}): ${formatEV(cost1.optimalEV)}`);
  console.log(`    Chosen (${cost1.chosenAction}): ${formatEV(cost1.chosenEV)}`);
  console.log(`    EV Loss: ${formatEVLoss(cost1.evLoss)}`);
}

console.log("\n\nTest 2: 11 vs 10 - Double vs Hit");
console.log("-".repeat(70));
const h11 = makeHand(["5", "6"]);
const evs2 = computeActionEVs(h11, d10, rules);
evs2.filter(e => e.isAvailable).forEach(e => {
  console.log(`  ${e.action.padEnd(10)}: ${formatEV(e.ev)}`);
});
const cost2 = computeEVCost(h11, d10, "hit", rules);
if (cost2) {
  console.log(`\n  If you hit instead of optimal:`);
  console.log(`    Optimal (${cost2.optimalAction}): ${formatEV(cost2.optimalEV)}`);
  console.log(`    Chosen (${cost2.chosenAction}): ${formatEV(cost2.chosenEV)}`);
  console.log(`    EV Loss: ${formatEVLoss(cost2.evLoss)}`);
}

console.log("\n\nTest 3: Soft 18 (A7) vs 10 - Hit vs Stand");
console.log("-".repeat(70));
const hA7 = makeHand(["A", "7"]);
const evs3 = computeActionEVs(hA7, d10, rules);
evs3.filter(e => e.isAvailable).forEach(e => {
  console.log(`  ${e.action.padEnd(10)}: ${formatEV(e.ev)}`);
});
const cost3 = computeEVCost(hA7, d10, "stand", rules);
if (cost3) {
  console.log(`\n  If you stand instead of optimal:`);
  console.log(`    Optimal (${cost3.optimalAction}): ${formatEV(cost3.optimalEV)}`);
  console.log(`    Chosen (${cost3.chosenAction}): ${formatEV(cost3.chosenEV)}`);
  console.log(`    EV Loss: ${formatEVLoss(cost3.evLoss)}`);
}

console.log("\n\nTest 4: Pair of 8s vs 10 - Split vs Stand");
console.log("-".repeat(70));
const h88 = makeHand(["8", "8"]);
const evs4 = computeActionEVs(h88, d10, rules);
evs4.filter(e => e.isAvailable).forEach(e => {
  console.log(`  ${e.action.padEnd(10)}: ${formatEV(e.ev)}`);
});
const cost4 = computeEVCost(h88, d10, "stand", rules);
if (cost4) {
  console.log(`\n  If you stand instead of optimal:`);
  console.log(`    Optimal (${cost4.optimalAction}): ${formatEV(cost4.optimalEV)}`);
  console.log(`    Chosen (${cost4.chosenAction}): ${formatEV(cost4.chosenEV)}`);
  console.log(`    EV Loss: ${formatEVLoss(cost4.evLoss)}`);
}

console.log("\n\nTest 5: 12 vs 3 - Hit vs Stand");
console.log("-".repeat(70));
const h12 = makeHand(["10", "2"]);
const d3 = makeDealerHand("3");
const evs5 = computeActionEVs(h12, d3, rules);
evs5.filter(e => e.isAvailable).forEach(e => {
  console.log(`  ${e.action.padEnd(10)}: ${formatEV(e.ev)}`);
});
const cost5 = computeEVCost(h12, d3, "stand", rules);
if (cost5) {
  console.log(`\n  If you stand instead of optimal:`);
  console.log(`    Optimal (${cost5.optimalAction}): ${formatEV(cost5.optimalEV)}`);
  console.log(`    Chosen (${cost5.chosenAction}): ${formatEV(cost5.chosenEV)}`);
  console.log(`    EV Loss: ${formatEVLoss(cost5.evLoss)}`);
}

console.log("\n\nTest 6: Pair of 10s vs 6 - Stand vs Split (common mistake)");
console.log("-".repeat(70));
const hTT = makeHand(["10", "K"]);
const d6 = makeDealerHand("6");
const evs6 = computeActionEVs(hTT, d6, rules);
evs6.filter(e => e.isAvailable).forEach(e => {
  console.log(`  ${e.action.padEnd(10)}: ${formatEV(e.ev)}`);
});
const cost6 = computeEVCost(hTT, d6, "split", rules);
if (cost6) {
  console.log(`\n  If you split instead of optimal:`);
  console.log(`    Optimal (${cost6.optimalAction}): ${formatEV(cost6.optimalEV)}`);
  console.log(`    Chosen (${cost6.chosenAction}): ${formatEV(cost6.chosenEV)}`);
  console.log(`    EV Loss: ${formatEVLoss(cost6.evLoss)}`);
}

console.log("\n\n" + "=".repeat(70));
console.log("All tests completed successfully!");

export {};
