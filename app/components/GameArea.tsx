import { Hand } from "./Hand";
import { GameState, HouseRules, PlayerAction, Hand as HandType } from "../lib/types";
import { isBusted, isCardsBlackjack } from "../lib/deck";
import { getHandResult } from "../lib/game";
import { computeAvailableActionEVs, computeEVCost, formatEV, formatEVLoss } from "../lib/ev-utils";
import { actionToString, getActionVariant, getActionColor } from "../lib/format";
import type { StrategyTable } from "../lib/ev-calculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GameAreaProps {
  gameState: GameState;
  rules: HouseRules;
  strategyTable?: StrategyTable | null;
  currentHand: HandType | undefined;
  showCorrectAnswer: boolean;
  availableActions: PlayerAction[];
  needsEarlySurrenderDecision: boolean;
  onAction: (action: PlayerAction) => void;
  onDeclineEarlySurrender: () => void;
  onDealerPlay: () => void;
  onNextHand: () => void;
  onNewGame: () => void;
}

export function GameArea({
  gameState,
  rules,
  strategyTable,
  currentHand,
  showCorrectAnswer,
  availableActions,
  needsEarlySurrenderDecision,
  onAction,
  onDeclineEarlySurrender,
  onDealerPlay,
  onNextHand,
  onNewGame,
}: GameAreaProps) {
  const playerCards = gameState.playerHands[0]?.cards ?? [];
  const dealerCards = gameState.dealerHand.cards;

  return (
    <>
      <div className="mb-8">
        <Hand
          cards={dealerCards}
          label="Dealer"
          hideHoleCard={
            gameState.phase === "playing" &&
            !rules.noHoleCard &&
            dealerCards.length === 2
          }
        />
      </div>

      <div className="mb-8">
        {gameState.playerHands.map((hand, i) => (
          <Hand
            key={i}
            cards={hand.cards}
            label={`Hand ${i + 1}`}
            isCurrentHand={
              i === gameState.currentHandIndex && gameState.phase === "playing"
            }
          />
        ))}
      </div>

      {gameState.phase === "resolved" &&
        (isCardsBlackjack(playerCards) || isCardsBlackjack(dealerCards)) && (
          <BlackjackResult
            playerBJ={isCardsBlackjack(playerCards)}
            dealerBJ={isCardsBlackjack(dealerCards)}
          />
        )}

      {gameState.phase === "playing" &&
        currentHand &&
        !isBusted(currentHand) &&
        !currentHand.isStanding &&
        !currentHand.isSurrendered && (
          <ActionButtons
            actions={availableActions}
            onAction={onAction}
            needsEarlySurrenderDecision={needsEarlySurrenderDecision}
            onDeclineEarlySurrender={onDeclineEarlySurrender}
          />
        )}

      {showCorrectAnswer && gameState.lastAction && gameState.expectedAction && (
        <FeedbackMessage
          isCorrect={gameState.isCorrect ?? false}
          expectedAction={gameState.expectedAction}
          lastAction={gameState.lastAction}
          actedHand={gameState.lastActionHand}
          dealerHand={gameState.dealerHand}
          rules={rules}
          strategyTable={strategyTable}
          lastAvailableActions={gameState.lastAvailableActions}
        />
      )}

      {gameState.phase === "playing" &&
        currentHand &&
        (isBusted(currentHand) ||
          currentHand.isStanding ||
          currentHand.isSurrendered) && (
          <TransitionButton
            isLastHand={
              gameState.currentHandIndex >= gameState.playerHands.length - 1
            }
            onNextHand={onNextHand}
            onDealerPlay={onDealerPlay}
          />
        )}

      {gameState.phase === "dealer" && (
        <div className="text-center">
          <Button onClick={onDealerPlay} size="lg">
            Dealer Plays
          </Button>
        </div>
      )}

      {gameState.phase === "resolved" && (
        <GameResults gameState={gameState} onNewGame={onNewGame} />
      )}
    </>
  );
}

function BlackjackResult({
  playerBJ,
  dealerBJ,
}: {
  playerBJ: boolean;
  dealerBJ: boolean;
}) {
  const message =
    playerBJ && dealerBJ
      ? "Both have Blackjack - Push!"
      : playerBJ
        ? "Blackjack! You Win!"
        : "Dealer has Blackjack - You Lose";

  return (
    <div className="space-y-4 mb-4">
      <div className="text-center">
        <Badge
          variant={playerBJ && !dealerBJ ? "default" : "destructive"}
          className={cn(
            "text-base px-4 py-2",
            playerBJ && dealerBJ && "bg-yellow-500"
          )}
        >
          {message}
        </Badge>
      </div>
    </div>
  );
}

