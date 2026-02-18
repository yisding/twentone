import { useState, useCallback } from "react";
import { IncorrectPlay, Card, PlayerAction } from "../lib/types";
import { calculateCardsValue, isPair } from "../lib/deck";

function loadPlays(): IncorrectPlay[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("blackjack-incorrect-plays");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function savePlays(plays: IncorrectPlay[]) {
  localStorage.setItem("blackjack-incorrect-plays", JSON.stringify(plays));
}

function describeHand(cards: Card[]): string {
  const { total, isSoft } = calculateCardsValue(cards);
  if (isPair({ cards, isDoubledDown: false, isSplit: false, isSurrendered: false, isStanding: false }) && cards.length === 2) {
    return `Pair of ${cards[0].rank}s`;
  }
  return `${isSoft ? "Soft" : "Hard"} ${total}`;
}

export function useIncorrectPlays() {
  const [plays, setPlays] = useState<IncorrectPlay[]>(loadPlays);

  const recordIncorrectPlay = useCallback(
    (playerCards: Card[], dealerUpCard: Card, playerAction: PlayerAction, expectedAction: PlayerAction) => {
      const play: IncorrectPlay = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        playerCards,
        dealerUpCard,
        playerAction,
        expectedAction,
        handDescription: describeHand(playerCards),
      };
      setPlays((prev) => {
        const newPlays = [play, ...prev].slice(0, 100);
        savePlays(newPlays);
        return newPlays;
      });
    },
    []
  );

  const clearPlays = useCallback(() => {
    setPlays([]);
    localStorage.removeItem("blackjack-incorrect-plays");
  }, []);

  const removePlay = useCallback((id: string) => {
    setPlays((prev) => {
      const newPlays = prev.filter((p) => p.id !== id);
      savePlays(newPlays);
      return newPlays;
    });
  }, []);

  return { plays, recordIncorrectPlay, clearPlays, removePlay };
}
