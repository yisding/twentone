"use client";

import { HouseRules } from "../lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SimulationPanel } from "./SimulationPanel";

interface SettingsPanelProps {
  rules: HouseRules;
  onRulesChange: (rules: HouseRules) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SettingsPanel({ rules, onRulesChange, isOpen, onToggle }: SettingsPanelProps) {
  return (
    <div className="w-full">
      <Button
        onClick={onToggle}
        variant="outline"
        className="w-full justify-between"
      >
        <span className="font-medium">House Rules</span>
        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>

      {isOpen && (
        <div className="mt-3 rounded-lg border bg-muted/40 p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleOption
              label="Hit soft 17"
              checked={rules.hitSoft17}
              onChange={(hitSoft17) => onRulesChange({ ...rules, hitSoft17 })}
            />

            <SelectOption
              label="Surrender"
              value={rules.surrenderAllowed}
              options={rules.noHoleCard
                ? [
                    { value: "none", label: "None" },
                    { value: "enhcAll", label: "All upcards" },
                    { value: "enhcNoAce", label: "No Ace" },
                  ]
                : [
                    { value: "none", label: "None" },
                    { value: "early", label: "Early" },
                    { value: "late", label: "Late" },
                  ]}
              onChange={(surrenderAllowed) =>
                onRulesChange({ ...rules, surrenderAllowed: surrenderAllowed as HouseRules["surrenderAllowed"] })
              }
            />

            <ToggleOption
              label="Double after split"
              checked={rules.doubleAfterSplit}
              onChange={(doubleAfterSplit) => onRulesChange({ ...rules, doubleAfterSplit })}
            />

            <SelectOption
              label="Double on"
              value={rules.doubleRestriction}
              options={[
                { value: "any", label: "Any 2 cards" },
                { value: "9-11", label: "9-11 only" },
                { value: "10-11", label: "10-11 only" },
              ]}
              onChange={(doubleRestriction) =>
                onRulesChange({ ...rules, doubleRestriction: doubleRestriction as HouseRules["doubleRestriction"] })
              }
            />

            <ToggleOption
              label="Resplit aces"
              checked={rules.resplitAces}
              onChange={(resplitAces) => onRulesChange({ ...rules, resplitAces })}
            />

            <ToggleOption
              label="No hole card (European)"
              checked={rules.noHoleCard}
              onChange={(noHoleCard) => {
                const surrenderAllowed = noHoleCard
                  ? rules.surrenderAllowed === "early"
                    ? "enhcAll"
                    : rules.surrenderAllowed === "late"
                      ? "enhcNoAce"
                      : rules.surrenderAllowed
                  : rules.surrenderAllowed === "enhcAll"
                    ? "early"
                    : rules.surrenderAllowed === "enhcNoAce"
                      ? "late"
                      : rules.surrenderAllowed;

                onRulesChange({ ...rules, noHoleCard, surrenderAllowed });
              }}
            />

            <SelectOption
              label="Blackjack pays"
              value={rules.blackjackPays}
              options={[
                { value: "3:2", label: "3:2" },
                { value: "6:5", label: "6:5" },
                { value: "1:1", label: "1:1" },
              ]}
              onChange={(blackjackPays) =>
                onRulesChange({ ...rules, blackjackPays: blackjackPays as HouseRules["blackjackPays"] })
              }
            />

            <SelectOption
              label="Max split hands"
              value={rules.maxSplitHands.toString()}
              options={[
                { value: "4", label: "4" },
                { value: "3", label: "3" },
                { value: "2", label: "2" },
              ]}
              onChange={(maxSplitHands) =>
                onRulesChange({ ...rules, maxSplitHands: parseInt(maxSplitHands) as 2 | 3 | 4 })
              }
            />

            <DeckSelector decks={rules.decks} onChange={(decks) => onRulesChange({ ...rules, decks })} />

          </div>

          <div className="mt-3 border-t border-border/70 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Simulation</div>
            <SimulationPanel rules={rules} onRulesChange={onRulesChange} />
          </div>
        </div>
      )}
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleOption({ label, checked, onChange }: ToggleOptionProps) {
  return (
    <div className="flex min-h-10 items-center justify-between rounded-md border bg-background px-3 py-2">
      <label className="pr-2 text-sm font-medium leading-tight">{label}</label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

interface SelectOptionProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function SelectOption({ label, value, options, onChange }: SelectOptionProps) {
  return (
    <div className="flex min-h-10 items-center justify-between rounded-md border bg-background px-3 py-2">
      <label className="pr-2 text-sm font-medium leading-tight">{label}</label>
      <Select value={value} onValueChange={onChange}>
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

interface DeckSelectorProps {
  decks: number;
  onChange: (decks: number) => void;
}

function DeckSelector({ decks, onChange }: DeckSelectorProps) {
  return (
    <div className="flex min-h-10 items-center justify-between rounded-md border bg-background px-3 py-2 sm:col-span-2">
      <label className="pr-2 text-sm font-medium leading-tight">Decks</label>
      <div className="flex gap-2">
        {[2, 6, 8].map((num) => (
          <Button
            key={num}
            variant={decks === num ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(num)}
            className={decks === num ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {num}
          </Button>
        ))}
        <Select
          value={decks === 2 || decks === 6 || decks === 8 ? "" : decks.toString()}
          onValueChange={(v) => onChange(parseInt(v))}
        >
          <SelectTrigger
            size="sm"
            className={decks !== 2 && decks !== 6 && decks !== 8 ? "w-24 border-green-600 bg-green-600 text-white" : "w-24"}
          >
            <SelectValue placeholder="Other" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
