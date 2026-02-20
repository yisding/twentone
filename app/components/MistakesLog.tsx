import { IncorrectPlay, PlayerAction } from "../lib/types";
import { actionToString } from "../lib/format";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

interface MistakesLogProps {
  plays: IncorrectPlay[];
  onClear: () => void;
  onRemove: (id: string) => void;
}

export function MistakesLog({ plays, onClear, onRemove }: MistakesLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (plays.length === 0 && !isOpen) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-foreground/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-expanded={isOpen}
          aria-label={`Mistakes log, ${plays.length} items`}
        >
          <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          Mistakes ({plays.length})
        </button>
        {plays.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-red-600 hover:text-red-700">
            Clear All
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {plays.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No mistakes recorded yet!</p>
          ) : (
            plays.map((play) => (
              <MistakeItem key={play.id} play={play} onRemove={() => onRemove(play.id)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MistakeItem({ play, onRemove }: { play: IncorrectPlay; onRemove: () => void }) {
  const timeAgo = formatTimeAgo(play.timestamp);

  return (
    <div className="flex items-start justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-100 dark:border-red-900/40 text-sm">
      <div className="flex-1">
        <div className="font-medium text-red-700 dark:text-red-300">
          {play.handDescription} vs Dealer {play.dealerUpCard.rank}
        </div>
        <div className="text-red-600">
          You: <span className="font-medium">{actionToString(play.playerAction as PlayerAction)}</span>
          {" → "}
          Correct: <span className="font-medium">{actionToString(play.expectedAction as PlayerAction)}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 italic">
          {play.explanation}
        </div>
        <div className="text-xs text-muted-foreground/60 mt-1">{timeAgo}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove} className="text-zinc-400 hover:text-zinc-600 p-1 h-auto" aria-label="Remove mistake">
        ✕
      </Button>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
