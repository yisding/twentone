import { useState } from "react";
import { Card } from "./Card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TrainingScenario,
  TrainingScenarioCategory,
  PlayerAction,
  HouseRules,
  Hand,
} from "../lib/types";
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
} from "../lib/training-scenarios";
import { calculateCardsValue } from "../lib/deck";
import { computeAvailableActionEVs, computeEVCost, formatEV, formatEVLoss } from "../lib/ev-utils";
import { actionToString, getActionVariant, getActionColor } from "../lib/format";
import type { StrategyTable } from "../lib/ev-calculator";

interface TrainingModeProps {
  currentScenario: TrainingScenario | null;
  showAnswer: boolean;
  lastAnswerCorrect: boolean | null;
  lastExpectedAction: PlayerAction | null;
  lastChosenAction: PlayerAction | null;
  sessionStats: { correct: number; total: number };
  focusCategory: TrainingScenarioCategory | null;
  rules: HouseRules;
  strategyTable?: StrategyTable | null;
  availableActions: PlayerAction[];
  onNextScenario: () => void;
  onSubmitAnswer: (action: PlayerAction) => void;
  onSetFocusCategory: (category: TrainingScenarioCategory | null) => void;
  onSkip: () => void;
  categoryStats: Record<
    TrainingScenarioCategory,
    { correct: number; total: number }
  >;
  weakCategories: TrainingScenarioCategory[];
}

