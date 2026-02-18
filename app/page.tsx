"use client";

import { useState, useCallback } from "react";
import { HouseRules, DEFAULT_HOUSE_RULES } from "./lib/types";
import { SettingsPanel, StatsBar, GameArea } from "./components";
import { useGameState, useSessionStats } from "./hooks";

export default function Home() {
  const [rules, setRules] = useState<HouseRules>(DEFAULT_HOUSE_RULES);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { stats, recordAnswer, updateWinnings, reset: resetStats } = useSessionStats();
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
  );

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
          </div>
        </div>

        <Footer />
      </div>
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

function Footer() {
  return (
    <footer className="mt-6 text-center text-green-200 text-sm">
      <p>
        Basic strategy is the mathematically optimal way to play every hand.
      </p>
    </footer>
  );
}