function ActionButtons({
  actions,
  onAction,
  needsEarlySurrenderDecision,
  onDeclineEarlySurrender,
}: {
  actions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  needsEarlySurrenderDecision: boolean;
  onDeclineEarlySurrender: () => void;
}) {
  return (
    <div className="space-y-4">
      {needsEarlySurrenderDecision && (
        <p className="text-center text-sm text-muted-foreground">
          Early surrender decision: surrender now or continue the hand.
        </p>
      )}
      <div className="flex flex-wrap gap-2 justify-center">
        {actions.map((action) => (
          <Button
            key={action}
            variant={getActionVariant(action)}
            size="lg"
            onClick={() => onAction(action)}
            className={getActionColor(action)}
            aria-label={actionToString(action)}
          >
            {actionToString(action)}
          </Button>
        ))}
        {needsEarlySurrenderDecision && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onDeclineEarlySurrender}
            aria-label="Continue hand"
          >
            Continue Hand
          </Button>
        )}
      </div>
    </div>
  );
}

function FeedbackMessage({
  isCorrect,
  expectedAction,
  lastAction,
  actedHand,
  dealerHand,
  rules,
  strategyTable,
  lastAvailableActions,
}: {
  isCorrect: boolean;
  expectedAction: PlayerAction;
  lastAction: PlayerAction;
  actedHand: HandType | null;
  dealerHand: HandType;
  rules: HouseRules;
  strategyTable?: StrategyTable | null;
  lastAvailableActions?: PlayerAction[];
}) {
  const message = isCorrect
    ? "Correct!"
    : `Incorrect. The correct play was ${actionToString(expectedAction)}.`;

  const actionEVs = actedHand
    ? computeAvailableActionEVs(actedHand, dealerHand, rules, strategyTable, lastAvailableActions)
      .sort((a, b) => b.ev - a.ev)
    : [];

  const evCost = !isCorrect && actedHand
    ? computeEVCost(actedHand, dealerHand, lastAction, rules, strategyTable, lastAvailableActions)
    : null;

  return (
    <div className="mb-4 space-y-2">
      <div className="text-center">
        <Badge
          variant={isCorrect ? "default" : "destructive"}
          className={cn(
            "text-base px-4 py-2",
            isCorrect && "bg-green-600"
          )}
        >
          <span aria-hidden="true">{isCorrect ? "✓" : "✗"}</span> {message}
        </Badge>
      </div>
      {actionEVs.length > 0 && (
        <div className="text-center">
          <div className={cn(
            "inline-block rounded-lg px-3 py-2 max-w-full overflow-hidden",
            isCorrect
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40"
              : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40"
          )}>
            <div className="flex items-center gap-2 text-sm flex-wrap justify-center">
              {actionEVs.map((a, i) => (
                <span key={a.action} className="flex items-center gap-2">
                  {i > 0 && <span className="text-zinc-400">|</span>}
                  <span className={cn(
                    a.action === expectedAction
                      ? isCorrect ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"
                      : a.action === lastAction && !isCorrect
                        ? "text-foreground/70 font-medium"
                        : "text-muted-foreground"
                  )}>
                    {actionToString(a.action)}: {formatEV(a.ev)}
                  </span>
                </span>
              ))}
            </div>
            {!isCorrect && evCost && (
              <div className="mt-1 text-xs text-red-500 dark:text-red-400 font-medium">
                Cost: {formatEVLoss(evCost.evLoss)} of your bet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TransitionButton({
  isLastHand,
  onNextHand,
  onDealerPlay,
}: {
  isLastHand: boolean;
  onNextHand: () => void;
  onDealerPlay: () => void;
}) {
  return (
    <div className="text-center">
      <Button
        onClick={isLastHand ? onDealerPlay : onNextHand}
        size="lg"
        className="bg-blue-600 hover:bg-blue-700"
      >
        {isLastHand ? "Dealer Plays" : "Next Hand"}
      </Button>
    </div>
  );
}

const RESULT_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  win: "default",
  blackjack: "default",
  push: "secondary",
  surrender: "outline",
  lose: "destructive",
};

const RESULT_COLORS: Record<string, string> = {
  win: "bg-green-600",
  blackjack: "bg-green-600",
  push: "bg-yellow-500",
  surrender: "",
  lose: "",
};

function GameResults({
  gameState,
  onNewGame,
}: {
  gameState: GameState;
  onNewGame: () => void;
}) {

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        {gameState.playerHands.map((hand, i) => {
          const result = getHandResult(hand, gameState.dealerHand);
          return (
            <Badge
              key={i}
              variant={RESULT_VARIANTS[result]}
              className={cn("text-base px-4 py-2", RESULT_COLORS[result])}
            >
              Hand {i + 1}: {result.charAt(0).toUpperCase() + result.slice(1)}
            </Badge>
          );
        })}
      </div>
      <div className="text-center">
        <Button
          onClick={onNewGame}
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6"
        >
          New Hand
        </Button>
      </div>
    </div>
  );
}
