import { Card, TrainingScenario, HouseRules } from "./types";

const createCard = (rank: Card["rank"], suit: Card["suit"] = "hearts"): Card => ({
  rank,
  suit,
});

const H: Card["suit"] = "hearts";
const D: Card["suit"] = "diamonds";
const S: Card["suit"] = "spades";

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  // SPLITS - Core scenarios
  {
    id: "split-8s-vs-10",
    category: "splits",
    description: "Pair of 8s vs Dealer 10",
    playerCards: [createCard("8", H), createCard("8", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "split",
    explanation: "16 is the worst hand in blackjack. Splitting gives you two chances to improve.",
    difficulty: 1,
  },
  {
    id: "split-8s-vs-ace",
    category: "splits",
    description: "Pair of 8s vs Dealer Ace",
    playerCards: [createCard("8", H), createCard("8", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "split",
    explanation: "Even against an Ace, splitting 8s is better than playing 16.",
    difficulty: 2,
    rulesVariants: [
      { hitSoft17: true, surrenderAllowed: "late" },
    ],
  },
  {
    id: "split-aces",
    category: "splits",
    description: "Pair of Aces vs Dealer 10",
    playerCards: [createCard("A", H), createCard("A", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "split",
    explanation: "Always split aces—you get two chances at blackjack.",
    difficulty: 1,
  },
  {
    id: "split-9s-vs-7",
    category: "splits",
    description: "Pair of 9s vs Dealer 7",
    playerCards: [createCard("9", H), createCard("9", D)],
    dealerUpCard: createCard("7", S),
    expectedAction: "stand",
    explanation: "Dealer likely has 17, your 18 wins. Standing is better than splitting.",
    difficulty: 2,
  },
  {
    id: "split-9s-vs-9",
    category: "splits",
    description: "Pair of 9s vs Dealer 9",
    playerCards: [createCard("9", H), createCard("9", D)],
    dealerUpCard: createCard("9", S),
    expectedAction: "split",
    explanation: "18 vs 9 is a losing hand. Split to try for two 19s.",
    difficulty: 2,
  },
  {
    id: "split-7s-vs-8-6deck",
    category: "splits",
    description: "Pair of 7s vs Dealer 8 (6+ decks)",
    playerCards: [createCard("7", H), createCard("7", D)],
    dealerUpCard: createCard("8", S),
    expectedAction: "hit",
    explanation: "With 6+ decks, splitting 7s vs 8 creates two weak hands. Better to hit the 14.",
    difficulty: 2,
  },
  {
    id: "split-7s-vs-8-2deck",
    category: "ruleset-variations",
    description: "Pair of 7s vs Dealer 8 (1-2 decks)",
    playerCards: [createCard("7", H), createCard("7", D)],
    dealerUpCard: createCard("8", S),
    expectedAction: "split",
    explanation: "With single or double deck, split 7s vs 8 due to card composition effects.",
    difficulty: 3,
    rulesVariants: [
      { decks: 1 },
      { decks: 2 },
    ],
  },
  {
    id: "split-6s-vs-2",
    category: "splits",
    description: "Pair of 6s vs Dealer 2 (DAS)",
    playerCards: [createCard("6", H), createCard("6", D)],
    dealerUpCard: createCard("2", S),
    expectedAction: "split",
    explanation: "With DAS, split 6s against dealer 2. Without DAS, just hit.",
    difficulty: 3,
    rulesVariants: [
      { doubleAfterSplit: true },
      { doubleAfterSplit: false },
    ],
  },
  {
    id: "split-4s-vs-6",
    category: "splits",
    description: "Pair of 4s vs Dealer 6",
    playerCards: [createCard("4", H), createCard("4", D)],
    dealerUpCard: createCard("6", S),
    expectedAction: "split",
    explanation: "With DAS, split 4s against 5-6 to potentially double after.",
    difficulty: 3,
    rulesVariants: [
      { doubleAfterSplit: true },
    ],
  },
  {
    id: "split-2s-vs-3",
    category: "splits",
    description: "Pair of 2s vs Dealer 3",
    playerCards: [createCard("2", H), createCard("2", D)],
    dealerUpCard: createCard("3", S),
    expectedAction: "split",
    explanation: "With DAS, split 2s and 3s against 2-7. Without DAS, only 4-7.",
    difficulty: 3,
    rulesVariants: [
      { doubleAfterSplit: true },
      { doubleAfterSplit: false },
    ],
  },

  // SOFT DOUBLES
  {
    id: "soft-18-vs-9",
    category: "soft-doubles",
    description: "Soft 18 vs Dealer 9",
    playerCards: [createCard("A", H), createCard("7", D)],
    dealerUpCard: createCard("9", S),
    expectedAction: "hit",
    explanation: "Soft 18 loses to dealer 19. Hit to try to improve.",
    difficulty: 2,
  },
  {
    id: "soft-18-vs-7",
    category: "soft-doubles",
    description: "Soft 18 vs Dealer 7",
    playerCards: [createCard("A", H), createCard("7", D)],
    dealerUpCard: createCard("7", S),
    expectedAction: "stand",
    explanation: "Dealer likely has 17. Your 18 wins.",
    difficulty: 2,
  },
  {
    id: "soft-18-vs-3",
    category: "soft-doubles",
    description: "Soft 18 vs Dealer 3",
    playerCards: [createCard("A", H), createCard("7", D)],
    dealerUpCard: createCard("3", S),
    expectedAction: "double",
    explanation: "Soft 18 can't bust. Double against weak dealer.",
    difficulty: 2,
  },
  {
    id: "soft-19-vs-6",
    category: "soft-doubles",
    description: "Soft 19 vs Dealer 6 (H17)",
    playerCards: [createCard("A", H), createCard("8", D)],
    dealerUpCard: createCard("6", S),
    expectedAction: "double",
    explanation: "With H17 rules, doubling soft 19 vs 6 is correct due to higher dealer bust rate.",
    difficulty: 3,
    rulesVariants: [
      { hitSoft17: true },
      { hitSoft17: false },
    ],
  },
  {
    id: "soft-17-vs-2",
    category: "soft-doubles",
    description: "Soft 17 vs Dealer 2",
    playerCards: [createCard("A", H), createCard("6", D)],
    dealerUpCard: createCard("2", S),
    expectedAction: "hit",
    explanation: "Soft 17 vs 2 isn't strong enough to double. Just hit.",
    difficulty: 2,
  },
  {
    id: "soft-17-vs-5",
    category: "soft-doubles",
    description: "Soft 17 vs Dealer 5",
    playerCards: [createCard("A", H), createCard("6", D)],
    dealerUpCard: createCard("5", S),
    expectedAction: "double",
    explanation: "Double soft 17 against dealer 4-6 when dealer is likely to bust.",
    difficulty: 2,
  },
  {
    id: "soft-15-vs-4",
    category: "soft-doubles",
    description: "Soft 15 vs Dealer 4",
    playerCards: [createCard("A", H), createCard("4", D)],
    dealerUpCard: createCard("4", S),
    expectedAction: "double",
    explanation: "Double soft 15 against dealer 4-6. Can't bust, good chance to improve.",
    difficulty: 2,
  },
  {
    id: "soft-13-vs-6",
    category: "soft-doubles",
    description: "Soft 13 vs Dealer 6",
    playerCards: [createCard("A", H), createCard("2", D)],
    dealerUpCard: createCard("6", S),
    expectedAction: "double",
    explanation: "Double soft 13 against dealer 5-6. Can't bust, good chance to improve.",
    difficulty: 3,
  },
  {
    id: "soft-13-vs-5",
    category: "soft-doubles",
    description: "Soft 13 vs Dealer 5",
    playerCards: [createCard("A", H), createCard("2", D)],
    dealerUpCard: createCard("5", S),
    expectedAction: "double",
    explanation: "Double soft 13 against dealer 5-6.",
    difficulty: 3,
  },

  // HARD DOUBLES
  {
    id: "hard-11-vs-ace-6deck-s17",
    category: "hard-doubles",
    description: "Hard 11 vs Dealer Ace (6 decks, S17)",
    playerCards: [createCard("5", H), createCard("6", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "hit",
    explanation: "With S17 and 6+ decks, just hit vs Ace. With H17 or single/double deck, double.",
    difficulty: 3,
    rulesVariants: [
      { decks: 6, hitSoft17: false },
    ],
  },
  {
    id: "hard-11-vs-ace-h17",
    category: "ruleset-variations",
    description: "Hard 11 vs Dealer Ace (H17)",
    playerCards: [createCard("5", H), createCard("6", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "double",
    explanation: "With H17, double 11 vs Ace. The dealer is more likely to bust.",
    difficulty: 3,
    rulesVariants: [
      { hitSoft17: true },
    ],
  },
  {
    id: "hard-11-vs-10",
    category: "hard-doubles",
    description: "Hard 11 vs Dealer 10",
    playerCards: [createCard("5", H), createCard("6", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "double",
    explanation: "Double 11 vs 10—you have the advantage even against dealer's strong card.",
    difficulty: 2,
  },
  {
    id: "hard-10-vs-10",
    category: "hard-doubles",
    description: "Hard 10 vs Dealer 10",
    playerCards: [createCard("4", H), createCard("6", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "hit",
    explanation: "Don't double 10 against dealer 10 or Ace—too risky.",
    difficulty: 2,
  },
  {
    id: "hard-10-vs-9",
    category: "hard-doubles",
    description: "Hard 10 vs Dealer 9",
    playerCards: [createCard("4", H), createCard("6", D)],
    dealerUpCard: createCard("9", S),
    expectedAction: "double",
    explanation: "Double 10 against dealer 2-9 for maximum profit.",
    difficulty: 2,
  },
  {
    id: "hard-9-vs-3",
    category: "hard-doubles",
    description: "Hard 9 vs Dealer 3",
    playerCards: [createCard("4", H), createCard("5", D)],
    dealerUpCard: createCard("3", S),
    expectedAction: "double",
    explanation: "Double 9 against dealer 3-6.",
    difficulty: 2,
  },
  {
    id: "hard-9-vs-2",
    category: "hard-doubles",
    description: "Hard 9 vs Dealer 2",
    playerCards: [createCard("4", H), createCard("5", D)],
    dealerUpCard: createCard("2", S),
    expectedAction: "hit",
    explanation: "Don't double 9 against dealer 2—just hit.",
    difficulty: 2,
  },

  // SURRENDERS
  {
    id: "surrender-16-vs-10",
    category: "surrenders",
    description: "Hard 16 vs Dealer 10",
    playerCards: [createCard("10", H), createCard("6", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "surrender",
    explanation: "16 vs 10 is a heavy underdog. Surrender saves half your bet.",
    difficulty: 2,
    rulesVariants: [
      { surrenderAllowed: "late" },
    ],
  },
  {
    id: "surrender-16-vs-9",
    category: "surrenders",
    description: "Hard 16 vs Dealer 9 (S17)",
    playerCards: [createCard("10", H), createCard("6", D)],
    dealerUpCard: createCard("9", S),
    expectedAction: "surrender",
    explanation: "With S17, surrender 16 vs 9. With H17, just hit.",
    difficulty: 3,
    rulesVariants: [
      { surrenderAllowed: "late", hitSoft17: false },
      { surrenderAllowed: "late", hitSoft17: true },
    ],
  },
  {
    id: "surrender-15-vs-10",
    category: "surrenders",
    description: "Hard 15 vs Dealer 10",
    playerCards: [createCard("10", H), createCard("5", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "surrender",
    explanation: "15 vs 10 is bad. Surrender cuts losses.",
    difficulty: 2,
    rulesVariants: [
      { surrenderAllowed: "late" },
    ],
  },
  {
    id: "surrender-15-vs-ace-h17",
    category: "surrenders",
    description: "Hard 15 vs Dealer Ace (H17)",
    playerCards: [createCard("10", H), createCard("5", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "surrender",
    explanation: "With H17 rules, surrender 15 vs Ace. With S17, just hit.",
    difficulty: 3,
    rulesVariants: [
      { surrenderAllowed: "late", hitSoft17: true },
      { surrenderAllowed: "late", hitSoft17: false },
    ],
  },
  {
    id: "surrender-17-vs-ace-h17",
    category: "surrenders",
    description: "Hard 17 vs Dealer Ace (H17)",
    playerCards: [createCard("10", H), createCard("7", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "surrender",
    explanation: "With H17, dealer is more aggressive with Ace up. Surrender 17 vs Ace.",
    difficulty: 3,
    rulesVariants: [
      { surrenderAllowed: "late", hitSoft17: true },
    ],
  },

  // RULESET VARIATIONS
  {
    id: "rules-soft-18-vs-2",
    category: "ruleset-variations",
    description: "Soft 18 vs Dealer 2 (H17 vs S17)",
    playerCards: [createCard("A", H), createCard("7", D)],
    dealerUpCard: createCard("2", S),
    expectedAction: "double",
    explanation: "With H17, double soft 18 vs 2. With S17, stand.",
    difficulty: 3,
    rulesVariants: [
      { hitSoft17: true },
      { hitSoft17: false },
    ],
  },
  {
    id: "rules-7s-vs-8-deck",
    category: "ruleset-variations",
    description: "Pair of 7s vs Dealer 8 (Deck Count)",
    playerCards: [createCard("7", H), createCard("7", D)],
    dealerUpCard: createCard("8", S),
    expectedAction: "split",
    explanation: "With single or double deck, split 7s vs 8. With 6+ decks, hit.",
    difficulty: 3,
    rulesVariants: [
      { decks: 2 },
      { decks: 6 },
    ],
  },
  {
    id: "rules-11-vs-ace-deck",
    category: "ruleset-variations",
    description: "Hard 11 vs Dealer Ace (Deck Count)",
    playerCards: [createCard("5", H), createCard("6", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "double",
    explanation: "With single or double deck, double 11 vs Ace. With 6+ decks and S17, hit.",
    difficulty: 3,
    rulesVariants: [
      { decks: 2, hitSoft17: false },
      { decks: 6, hitSoft17: false },
    ],
  },

  // TRICKY TOTALS
  {
    id: "tricky-12-vs-2",
    category: "tricky-totals",
    description: "Hard 12 vs Dealer 2",
    playerCards: [createCard("10", H), createCard("2", D)],
    dealerUpCard: createCard("2", S),
    expectedAction: "hit",
    explanation: "Hit 12 vs 2-3. Dealer bust rate isn't high enough to stand.",
    difficulty: 2,
  },
  {
    id: "tricky-12-vs-4",
    category: "tricky-totals",
    description: "Hard 12 vs Dealer 4",
    playerCards: [createCard("10", H), createCard("2", D)],
    dealerUpCard: createCard("4", S),
    expectedAction: "stand",
    explanation: "Stand on 12 vs 4-6. Let the dealer bust.",
    difficulty: 2,
  },
  {
    id: "tricky-16-vs-7",
    category: "tricky-totals",
    description: "Hard 16 vs Dealer 7",
    playerCards: [createCard("10", H), createCard("6", D)],
    dealerUpCard: createCard("7", S),
    expectedAction: "hit",
    explanation: "16 vs 7 is tough. Hit and hope to improve—dealer likely has 17.",
    difficulty: 2,
  },
  {
    id: "tricky-16-vs-10-no-surrender",
    category: "tricky-totals",
    description: "Hard 16 vs Dealer 10 (No Surrender)",
    playerCards: [createCard("10", H), createCard("6", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "hit",
    explanation: "Without surrender, you must hit 16 vs 10. It's a bad spot but hitting is slightly better.",
    difficulty: 2,
  },
  {
    id: "tricky-13-vs-2",
    category: "tricky-totals",
    description: "Hard 13 vs Dealer 2",
    playerCards: [createCard("10", H), createCard("3", D)],
    dealerUpCard: createCard("2", S),
    expectedAction: "stand",
    explanation: "Stand on 13+ vs dealer 2-6. Let the dealer bust.",
    difficulty: 1,
  },
  {
    id: "tricky-15-vs-10-no-surrender",
    category: "tricky-totals",
    description: "Hard 15 vs Dealer 10 (No Surrender)",
    playerCards: [createCard("10", H), createCard("5", D)],
    dealerUpCard: createCard("10", S),
    expectedAction: "hit",
    explanation: "Without surrender, hit 15 vs 10. You'll bust often but it's the best play.",
    difficulty: 2,
  },
  {
    id: "tricky-soft-18-vs-A",
    category: "tricky-totals",
    description: "Soft 18 vs Dealer Ace",
    playerCards: [createCard("A", H), createCard("7", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "hit",
    explanation: "Soft 18 vs Ace loses to dealer blackjack or 19+. Hit to try to improve.",
    difficulty: 2,
  },
  {
    id: "tricky-10-vs-A",
    category: "tricky-totals",
    description: "Hard 10 vs Dealer Ace",
    playerCards: [createCard("5", H), createCard("5", D)],
    dealerUpCard: createCard("A", S),
    expectedAction: "hit",
    explanation: "Don't double 10 against Ace. Too much risk of dealer having blackjack or strong hand.",
    difficulty: 2,
  },
];

export function getScenariosByCategory(
  category: TrainingScenario["category"],
): TrainingScenario[] {
  return TRAINING_SCENARIOS.filter((s) => s.category === category);
}

export function getScenariosForRules(
  rules: HouseRules,
): TrainingScenario[] {
  return TRAINING_SCENARIOS.filter((scenario) => {
    if (!scenario.rulesVariants || scenario.rulesVariants.length === 0) {
      return true;
    }
    return scenario.rulesVariants.some((variant) => {
      return Object.entries(variant).every(([key, value]) => {
        return rules[key as keyof HouseRules] === value;
      });
    });
  });
}

// Note: Expected action for a given ruleset is computed dynamically via
// getBasicStrategyAction() in useTrainingMode.ts, not from static scenario data.
// The rulesVariants field on scenarios is used for filtering which scenarios
// are relevant to the current ruleset (see getScenariosForRules).

export const CATEGORY_LABELS: Record<TrainingScenario["category"], string> = {
  splits: "Split Decisions",
  "soft-doubles": "Soft Hand Doubles",
  "hard-doubles": "Hard Hand Doubles",
  surrenders: "Surrender Plays",
  "ruleset-variations": "Ruleset Variations",
  "tricky-totals": "Tricky Totals",
};

export const CATEGORY_DESCRIPTIONS: Record<TrainingScenario["category"], string> = {
  splits: "When to split pairs and when not to",
  "soft-doubles": "Doubling soft hands (Ace + another card)",
  "hard-doubles": "Doubling hard totals like 9, 10, 11",
  surrenders: "When to surrender and cut your losses",
  "ruleset-variations": "Plays that change based on H17/S17, DAS, deck count",
  "tricky-totals": "Hard 12, 15, 16 decisions and soft 18 edge cases",
};
