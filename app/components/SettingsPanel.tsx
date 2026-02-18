import { HouseRules } from "../lib/types";

interface SettingsPanelProps {
  rules: HouseRules;
  onRulesChange: (rules: HouseRules) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SettingsPanel({ rules, onRulesChange, isOpen, onToggle }: SettingsPanelProps) {
  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center justify-between"
      >
        <span className="font-medium">House Rules</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 p-4 bg-zinc-50 rounded-lg space-y-4">
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
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded"
      />
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
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1 rounded border border-zinc-300"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
      <label className="text-sm font-medium text-zinc-700">Number of decks</label>
      <div className="flex gap-2">
        {[2, 6].map((num) => (
          <button
            key={num}
            onClick={() => onChange(num)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              decks === num
                ? "bg-green-600 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
            }`}
          >
            {num}
          </button>
        ))}
        <select
          value={decks === 2 || decks === 6 ? "" : decks}
          onChange={(e) => e.target.value && onChange(parseInt(e.target.value))}
          className={`px-2 py-1 rounded border text-sm ${
            decks !== 2 && decks !== 6
              ? "bg-green-600 text-white border-green-600"
              : "bg-white border-zinc-300"
          }`}
        >
          <option value="">Other</option>
          <option value="1">1</option>
          <option value="4">4</option>
          <option value="8">8</option>
        </select>
      </div>
    </div>
  );
}
