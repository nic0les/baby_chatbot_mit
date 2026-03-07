"use client";

import type { CourseBlock, Day } from "../types";

// ── Mock data ──────────────────────────────────────────────────────────────────
export const DEFAULT_SCHEDULE: CourseBlock[] = [
  {
    id: "6.3900",
    name: "Intro to Machine Learning",
    days: ["Mon", "Wed", "Fri"],
    startHour: 10.5,
    endHour: 11.5,
    color: "#4A7FC1",
    units: 12,
  },
  {
    id: "18.404",
    name: "Theory of Computation",
    days: ["Tue", "Thu"],
    startHour: 13,
    endHour: 14.5,
    color: "#4E9E6E",
    units: 12,
  },
  {
    id: "15.310",
    name: "People, Teams & Organizations",
    days: ["Mon", "Wed"],
    startHour: 14,
    endHour: 15.5,
    color: "#9171C7",
    units: 9,
  },
];

// ── Constants ──────────────────────────────────────────────────────────────────
const SCHEDULE_START = 8;
const SCHEDULE_END = 21;
const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
};

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours > 12 ? hours - 12 : hours;
  if (mins === 0) return `${h12} ${ampm}`;
  return `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

// ── Grid ───────────────────────────────────────────────────────────────────────
interface Props {
  courses?: CourseBlock[];
  compact?: boolean;
}

export default function ScheduleGrid({
  courses = DEFAULT_SCHEDULE,
  compact = false,
}: Props) {
  const pxPerHour = compact ? 28 : 56;
  const totalHours = SCHEDULE_END - SCHEDULE_START;
  const totalHeight = totalHours * pxPerHour;
  const timeColWidth = compact ? 40 : 52;

  const hours = Array.from({ length: totalHours + 1 }, (_, i) => SCHEDULE_START + i);

  function top(h: number) {
    return (h - SCHEDULE_START) * pxPerHour;
  }
  function height(start: number, end: number) {
    return (end - start) * pxPerHour;
  }

  return (
    <div className="w-full overflow-auto">
      {/* Day headers */}
      <div
        className="flex border-b border-border sticky top-0 bg-surface z-10"
        style={{ paddingLeft: timeColWidth }}
      >
        {DAYS.map((day) => (
          <div
            key={day}
            className={`flex-1 text-center border-l border-border py-2 ${
              compact ? "text-[10px]" : "text-[12px]"
            } font-semibold text-[#888] uppercase tracking-wider`}
          >
            {compact ? day : DAY_LABELS[day]}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex" style={{ height: totalHeight }}>
        {/* Time labels */}
        <div
          className="relative shrink-0"
          style={{ width: timeColWidth, height: totalHeight }}
        >
          {hours.map((h) => (
            <div
              key={h}
              className={`absolute right-2 text-right leading-none`}
              style={{
                top: top(h) - 6,
                fontSize: compact ? 9 : 10,
                color: "var(--muted)",
              }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative" style={{ height: totalHeight }}>
          {/* Horizontal hour lines */}
          <div
            className="absolute inset-0 pointer-events-none"
          >
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full border-t"
                style={{
                  top: top(h),
                  borderColor:
                    h % 2 === 0 ? "var(--border)" : "rgba(229,226,220,0.4)",
                }}
              />
            ))}
          </div>

          {DAYS.map((day) => {
            const dayCourses = courses.filter((c) => c.days.includes(day));
            return (
              <div
                key={day}
                className="flex-1 relative border-l border-border"
                style={{ height: totalHeight }}
              >
                {dayCourses.map((course) => {
                  const h = height(course.startHour, course.endHour);
                  const t = top(course.startHour);
                  const minH = compact ? 14 : 20;
                  return (
                    <div
                      key={course.id}
                      className="absolute left-[2px] right-[2px] rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                      style={{
                        top: t + 1,
                        height: Math.max(h - 2, minH),
                        backgroundColor: course.color,
                      }}
                      title={`${course.id} — ${course.name}`}
                    >
                      <div
                        className={`px-1.5 py-1 text-white leading-tight ${compact ? "text-[9px]" : "text-[11px]"}`}
                      >
                        <div className="font-semibold truncate">{course.id}</div>
                        {!compact && (
                          <div className="opacity-80 truncate text-[10px]">
                            {course.name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
