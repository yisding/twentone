import { simulateHouseEdge } from "../app/lib/simulation-fast";
import { HouseRules, DEFAULT_HOUSE_RULES } from "../app/lib/types";
import { calculateHouseEdge } from "../app/lib/houseEdge";

const numHands = parseInt(process.argv[2]) || 1000000;
const decksArg = parseInt(process.argv[3]);
const reshuffleArg = parseFloat(process.argv[4]);
const shuffleArg = (process.argv[5] || "").toLowerCase();

const rules: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  decks: Number.isNaN(decksArg) ? DEFAULT_HOUSE_RULES.decks : decksArg,
  reshufflePoint: Number.isNaN(reshuffleArg) ? DEFAULT_HOUSE_RULES.reshufflePoint : reshuffleArg,
  continuousShuffle: shuffleArg === "csm",
};

console.log(`\nBlackjack House Edge Simulation`);
console.log(`================================`);
console.log(`Hands to simulate: ${numHands.toLocaleString()}`);
console.log(`\nRules:`);
console.log(`  Decks: ${rules.decks}`);
console.log(`  Hit Soft 17: ${rules.hitSoft17}`);
console.log(`  Blackjack Pays: ${rules.blackjackPays}`);
console.log(`  Double After Split: ${rules.doubleAfterSplit}`);
console.log(`  Double Restriction: ${rules.doubleRestriction}`);
console.log(`  Surrender: ${rules.surrenderAllowed}`);
console.log(`  Resplit Aces: ${rules.resplitAces}`);
console.log(`  Max Split Hands: ${rules.maxSplitHands}`);
console.log(`  No Hole Card: ${rules.noHoleCard}`);
console.log(`  Reshuffle Point: ${(rules.reshufflePoint * 100).toFixed(0)}%`);
console.log(`  Shuffle Mode: ${rules.continuousShuffle ? "CSM" : "Shoe"}`);
console.log(`\nRunning simulation...\n`);

const startTime = Date.now();
const result = simulateHouseEdge(numHands, rules, (completed, total) => {
  process.stdout.write(`\rProgress: ${((completed / total) * 100).toFixed(1)}%`);
});
const elapsed = Date.now() - startTime;

const theoreticalEdge = calculateHouseEdge(rules);

console.log(`\rProgress: 100.0%`);
console.log(`\nResults (${elapsed}ms):`);
console.log(`  Hands Played: ${result.handsPlayed.toLocaleString()}`);
console.log(`  Total Bet: ${result.totalBet.toLocaleString()} units`);
console.log(`  Total Returned: ${result.totalReturned.toFixed(2)} units`);
console.log(`\n  Wins: ${result.wins.toLocaleString()} (${((result.wins / result.handsPlayed) * 100).toFixed(2)}%)`);
console.log(`  Losses: ${result.losses.toLocaleString()} (${((result.losses / result.handsPlayed) * 100).toFixed(2)}%)`);
console.log(`  Pushes: ${result.pushes.toLocaleString()} (${((result.pushes / result.handsPlayed) * 100).toFixed(2)}%)`);
console.log(`  Blackjacks: ${result.blackjacks.toLocaleString()} (${((result.blackjacks / result.handsPlayed) * 100).toFixed(2)}%)`);
console.log(`  Surrenders: ${result.surrenders.toLocaleString()} (${((result.surrenders / result.handsPlayed) * 100).toFixed(2)}%)`);
console.log(`\n  Simulated House Edge: ${result.houseEdge.toFixed(3)}%`);
console.log(`  Theoretical Edge: ${theoreticalEdge.toFixed(3)}%`);
console.log(`  Difference: ${(result.houseEdge - theoreticalEdge).toFixed(3)}%`);

export {};
