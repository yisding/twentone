import {
  TrainingScenario,
  TrainingProgress,
  ScenarioProgress,
  TrainingRecord,
  TrainingScenarioCategory,
} from "./types";

const STORAGE_KEY = "blackjack-training-progress";

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL = 1;

export function getEmptyProgress(): TrainingProgress {
  return {
    scenarios: {},
    categoryStats: {
      splits: { correct: 0, total: 0 },
      "soft-doubles": { correct: 0, total: 0 },
      "hard-doubles": { correct: 0, total: 0 },
      surrenders: { correct: 0, total: 0 },
      "ruleset-variations": { correct: 0, total: 0 },
      "tricky-totals": { correct: 0, total: 0 },
    },
    totalSessions: 0,
    lastSession: Date.now(),
  };
}

export function loadProgress(): TrainingProgress {
  if (typeof window === "undefined") {
    return getEmptyProgress();
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getEmptyProgress();
    return JSON.parse(stored) as TrainingProgress;
  } catch {
    return getEmptyProgress();
  }
}

export function saveProgress(progress: TrainingProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error("Failed to save training progress:", e);
  }
}

export function getEmptyScenarioProgress(scenarioId: string): ScenarioProgress {
  return {
    scenarioId,
    correctCount: 0,
    incorrectCount: 0,
    lastAttempt: 0,
    interval: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    nextReview: 0,
  };
}

export function updateScenarioProgress(
  progress: ScenarioProgress,
  wasCorrect: boolean,
): ScenarioProgress {
  const now = Date.now();
  let { easeFactor, interval } = progress;

  if (wasCorrect) {
    if (interval === 0) {
      interval = INITIAL_INTERVAL;
    } else if (interval === 1) {
      interval = 3;
    } else if (interval === 3) {
      interval = 7;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor + 0.05);
  } else {
    interval = 0;
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
  }

  return {
    ...progress,
    correctCount: progress.correctCount + (wasCorrect ? 1 : 0),
    incorrectCount: progress.incorrectCount + (wasCorrect ? 0 : 1),
    lastAttempt: now,
    interval,
    easeFactor,
    nextReview: wasCorrect ? now + interval * 60 * 60 * 1000 : now,
  };
}

export function recordAnswer(
  progress: TrainingProgress,
  scenario: TrainingScenario,
  record: TrainingRecord,
): TrainingProgress {
  const existingScenario = progress.scenarios[scenario.id] ||
    getEmptyScenarioProgress(scenario.id);
  const updatedScenario = updateScenarioProgress(
    existingScenario,
    record.wasCorrect,
  );

  const updatedCategoryStats = {
    ...progress.categoryStats,
  };
  updatedCategoryStats[scenario.category] = {
    correct:
      progress.categoryStats[scenario.category].correct +
      (record.wasCorrect ? 1 : 0),
    total: progress.categoryStats[scenario.category].total + 1,
  };

  return {
    ...progress,
    scenarios: {
      ...progress.scenarios,
      [scenario.id]: updatedScenario,
    },
    categoryStats: updatedCategoryStats,
    lastSession: Date.now(),
  };
}

export interface ScenarioPriority {
  scenario: TrainingScenario;
  priority: number;
  reason: string;
}

export function prioritizeScenarios(
  scenarios: TrainingScenario[],
  progress: TrainingProgress,
  focusCategory?: TrainingScenarioCategory,
): ScenarioPriority[] {
  const now = Date.now();

  return scenarios.map((scenario) => {
    const scenarioProgress = progress.scenarios[scenario.id];
    let priority = 0;
    let reason = "New scenario";

    if (!scenarioProgress) {
      priority = 1000 + scenario.difficulty * 100;
      reason = "New scenario";
    } else {
      const { nextReview, correctCount, incorrectCount, easeFactor } =
        scenarioProgress;
      const totalAttempts = correctCount + incorrectCount;
      const isDue = now >= nextReview;
      const accuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

      if (isDue) {
        priority += 500;
        reason = "Due for review";
      }

      priority += (1 - accuracy) * 400;
      if (totalAttempts > 0) {
        priority += (incorrectCount / totalAttempts) * 300;
      }

      priority += scenario.difficulty * 50;

      priority += (DEFAULT_EASE_FACTOR - easeFactor) * 100;

      if (accuracy < 0.5 && totalAttempts >= 3) {
        priority += 200;
        reason = "Needs practice";
      } else if (accuracy < 0.75 && totalAttempts >= 3) {
        priority += 100;
        reason = "Still learning";
      } else if (isDue) {
        reason = "Due for review";
      } else if (accuracy >= 0.9 && totalAttempts >= 5) {
        priority -= 100;
        reason = "Mastered";
      }
    }

    if (focusCategory && scenario.category === focusCategory) {
      priority += 500;
      reason = `Focus: ${focusCategory}`;
    }

    return { scenario, priority, reason };
  });
}

export function selectNextScenario(
  scenarios: TrainingScenario[],
  progress: TrainingProgress,
  focusCategory?: TrainingScenarioCategory,
): TrainingScenario | null {
  if (scenarios.length === 0) return null;

  const prioritized = prioritizeScenarios(scenarios, progress, focusCategory);
  prioritized.sort((a, b) => b.priority - a.priority);

  const topCandidates = prioritized.slice(0, Math.min(8, prioritized.length));
  const minPriority = Math.min(...topCandidates.map((p) => p.priority));
  const offset = minPriority < 1 ? 1 - minPriority : 0;
  const weights = topCandidates.map((p) => p.priority + offset);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return topCandidates[0]?.scenario ?? null;
  let random = Math.random() * totalWeight;

  for (let i = 0; i < topCandidates.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return topCandidates[i].scenario;
    }
  }

  return topCandidates[0]?.scenario ?? null;
}

export function getWeakCategories(
  progress: TrainingProgress,
): TrainingScenarioCategory[] {
  const categories = Object.entries(progress.categoryStats) as [
    TrainingScenarioCategory,
    { correct: number; total: number },
  ][];

  return categories
    .filter(([, stats]) => stats.total >= 5)
    .sort((a, b) => {
      const accuracyA = a[1].correct / a[1].total;
      const accuracyB = b[1].correct / b[1].total;
      return accuracyA - accuracyB;
    })
    .slice(0, 2)
    .map(([category]) => category);
}

export function getProgressStats(progress: TrainingProgress): {
  totalScenarios: number;
  masteredScenarios: number;
  learningScenarios: number;
  newScenarios: number;
  averageAccuracy: number;
} {
  const scenarios = Object.values(progress.scenarios);
  const totalScenarios = scenarios.length;

  let mastered = 0;
  let learning = 0;

  for (const s of scenarios) {
    const total = s.correctCount + s.incorrectCount;
    if (total === 0) continue;

    const accuracy = s.correctCount / total;
    if (accuracy >= 0.9 && total >= 5) {
      mastered++;
    } else if (total >= 1) {
      learning++;
    }
  }

  const totalCorrect = scenarios.reduce((sum, s) => sum + s.correctCount, 0);
  const totalAttempts = scenarios.reduce(
    (sum, s) => sum + s.correctCount + s.incorrectCount,
    0,
  );

  return {
    totalScenarios,
    masteredScenarios: mastered,
    learningScenarios: learning,
    newScenarios: 0,
    averageAccuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
  };
}
