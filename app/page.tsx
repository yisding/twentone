"use client";

import { useState, useCallback } from "react";
import {
  HouseRules,
  GameState,
  PlayerAction,
  DEFAULT_HOUSE_RULES,
  Card,
} from "./lib/types";
import {
  initGame,
  getAvailableActions,
  playerHit,
  playerStand,
  playerDouble,
  playerSplit,
  playerSurrender,
  dealerPlay,
} from "./lib/game";
import { getBasicStrategyAction, actionToString } from "./lib/strategy";
import { calculateHandValue, isBusted, isBlackjack } from "./lib/deck";

interface SessionStats {
  correct: number;
  wrong: number;
}

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitColors: Record<string, string> = {
  hearts: "text-red-600",
  diamonds: "text-red-600",
  clubs: "text-zinc-900",
  spades: "text-zinc-900",
};

function CardDisplay({
  card,
  hidden = false,
}: {
  card: Card;
  hidden?: boolean;
}) {
  if (hidden) {
    return (
      <div className="w-16 h-24 bg-blue-600 rounded-lg border-2 border-blue-700 flex items-center justify-center shadow-md">
        <span className="text-white text-2xl">?</span>
      </div>
    );
  }

  return (
    <div className="w-16 h-24 bg-white rounded-lg border-2 border-zinc-300 flex flex-col items-center justify-center shadow-md">
      <span className={`text-lg font-bold ${suitColors[card.suit]}`}>
        {card.rank}
      </span>
      <span className={`text-2xl ${suitColors[card.suit]}`}>
        {suitSymbols[card.suit]}
      </span>
    </div>
  );
}