export function TrainingMode({
  currentScenario,
  showAnswer,
  lastAnswerCorrect,
  lastExpectedAction,
  lastChosenAction,
  sessionStats,
  focusCategory,
  rules,
  strategyTable,
  availableActions,
  onNextScenario,
  onSubmitAnswer,
  onSetFocusCategory,
  onSkip,
  categoryStats,
  weakCategories,
}: TrainingModeProps) {
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  if (!currentScenario) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Training Mode</h2>
        <p className="text-zinc-600 mb-6">
          Focus on the harder parts of basic strategy with spaced repetition.
        </p>
        <Button onClick={onNextScenario} size="lg" className="bg-green-600 hover:bg-green-700">
          Start Training
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {CATEGORY_LABELS[currentScenario.category]}
          </Badge>
          {currentScenario.difficulty === 3 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              Advanced
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">
            Session: {sessionStats.correct}/{sessionStats.total}
          </span>
          {sessionStats.total > 0 && (
            <span className="text-sm font-medium">
              ({Math.round((sessionStats.correct / sessionStats.total) * 100)}%)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={focusCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => onSetFocusCategory(null)}
        >
          All Categories
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCategorySelector(!showCategorySelector)}
        >
          Focus: {focusCategory ? CATEGORY_LABELS[focusCategory] : "None"}
        </Button>
      </div>

      {showCategorySelector && (
        <CategorySelector
          focusCategory={focusCategory}
          onSelect={onSetFocusCategory}
          onClose={() => setShowCategorySelector(false)}
          categoryStats={categoryStats}
          weakCategories={weakCategories}
        />
      )}

      {weakCategories.length > 0 && !focusCategory && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">
          <span>Needs practice:</span>
          {weakCategories.map((cat) => (
            <Button
              key={cat}
              variant="outline"
              size="sm"
              onClick={() => onSetFocusCategory(cat)}
              className="h-7 text-xs"
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      )}

      <div className="bg-zinc-50 rounded-lg p-6">
        <div className="text-center mb-2 text-zinc-600 font-medium">
          {currentScenario.description}
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <div className="text-sm text-zinc-500 mb-2">Dealer</div>
            <div className="flex justify-center gap-2">
              <Card card={currentScenario.dealerUpCard} />
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-zinc-500 mb-2">Your Hand</div>
            <div className="flex justify-center gap-2">
              {currentScenario.playerCards.map((card, i) => (
                <Card key={i} card={card} />
              ))}
            </div>
            <div className="mt-2">
              <HandDescription cards={currentScenario.playerCards} />
            </div>
          </div>
        </div>
      </div>

      {!showAnswer ? (
        <div className="space-y-4">
          <div className="text-center text-zinc-600">What is the correct play?</div>
          <ActionButtons
            actions={availableActions}
            onAction={onSubmitAnswer}
            disabled={showAnswer}
          />
          <div className="text-center">
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FeedbackMessage
            isCorrect={lastAnswerCorrect ?? false}
            expectedAction={lastExpectedAction}
            chosenAction={lastChosenAction}
            currentScenario={currentScenario}
            rules={rules}
            strategyTable={strategyTable}
          />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">{currentScenario.explanation}</p>
          </div>

          {currentScenario.rulesVariants && currentScenario.rulesVariants.length > 0 && (
            <RulesetNote rules={rules} />
          )}

          <div className="text-center">
            <Button
              onClick={onNextScenario}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              Next Scenario
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HandDescription({ cards }: { cards: TrainingScenario["playerCards"] }) {
  const { total, isSoft } = calculateCardsValue(cards);
  const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;

  if (isPair) {
    return (
      <Badge variant="secondary">
        Pair of {cards[0].rank}s
      </Badge>
    );
  }

  if (isSoft && total <= 21) {
    return (
      <Badge variant="secondary">
        Soft {total}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {total}
    </Badge>
  );
}

function ActionButtons({
  actions,
  onAction,
  disabled,
}: {
  actions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {actions.map((action) => (
        <Button
          key={action}
          variant={getActionVariant(action)}
          size="lg"
          onClick={() => onAction(action)}
          disabled={disabled}
          className={getActionColor(action)}
          aria-label={actionToString(action)}
        >
          {actionToString(action)}
        </Button>
      ))}
    </div>
  );
}

function FeedbackMessage({
  isCorrect,
  expectedAction,
  chosenAction,
  currentScenario,
  rules,
  strategyTable,
}: {
  isCorrect: boolean;
  expectedAction: PlayerAction | null;
  chosenAction: PlayerAction | null;
  currentScenario: TrainingScenario;
  rules: HouseRules;
  strategyTable?: StrategyTable | null;
}) {
  const message = isCorrect
    ? "Correct!"
    : `Incorrect. The correct play was ${expectedAction ? actionToString(expectedAction) : "?"}.`;

  const playerHand: Hand = {
    cards: currentScenario.playerCards,
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
  const dealerHand: Hand = {
    cards: [currentScenario.dealerUpCard],
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };

  const actionEVs = computeAvailableActionEVs(playerHand, dealerHand, rules, strategyTable)
    .sort((a, b) => b.ev - a.ev);

  const evCost = !isCorrect && chosenAction && expectedAction
    ? computeEVCost(playerHand, dealerHand, chosenAction, rules, strategyTable)
    : null;

  return (
    <div className="space-y-2">
      <div className="text-center">
        <Badge
          variant={isCorrect ? "default" : "destructive"}
          className={cn("text-base px-4 py-2", isCorrect && "bg-green-600")}
        >
          <span aria-hidden="true">{isCorrect ? "✓" : "✗"}</span> {message}
        </Badge>
      </div>
      {actionEVs.length > 0 && (
        <div className="text-center">
          <div className={cn(
            "inline-block rounded-lg px-3 py-2 max-w-full overflow-hidden",
            isCorrect
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          )}>
            <div className="flex items-center gap-2 text-sm flex-wrap justify-center">
              {actionEVs.map((a, i) => (
                <span key={a.action} className="flex items-center gap-2">
                  {i > 0 && <span className="text-zinc-400">|</span>}
                  <span className={cn(
                    a.action === (expectedAction ?? chosenAction)
                      ? isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium"
                      : a.action === chosenAction && !isCorrect
                        ? "text-zinc-600 font-medium"
                        : "text-zinc-500"
                  )}>
                    {actionToString(a.action)}: {formatEV(a.ev)}
                  </span>
                </span>
              ))}
            </div>
            {!isCorrect && evCost && (
              <div className="mt-1 text-xs text-red-600 font-medium">
                Cost: {formatEVLoss(evCost.evLoss)} of your bet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RulesetNote({
  rules,
}: {
  rules: HouseRules;
}) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <p className="text-xs text-amber-800">
        <strong>Note:</strong> This scenario has ruleset variations. The correct
        play depends on your current rules (H17: {rules.hitSoft17 ? "Yes" : "No"},
        DAS: {rules.doubleAfterSplit ? "Yes" : "No"}, Decks: {rules.decks}).
      </p>
    </div>
  );
}

function CategorySelector({
  focusCategory,
  onSelect,
  onClose,
  categoryStats,
  weakCategories,
}: {
  focusCategory: TrainingScenarioCategory | null;
  onSelect: (category: TrainingScenarioCategory | null) => void;
  onClose: () => void;
  categoryStats: Record<
    TrainingScenarioCategory,
    { correct: number; total: number }
  >;
  weakCategories: TrainingScenarioCategory[];
}) {
  const categories: TrainingScenarioCategory[] = [
    "splits",
    "soft-doubles",
    "hard-doubles",
    "surrenders",
    "ruleset-variations",
    "tricky-totals",
  ];

  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">Focus on Category</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => {
          const stats = categoryStats[cat];
          const accuracy =
            stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
          const isWeak = weakCategories.includes(cat);

          return (
            <button
              key={cat}
              onClick={() => {
                onSelect(cat);
                onClose();
              }}
              className={cn(
                "text-left p-3 rounded border transition-colors",
                focusCategory === cat
                  ? "border-blue-500 bg-blue-50"
                  : "border-zinc-200 hover:border-zinc-300"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {CATEGORY_LABELS[cat]}
                </span>
                {isWeak && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                    Weak
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {CATEGORY_DESCRIPTIONS[cat]}
              </p>
              {stats.total > 0 && (
                <p className="text-xs mt-1">
                  <span className={cn(
                    "font-medium",
                    accuracy >= 80 ? "text-green-600" : accuracy >= 60 ? "text-amber-600" : "text-red-600"
                  )}>
                    {accuracy}%
                  </span>
                  <span className="text-zinc-400"> ({stats.correct}/{stats.total})</span>
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
