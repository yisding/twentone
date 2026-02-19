import { Card as CardType } from "../lib/types";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-600",
  diamonds: "text-red-600",
  clubs: "text-zinc-900",
  spades: "text-zinc-900",
};

interface CardProps {
  card: CardType;
  hidden?: boolean;
}

export function Card({ card, hidden = false }: CardProps) {
  if (hidden) {
    return (
      <div className="w-16 h-24 bg-blue-600 rounded-lg border-2 border-blue-700 flex items-center justify-center shadow-md" role="img" aria-label="Hidden card">
        <span className="text-white text-2xl" aria-hidden="true">?</span>
      </div>
    );
  }

  return (
    <div className="w-16 h-24 bg-white rounded-lg border-2 border-zinc-300 flex flex-col items-center justify-center shadow-md" role="img" aria-label={`${card.rank} of ${card.suit}`}>
      <span className={`text-lg font-bold ${SUIT_COLORS[card.suit]}`} aria-hidden="true">
        {card.rank}
      </span>
      <span className={`text-2xl ${SUIT_COLORS[card.suit]}`} aria-hidden="true">
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
}
