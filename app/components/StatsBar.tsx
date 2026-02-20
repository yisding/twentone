import { HouseRules, SessionStats } from "../lib/types";
import { calculateHouseEdge, formatHouseEdge } from "../lib/houseEdge";
import { Button } from "@/components/ui/button";

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
    <div className="px-4 py-3 bg-muted border-b">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Stat value={stats.correct} label="Correct" className="text-green-600" />
        <Stat value={stats.wrong} label="Wrong" className="text-destructive" />
        <Stat value={`${accuracy}%`} label="Accuracy" />
        <Stat
          value={`${stats.winnings >= 0 ? "+" : ""}${formattedWinnings}`}
          label="Winnings"
          className={stats.winnings > 0 ? "text-green-600" : stats.winnings < 0 ? "text-destructive" : undefined}
        />
        <Stat value={formatHouseEdge(calculateHouseEdge(rules))} label="House Edge" />
        <Button variant="link" size="sm" onClick={onReset} className="text-muted-foreground">
          Reset
        </Button>
      </div>
    </div>
  );
}

interface StatProps {
  value: number | string;
  label: string;
  className?: string;
}

function Stat({ value, label, className }: StatProps) {
  return (
    <div className="text-center">
      <div className={`text-xl sm:text-2xl font-bold ${className || "text-foreground"}`}>{value}</div>
      <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
