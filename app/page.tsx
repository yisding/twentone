"use client";

import { useState, useCallback } from "react";
import { HouseRules, DEFAULT_HOUSE_RULES } from "./lib/types";
import { SettingsPanel, StatsBar, GameArea, MistakesLog, TrainingMode } from "./components";
import { useGameState, useSessionStats, useIncorrectPlays, useTrainingMode } from "./hooks";

type GameMode = "practice" | "training";

export default function Home() {
  const [rules, setRules] = useState<HouseRules>(DEFAULT_HOUSE_RULES);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("practice");

  const { stats, recordAnswer, updateWinnings, reset: resetStats } = useSessionStats();
  const { plays, recordIncorrectPlay, clearPlays, removePlay } = useIncorrectPlays();
  const {
    gameState,
    showCorrectAnswer,
    startNewGame,
    handleAction,
    handleDealerPlay,
    nextHand,
    availableActions,
  } = useGameState(
    rules,
    useCallback(() => recordAnswer(true), [recordAnswer]),
    useCallback(() => recordAnswer(false), [recordAnswer]),
    updateWinnings,
    recordIncorrectPlay,
  );

  const {
    state: trainingState,
    nextScenario,
    submitAnswer,
    setFocusCategory,
    resetProgress,
    skipScenario,
    stats: trainingStats,
    weakCategories,
    getAvailableActions: getTrainingActions,
  } = useTrainingMode(rules);

  const currentHand = gameState?.playerHands[gameState.currentHandIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-800 to-green-900">
      <div className="max-w-4xl mx-auto p-4">
        <Header />

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-200">
            <SettingsPanel
              rules={rules}
              onRulesChange={setRules}
              isOpen={settingsOpen}
              onToggle={() => setSettingsOpen(!settingsOpen)}
            />
          </div>

          <ModeSelector currentMode={gameMode} onModeChange={setGameMode} />

          {gameMode === "practice" && (
            <>
              <StatsBar stats={stats} rules={rules} onReset={resetStats} />
              <div className="p-6">
                {gameState ? (
                  <GameArea
                    gameState={gameState}
                    rules={rules}
                    currentHand={currentHand}
                    showCorrectAnswer={showCorrectAnswer}
                    availableActions={availableActions}
                    onAction={handleAction}
                    onDealerPlay={handleDealerPlay}
                    onNextHand={nextHand}
                    onNewGame={startNewGame}
                  />
                ) : (
                  <StartButton onStart={startNewGame} />
                )}
                <MistakesLog plays={plays} onClear={clearPlays} onRemove={removePlay} />
              </div>
            </>
          )}

          {gameMode === "training" && (
            <>
              <TrainingStatsBar
                sessionStats={trainingState.sessionStats}
                trainingStats={trainingStats}
                onReset={resetProgress}
              />
              <div className="p-6">
                <TrainingMode
                  currentScenario={trainingState.currentScenario}
                  showAnswer={trainingState.showAnswer}
                  lastAnswerCorrect={trainingState.lastAnswerCorrect}
                  lastExpectedAction={trainingState.lastExpectedAction}
                  sessionStats={trainingState.sessionStats}
                  focusCategory={trainingState.focusCategory}
                  rules={rules}
                  availableActions={getTrainingActions()}
                  onNextScenario={nextScenario}
                  onSubmitAnswer={submitAnswer}
                  onSetFocusCategory={setFocusCategory}
                  onSkip={skipScenario}
                  categoryStats={trainingState.progress.categoryStats}
                  weakCategories={weakCategories}
                />
              </div>
            </>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}

function ModeSelector({
  currentMode,
  onModeChange,
}: {
  currentMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}) {
  return (
    <div className="flex border-b border-zinc-200">
      <button
        onClick={() => onModeChange("practice")}
        className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
          currentMode === "practice"
            ? "bg-zinc-100 text-zinc-900 border-b-2 border-green-600"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        Practice Mode
      </button>
      <button
        onClick={() => onModeChange("training")}
        className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
          currentMode === "training"
            ? "bg-zinc-100 text-zinc-900 border-b-2 border-green-600"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        Training Mode
      </button>
    </div>
  );
}

function Header() {
  return (
    <header className="text-center mb-6">
      <h1 className="text-3xl font-bold text-white mb-2">
        Blackjack Strategy Trainer
      </h1>
      <p className="text-green-200">
        Test your knowledge of basic strategy
      </p>
    </header>
  );
}

function StartButton({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-12">
      <button
        onClick={onStart}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors"
      >
        Start Training
      </button>
    </div>
  );
}

function TrainingStatsBar({
  sessionStats,
  trainingStats,
  onReset,
}: {
  sessionStats: { correct: number; total: number };
  trainingStats: {
    totalScenarios: number;
    masteredScenarios: number;
    learningScenarios: number;
    newScenarios: number;
    averageAccuracy: number;
  };
  onReset: () => void;
}) {
  const sessionAccuracy =
    sessionStats.total > 0
      ? Math.round((sessionStats.correct / sessionStats.total) * 100)
      : 0;

  return (
    <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-zinc-500">Session:</span>{" "}
            <span className="font-semibold">{sessionStats.correct}/{sessionStats.total}</span>
            {sessionStats.total > 0 && (
              <span className="ml-1 text-zinc-400">({sessionAccuracy}%)</span>
            )}
          </div>
          <div>
            <span className="text-zinc-500">Overall:</span>{" "}
            <span className="font-semibold">{Math.round(trainingStats.averageAccuracy * 100)}%</span>
          </div>
          {trainingStats.masteredScenarios > 0 && (
            <div className="text-green-600">
              <span className="text-zinc-500">Mastered:</span>{" "}
              <span className="font-semibold">{trainingStats.masteredScenarios}</span>
            </div>
          )}
        </div>
        <button
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          Reset Progress
        </button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-6 text-center text-green-200 text-sm">
      <p>
        Basic strategy is the mathematically optimal way to play every hand.
      </p>
    </footer>
  );
}
