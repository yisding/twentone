"use client";

import { useState } from "react";
import { HouseRules } from "../lib/types";
import { calculateHouseEdge } from "../lib/houseEdge";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { SimulationResult } from "../lib/simulation";

interface SimulationPanelProps {
  rules: HouseRules;
}

export function SimulationPanel({ rules }: SimulationPanelProps) {
  const [numHands, setNumHands] = useState(1000000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numHands, rules }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Simulation failed: ${response.status}${errorData.error ? ` - ${errorData.error}` : ""}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setIsRunning(false);
    }
  };

  const theoreticalEdge = calculateHouseEdge(rules);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Hands:</label>
        <div className="flex gap-2">
          {[1000000, 10000000, 100000000].map((num) => (
            <Button
              key={num}
              variant={numHands === num ? "default" : "outline"}
              size="sm"
              onClick={() => setNumHands(num)}
              className={numHands === num ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {num >= 1000000 ? `${num / 1000000}M` : `${num / 1000}K`}
            </Button>
          ))}
          <select
            value={numHands > 100000000 ? numHands.toString() : ""}
            onChange={(e) => e.target.value && setNumHands(parseInt(e.target.value))}
            className="h-8 px-3 text-sm border rounded-md bg-background"
          >
            <option value="">More...</option>
            <option value="500000000">500M</option>
            <option value="1000000000">1B</option>
          </select>
        </div>
        <Button
          onClick={runSimulation}
          disabled={isRunning}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          {isRunning ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="size-4 mr-2" />
              Simulate
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="text-destructive text-sm">{error}</div>
      )}

      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <ResultStat
            label="Simulated Edge"
            value={`${result.houseEdge.toFixed(3)}%`}
            className={result.houseEdge < theoreticalEdge ? "text-green-600" : result.houseEdge > theoreticalEdge + 0.2 ? "text-destructive" : undefined}
          />
          <ResultStat
            label="Theoretical"
            value={`${theoreticalEdge.toFixed(3)}%`}
          />
          <ResultStat
            label="Diff"
            value={`${(result.houseEdge - theoreticalEdge).toFixed(3)}%`}
            className={Math.abs(result.houseEdge - theoreticalEdge) < 0.3 ? "text-green-600" : "text-yellow-600"}
          />
          <ResultStat
            label="Hands"
            value={result.handsPlayed.toLocaleString()}
          />
          <ResultStat
            label="Wins"
            value={`${((result.wins / result.handsPlayed) * 100).toFixed(1)}%`}
          />
          <ResultStat
            label="Losses"
            value={`${((result.losses / result.handsPlayed) * 100).toFixed(1)}%`}
          />
          <ResultStat
            label="Pushes"
            value={`${((result.pushes / result.handsPlayed) * 100).toFixed(1)}%`}
          />
          <ResultStat
            label="Blackjacks"
            value={`${((result.blackjacks / result.handsPlayed) * 100).toFixed(2)}%`}
          />
        </div>
      )}
    </div>
  );
}

interface ResultStatProps {
  label: string;
  value: string;
  className?: string;
}

function ResultStat({ label, value, className }: ResultStatProps) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${className || ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
