"use client";

import type { CourseBlock, Day } from "../types";
import { formatHourLabel } from "../utils/parseMeetingTimes";

export const DEFAULT_SCHEDULE: CourseBlock[] = [];

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

// ── Grid ───────────────────────────────────────────────────────────────────────
interface Props {
  courses?: CourseBlock[];
  compact?: boolean;
  suggestedCourses?: CourseBlock[];
  onAddCourse?: (id: string) => void;
}

export default function ScheduleGrid({
  courses = [],
  compact = false,
  suggestedCourses = [],
  onAddCourse,
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

  // Suggestions that have valid parsed meeting times
  const scheduledSuggestions = suggestedCourses.filter((c) => c.days.length > 0 && c.startHour > 0);
  // Suggestions without times (TBA) — only show in tray
  const unscheduledSuggestions = suggestedCourses.filter((c) => !c.days.length || c.startHour === 0);

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
              className="absolute right-2 text-right leading-none"
              style={{
                top: top(h) - 6,
                fontSize: compact ? 9 : 10,
                color: "var(--muted)",
              }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative" style={{ height: totalHeight }}>
          {/* Horizontal hour lines */}
          <div className="absolute inset-0 pointer-events-none">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full border-t"
                style={{
                  top: top(h),
                  borderColor: h % 2 === 0 ? "var(--border)" : "rgba(229,226,220,0.4)",
                }}
              />
            ))}
          </div>

          {DAYS.map((day) => {
            const dayCourses = courses.filter((c) => c.days.includes(day));
            const daySuggested = scheduledSuggestions.filter((c) => c.days.includes(day));
            return (
              <div
                key={day}
                className="flex-1 relative border-l border-border"
                style={{ height: totalHeight }}
              >
                {/* Confirmed course blocks */}
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
                        zIndex: 2,
                      }}
                      title={`${course.id} — ${course.name}`}
                    >
                      <div
                        className={`px-1.5 py-1 text-white leading-tight ${compact ? "text-[9px]" : "text-[11px]"}`}
                      >
                        <div className="font-semibold truncate">{course.id}</div>
                        {!compact && (
                          <div className="opacity-80 truncate text-[10px]">{course.name}</div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Ghost blocks for suggested courses with known times */}
                {daySuggested.map((course) => {
                  const h = height(course.startHour, course.endHour);
                  const t = top(course.startHour);
                  const minH = compact ? 14 : 20;
                  return (
                    <div
                      key={`sug-${course.id}`}
                      className="absolute left-[2px] right-[2px] rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        top: t + 1,
                        height: Math.max(h - 2, minH),
                        backgroundColor: course.color + "28",
                        border: `1.5px dashed ${course.color}`,
                        zIndex: 1,
                      }}
                      title={`Add ${course.id} — ${course.name}`}
                      onClick={() => onAddCourse?.(course.id)}
                    >
                      <div
                        className={`px-1.5 py-1 leading-tight ${compact ? "text-[9px]" : "text-[11px]"}`}
                        style={{ color: course.color }}
                      >
                        <div className="font-semibold truncate">+ {course.id}</div>
                        {!compact && (
                          <div className="opacity-70 truncate text-[10px]">{course.name}</div>
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
