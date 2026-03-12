"use client";

import type { CourseBlock } from "../types";

const MAX_UNITS = 54;

export default function UnitLoadBar({ courses }: { courses: CourseBlock[] }) {
  const total = courses.reduce((s, c) => s + c.units, 0);
  const pct = Math.min((total / MAX_UNITS) * 100, 100);
  const over = total > MAX_UNITS;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span style={{ color: over ? "var(--accent)" : "#888" }}>
          {total} / {MAX_UNITS} units
        </span>
        {over && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "rgba(163,31,52,0.10)", color: "var(--accent)" }}
          >
            overload
          </span>
        )}
      </div>
      <div className="w-full h-2 rounded-full bg-[#eee] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? "var(--accent)" : "#4A9E6E",
          }}
        />
      </div>
    </div>
  );
}
