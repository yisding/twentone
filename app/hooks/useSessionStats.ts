import { useState, useCallback } from "react";

interface SessionStats {
  correct: number;
  wrong: number;
  winnings: number;
}

function loadStats(): SessionStats {
  if (typeof window === "undefined") return { correct: 0, wrong: 0, winnings: 0 };
  try {
    const saved = localStorage.getItem("blackjack-stats");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.correct === "number" && typeof parsed.wrong === "number") {
        return { correct: parsed.correct, wrong: parsed.wrong, winnings: parsed.winnings || 0 };
      }
    }
  } catch {
    // ignore
  }
  return { correct: 0, wrong: 0, winnings: 0 };
}

function saveStats(stats: SessionStats) {
  localStorage.setItem("blackjack-stats", JSON.stringify(stats));
}

export function useSessionStats() {
  const [stats, setStats] = useState<SessionStats>(loadStats);

  const recordAnswer = useCallback((isCorrect: boolean) => {
    setStats((prev) => {
      const newStats = {
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1),
        winnings: prev.winnings,
      };
      saveStats(newStats);
      return newStats;
    });
  }, []);

  const updateWinnings = useCallback((amount: number) => {
    setStats((prev) => {
      const newStats = { ...prev, winnings: prev.winnings + amount };
      saveStats(newStats);
      return newStats;
    });
  }, []);

  const reset = useCallback(() => {
    setStats({ correct: 0, wrong: 0, winnings: 0 });
    localStorage.removeItem("blackjack-stats");
  }, []);

  return { stats, recordAnswer, updateWinnings, reset };
}
