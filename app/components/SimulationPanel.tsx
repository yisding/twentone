"use client";

import { useEffect, useRef, useState } from "react";
import { HouseRules } from "../lib/types";
import { calculateHouseEdge } from "../lib/houseEdge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Loader2 } from "lucide-react";
import { SimulationResult } from "../lib/simulation-fast";

interface SimulationPanelProps {
  rules: HouseRules;
  onRulesChange: (rules: HouseRules) => void;
}


type WorkerResponse =
  | { type: "simulation-complete"; result: SimulationResult }
  | { type: "simulation-error"; error: string };

export function SimulationPanel({ rules, onRulesChange }: SimulationPanelProps) {
  const [numHands, setNumHands] = useState(1000000);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runSimulation = () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/simulationWorker.ts", import.meta.url),
      );
    }

    const currentRequestId = ++requestIdRef.current;

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (event.data.type === "simulation-complete") {
        setResult(event.data.result);
        setError(null);
      } else {
        setError(event.data.error);
      }
      setIsRunning(false);
    };

    workerRef.current.onerror = () => {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      setError("Simulation worker failed");
      setIsRunning(false);
    };

    workerRef.current.postMessage({
      type: "run-simulation",
      numHands,
      rules,
    });
  };
  const theoreticalEdge = calculateHouseEdge(rules);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectOption
          label="Shuffle"
          value={rules.continuousShuffle ? "csm" : "shoe"}
          options={[
            { value: "shoe", label: "Shoe" },
            { value: "csm", label: "CSM" },
          ]}
          onChange={(shuffleMode) =>
            onRulesChange({ ...rules, continuousShuffle: shuffleMode === "csm" })
          }
        />

        <SelectOption
          label="Reshuffle point"
          value={rules.reshufflePoint.toString()}
          options={[
            { value: "0.5", label: "50%" },
            { value: "0.6", label: "60%" },
            { value: "0.7", label: "70%" },
            { value: "0.75", label: "75%" },
            { value: "0.8", label: "80%" },
          ]}
          onChange={(reshufflePoint) =>
            onRulesChange({ ...rules, reshufflePoint: parseFloat(reshufflePoint) })
          }
          disabled={rules.continuousShuffle}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-1 text-sm font-medium">Hands:</label>
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
            className="h-8 rounded-md border bg-background px-3 text-sm"
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
          className="w-full bg-green-600 hover:bg-green-700 sm:ml-auto sm:w-auto"
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

interface SelectOptionProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function SelectOption({ label, value, options, onChange, disabled = false }: SelectOptionProps) {
  return (
    <div className="flex min-h-10 items-center justify-between rounded-md border bg-background px-3 py-2">
      <label className="pr-2 text-sm font-medium leading-tight">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger size="sm" className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
