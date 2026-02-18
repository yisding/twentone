"use client";

import { useState, useCallback } from "react";
import { HouseRules, DEFAULT_HOUSE_RULES, PlayerAction, Hand as HandType } from "./lib/types";
import { getHandResult } from "./lib/game";
import { isBusted, isBlackjack } from "./lib/deck";
import { actionToString } from "./lib/strategy";
import { Hand, SettingsPanel, StatsBar } from "./components";
import { useGameState, useSessionStats } from "./hooks";

export default function Home() {
  const [rules, setRules] = useState<HouseRules>(DEFAULT_HOUSE_RULES);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { stats, recordAnswer, updateWinnings, reset: resetStats } = useSessionStats();
  const { gameState, showCorrectAnswer, startNewGame, handleAction, handleDealerPlay, nextHand, availableActions } = useGameState(
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
          <SettingsSection rules={rules} onRulesChange={setRules} isOpen={settingsOpen} onToggle={() => setSettingsOpen(!settingsOpen)} />
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
      <h1 className="text-3xl font-bold text-white mb-2">Blackjack Strategy Trainer</h1>
      <p className="text-green-200">Test your knowledge of basic strategy</p>
    </header>
  );
}

function SettingsSection({
  rules,
  onRulesChange,
  isOpen,
  onToggle,
}: {
  rules: HouseRules;
  onRulesChange: (rules: HouseRules) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="p-4 border-b border-zinc-200">
      <SettingsPanel rules={rules} onRulesChange={onRulesChange} isOpen={isOpen} onToggle={onToggle} />
    </div>
  );
}

function StartButton({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-12">
      <button onClick={onStart} className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors">
        Start Training
      </button>
    </div>
  );
}

interface GameAreaProps {
  gameState: NonNullable<ReturnType<typeof useGameState>["gameState"]>;
  rules: HouseRules;
  currentHand: HandType | undefined;
  showCorrectAnswer: boolean;
  availableActions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  onDealerPlay: () => void;
  onNextHand: () => void;
  onNewGame: () => void;
}

function GameArea({ gameState, rules, currentHand, showCorrectAnswer, availableActions, onAction, onDealerPlay, onNextHand, onNewGame }: GameAreaProps) {
  return (
    <>
      <div className="mb-8">
        <Hand
          cards={gameState.dealerHand.cards}
          label="Dealer"
          hiddenFirst={gameState.phase === "playing" && !rules.noHoleCard && gameState.dealerHand.cards.length === 2}
        />
      </div>

      <div className="mb-8">
        {gameState.playerHands.map((hand, i) => (
          <Hand
            key={i}
            cards={hand.cards}
            label={`Hand ${i + 1}`}
            isCurrentHand={i === gameState.currentHandIndex && gameState.phase === "playing"}
          />
        ))}
      </div>

      {gameState.phase === "resolved" && (isBlackjack(gameState.playerHands[0]) || isBlackjack(gameState.dealerHand)) && (
        <BlackjackResult playerBJ={isBlackjack(gameState.playerHands[0])} dealerBJ={isBlackjack(gameState.dealerHand)} />
      )}

      {gameState.phase === "playing" && currentHand && !isBusted(currentHand) && !currentHand.isStanding && !currentHand.isSurrendered && (
        <ActionButtons actions={availableActions} onAction={onAction} />
      )}

      {showCorrectAnswer && gameState.lastAction && gameState.expectedAction && (
        <FeedbackMessage isCorrect={gameState.isCorrect ?? false} expectedAction={gameState.expectedAction} />
      )}

      {gameState.phase === "playing" && currentHand && (isBusted(currentHand) || currentHand.isStanding || currentHand.isSurrendered) && (
        <TransitionButton
          isLastHand={gameState.currentHandIndex >= gameState.playerHands.length - 1}
          onNextHand={onNextHand}
          onDealerPlay={onDealerPlay}
        />
      )}

      {gameState.phase === "dealer" && (
        <div className="text-center">
          <button onClick={onDealerPlay} className="px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg font-semibold">
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

function BlackjackResult({ playerBJ, dealerBJ }: { playerBJ: boolean; dealerBJ: boolean }) {
  const message = playerBJ && dealerBJ ? "Both have Blackjack - Push!" : playerBJ ? "Blackjack! You Win!" : "Dealer has Blackjack - You Lose";
  const bgClass = playerBJ && dealerBJ ? "bg-yellow-100 text-yellow-800" : playerBJ ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";

  return (
    <div className="space-y-4 mb-4">
      <div className="text-center">
        <div className={`p-4 rounded-lg font-semibold ${bgClass}`}>{message}</div>
      </div>
    </div>
  );
}

function ActionButtons({ actions, onAction }: { actions: PlayerAction[]; onAction: (action: PlayerAction) => void }) {
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
          <button key={action} onClick={() => onAction(action)} className={`px-6 py-3 rounded-lg font-semibold transition-colors ${actionColors[action]}`}>
            {actionToString(action)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackMessage({ isCorrect, expectedAction }: { isCorrect: boolean; expectedAction: PlayerAction }) {
  const bgClass = isCorrect ? "bg-green-100" : "bg-red-100";
  const textClass = isCorrect ? "text-green-800" : "text-red-800";
  const message = isCorrect ? "✓ Correct!" : `✗ Incorrect. The correct play was ${actionToString(expectedAction)}.`;

  return (
    <div className={`p-4 rounded-lg mb-4 ${bgClass}`}>
      <p className={textClass}>{message}</p>
    </div>
  );
}

function TransitionButton({ isLastHand, onNextHand, onDealerPlay }: { isLastHand: boolean; onNextHand: () => void; onDealerPlay: () => void }) {
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

function GameResults({ gameState, onNewGame }: { gameState: NonNullable<ReturnType<typeof useGameState>["gameState"]>; onNewGame: () => void }) {
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
        <button onClick={onNewGame} className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors">
          New Hand
        </button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-6 text-center text-green-200 text-sm">
      <p>Basic strategy is the mathematically optimal way to play every hand.</p>
    </footer>
  );
}
