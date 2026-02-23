import { useState, useCallback, useEffect } from "react";
import {
  TrainingScenario,
  TrainingProgress,
  TrainingRecord,
  TrainingScenarioCategory,
  HouseRules,
  PlayerAction,
  Hand,
} from "../lib/types";
import { TRAINING_SCENARIOS } from "../lib/training-scenarios";
import {
  loadProgress,
  saveProgress,
  recordAnswer,
  selectNextScenario,
  getProgressStats,
  getWeakCategories,
  getEmptyProgress,
} from "../lib/spaced-repetition";
import { getBasicStrategyAction } from "../lib/strategy";
import { canSurrenderAgainstDealerUpCard, isEarlySurrender } from "../lib/surrender";

function computeExpectedAction(
  scenario: TrainingScenario,
  rules: HouseRules,
): PlayerAction {
  const hand: Hand = {
    cards: scenario.playerCards,
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
  const dealerHand: Hand = {
    cards: [scenario.dealerUpCard],
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
  return getBasicStrategyAction(hand, dealerHand, rules);
}


function getScenarioDealerHand(scenario: TrainingScenario): Hand {
  return {
    cards: [scenario.dealerUpCard],
    isDoubledDown: false,
    isSplit: false,
    isSplitAces: false,
    isSurrendered: false,
    isStanding: false,
  };
}

function canSurrenderInScenario(scenario: TrainingScenario, rules: HouseRules): boolean {
  return canSurrenderAgainstDealerUpCard(rules, getScenarioDealerHand(scenario));
}

export interface TrainingModeState {
  currentScenario: TrainingScenario | null;
  progress: TrainingProgress;
  showAnswer: boolean;
  lastAnswerCorrect: boolean | null;
  lastExpectedAction: PlayerAction | null;
  lastChosenAction: PlayerAction | null;
  sessionStats: { correct: number; total: number };
  focusCategory: TrainingScenarioCategory | null;
  hasCompletedEarlySurrenderDecision: boolean;
}

export function useTrainingMode(rules: HouseRules) {
  const [isProgressHydrated, setIsProgressHydrated] = useState(false);
  const [state, setState] = useState<TrainingModeState>(() => ({
    currentScenario: null,
    progress: getEmptyProgress(),
    showAnswer: false,
    lastAnswerCorrect: null,
    lastExpectedAction: null,
    lastChosenAction: null,
    sessionStats: { correct: 0, total: 0 },
    focusCategory: null,
    hasCompletedEarlySurrenderDecision: false,
  }));

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, progress: loadProgress() }));
      setIsProgressHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isProgressHydrated) return;
    saveProgress(state.progress);
  }, [state.progress, isProgressHydrated]);

  const availableScenarios = TRAINING_SCENARIOS;

  const nextScenario = useCallback(() => {
    const scenario = selectNextScenario(
      availableScenarios,
      state.progress,
      state.focusCategory ?? undefined,
    );

    if (!scenario) return;

    const expectedAction = computeExpectedAction(scenario, rules);

    setState((prev) => ({
      ...prev,
      currentScenario: scenario,
      showAnswer: false,
      lastAnswerCorrect: null,
      lastExpectedAction: expectedAction,
      lastChosenAction: null,
      hasCompletedEarlySurrenderDecision: false,
    }));
  }, [availableScenarios, state.progress, state.focusCategory, rules]);

  const getExpectedAction = useCallback((): PlayerAction | null => {
    if (!state.currentScenario) return null;

    const rawExpectedAction = computeExpectedAction(state.currentScenario, rules);
    if (
      isEarlySurrender(rules) &&
      state.hasCompletedEarlySurrenderDecision &&
      rawExpectedAction === "surrender"
    ) {
      return computeExpectedAction(state.currentScenario, {
        ...rules,
        surrenderAllowed: "none",
      });
    }

    return rawExpectedAction;
  }, [state.currentScenario, state.hasCompletedEarlySurrenderDecision, rules]);

  const submitAnswer = useCallback(
    (action: PlayerAction) => {
      if (!state.currentScenario) return;

      if (
        isEarlySurrender(rules) &&
        state.hasCompletedEarlySurrenderDecision &&
        action === "surrender"
      ) {
        return;
      }

      const expectedAction = getExpectedAction();
      if (!expectedAction) return;
      const isCorrect = action === expectedAction;

      const record: TrainingRecord = {
        scenarioId: state.currentScenario.id,
        timestamp: Date.now(),
        wasCorrect: isCorrect,
        responseTime: 0,
        userAction: action,
      };

      const updatedProgress = recordAnswer(
        state.progress,
        state.currentScenario,
        record,
      );

      setState((prev) => ({
        ...prev,
        progress: updatedProgress,
        showAnswer: true,
        lastAnswerCorrect: isCorrect,
        lastExpectedAction: expectedAction,
        lastChosenAction: action,
        sessionStats: {
          correct: prev.sessionStats.correct + (isCorrect ? 1 : 0),
          total: prev.sessionStats.total + 1,
        },
      }));
    },
    [state.currentScenario, state.progress, state.hasCompletedEarlySurrenderDecision, rules, getExpectedAction],
  );

  const submitEarlySurrenderDecision = useCallback(
    (decision: "surrender" | "continue") => {
      if (!state.currentScenario) return;

      const rawExpectedAction = computeExpectedAction(state.currentScenario, rules);
      const expectedAction: PlayerAction =
        rawExpectedAction === "surrender" ? "surrender" : "continue";
      const chosenAction: PlayerAction =
        decision === "surrender" ? "surrender" : "continue";

      if (decision === "continue") {
        setState((prev) => ({
          ...prev,
          hasCompletedEarlySurrenderDecision: true,
          lastExpectedAction: expectedAction,
          lastChosenAction: chosenAction,
          lastAnswerCorrect: null,
          showAnswer: false,
        }));
        return;
      }

      const isCorrect = chosenAction === expectedAction;

      const record: TrainingRecord = {
        scenarioId: state.currentScenario.id,
        timestamp: Date.now(),
        wasCorrect: isCorrect,
        responseTime: 0,
        userAction: chosenAction,
      };

      const updatedProgress = recordAnswer(
        state.progress,
        state.currentScenario,
        record,
      );

      setState((prev) => ({
        ...prev,
        progress: updatedProgress,
        showAnswer: true,
        lastAnswerCorrect: isCorrect,
        lastExpectedAction: expectedAction,
        lastChosenAction: chosenAction,
        sessionStats: {
          correct: prev.sessionStats.correct + (isCorrect ? 1 : 0),
          total: prev.sessionStats.total + 1,
        },
        hasCompletedEarlySurrenderDecision: true,
      }));
    },
    [state.currentScenario, state.progress, rules],
  );

  const setFocusCategory = useCallback(
    (category: TrainingScenarioCategory | null) => {
      setState((prev) => ({
        ...prev,
        focusCategory: category,
      }));
    },
    [],
  );

  const resetProgress = useCallback(() => {
    const emptyProgress = getEmptyProgress();
    setState((prev) => ({
      ...prev,
      progress: emptyProgress,
      sessionStats: { correct: 0, total: 0 },
      currentScenario: null,
      showAnswer: false,
      lastAnswerCorrect: null,
      hasCompletedEarlySurrenderDecision: false,
    }));
  }, []);

  const skipScenario = useCallback(() => {
    nextScenario();
  }, [nextScenario]);

  const stats = getProgressStats(state.progress);
  const weakCategories = getWeakCategories(state.progress);

  const getCategoryStats = useCallback(
    (category: TrainingScenarioCategory) => {
      return state.progress.categoryStats[category];
    },
    [state.progress.categoryStats],
  );

  const getAvailableActions = useCallback((): PlayerAction[] => {
    if (!state.currentScenario) return ["hit", "stand"];

    const canSurrender = canSurrenderInScenario(state.currentScenario, rules);

    if (
      isEarlySurrender(rules) &&
      !state.hasCompletedEarlySurrenderDecision &&
      canSurrender
    ) {
      return ["surrender"];
    }

    const actions: PlayerAction[] = ["hit", "stand", "double", "split"];
    if (!isEarlySurrender(rules) && canSurrender) {
      actions.push("surrender");
    }
    return actions;
  }, [state.currentScenario, state.hasCompletedEarlySurrenderDecision, rules]);

  const needsEarlySurrenderDecision =
    Boolean(state.currentScenario) &&
    isEarlySurrender(rules) &&
    canSurrenderInScenario(state.currentScenario, rules) &&
    !state.hasCompletedEarlySurrenderDecision;

  return {
    state,
    nextScenario,
    submitAnswer,
    submitEarlySurrenderDecision,
    setFocusCategory,
    resetProgress,
    skipScenario,
    stats,
    weakCategories,
    getCategoryStats,
    getAvailableActions,
    needsEarlySurrenderDecision,
  };
}
