import { Hand } from "./Hand";
import { GameState, HouseRules, PlayerAction, Hand as HandType } from "../lib/types";
import { isBusted, isCardsBlackjack } from "../lib/deck";
import { getHandResult } from "../lib/game";

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
          hiddenFirst={
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
          <button
            onClick={onDealerPlay}
            className="px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg font-semibold"
          >
            Dealer Plays
          </button>
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
  const bgClass =
    playerBJ && dealerBJ
      ? "bg-yellow-100 text-yellow-800"
      : playerBJ
        ? "bg-green-100 text-green-800"
        : "bg-red-100 text-red-800";

  return (
    <div className="space-y-4 mb-4">
      <div className="text-center">
        <div className={`p-4 rounded-lg font-semibold ${bgClass}`}>
          {message}
        </div>
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
  const actionColors: Record<PlayerAction, string> = {
    hit: "bg-blue-600 hover:bg-blue-700 text-white",
    stand: "bg-zinc-600 hover:bg-zinc-700 text-white",
    double: "bg-purple-600 hover:bg-purple-700 text-white",
    split: "bg-orange-600 hover:bg-orange-700 text-white",
    surrender: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {actions.map((action) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${actionColors[action]}`}
          >
            {actionToString(action)}
          </button>
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
}: {
  isCorrect: boolean;
  expectedAction: PlayerAction;
}) {
  const bgClass = isCorrect ? "bg-green-100" : "bg-red-100";
  const textClass = isCorrect ? "text-green-800" : "text-red-800";
  const message = isCorrect
    ? "✓ Correct!"
    : `✗ Incorrect. The correct play was ${actionToString(expectedAction)}.`;

  return (
    <div className={`p-4 rounded-lg mb-4 ${bgClass}`}>
      <p className={textClass}>{message}</p>
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
      <button
        onClick={isLastHand ? onDealerPlay : onNextHand}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
      >
        {isLastHand ? "Dealer Plays" : "Next Hand"}
      </button>
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
  return (
    <div className="space-y-4">
      <div className="text-center">
        {gameState.playerHands.map((hand, i) => {
          const result = getHandResult(hand, gameState.dealerHand);
          const bgClass =
            result === "win" || result === "blackjack"
              ? "bg-green-100 text-green-800"
              : result === "push"
                ? "bg-yellow-100 text-yellow-800"
                : result === "surrender"
                  ? "bg-zinc-100 text-zinc-800"
                  : "bg-red-100 text-red-800";

          return (
            <div key={i} className={`p-3 rounded-lg mb-2 ${bgClass}`}>
              Hand {i + 1}: {result.charAt(0).toUpperCase() + result.slice(1)}
            </div>
          );
        })}
      </div>
      <div className="text-center">
        <button
          onClick={onNewGame}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors"
        >
          New Hand
        </button>
      </div>
    </div>
  );
}
