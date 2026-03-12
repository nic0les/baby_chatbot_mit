import type { Day } from "../types";

const DAY_MAP: Record<string, Day> = {
  M: "Mon",
  T: "Tue",
  W: "Wed",
  R: "Thu",
  F: "Fri",
};

/** MIT time notation: times 1–7 are PM (13–19), 8–12 are AM (8–12). */
function mitTimeToHour(t: string): number {
  const parts = t.split(".");
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  const hour = h >= 8 ? h : h + 12; // 1-7 → 13-19
  return hour + m / 60;
}

export interface TimeBlock {
  days: Day[];
  startHour: number;
  endHour: number;
}

/**
 * Parse MIT meeting_times_raw strings like:
 *   "Lecture: MW3-4.30 (34-101) Recitation: F10 (26-100)"
 *   "TR9-10.30"  |  "MWF11"  |  "TBA"
 * Returns an array of TimeBlocks (one per distinct lecture/recitation block).
 */
export function parseMeetingTimes(raw: string): TimeBlock[] {
  if (!raw) return [];
  const upper = raw.toUpperCase();
  if (upper.includes("TBA") || upper.includes("ARR") || upper.includes("ARRANGED")) return [];

  const blocks: TimeBlock[] = [];
  // Match patterns like MW3-4.30, F10, TR9-10.30
  const pattern = /([MTWRF]+)(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const dayStr = match[1];
    const timeStr = match[2];

    // Parse day characters one by one
    const days: Day[] = [];
    for (const ch of dayStr) {
      const d = DAY_MAP[ch];
      if (d && !days.includes(d)) days.push(d);
    }
    if (!days.length) continue;

    // Parse time range or single slot
    if (timeStr.includes("-")) {
      const [startStr, endStr] = timeStr.split("-");
      const startHour = mitTimeToHour(startStr);
      const endHour = mitTimeToHour(endStr);
      if (startHour >= 7 && endHour <= 22 && startHour < endHour) {
        blocks.push({ days, startHour, endHour });
      }
    } else {
      const startHour = mitTimeToHour(timeStr);
      if (startHour >= 7 && startHour <= 21) {
        blocks.push({ days, startHour, endHour: startHour + 1 });
      }
    }
  }

  // Deduplicate blocks with identical key
  const seen = new Set<string>();
  return blocks.filter((b) => {
    const key = `${[...b.days].sort().join("")}-${b.startHour}-${b.endHour}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Format a decimal hour like 15.5 → "3:30 PM" */
export function formatHourLabel(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return mins === 0 ? `${h12} ${ampm}` : `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}
