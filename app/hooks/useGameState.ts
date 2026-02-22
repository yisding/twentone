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
import { getBasicStrategyAction, getBestActionWithoutSurrender } from "../lib/strategy";
import { isBusted, isBlackjack, getDealerUpCard, getCardValue, dealCard } from "../lib/deck";

function processForcedActions(state: GameState, rules: HouseRules): GameState {
  let currentState = state;

  while (currentState.phase === "playing") {
    const actions = getAvailableActions(currentState, rules);
    if (actions.length !== 1) break;

    const forcedAction = actions[0];
    currentState = applyAction(currentState, forcedAction, rules, false);

    if (currentState.phase === "playing" &&
      (isBusted(currentState.playerHands[currentState.currentHandIndex]) ||
        currentState.playerHands[currentState.currentHandIndex].isStanding)) {
      const allResolved = currentState.playerHands.every(
        (h) => h.isStanding || isBusted(h) || h.isSurrendered
      );
      if (allResolved) {
        currentState = { ...currentState, phase: "dealer" };
      }
    }
  }

  return currentState;
}

export function useGameState(
  rules: HouseRules,
  onCorrectAnswer: () => void,
  onWrongAnswer: () => void,
  onWinnings: (amount: number) => void,
  onIncorrectPlay?: (playerCards: Card[], dealerUpCard: Card, playerAction: PlayerAction, expectedAction: PlayerAction, rules: HouseRules) => void,
) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [hasCompletedEarlySurrenderDecision, setHasCompletedEarlySurrenderDecision] = useState(false);
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
    let newGame = initGame(rules);
    const playerHasBlackjack = isBlackjack(newGame.playerHands[0]);
    const dealerHasBlackjack =
      !rules.noHoleCard &&
      rules.surrenderAllowed !== "early" &&
      isBlackjack(newGame.dealerHand);
    if (playerHasBlackjack || dealerHasBlackjack) {
      if (rules.noHoleCard) {
        // No hole card rules: only deal one card if dealer shows 10/Ace
        const upCard = getDealerUpCard(newGame.dealerHand);
        const upCardValue = upCard ? getCardValue(upCard) : 0;
        if (upCardValue === 10 || upCardValue === 11) {
          const { card, remainingDeck } = dealCard(newGame.deck);
          newGame = {
            ...newGame,
            dealerHand: {
              ...newGame.dealerHand,
              cards: [...newGame.dealerHand.cards, card],
            },
            deck: remainingDeck,
            phase: "resolved",
          };
        } else {
          newGame = { ...newGame, phase: "resolved" };
        }
      } else {
        newGame.phase = "resolved";
      }
    }
    winningsProcessedRef.current = false;
    setHasCompletedEarlySurrenderDecision(false);

    newGame = processForcedActions(newGame, rules);

    setGameState(newGame);
    setShowCorrectAnswer(false);
  }, [rules]);

  const handleAction = useCallback(
    (action: PlayerAction) => {
      if (!gameState || gameState.phase !== "playing") return;

      const needsEarlySurrenderDecision = shouldPromptEarlySurrenderDecision(
        gameState,
        rules,
        hasCompletedEarlySurrenderDecision,
      );

      if (
        action !== "surrender" &&
        needsEarlySurrenderDecision
      ) {
        return;
      }

      const currentHand = gameState.playerHands[gameState.currentHandIndex];
      const expectedAction = getExpectedPlayableAction(gameState, rules, needsEarlySurrenderDecision);
      const isCorrect = action === expectedAction;

      if (!isCorrect && onIncorrectPlay) {
        const dealerUpCard = getDealerUpCard(gameState.dealerHand);
        if (dealerUpCard) {
          onIncorrectPlay(currentHand.cards, dealerUpCard, action, expectedAction, rules);
        }
      }

      if (action === "surrender" && needsEarlySurrenderDecision) {
        setHasCompletedEarlySurrenderDecision(true);
      }

      let newState = applyAction(gameState, action, rules, true, needsEarlySurrenderDecision);

      newState = {
        ...newState,
        lastAvailableActions: needsEarlySurrenderDecision
          ? ["surrender", "continue"]
          : getAvailableActions(gameState, rules).filter((a) =>
            !(
              rules.surrenderAllowed === "early" &&
              !rules.noHoleCard &&
              hasCompletedEarlySurrenderDecision &&
              a === "surrender"
            )
          ),
      };

      if (shouldResolveDealerBlackjackAfterEarlySurrenderDecision(gameState, rules, action)) {
        newState = {
          ...newState,
          phase: "resolved",
        };
      }

      if (newState.phase === "playing" &&
        (isBusted(newState.playerHands[newState.currentHandIndex]) ||
          newState.playerHands[newState.currentHandIndex].isStanding)) {
        const allResolved = newState.playerHands.every(
          (h) => h.isStanding || isBusted(h) || h.isSurrendered
        );
        if (allResolved) {
          newState = { ...newState, phase: "dealer" };
        }
      }

      newState.score = isCorrect
        ? { correct: gameState.score.correct + 1, total: gameState.score.total + 1 }
        : { correct: gameState.score.correct, total: gameState.score.total + 1 };

      newState = processForcedActions(newState, rules);

      if (isCorrect) {
        onCorrectAnswer();
      } else {
        onWrongAnswer();
      }

      setGameState(newState);
      setShowCorrectAnswer(true);
    },
    [gameState, rules, onCorrectAnswer, onWrongAnswer, onIncorrectPlay, hasCompletedEarlySurrenderDecision],
  );

  const declineEarlySurrender = useCallback(() => {
    if (!gameState) return;
    if (!shouldPromptEarlySurrenderDecision(gameState, rules, hasCompletedEarlySurrenderDecision)) return;

    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    const expectedAction = getExpectedPlayableAction(gameState, rules, true);

    // The action the user chose is implicitly "continue"
    const chosenAction: PlayerAction = "continue";
    const isCorrect = expectedAction === "continue";

    if (!isCorrect && onIncorrectPlay) {
      const dealerUpCard = getDealerUpCard(gameState.dealerHand);
      if (dealerUpCard) {
        onIncorrectPlay(currentHand.cards, dealerUpCard, chosenAction, expectedAction, rules);
      }
    }

    const newState: GameState = {
      ...gameState,
      lastAction: chosenAction,
      lastActionHand: { ...currentHand, cards: [...currentHand.cards] },
      expectedAction,
      lastAvailableActions: ["surrender", "continue"],
      isCorrect,
      phase: isBlackjack(gameState.dealerHand) ? "resolved" as const : gameState.phase,
      score: isCorrect
        ? { correct: gameState.score.correct + 1, total: gameState.score.total + 1 }
        : { correct: gameState.score.correct, total: gameState.score.total + 1 },
    };

    if (isCorrect) {
      onCorrectAnswer();
    } else {
      onWrongAnswer();
    }

    setGameState(newState);
    setShowCorrectAnswer(true);
    setHasCompletedEarlySurrenderDecision(true);
  }, [gameState, rules, hasCompletedEarlySurrenderDecision, onCorrectAnswer, onWrongAnswer, onIncorrectPlay]);

  const handleDealerPlay = useCallback(() => {
    if (!gameState || gameState.phase !== "dealer") return;
    setGameState(dealerPlay(gameState, rules));
  }, [gameState, rules]);

  const discardCurrentGame = useCallback(() => {
    winningsProcessedRef.current = false;
    setHasCompletedEarlySurrenderDecision(false);
    setShowCorrectAnswer(false);
    setGameState(null);
  }, []);

  const nextHand = useCallback(() => {
    if (!gameState) return;
    let newState = { ...gameState, currentHandIndex: gameState.currentHandIndex + 1 };
    newState = processForcedActions(newState, rules);
    setGameState(newState);
  }, [gameState, rules]);

  const availableActions: PlayerAction[] = gameState?.phase === "playing"
    ? shouldPromptEarlySurrenderDecision(gameState, rules, hasCompletedEarlySurrenderDecision)
      ? (["surrender"] as PlayerAction[])
      : getAvailableActions(gameState, rules).filter((action) =>
        !(
          rules.surrenderAllowed === "early" &&
          !rules.noHoleCard &&
          hasCompletedEarlySurrenderDecision &&
          action === "surrender"
        ),
      )
    : [];

  const needsEarlySurrenderDecision = Boolean(
    gameState && shouldPromptEarlySurrenderDecision(gameState, rules, hasCompletedEarlySurrenderDecision),
  );

  return {
    gameState,
    showCorrectAnswer,
    startNewGame,
    handleAction,
    handleDealerPlay,
    discardCurrentGame,
    declineEarlySurrender,
    nextHand,
    availableActions,
    needsEarlySurrenderDecision,
  };
}

