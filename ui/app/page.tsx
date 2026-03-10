"use client";

import { useState } from "react";
import { Maximize2, Upload } from "lucide-react";
import Sidebar from "./components/Sidebar";
import RequirementsPanel, {
  DEFAULT_REQUIREMENTS,
} from "./components/RequirementsPanel";
import ScheduleGrid, { DEFAULT_SCHEDULE } from "./components/ScheduleGrid";
import ChatPanel from "./components/ChatPanel";
import FullscreenModal from "./components/FullscreenModal";
import type {
  Message,
  RequirementGroup,
  CourseBlock,
  StudentProfile,
} from "./types";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "MEng"] as const;

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  schedule: "Weekly Schedule",
  requirements: "Graduation Requirements",
  chat: "Course Advisor",
};

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
  const [schedule, setSchedule] = useState<CourseBlock[]>(DEFAULT_SCHEDULE);
  const [fullscreen, setFullscreen] = useState<
    "requirements" | "schedule" | null
  >(null);
  const [profile, setProfile] = useState<StudentProfile>({
    name: "Student",
    year: "Junior",
    major: "6-4",
  });

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
        body: JSON.stringify({ messages: next, profile }),
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
        // Stream was empty
        setMessages([...next, { role: "assistant", content: "No response received.", timestamp: new Date() }]);
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
        const subjects: Array<{ subject_id: string; title: string; semester: number }> =
          data.selectedSubjects ?? [];
        const summary = subjects
          .map((s) => `${s.subject_id} (${s.title}, sem ${s.semester})`)
          .join(", ");
        handleSend(
          `I uploaded my CourseRoad. Here are my selected subjects: ${summary}. Can you help me plan what to take next?`
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
                <ScheduleGrid courses={schedule} />
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
                <ScheduleGrid courses={schedule} compact />
              </PanelCard>
            </div>

            <div className="w-[380px] shrink-0 flex flex-col overflow-hidden">
              <ChatPanel
                messages={messages}
                onSend={handleSend}
                onReset={() => setMessages([])}
                isLoading={isLoading}
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
          <ScheduleGrid courses={schedule} />
        </FullscreenModal>
      )}
    </div>
  );
}
