import { PlayerAction } from "./types";

const ACTION_LABELS: Record<PlayerAction, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double Down",
  split: "Split",
  surrender: "Surrender",
  continue: "Continue Hand",
};

export function actionToString(action: PlayerAction): string {
  return ACTION_LABELS[action];
}

const ACTION_VARIANTS: Record<PlayerAction, "default" | "secondary" | "destructive" | "outline"> = {
  hit: "default",
  stand: "secondary",
  double: "default",
  split: "default",
  surrender: "destructive",
  continue: "secondary",
};

const ACTION_COLORS: Record<PlayerAction, string> = {
  hit: "bg-blue-600 hover:bg-blue-700",
  stand: "",
  double: "bg-purple-600 hover:bg-purple-700",
  split: "bg-orange-600 hover:bg-orange-700",
  surrender: "",
  continue: "",
};

export function getActionVariant(action: PlayerAction) {
  return ACTION_VARIANTS[action];
}

export function getActionColor(action: PlayerAction) {
  return ACTION_COLORS[action];
}
