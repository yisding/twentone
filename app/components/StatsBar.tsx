import { HouseRules } from "../lib/types";
import { calculateHouseEdge, formatHouseEdge } from "../lib/houseEdge";

interface SessionStats {
  correct: number;
  wrong: number;
  winnings: number;
}

interface StatsBarProps {
  stats: SessionStats;
  rules: HouseRules;
  onReset: () => void;
}

export function StatsBar({ stats, rules, onReset }: StatsBarProps) {
  const accuracy = stats.correct + stats.wrong > 0
    ? Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)
    : 0;

  const formattedWinnings = stats.winnings.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <div className="p-4 bg-zinc-100 border-b border-zinc-200">
      <div className="flex items-center justify-center gap-8">
        <Stat value={stats.correct} label="Correct" color="text-green-600" />
        <Stat value={stats.wrong} label="Wrong" color="text-red-600" />
        <Stat value={`${accuracy}%`} label="Accuracy" />
        <Stat
          value={`${stats.winnings >= 0 ? "+" : ""}${formattedWinnings}`}
          label="Winnings"
          color={stats.winnings > 0 ? "text-green-600" : stats.winnings < 0 ? "text-red-600" : undefined}
        />
        <Stat value={formatHouseEdge(calculateHouseEdge(rules))} label="House Edge" />
        <button
          onClick={onReset}
          className="text-sm text-zinc-500 hover:text-zinc-700 underline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

interface StatProps {
  value: number | string;
  label: string;
  color?: string;
}

function Stat({ value, label, color }: StatProps) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color || "text-zinc-900"}`}>{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}

export type { SessionStats };
