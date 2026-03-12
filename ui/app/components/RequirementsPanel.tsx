"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { RequirementGroup, SubRequirement } from "../types";

// ── Default mock data ──────────────────────────────────────────────────────────
export const DEFAULT_REQUIREMENTS: RequirementGroup[] = [];

// ── Helper ─────────────────────────────────────────────────────────────────────
function groupTotal(group: RequirementGroup) {
  const done = group.subcategories.reduce((s, c) => s + c.completed, 0);
  const total = group.subcategories.reduce((s, c) => s + c.total, 0);
  return { done, total };
}

// ── Sub-row ────────────────────────────────────────────────────────────────────
function SubRow({
  sub,
  color,
  compact,
}: {
  sub: SubRequirement;
  color: string;
  compact: boolean;
}) {
  const pct = sub.total > 0 ? sub.completed / sub.total : 0;
  const done = pct >= 1;

  return (
    <div
      className={`flex flex-col gap-1 ${compact ? "py-1.5" : "py-2.5"} border-b border-[#f0ede8] last:border-0`}
    >
      <div className="flex items-center justify-between">
        <span className={`${compact ? "text-[11px]" : "text-[13px]"} text-[#1c1c1c]`}>
          {sub.name}
          {sub.note && (
            <span className="ml-1.5 text-[10px] text-[#aaa]">({sub.note})</span>
          )}
        </span>
        <span
          className={`${compact ? "text-[10px]" : "text-[12px]"} tabular-nums`}
          style={{ color: done ? "#5b9d6b" : "var(--muted)" }}
        >
          {sub.completed}/{sub.total}
        </span>
      </div>
      <div className="h-1 rounded-full bg-[#f0ede8] overflow-hidden">
        <div
          className="h-full rounded-full progress-fill"
          style={{ width: `${pct * 100}%`, backgroundColor: done ? "#5b9d6b" : color }}
        />
      </div>
    </div>
  );
}

// ── Category row ───────────────────────────────────────────────────────────────
function CategorySection({
  group,
  compact,
  defaultOpen,
}: {
  group: RequirementGroup;
  compact: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { done, total } = groupTotal(group);
  const pct = total > 0 ? done / total : 0;

  return (
    <div className="mb-1">
      {/* Category header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 py-2 hover:opacity-80 transition-opacity text-left"
      >
        {open ? (
          <ChevronDown size={12} className="text-[#aaa] shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-[#aaa] shrink-0" />
        )}
        <span
          className={`flex-1 font-semibold ${compact ? "text-[12px]" : "text-[14px]"}`}
          style={{ color: "var(--text)" }}
        >
          {group.name}
        </span>
        <span
          className={`${compact ? "text-[11px]" : "text-[13px]"} tabular-nums font-medium`}
          style={{ color: group.color }}
        >
          {Math.round(pct * 100)}%
        </span>
      </button>

      {/* Overall bar */}
      <div className={`h-1.5 rounded-full bg-[#f0ede8] overflow-hidden ${compact ? "mb-1" : "mb-2"}`}>
        <div
          className="h-full rounded-full progress-fill"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: group.color,
          }}
        />
      </div>

      {/* Sub-rows */}
      {open && (
        <div className={`pl-4 ${compact ? "" : "mt-1"}`}>
          {group.subcategories.map((sub) => (
            <SubRow key={sub.name} sub={sub} color={group.color} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exported panel ─────────────────────────────────────────────────────────────
interface Props {
  requirements: RequirementGroup[];
  compact?: boolean;
}

export default function RequirementsPanel({ requirements, compact = false }: Props) {
  return (
    <div className="w-full">
      {/* Total units completed badge */}
      {!compact && (
        <div className="flex gap-4 mb-5">
          {requirements.map((g) => {
            const { done, total } = groupTotal(g);
            return (
              <div
                key={g.id}
                className="flex-1 rounded-lg px-4 py-3"
                style={{ backgroundColor: `${g.color}14` }}
              >
                <div
                  className="text-[11px] font-medium uppercase tracking-wide mb-0.5"
                  style={{ color: g.color }}
                >
                  {g.name.split(" ").slice(0, 2).join(" ")}
                </div>
                <div className="text-[22px] font-semibold tabular-nums" style={{ color: g.color }}>
                  {done}
                  <span className="text-[14px] font-normal opacity-60">/{total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category sections */}
      {requirements.map((group, i) => (
        <CategorySection
          key={group.id}
          group={group}
          compact={compact}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
