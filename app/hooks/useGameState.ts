import { useState, useCallback, useRef, useEffect } from "react";
import { GameState, HouseRules, PlayerAction, Card } from "../lib/types";
import {
  initGame,
  getAvailableActions,
  playerHit,
  playerStand,
  playerDouble,
  playerSplit,
  playerSurrender,
  dealerPlay,
  getHandResult,
} from "../lib/game";
import { getBasicStrategyAction } from "../lib/strategy";
import { isBusted, isBlackjack, getDealerUpCard } from "../lib/deck";

export function useGameState(
  rules: HouseRules,
  onCorrectAnswer: () => void,
  onWrongAnswer: () => void,
  onWinnings: (amount: number) => void,
  onIncorrectPlay?: (playerCards: Card[], dealerUpCard: Card, playerAction: PlayerAction, expectedAction: PlayerAction, rules: HouseRules) => void,
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const winningsProcessedRef = useRef(false);

  useEffect(() => {
    if (gameState?.phase === "resolved" && !winningsProcessedRef.current) {
      winningsProcessedRef.current = true;
      const totalWinnings = calculateTotalWinnings(gameState, rules);
      if (totalWinnings !== 0) {
        onWinnings(totalWinnings);
      }
    }
    if (gameState?.phase !== "resolved") {
      winningsProcessedRef.current = false;
    }
  }, [gameState, rules, onWinnings]);

  const startNewGame = useCallback(() => {
    const newGame = initGame(rules);
    const playerHasBlackjack = isBlackjack(newGame.playerHands[0]);
    const dealerHasBlackjack = !rules.noHoleCard && isBlackjack(newGame.dealerHand);
    if (playerHasBlackjack || dealerHasBlackjack) {
      newGame.phase = "resolved";
    }
    winningsProcessedRef.current = false;
    setGameState(newGame);
    setShowCorrectAnswer(false);
  }, [rules]);

  const handleAction = useCallback(
    (action: PlayerAction) => {
      if (!gameState || gameState.phase !== "playing") return;

      const currentHand = gameState.playerHands[gameState.currentHandIndex];
      const expectedAction = getBasicStrategyAction(currentHand, gameState.dealerHand, rules);
      const isCorrect = action === expectedAction;

      if (!isCorrect && onIncorrectPlay) {
        const dealerUpCard = getDealerUpCard(gameState.dealerHand);
        if (dealerUpCard) {
          onIncorrectPlay(currentHand.cards, dealerUpCard, action, expectedAction, rules);
        }
      }

      let newState = applyAction(gameState, action, rules);

      if (newState.phase === "playing" && (isBusted(newState.playerHands[newState.currentHandIndex]) || newState.playerHands[newState.currentHandIndex].isStanding)) {
        const allResolved = newState.playerHands.every((h) => h.isStanding || isBusted(h) || h.isSurrendered);
        if (allResolved) {
          newState = { ...newState, phase: "dealer" };
        }
      }

      newState.score = isCorrect
        ? { correct: gameState.score.correct + 1, total: gameState.score.total + 1 }
        : { correct: gameState.score.correct, total: gameState.score.total + 1 };

      if (isCorrect) {
        onCorrectAnswer();
      } else {
        onWrongAnswer();
      }

      setGameState(newState);
      setShowCorrectAnswer(!isCorrect);
    },
    [gameState, rules, onCorrectAnswer, onWrongAnswer, onIncorrectPlay],
  );

  const handleDealerPlay = useCallback(() => {
    if (!gameState || gameState.phase !== "dealer") return;
    setGameState(dealerPlay(gameState, rules));
  }, [gameState, rules]);

  const nextHand = useCallback(() => {
    if (!gameState) return;
    setGameState({ ...gameState, currentHandIndex: gameState.currentHandIndex + 1 });
  }, [gameState]);

  const availableActions = gameState?.phase === "playing"
    ? getAvailableActions(gameState, rules)
    : [];

  return {
    gameState,
    showCorrectAnswer,
    startNewGame,
    handleAction,
    handleDealerPlay,
    nextHand,
    availableActions,
  };
}

function applyAction(state: GameState, action: PlayerAction, rules: HouseRules): GameState {
  const currentHand = state.playerHands[state.currentHandIndex];
  const expectedAction = getBasicStrategyAction(currentHand, state.dealerHand, rules);
  const isCorrect = action === expectedAction;

  let newState: GameState = { ...state, lastAction: action, expectedAction, isCorrect };

  switch (action) {
    case "hit": newState = playerHit(newState); break;
    case "stand": newState = playerStand(newState); break;
    case "double": newState = playerDouble(newState); break;
    case "split": newState = playerSplit(newState); break;
    case "surrender": newState = playerSurrender(newState); break;
  }

  return newState;
}

function calculateTotalWinnings(gameState: GameState, rules: HouseRules): number {
  let total = 0;
  for (const hand of gameState.playerHands) {
    const result = getHandResult(hand, gameState.dealerHand);
    const bet = hand.isDoubledDown ? 20 : 10;
    const bjPayout = rules.blackjackPays === "3:2" ? 1.5 : rules.blackjackPays === "6:5" ? 1.2 : 1;

    if (result === "win") total += bet;
    else if (result === "blackjack") total += Math.round(bet * bjPayout);
    else if (result === "lose") total -= bet;
    else if (result === "surrender") total -= 5;
  }
  return total;
}
