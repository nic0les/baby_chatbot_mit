"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { Preferences } from "../types";

interface Props {
  preferences: Preferences;
  onChange: (p: Preferences) => void;
}

function TagList({
  items,
  color,
  onRemove,
}: {
  items: string[];
  color: string;
  onRemove: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 min-h-[24px]">
      {items.map((item) => (
        <span
          key={item}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {item}
          <button
            onClick={() => onRemove(item)}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

export default function PreferencesPanel({ preferences, onChange }: Props) {
  const [priInput, setPriInput] = useState("");
  const [avoidInput, setAvoidInput] = useState("");

  function addPrioritize() {
    const val = priInput.trim();
    if (!val || preferences.prioritize.includes(val)) return;
    onChange({ ...preferences, prioritize: [...preferences.prioritize, val] });
    setPriInput("");
  }

  function addAvoid() {
    const val = avoidInput.trim();
    if (!val || preferences.avoid.includes(val)) return;
    onChange({ ...preferences, avoid: [...preferences.avoid, val] });
    setAvoidInput("");
  }

  function removePrioritize(item: string) {
    onChange({ ...preferences, prioritize: preferences.prioritize.filter((x) => x !== item) });
  }

  function removeAvoid(item: string) {
    onChange({ ...preferences, avoid: preferences.avoid.filter((x) => x !== item) });
  }

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa] mb-1.5">
          Prioritize
        </div>
        <TagList items={preferences.prioritize} color="#2D7A4F" onRemove={removePrioritize} />
        <div className="flex items-center gap-1.5 mt-2">
          <input
            value={priInput}
            onChange={(e) => setPriInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPrioritize()}
            placeholder="e.g. 6.3900, afternoon classes"
            className="flex-1 text-[12px] bg-bg border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ccc] placeholder:text-[#ccc]"
          />
          <button
            onClick={addPrioritize}
            className="p-1.5 rounded-lg border border-border bg-bg hover:bg-surface transition-colors text-[#555]"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa] mb-1.5">
          Avoid
        </div>
        <TagList items={preferences.avoid} color="#A31F34" onRemove={removeAvoid} />
        <div className="flex items-center gap-1.5 mt-2">
          <input
            value={avoidInput}
            onChange={(e) => setAvoidInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAvoid()}
            placeholder="e.g. 14.01, 8am sections"
            className="flex-1 text-[12px] bg-bg border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ccc] placeholder:text-[#ccc]"
          />
          <button
            onClick={addAvoid}
            className="p-1.5 rounded-lg border border-border bg-bg hover:bg-surface transition-colors text-[#555]"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {(preferences.prioritize.length > 0 || preferences.avoid.length > 0) && (
        <p className="text-[10px] text-[#aaa]">
          These preferences are sent with every message to the advisor.
        </p>
      )}
    </div>
  );
}