function shouldPromptEarlySurrenderDecision(
  state: GameState,
  rules: HouseRules,
  hasCompletedEarlySurrenderDecision: boolean,
): boolean {
  if (hasCompletedEarlySurrenderDecision) return false;
  if (state.phase !== "playing") return false;
  if (rules.surrenderAllowed !== "early") return false;
  if (rules.noHoleCard) return false;
  if (state.currentHandIndex !== 0 || state.playerHands.length !== 1) return false;

  const hand = state.playerHands[0];

  if (state.dealerHand.cards.length !== 2) return false;
  if (hand.cards.length !== 2 || hand.isSplit) return false;

  return true;
}

function applyAction(state: GameState, action: PlayerAction, rules: HouseRules, checkStrategy: boolean, isESPrompt: boolean = false): GameState {
  const currentHand = state.playerHands[state.currentHandIndex];

  let newState: GameState;

  if (checkStrategy) {
    const expectedAction = getExpectedPlayableAction(state, rules, isESPrompt);
    const isCorrect = action === expectedAction;
    newState = {
      ...state,
      lastAction: action,
      lastActionHand: { ...currentHand, cards: [...currentHand.cards] },
      expectedAction,
      isCorrect,
    };
  } else {
    newState = state;
  }

  const shouldApplyAction = !shouldResolveDealerBlackjackAfterEarlySurrenderDecision(state, rules, action);

  if (shouldApplyAction) {
    switch (action) {
      case "hit": newState = playerHit(newState); break;
      case "stand": newState = playerStand(newState); break;
      case "double": newState = playerDouble(newState); break;
      case "split": newState = playerSplit(newState); break;
      case "surrender": newState = playerSurrender(newState); break;
      case "continue": break;
    }
  }

  return newState;
}