function HandDisplay({
  cards,
  label,
  hiddenFirst = false,
  isCurrentHand = false,
}: {
  cards: Card[];
  label: string;
  hiddenFirst?: boolean;
  isCurrentHand?: boolean;
}) {
  const { total, isSoft } = calculateHandValue({
    cards,
    isDoubledDown: false,
    isSplit: false,
    isSurrendered: false,
    isStanding: false,
  });
  const hasBlackjack = isBlackjack({
    cards,
    isDoubledDown: false,
    isSplit: false,
    isSurrendered: false,
    isStanding: false,
  });

  return (
    <div
      className={`p-4 rounded-lg ${isCurrentHand ? "ring-2 ring-yellow-400 bg-yellow-50" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-zinc-700">{label}</span>
        {hasBlackjack && !hiddenFirst ? (
          <span className="text-sm font-bold text-amber-600">BLACKJACK!</span>
        ) : (
          <span className="text-sm text-zinc-500">
            ({isSoft && total <= 21 ? "Soft " : ""}
            {total > 21 ? "Bust!" : total})
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {cards.map((card, i) => (
          <CardDisplay key={i} card={card} hidden={hiddenFirst && i === 0} />
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({
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
    <div className="w-full">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center justify-between"
      >
        <span className="font-medium">House Rules</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 p-4 bg-zinc-50 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Dealer hits on soft 17
            </label>
            <input
              type="checkbox"
              checked={rules.hitSoft17}
              onChange={(e) =>
                onRulesChange({ ...rules, hitSoft17: e.target.checked })
              }
              className="w-5 h-5 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Surrender allowed
            </label>
            <select
              value={rules.surrenderAllowed}
              onChange={(e) =>
                onRulesChange({
                  ...rules,
                  surrenderAllowed: e.target.value as "none" | "early" | "late",
                })
              }
              className="px-3 py-1 rounded border border-zinc-300"
            >
              <option value="none">None</option>
              <option value="early">Early</option>
              <option value="late">Late</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Double after split
            </label>
            <input
              type="checkbox"
              checked={rules.doubleAfterSplit}
              onChange={(e) =>
                onRulesChange({ ...rules, doubleAfterSplit: e.target.checked })
              }
              className="w-5 h-5 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Double on any two cards
            </label>
            <input
              type="checkbox"
              checked={rules.doubleOnAnyTwo}
              onChange={(e) =>
                onRulesChange({ ...rules, doubleOnAnyTwo: e.target.checked })
              }
              className="w-5 h-5 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Resplit aces
            </label>
            <input
              type="checkbox"
              checked={rules.resplitAces}
              onChange={(e) =>
                onRulesChange({ ...rules, resplitAces: e.target.checked })
              }
              className="w-5 h-5 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Blackjack pays
            </label>
            <select
              value={rules.blackjackPays}
              onChange={(e) =>
                onRulesChange({
                  ...rules,
                  blackjackPays: e.target.value as "3:2" | "6:5" | "1:1",
                })
              }
              className="px-3 py-1 rounded border border-zinc-300"
            >
              <option value="3:2">3:2</option>
              <option value="6:5">6:5</option>
              <option value="1:1">1:1</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">
              Number of decks
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onRulesChange({ ...rules, decks: 2 })}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  rules.decks === 2
                    ? "bg-green-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              >
                2
              </button>
              <button
                onClick={() => onRulesChange({ ...rules, decks: 6 })}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  rules.decks === 6
                    ? "bg-green-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              >
                6
              </button>
              <select
                value={
                  rules.decks === 2 || rules.decks === 6 ? "" : rules.decks
                }
                onChange={(e) =>
                  e.target.value &&
                  onRulesChange({ ...rules, decks: parseInt(e.target.value) })
                }
                className={`px-2 py-1 rounded border text-sm ${
                  rules.decks !== 2 && rules.decks !== 6
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white border-zinc-300"
                }`}
              >
                <option value="">Other</option>
                <option value="1">1</option>
                <option value="4">4</option>
                <option value="8">8</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadSessionStats(): SessionStats {
  if (typeof window === "undefined") return { correct: 0, wrong: 0 };
  try {
    const saved = localStorage.getItem("blackjack-stats");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed.correct === "number" &&
        typeof parsed.wrong === "number"
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { correct: 0, wrong: 0 };
}

export default function Home() {
  const [rules, setRules] = useState<HouseRules>(DEFAULT_HOUSE_RULES);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [sessionStats, setSessionStats] =
    useState<SessionStats>(loadSessionStats);

  const updateSessionStats = useCallback((isCorrect: boolean) => {
    setSessionStats((prev) => {
      const newStats = {
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1),
      };
      localStorage.setItem("blackjack-stats", JSON.stringify(newStats));
      return newStats;
    });
  }, []);

  const resetSessionStats = useCallback(() => {
    setSessionStats({ correct: 0, wrong: 0 });
    localStorage.removeItem("blackjack-stats");
  }, []);

  const startNewGame = useCallback(() => {
    const newGame = initGame(rules);
    const playerHasBlackjack = isBlackjack(newGame.playerHands[0]);
    const dealerHasBlackjack = isBlackjack(newGame.dealerHand);

    if (playerHasBlackjack || dealerHasBlackjack) {
      newGame.phase = "resolved";
    }

    setGameState(newGame);
    setShowCorrectAnswer(false);
  }, [rules]);

  const handleAction = useCallback(
    (action: PlayerAction) => {
      if (!gameState || gameState.phase !== "playing") return;

      const currentHand = gameState.playerHands[gameState.currentHandIndex];
      const expectedAction = getBasicStrategyAction(
        currentHand,
        gameState.dealerHand,
        rules,
      );
      const isCorrect = action === expectedAction;

      let newState: GameState = {
        ...gameState,
        lastAction: action,
        expectedAction,
        isCorrect,
      };

      switch (action) {
        case "hit":
          newState = playerHit(newState);
          break;
        case "stand":
          newState = playerStand(newState);
          break;
        case "double":
          newState = playerDouble(newState);
          break;
        case "split":
          newState = playerSplit(newState);
          break;
        case "surrender":
          newState = playerSurrender(newState);
          break;
      }

      if (
        newState.phase === "playing" &&
        (isBusted(newState.playerHands[newState.currentHandIndex]) ||
          newState.playerHands[newState.currentHandIndex].isStanding)
      ) {
        const allResolved = newState.playerHands.every(
          (h) => h.isStanding || isBusted(h) || h.isSurrendered,
        );
        if (allResolved) {
          newState = { ...newState, phase: "dealer" };
        }
      }

      if (isCorrect) {
        newState.score = {
          correct: gameState.score.correct + 1,
          total: gameState.score.total + 1,
        };
      } else {
        newState.score = {
          correct: gameState.score.correct,
          total: gameState.score.total + 1,
        };
      }

      updateSessionStats(isCorrect);
      setGameState(newState);
      setShowCorrectAnswer(!isCorrect);
    },
    [gameState, rules, updateSessionStats],
  );

  const handleDealerPlay = useCallback(() => {
    if (!gameState || gameState.phase !== "dealer") return;
    const newState = dealerPlay(gameState, rules);
    setGameState(newState);
  }, [gameState, rules]);

  const availableActions =
    gameState && gameState.phase === "playing"
      ? getAvailableActions(gameState, rules)
      : [];

  const currentHand = gameState?.playerHands[gameState.currentHandIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-800 to-green-900">
      <div className="max-w-4xl mx-auto p-4">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Blackjack Strategy Trainer
          </h1>
          <p className="text-green-200">
            Test your knowledge of basic strategy
          </p>
        </header>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-200">
            <SettingsPanel
              rules={rules}
              onRulesChange={setRules}
              isOpen={settingsOpen}
              onToggle={() => setSettingsOpen(!settingsOpen)}
            />
          </div>

          {gameState && (
            <div className="p-4 bg-zinc-100 border-b border-zinc-200">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {sessionStats.correct}
                  </div>
                  <div className="text-sm text-zinc-500">Correct</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {sessionStats.wrong}
                  </div>
                  <div className="text-sm text-zinc-500">Wrong</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900">
                    {sessionStats.correct + sessionStats.wrong > 0
                      ? Math.round(
                          (sessionStats.correct /
                            (sessionStats.correct + sessionStats.wrong)) *
                            100,
                        )
                      : 0}
                    %
                  </div>
                  <div className="text-sm text-zinc-500">Accuracy</div>
                </div>
                <button
                  onClick={resetSessionStats}
                  className="text-sm text-zinc-500 hover:text-zinc-700 underline"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="p-6">
            {!gameState ? (
              <div className="text-center py-12">
                <button
                  onClick={startNewGame}
                  className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors"
                >
                  Start Training
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <HandDisplay
                    cards={gameState.dealerHand.cards}
                    label="Dealer"
                    hiddenFirst={gameState.phase === "playing"}
                  />
                </div>

                <div className="mb-8">
                  {gameState.playerHands.map((hand, i) => {
                    return (
                      <HandDisplay
                        key={i}
                        cards={hand.cards}
                        label={`Hand ${i + 1}`}
                        isCurrentHand={
                          i === gameState.currentHandIndex &&
                          gameState.phase === "playing"
                        }
                      />
                    );
                  })}
                </div>

                {gameState.phase === "resolved" &&
                  (isBlackjack(gameState.playerHands[0]) ||
                    isBlackjack(gameState.dealerHand)) && (
                    <div className="space-y-4 mb-4">
                      <div className="text-center">
                        {isBlackjack(gameState.playerHands[0]) &&
                        isBlackjack(gameState.dealerHand) ? (
                          <div className="p-4 rounded-lg bg-yellow-100 text-yellow-800 font-semibold">
                            Both have Blackjack - Push!
                          </div>
                        ) : isBlackjack(gameState.playerHands[0]) ? (
                          <div className="p-4 rounded-lg bg-green-100 text-green-800 font-semibold">
                            Blackjack! You Win!
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-red-100 text-red-800 font-semibold">
                            Dealer has Blackjack - You Lose
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {gameState.phase === "playing" &&
                  currentHand &&
                  !isBusted(currentHand) &&
                  !currentHand.isStanding &&
                  !currentHand.isSurrendered && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {availableActions.map((action) => (
                          <button
                            key={action}
                            onClick={() => handleAction(action)}
                            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                              action === "hit"
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : action === "stand"
                                  ? "bg-zinc-600 hover:bg-zinc-700 text-white"
                                  : action === "double"
                                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                                    : action === "split"
                                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                                      : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            {actionToString(action)}
                          </button>
                        ))}
                      </div>

                      {showCorrectAnswer &&
                        gameState.lastAction &&
                        gameState.expectedAction && (
                          <div
                            className={`p-4 rounded-lg ${gameState.isCorrect ? "bg-green-100" : "bg-red-100"}`}
                          >
                            <p
                              className={
                                gameState.isCorrect
                                  ? "text-green-800"
                                  : "text-red-800"
                              }
                            >
                              {gameState.isCorrect
                                ? "✓ Correct!"
                                : `✗ Incorrect. The correct play was ${actionToString(gameState.expectedAction)}.`}
                            </p>
                          </div>
                        )}
                    </div>
                  )}

                {gameState.phase === "playing" &&
                  currentHand &&
                  (isBusted(currentHand) ||
                    currentHand.isStanding ||
                    currentHand.isSurrendered) && (
                    <div className="text-center">
                      {gameState.currentHandIndex <
                      gameState.playerHands.length - 1 ? (
                        <button
                          onClick={() =>
                            setGameState({
                              ...gameState,
                              currentHandIndex: gameState.currentHandIndex + 1,
                            })
                          }
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                        >
                          Next Hand
                        </button>
                      ) : (
                        <button
                          onClick={handleDealerPlay}
                          className="px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg font-semibold"
                        >
                          Dealer Plays
                        </button>
                      )}
                    </div>
                  )}

                {gameState.phase === "dealer" && (
                  <div className="text-center">
                    <button
                      onClick={handleDealerPlay}
                      className="px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg font-semibold"
                    >
                      Reveal Dealer Card
                    </button>
                  </div>
                )}

                {gameState.phase === "resolved" && (
                  <div className="space-y-4">
                    <div className="text-center">
                      {gameState.playerHands.map((hand, i) => {
                        const result = getHandResult(
                          hand,
                          gameState.dealerHand,
                        );
                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-lg mb-2 ${
                              result === "win" || result === "blackjack"
                                ? "bg-green-100 text-green-800"
                                : result === "push"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : result === "surrender"
                                    ? "bg-zinc-100 text-zinc-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            Hand {i + 1}:{" "}
                            {result.charAt(0).toUpperCase() + result.slice(1)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center">
                      <button
                        onClick={startNewGame}
                        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors"
                      >
                        New Hand
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="mt-6 text-center text-green-200 text-sm">
          <p>
            Basic strategy is the mathematically optimal way to play every hand.
          </p>
        </footer>
      </div>
    </div>
  );
}

function getHandResult(
  playerHand: { cards: Card[]; isSurrendered: boolean },
  dealerHand: { cards: Card[] },
): "win" | "lose" | "push" | "blackjack" | "surrender" {
  if (playerHand.isSurrendered) return "surrender";

  const playerValue = calculateHandValue({
    ...playerHand,
    isDoubledDown: false,
    isSplit: false,
    isStanding: false,
  }).total;
  const dealerValue = calculateHandValue({
    ...dealerHand,
    isDoubledDown: false,
    isSplit: false,
    isSurrendered: false,
    isStanding: false,
  }).total;

  if (
    isBusted({
      ...playerHand,
      isDoubledDown: false,
      isSplit: false,
      isSurrendered: false,
      isStanding: false,
    })
  )
    return "lose";
  if (
    isBlackjack({
      ...playerHand,
      isDoubledDown: false,
      isSplit: false,
      isSurrendered: false,
      isStanding: false,
    }) &&
    !isBlackjack({
      ...dealerHand,
      isDoubledDown: false,
      isSplit: false,
      isSurrendered: false,
      isStanding: false,
    })
  )
    return "blackjack";
  if (
    isBlackjack({
      ...dealerHand,
      isDoubledDown: false,
      isSplit: false,
      isSurrendered: false,
      isStanding: false,
    }) &&
    !isBlackjack({
      ...playerHand,
      isDoubledDown: false,
      isSplit: false,
      isSurrendered: false,
      isStanding: false,
    })
  )
    return "lose";
  if (dealerValue > 21) return "win";
  if (playerValue > dealerValue) return "win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}
