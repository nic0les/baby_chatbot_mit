"use client";

import { useRef, useState } from "react";
import { Maximize2, Upload } from "lucide-react";
import Sidebar from "./components/Sidebar";
import RequirementsPanel, {
  DEFAULT_REQUIREMENTS,
} from "./components/RequirementsPanel";
import ScheduleGrid from "./components/ScheduleGrid";
import { parseMeetingTimes } from "./utils/parseMeetingTimes";
import { buildRoadRequirements, parseMajorCode } from "./utils/majorRequirements";
import ChatPanel from "./components/ChatPanel";
import FullscreenModal from "./components/FullscreenModal";
import PreferencesPanel from "./components/PreferencesPanel";
import UnitLoadBar from "./components/UnitLoadBar";
import type {
  Message,
  RequirementGroup,
  CourseBlock,
  StudentProfile,
  PrereqWarning,
  Preferences,
} from "./types";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "MEng"] as const;

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  schedule: "Weekly Schedule",
  requirements: "Graduation Requirements",
  chat: "Course Advisor",
};

// ── Suggestions tray ───────────────────────────────────────────────────────────
function SuggestionsTray({
  courses,
  onAdd,
  compact = false,
}: {
  courses: CourseBlock[];
  onAdd: (id: string) => void;
  compact?: boolean;
}) {
  if (!courses.length) return null;
  return (
    <div className={`${compact ? "mb-2" : "mb-3"}`}>
      <div
        className={`${compact ? "text-[9px]" : "text-[10px]"} text-[#aaa] uppercase tracking-wider mb-1.5`}
      >
        Advisor Suggestions — click + to add
      </div>
      <div className="flex flex-wrap gap-1.5">
        {courses.map((course) => (
          <div
            key={course.id}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${compact ? "text-[9px]" : "text-[11px]"}`}
            style={{ borderColor: course.color + "60", backgroundColor: course.color + "0d" }}
          >
            <span className="font-semibold" style={{ color: course.color }}>{course.id}</span>
            {!compact && (
              <span className="text-[#666] max-w-[110px] truncate">{course.name}</span>
            )}
            <span className="text-[#aaa]">
              {course.startHour > 0 ? formatTimeShort(course.startHour, course.days) : "TBA"}
            </span>
            <button
              onClick={() => onAdd(course.id)}
              className="w-4 h-4 flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: course.color }}
              title={`Add ${course.id} to schedule`}
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeShort(startHour: number, days: CourseBlock["days"]): string {
  const h = Math.floor(startHour);
  const m = Math.round((startHour - h) * 60);
  const ampm = startHour >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const timeStr = m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
  const dayStr = days.map((d) => d.slice(0, 1)).join("");
  return `${dayStr} ${timeStr}`;
}

// ── Panel card wrapper ─────────────────────────────────────────────────────────
function PanelCard({
  title,
  subtitle,
  onExpand,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  onExpand: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="bg-surface rounded-xl border border-border flex flex-col overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <div className="font-serif text-[15px] text-[#1c1c1c]">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-[#aaa] mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={onExpand}
            className="p-1.5 rounded-lg text-[#aaa] hover:text-[#1c1c1c] hover:bg-bg transition-colors"
            title="Expand"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-5">{children}</div>
    </div>
  );
}

// ── Profile bar ────────────────────────────────────────────────────────────────
function ProfileBar({
  profile,
  onChange,
}: {
  profile: StudentProfile;
  onChange: (p: StudentProfile) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <input
        className="text-[13px] font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-[#ccc] outline-none transition-colors w-32"
        value={profile.name}
        onChange={(e) => onChange({ ...profile, name: e.target.value })}
        placeholder="Your name"
      />
      <span className="text-[#ddd]">·</span>
      <select
        className="text-[13px] bg-transparent border-b border-transparent hover:border-border focus:border-[#ccc] outline-none cursor-pointer transition-colors"
        value={profile.year}
        onChange={(e) =>
          onChange({ ...profile, year: e.target.value as StudentProfile["year"] })
        }
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <span className="text-[#ddd]">·</span>
      <input
        className="text-[13px] bg-transparent border-b border-transparent hover:border-border focus:border-[#ccc] outline-none transition-colors w-24"
        value={profile.major}
        onChange={(e) => onChange({ ...profile, major: e.target.value })}
        placeholder="Major"
      />
    </div>
  );
}

// ── Units badge ────────────────────────────────────────────────────────────────
function UnitsBadge({ courses }: { courses: CourseBlock[] }) {
  const total = courses.reduce((s, c) => s + c.units, 0);
  const over = total > 54;
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full font-medium"
      style={{
        backgroundColor: over ? "rgba(163,31,52,0.10)" : "rgba(74,158,110,0.10)",
        color: over ? "var(--accent)" : "#3d8a5e",
      }}
    >
      {total} units
    </span>
  );
}

// ── Page header shared across views ───────────────────────────────────────────
function PageHeader({
  activeNav,
  profile,
  onProfileChange,
  schedule,
}: {
  activeNav: string;
  profile: StudentProfile;
  onProfileChange: (p: StudentProfile) => void;
  schedule: CourseBlock[];
}) {
  const totalUnits = schedule.reduce((s, c) => s + c.units, 0);
  const isDashboard = activeNav === "dashboard";

  return (
    <div className="flex items-center justify-between shrink-0 pb-1">
      <div>
        <h1 className="font-serif text-[26px] leading-none text-[#1c1c1c]">
          {PAGE_TITLES[activeNav] ?? "MIT Course Advisor"}
        </h1>
        {isDashboard && (
          <div className="mt-2">
            <ProfileBar profile={profile} onChange={onProfileChange} />
          </div>
        )}
      </div>

      {isDashboard && (
        <div className="flex items-center gap-3">
          <div
            className="text-center px-4 py-2.5 rounded-xl border border-border bg-surface"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div className="text-[22px] font-semibold tabular-nums text-[#1c1c1c]">
              {schedule.length}
            </div>
            <div className="text-[10px] text-[#aaa] uppercase tracking-wide">
              Courses
            </div>
          </div>
          <div
            className="text-center px-4 py-2.5 rounded-xl border border-border bg-surface"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div
              className="text-[22px] font-semibold tabular-nums"
              style={{ color: totalUnits > 54 ? "var(--accent)" : "#1c1c1c" }}
            >
              {totalUnits}
            </div>
            <div className="text-[10px] text-[#aaa] uppercase tracking-wide">
              Units
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requirements, setRequirements] =
    useState<RequirementGroup[]>(DEFAULT_REQUIREMENTS);
  const [schedule, setSchedule] = useState<CourseBlock[]>([]);
  const [suggestedCourses, setSuggestedCourses] = useState<CourseBlock[]>([]);
  const [fullscreen, setFullscreen] = useState<
    "requirements" | "schedule" | null
  >(null);
  const [profile, setProfile] = useState<StudentProfile>({
    name: "",
    year: "Freshman",
    major: "",
  });
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const completedCoursesRef = useRef<string[]>([]);
  const [prereqWarnings, setPrereqWarnings] = useState<PrereqWarning[]>([]);
  const [courseMetadata, setCourseMetadata] = useState<Record<string, Record<string, string>>>({});
  const [preferences, setPreferences] = useState<Preferences>({ prioritize: [], avoid: [] });
  const [feedbackState, setFeedbackState] = useState<Record<number, "up" | "down">>({});

  const COURSE_REGEX = /\b(\d+\.[A-Z0-9]+[A-Za-z]?)\b/g;

  const PALETTE = ["#4A7FC1", "#4E9E6E", "#9171C7", "#C97B4B", "#C1496A", "#5BA3A0"];
  function colorForCode(code: string): string {
    let hash = 0;
    for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }
  function parseUnits(u: string): number {
    if (!u) return 0;
    const parts = u.split("-");
    if (parts.length === 3) return parts.reduce((s, p) => s + (parseInt(p) || 0), 0);
    return parseInt(u) || 0;
  }

  async function fetchSuggestedCourses(codes: string[]) {
    const results = await Promise.all(
      codes.map(async (code) => {
        try {
          const res = await fetch(`/api/prereqs/${encodeURIComponent(code)}`);
          const courses = (await res.json()) as Record<string, string>[];
          if (!courses.length) return null;
          return { code, meta: courses[0] };
        } catch {
          return null;
        }
      })
    );

    const alreadyInSchedule = new Set(schedule.map((c) => c.id.toUpperCase()));
    const alreadyCompleted = new Set(completedCoursesRef.current.map((c) => c.toUpperCase()));
    const suggested: CourseBlock[] = [];

    for (const result of results.filter(Boolean) as { code: string; meta: Record<string, string> }[]) {
      const { code, meta } = result;
      if (alreadyInSchedule.has(code.toUpperCase())) continue;
      if (alreadyCompleted.has(code.toUpperCase())) continue;
      const times = parseMeetingTimes(meta.meeting_times_raw || "");
      const primary = times[0];
      suggested.push({
        id: code,
        name: meta.title || code,
        days: primary?.days ?? [],
        startHour: primary?.startHour ?? 0,
        endHour: primary?.endHour ?? 0,
        color: colorForCode(code),
        units: parseUnits(meta.units || "0"),
      });
    }

    setSuggestedCourses(suggested);
  }

  /** Normalize a course code for comparison: uppercase, strip trailing zeros after dot.
   *  e.g. "6.3900" → "6.390", "18.06" → "18.06", "6.100A" → "6.100A" */
  function normalizeCode(code: string): string {
    return code.toUpperCase().replace(/(\.\d*[1-9])0+\b/, "$1");
  }

  function hasCompleted(code: string): boolean {
    const norm = normalizeCode(code);
    return completedCoursesRef.current.some((c) => normalizeCode(c) === norm);
  }

  /**
   * Parse prereq_text into AND-groups of OR-alternatives.
   * Each returned group is a list of course codes; satisfying ANY one satisfies that group.
   * All groups must be satisfied.
   *
   * Key heuristic: within a clause split by "and", if that clause contains "or"
   * then commas are OR separators. If not, commas are additional AND requirements
   * (Oxford-comma style: "6.1020, 6.1210, and 6.1910" → all three required).
   */
  function parsePrereqGroups(prereqText: string): string[][] {
    if (!prereqText || prereqText.toLowerCase() === "none") return [];

    const cleaned = prereqText
      .replace(/permission of (?:instructor|department)/gi, "")
      .replace(/;/g, " ");

    const andParts = cleaned.split(/\band\b/i);
    const groups: string[][] = [];
    const codeRe = /\b(\d+\.[A-Z0-9]+[A-Za-z]?)\b/g;

    for (const part of andParts) {
      const hasOr = /\bor\b/i.test(part);

      if (hasOr) {
        // Commas within this clause are OR-separators
        const alts = part.split(/\bor\b|,/i);
        const codes = alts
          .flatMap((s) => [...s.matchAll(codeRe)].map((m) => m[1]))
          .filter(Boolean);
        if (codes.length) groups.push([...new Set(codes)]);
      } else {
        // No "or" in this clause — each comma-delimited item is individually required
        for (const sub of part.split(",")) {
          const codes = [...sub.matchAll(codeRe)].map((m) => m[1]).filter(Boolean);
          if (codes.length) groups.push(codes);
        }
      }
    }
    return groups;
  }

  async function checkPrereqs(text: string) {
    if (!completedCoursesRef.current.length) return;
    const codes = [...new Set([...text.matchAll(COURSE_REGEX)].map((m) => m[1]))];
    if (!codes.length) return;

    const results = await Promise.all(
      codes.map(async (code) => {
        try {
          const res = await fetch(`/api/prereqs/${encodeURIComponent(code)}`);
          const courses = (await res.json()) as Record<string, string>[];
          if (!courses.length) return null;
          const prereqText = courses[0].prereq_text || "";
          const groups = parsePrereqGroups(prereqText);
          if (!groups.length) return null;

          // For each AND-group, check if at least one OR-alternative is completed
          const unmetGroups = groups.filter(
            (group) => !group.some((p) => hasCompleted(p))
          );

          if (!unmetGroups.length) return null;
          // Report the first (shortest) option from each unmet group
          const unmet = unmetGroups.map((g) =>
            g.length === 1 ? g[0] : `(${g.join(" or ")})`
          );
          return { code, unmet };
        } catch {
          return null;
        }
      })
    );
    const warnings = results.filter(Boolean) as PrereqWarning[];
    setPrereqWarnings(warnings);
  }

  async function fetchCourseMetadata(query: string) {
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&n=20`
      );
      const courses = (await res.json()) as Record<string, string>[];
      const meta: Record<string, Record<string, string>> = {};
      for (const c of courses) {
        if (c.subject_code) meta[c.subject_code] = c;
      }
      setCourseMetadata((prev) => ({ ...prev, ...meta }));
    } catch {
      // best-effort
    }
  }

  // ── Chat send (streaming) ────────────────────────────────────────────────────
  async function handleSend(content: string) {
    const userMsg: Message = { role: "user", content, timestamp: new Date() };
    const next = [...messages, userMsg];
    setMessages(next);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          profile: { ...profile, completed_courses: completedCourses },
          preferences,
        }),
      });

      // Non-streaming error response (backend offline, etc.)
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        setMessages([...next, { role: "assistant", content: `Error: ${data.error}`, timestamp: new Date() }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fullContent += decoder.decode(value, { stream: true });

        // Hide typing indicator and show streaming message on first chunk
        if (!started) {
          started = true;
          setIsLoading(false);
        }

        setMessages([
          ...next,
          { role: "assistant", content: fullContent, timestamp: new Date() },
        ]);
      }

      if (!started) {
        setMessages([...next, { role: "assistant", content: "No response received.", timestamp: new Date() }]);
      } else {
        // Post-stream: check prereqs, fetch metadata, build suggestions
        setPrereqWarnings([]);
        const suggestedCodes = [...new Set([...fullContent.matchAll(COURSE_REGEX)].map((m) => m[1]))];
        await Promise.all([
          checkPrereqs(fullContent),
          fetchCourseMetadata(content),
          fetchSuggestedCourses(suggestedCodes),
        ]);
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Network error — please try again.", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // ── CourseRoad upload ────────────────────────────────────────────────────────
  function handleCourseroadUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const coursesOfStudy: string[] = data.coursesOfStudy ?? [];
        const subjects: Array<{ subject_id: string; title: string; semester: number; units: number }> =
          data.selectedSubjects ?? [];

        // 1. Update completed courses for prereq checking
        const codes = subjects.map((s) => s.subject_id);
        setCompletedCourses(codes);
        completedCoursesRef.current = codes;

        // 2. Update profile major from the road
        const majorCode = parseMajorCode(coursesOfStudy);
        if (majorCode) {
          setProfile((prev) => ({ ...prev, major: majorCode }));
        }

        // 3. Build and set requirements directly from road data
        const progressAssertions: Record<string, { substitutions?: string[] }> =
          data.progressAssertions ?? {};
        setRequirements(buildRoadRequirements(subjects, majorCode, progressAssertions));

        // 4. Send a concise message to the LLM for course advice
        const latestSem = Math.max(...subjects.map((s) => s.semester).filter((s) => s < 20));
        const recentCodes = subjects
          .filter((s) => s.semester >= latestSem - 1)
          .map((s) => s.subject_id)
          .join(", ");
        handleSend(
          `I uploaded my CourseRoad (major: ${majorCode || "unknown"}, ${subjects.length} courses through semester ${latestSem}). ` +
          `Recent courses: ${recentCodes}. What should I take next semester?`
        );
      } catch {
        handleSend("I tried uploading my CourseRoad file but it failed to parse. Can you still help me plan my schedule?");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Course road upload action ─────────────────────────────────────────────
  const courseroadAction = (
    <label
      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-border bg-bg hover:bg-surface cursor-pointer transition-colors text-[#555]"
      title="Upload CourseRoad .road file"
    >
      <Upload size={11} />
      CourseRoad
      <input
        type="file"
        accept=".road,.json"
        className="hidden"
        onChange={handleCourseroadUpload}
      />
    </label>
  );

  // ── Message feedback (thumbs up/down) ────────────────────────────────────────
  async function handleFeedback(msgIndex: number, rating: "up" | "down") {
    setFeedbackState((prev) => ({ ...prev, [msgIndex]: rating }));
    // allMessages = [WELCOME, ...messages], so real message index = msgIndex - 1
    const allMessages = [{ role: "assistant", content: "" }, ...messages];
    const assistantMsg = allMessages[msgIndex];
    // Find the most recent user message before this assistant message
    const userMsg = allMessages.slice(0, msgIndex).reverse().find((m) => m.role === "user");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          message: assistantMsg?.content ?? "",
          user_message: userMsg?.content ?? "",
          profile,
        }),
      });
    } catch {
      // best-effort
    }
  }

  // ── Add suggested course to confirmed schedule ────────────────────────────────
  function handleAddCourse(id: string) {
    const course = suggestedCourses.find((c) => c.id === id);
    if (!course) return;
    setSchedule((prev) => [...prev, course]);
    setSuggestedCourses((prev) => prev.filter((c) => c.id !== id));
  }

  // ── View content ─────────────────────────────────────────────────────────────
  const sharedScrollArea = "flex-1 flex flex-col overflow-y-auto p-5 gap-4 min-w-0";

  function renderContent() {
    switch (activeNav) {
      case "schedule":
        return (
          <div className={sharedScrollArea}>
            <PageHeader activeNav={activeNav} profile={profile} onProfileChange={setProfile} schedule={schedule} />
            <div
              className="bg-surface rounded-xl border border-border flex-1 overflow-hidden flex flex-col"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
                <div className="text-[13px] text-[#aaa]">
                  {schedule.length} courses · {schedule.reduce((s, c) => s + c.units, 0)} units
                </div>
                <UnitsBadge courses={schedule} />
              </div>
              <div className="flex-1 overflow-auto p-4">
                {suggestedCourses.length > 0 && (
                  <div className="mb-4">
                    <SuggestionsTray courses={suggestedCourses} onAdd={handleAddCourse} />
                  </div>
                )}
                <ScheduleGrid
                  courses={schedule}
                  suggestedCourses={suggestedCourses}
                  onAddCourse={handleAddCourse}
                />
              </div>
            </div>
          </div>
        );

      case "requirements":
        return (
          <div className={sharedScrollArea}>
            <PageHeader activeNav={activeNav} profile={profile} onProfileChange={setProfile} schedule={schedule} />
            <div
              className="bg-surface rounded-xl border border-border flex flex-col overflow-hidden"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
                <div className="text-[13px] text-[#aaa]">
                  {profile.major} · {profile.year}
                </div>
                {courseroadAction}
              </div>
              <div className="overflow-auto p-5">
                <RequirementsPanel requirements={requirements} />
              </div>
            </div>
          </div>
        );

      case "chat":
        return (
          <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4">
            <PageHeader activeNav={activeNav} profile={profile} onProfileChange={setProfile} schedule={schedule} />
            <div
              className="flex-1 overflow-hidden rounded-xl border border-border"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              <ChatPanel
                messages={messages}
                onSend={handleSend}
                onReset={() => setMessages([])}
                isLoading={isLoading}
                prereqWarnings={prereqWarnings}
                courseMetadata={courseMetadata}
                completedCourses={completedCourses}
                onFeedback={handleFeedback}
                feedbackState={feedbackState}
              />
            </div>
          </div>
        );

      default: // dashboard
        return (
          <>
            <div className={sharedScrollArea}>
              <PageHeader activeNav={activeNav} profile={profile} onProfileChange={setProfile} schedule={schedule} />

              <PanelCard
                title="Graduation Requirements"
                subtitle={`${profile.major} · ${profile.year}`}
                onExpand={() => setFullscreen("requirements")}
                action={courseroadAction}
              >
                <RequirementsPanel requirements={requirements} compact />
              </PanelCard>

              <PanelCard
                title="Weekly Schedule"
                subtitle={`${schedule.length} courses · ${schedule.reduce((s, c) => s + c.units, 0)} units`}
                onExpand={() => setFullscreen("schedule")}
                action={<UnitsBadge courses={schedule} />}
              >
                <SuggestionsTray
                  courses={suggestedCourses}
                  onAdd={handleAddCourse}
                  compact
                />
                <ScheduleGrid
                  courses={schedule}
                  compact
                  suggestedCourses={suggestedCourses}
                  onAddCourse={handleAddCourse}
                />
                <div className="mt-3">
                  <UnitLoadBar courses={schedule} />
                </div>
              </PanelCard>

              <PanelCard
                title="My Preferences"
                subtitle="Courses & constraints for the advisor"
                onExpand={() => {}}
              >
                <PreferencesPanel
                  preferences={preferences}
                  onChange={setPreferences}
                />
              </PanelCard>
            </div>

            <div className="w-[380px] shrink-0 flex flex-col overflow-hidden gap-0">
              <ChatPanel
                messages={messages}
                onSend={handleSend}
                onReset={() => setMessages([])}
                isLoading={isLoading}
                prereqWarnings={prereqWarnings}
                courseMetadata={courseMetadata}
                completedCourses={completedCourses}
                onFeedback={handleFeedback}
                feedbackState={feedbackState}
              />
            </div>
          </>
        );
    }
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar active={activeNav} onNav={setActiveNav} />

      <div className="flex flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {fullscreen === "requirements" && (
        <FullscreenModal title="Graduation Requirements" onClose={() => setFullscreen(null)}>
          <RequirementsPanel requirements={requirements} />
        </FullscreenModal>
      )}
      {fullscreen === "schedule" && (
        <FullscreenModal title="Weekly Schedule" onClose={() => setFullscreen(null)}>
          {suggestedCourses.length > 0 && (
            <div className="mb-4">
              <SuggestionsTray courses={suggestedCourses} onAdd={handleAddCourse} />
            </div>
          )}
          <ScheduleGrid
            courses={schedule}
            suggestedCourses={suggestedCourses}
            onAddCourse={handleAddCourse}
          />
        </FullscreenModal>
      )}
    </div>
  );
}
