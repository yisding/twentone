import { DEFAULT_HOUSE_RULES, HouseRules } from "@/app/lib/types";
import { simulateHouseEdge } from "@/app/lib/simulation-fast";

type RunSimulationMessage = {
  type: "run-simulation";
  numHands: number;
  rules: HouseRules;
};

type SimulationWorkerMessage = RunSimulationMessage;

self.onmessage = (event: MessageEvent<SimulationWorkerMessage>) => {
  const message = event.data;

  if (message.type !== "run-simulation") {
    return;
  }

  try {
    const simulationRules: HouseRules = {
      ...DEFAULT_HOUSE_RULES,
      ...message.rules,
    };
    const result = simulateHouseEdge(message.numHands, simulationRules);
    self.postMessage({ type: "simulation-complete", result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Simulation failed";
    self.postMessage({ type: "simulation-error", error: errorMessage });
  }
};

export {};
