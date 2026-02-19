import { Card } from "./Card";
import { Card as CardType } from "../lib/types";
import { calculateCardsValue, isCardsBlackjack } from "../lib/deck";

interface HandProps {
  cards: CardType[];
  label: string;
  hideHoleCard?: boolean;
  isCurrentHand?: boolean;
}

export function Hand({
  cards,
  label,
  hideHoleCard = false,
  isCurrentHand = false,
}: HandProps) {
  const visibleCards = hideHoleCard && cards.length >= 2 ? [cards[0]] : cards;
  const { total, isSoft } = calculateCardsValue(visibleCards);
  const hasBlackjack = isCardsBlackjack(cards);

  return (
    <div className={`p-4 rounded-lg ${isCurrentHand ? "ring-2 ring-yellow-400 bg-yellow-50" : ""}`} role="region" aria-label={`${label}${hideHoleCard ? "" : hasBlackjack ? ", Blackjack" : `, ${isSoft && total <= 21 ? "Soft " : ""}${total > 21 ? "Bust" : total}`}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-zinc-700">{label}</span>
        {hideHoleCard ? (
          <span className="text-sm text-zinc-500">(?)</span>
        ) : hasBlackjack ? (
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
          <Card key={i} card={card} hidden={hideHoleCard && i === 1} />
        ))}
      </div>
    </div>
  );
}
