import { Hand } from "./Hand";
import { GameState, HouseRules, PlayerAction, Hand as HandType } from "../lib/types";
import { isBusted, isCardsBlackjack } from "../lib/deck";
import { getHandResult } from "../lib/game";
import { computeEVCost, formatEV, formatEVLoss } from "../lib/ev-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GameAreaProps {
  gameState: GameState;
  rules: HouseRules;
  currentHand: HandType | undefined;
  showCorrectAnswer: boolean;
  availableActions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  onDealerPlay: () => void;
  onNextHand: () => void;
  onNewGame: () => void;
}

export function GameArea({
  gameState,
  rules,
  currentHand,
  showCorrectAnswer,
  availableActions,
  onAction,
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
          <ActionButtons actions={availableActions} onAction={onAction} />
        )}

      {showCorrectAnswer && gameState.lastAction && gameState.expectedAction && (
        <FeedbackMessage
          isCorrect={gameState.isCorrect ?? false}
          expectedAction={gameState.expectedAction}
          lastAction={gameState.lastAction}
          actedHand={gameState.lastActionHand}
          dealerHand={gameState.dealerHand}
          rules={rules}
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
}: {
  actions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
}) {
  const actionVariants: Record<PlayerAction, "default" | "secondary" | "destructive" | "outline"> = {
    hit: "default",
    stand: "secondary",
    double: "default",
    split: "default",
    surrender: "destructive",
  };

  const actionColors: Record<PlayerAction, string> = {
    hit: "bg-blue-600 hover:bg-blue-700",
    stand: "",
    double: "bg-purple-600 hover:bg-purple-700",
    split: "bg-orange-600 hover:bg-orange-700",
    surrender: "",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {actions.map((action) => (
          <Button
            key={action}
            variant={actionVariants[action]}
            size="lg"
            onClick={() => onAction(action)}
            className={actionColors[action]}
          >
            {actionToString(action)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function actionToString(action: PlayerAction): string {
  const map: Record<PlayerAction, string> = {
    hit: "Hit",
    stand: "Stand",
    double: "Double Down",
    split: "Split",
    surrender: "Surrender",
  };
  return map[action];
}

function FeedbackMessage({
  isCorrect,
  expectedAction,
  lastAction,
  actedHand,
  dealerHand,
  rules,
}: {
  isCorrect: boolean;
  expectedAction: PlayerAction;
  lastAction: PlayerAction;
  actedHand: HandType | null;
  dealerHand: HandType;
  rules: HouseRules;
}) {
  const message = isCorrect
    ? "Correct!"
    : `Incorrect. The correct play was ${actionToString(expectedAction)}.`;

  const evCost = !isCorrect && actedHand
    ? computeEVCost(actedHand, dealerHand, lastAction, rules)
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
          {isCorrect ? "✓" : "✗"} {message}
        </Badge>
      </div>
      {evCost && !isCorrect && (
        <div className="text-center">
          <div className="inline-block bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-red-700 font-medium">
                {actionToString(expectedAction)}: {formatEV(evCost.optimalEV)}
              </span>
              <span className="text-zinc-400">|</span>
              <span className="text-zinc-600">
                {actionToString(lastAction)}: {formatEV(evCost.chosenEV)}
              </span>
            </div>
            <div className="mt-1 text-xs text-red-600 font-medium">
              Cost: {formatEVLoss(evCost.evLoss)} of your bet
            </div>
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

function GameResults({
  gameState,
  onNewGame,
}: {
  gameState: GameState;
  onNewGame: () => void;
}) {
  const resultVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    win: "default",
    blackjack: "default",
    push: "secondary",
    surrender: "outline",
    lose: "destructive",
  };

  const resultColors: Record<string, string> = {
    win: "bg-green-600",
    blackjack: "bg-green-600",
    push: "bg-yellow-500",
    surrender: "",
    lose: "",
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        {gameState.playerHands.map((hand, i) => {
          const result = getHandResult(hand, gameState.dealerHand);
          return (
            <Badge
              key={i}
              variant={resultVariants[result]}
              className={cn("text-base px-4 py-2", resultColors[result])}
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
