import { Card } from "./Card";
import { Card as CardType, Hand as HandType } from "../lib/types";
import { calculateHandValue, isBlackjack } from "../lib/deck";

interface HandProps {
  cards: CardType[];
  label: string;
  hiddenFirst?: boolean;
  isCurrentHand?: boolean;
}

export function Hand({ cards, label, hiddenFirst = false, isCurrentHand = false }: HandProps) {
  const tempHand: HandType = {
    cards,
    isDoubledDown: false,
    isSplit: false,
    isSurrendered: false,
    isStanding: false,
  };
  
  const { total, isSoft } = calculateHandValue(tempHand);
  const hasBlackjack = isBlackjack(tempHand);

  return (
    <div className={`p-4 rounded-lg ${isCurrentHand ? "ring-2 ring-yellow-400 bg-yellow-50" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-zinc-700">{label}</span>
        {hiddenFirst ? (
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
          <Card key={i} card={card} hidden={hiddenFirst && i === 0} />
        ))}
      </div>
    </div>
  );
}
