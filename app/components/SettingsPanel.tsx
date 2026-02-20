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
        <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
          <ToggleOption
            label="Dealer hits on soft 17"
            checked={rules.hitSoft17}
            onChange={(hitSoft17) => onRulesChange({ ...rules, hitSoft17 })}
          />

          <SelectOption
            label="Surrender allowed"
            value={rules.surrenderAllowed}
            options={[
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
              { value: "any", label: "Any two cards" },
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
            label="No hole card (European style)"
            checked={rules.noHoleCard}
            onChange={(noHoleCard) => onRulesChange({ ...rules, noHoleCard })}
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

          <div className="pt-4 border-t border-border">
            <div className="text-sm font-medium mb-3">Simulation</div>
            <SimulationPanel rules={rules} />
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
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
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
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-32">
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
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">Number of decks</label>
      <div className="flex gap-2">
        {[2, 6].map((num) => (
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
          value={decks === 2 || decks === 6 ? "" : decks.toString()}
          onValueChange={(v) => v && onChange(parseInt(v))}
        >
          <SelectTrigger
            size="sm"
            className={decks !== 2 && decks !== 6 ? "bg-green-600 text-white border-green-600 w-20" : "w-20"}
          >
            <SelectValue placeholder="Other" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="4">4</SelectItem>
            <SelectItem value="8">8</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