function shouldResolveDealerBlackjackAfterEarlySurrenderDecision(
  state: GameState,
  rules: HouseRules,
  action: PlayerAction,
): boolean {
  if (action === "surrender") return false;
  if (rules.surrenderAllowed !== "early") return false;
  if (rules.noHoleCard) return false;
  if (state.currentHandIndex !== 0 || state.playerHands.length !== 1) return false;

  const hand = state.playerHands[0];
  const dealerUpCard = getDealerUpCard(state.dealerHand);
  const dealerUpCardValue = dealerUpCard ? getCardValue(dealerUpCard) : 0;

  if (hand.cards.length !== 2 || hand.isSplit) return false;
  if (dealerUpCardValue !== 10 && dealerUpCardValue !== 11) return false;

  return isBlackjack(state.dealerHand);
}

function getExpectedPlayableAction(state: GameState, rules: HouseRules, isESPrompt: boolean = false): PlayerAction {
  const hand = state.playerHands[state.currentHandIndex];
  const expectedAction = getBasicStrategyAction(hand, state.dealerHand, rules);

  if (isESPrompt) {
    return expectedAction === "surrender" ? "surrender" : "continue";
  }

  const availableActions = getAvailableActions(state, rules);

  if (availableActions.includes(expectedAction)) {
    return expectedAction;
  }

  if (
    (expectedAction === "double" || expectedAction === "split") &&
    availableActions.includes("hit")
  ) {
    return "hit";
  }

  if (expectedAction === "surrender") {
    return getBestActionWithoutSurrender(hand, state.dealerHand, rules);
  }

  return "stand";
}

function calculateTotalWinnings(gameState: GameState, rules: HouseRules): number {
  let total = 0;
  for (const hand of gameState.playerHands) {
    const result = getHandResult(hand, gameState.dealerHand);
    const bet = hand.isDoubledDown ? 20 : 10;
    const bjPayout = rules.blackjackPays === "3:2" ? 1.5 : rules.blackjackPays === "6:5" ? 1.2 : 1;

    if (result === "win") total += bet;
    else if (result === "blackjack") total += bet * bjPayout;
    else if (result === "lose") total -= bet;
    else if (result === "surrender") total -= bet / 2;
  }
  return total;
}
