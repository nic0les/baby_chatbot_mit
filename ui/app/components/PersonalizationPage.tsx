"use client";

import { useState, useRef, useEffect } from "react";
import { X, Edit2, Trash2, ArrowRight, Send } from "lucide-react";
import type { PersonalizationMemory } from "../types";

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  PersonalizationMemory["category"],
  { label: string; color: string }
> = {
  schedule:  { label: "Schedule",  color: "#4A7FC1" },
  learning:  { label: "Learning",  color: "#4E9E6E" },
  workload:  { label: "Workload",  color: "#C97B4B" },
  interests: { label: "Interests", color: "#9171C7" },
  other:     { label: "Other",     color: "#888888" },
};

// ── Quick form types ─────────────────────────────────────────────────────────
interface QuickForm {
  schedule: "morning" | "afternoon" | "none";
  format: string[];
  workStyle: "psets" | "projects" | "papers" | "mixed";
  intensity: "light" | "medium" | "intense";
  interests: string[];
  approach: "breadth" | "depth" | "balance";
}

const SCHEDULE_LABELS: Record<QuickForm["schedule"], string> = {
  morning:   "Morning person, prefers 8am–12pm classes",
  afternoon: "Prefers afternoon or evening classes (12pm+)",
  none:      "No strong schedule preference",
};
const WORKSTYLE_LABELS: Record<QuickForm["workStyle"], string> = {
  psets:    "Problem sets and problem-based learning",
  projects: "Projects and hands-on building",
  papers:   "Papers and readings",
  mixed:    "Mixed — comfortable with any style",
};
const INTENSITY_LABELS: Record<QuickForm["intensity"], string> = {
  light:   "Light (~36 units, ~3 courses)",
  medium:  "Medium (~48 units, ~4 courses)",
  intense: "Intense (~54 units, 4–5 courses)",
};
const APPROACH_LABELS: Record<QuickForm["approach"], string> = {
  breadth: "Broad exploration — try many areas",
  depth:   "Deep specialization in one area",
  balance: "Balanced — some depth, some exploration",
};

const MAX_USER_TURNS = 5;

const INITIAL_GREETING =
  "Welcome! I'd love to learn about your learning style so I can give you better course recommendations. Let's start — are you more of a morning person who likes early classes, or do you prefer afternoons and evenings?";

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  memories: PersonalizationMemory[];
  onMemoriesChange: (m: PersonalizationMemory[]) => void;
  onClearAll: () => void;
  onDone: () => void;
}

// ── Memory card ──────────────────────────────────────────────────────────────
function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: PersonalizationMemory;
  onEdit: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = CATEGORY_CONFIG[memory.category];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.value);

  function save() {
    if (draft.trim()) onEdit(memory.id, draft.trim());
    setEditing(false);
  }

  return (
    <div
      className="group rounded-lg border border-border p-3 relative"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
        backgroundColor: `${cfg.color}0d`,
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: cfg.color }}
      >
        {memory.key}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="text-[12px] text-[#444] bg-transparent border-b border-[#ccc] outline-none w-full pr-10"
        />
      ) : (
        <div className="text-[12px] text-[#444] leading-relaxed pr-10">
          {memory.value}
        </div>
      )}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setDraft(memory.value); setEditing(true); }}
          className="p-0.5 rounded text-[#aaa] hover:text-[#555] hover:bg-white transition-colors"
          title="Edit"
        >
          <Edit2 size={11} />
        </button>
        <button
          onClick={() => onDelete(memory.id)}
          className="p-0.5 rounded text-[#aaa] hover:text-[#C1496A] hover:bg-white transition-colors"
          title="Delete"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PersonalizationPage({
  memories,
  onMemoriesChange,
  onClearAll,
  onDone,
}: Props) {
  // Quick form
  const [form, setForm] = useState<QuickForm>({
    schedule: "none",
    format: [],
    workStyle: "mixed",
    intensity: "medium",
    interests: [],
    approach: "balance",
  });
  const [formSaved, setFormSaved] = useState(false);

  // Interview chat
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([{ role: "assistant", content: INITIAL_GREETING }]);
  const [chatInput, setChatInput] = useState("");
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [interviewDone, setInterviewDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore done state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem("mit_advisor_onboarding_done");
      if (done === "true") setInterviewDone(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isLoading]);

  // ── Form helpers ─────────────────────────────────────────────────────────
  function toggleFormat(f: string) {
    setForm((prev) => ({
      ...prev,
      format: prev.format.includes(f)
        ? prev.format.filter((x) => x !== f)
        : [...prev.format, f],
    }));
  }

  function toggleInterest(i: string) {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(i)
        ? prev.interests.filter((x) => x !== i)
        : [...prev.interests, i],
    }));
  }

  function handleFormSave() {
    const formMemories: PersonalizationMemory[] = [];

    if (form.schedule !== "none") {
      formMemories.push({
        id: `form_schedule_${Date.now()}`,
        key: "Class schedule",
        value: SCHEDULE_LABELS[form.schedule],
        category: "schedule",
      });
    }
    if (form.format.length > 0) {
      formMemories.push({
        id: `form_format_${Date.now()}`,
        key: "Class format",
        value: form.format.join(", "),
        category: "learning",
      });
    }
    formMemories.push({
      id: `form_workstyle_${Date.now()}`,
      key: "Work style",
      value: WORKSTYLE_LABELS[form.workStyle],
      category: "workload",
    });
    formMemories.push({
      id: `form_intensity_${Date.now()}`,
      key: "Semester workload",
      value: INTENSITY_LABELS[form.intensity],
      category: "workload",
    });
    if (form.interests.length > 0) {
      formMemories.push({
        id: `form_interests_${Date.now()}`,
        key: "Academic interests",
        value: form.interests.join(", "),
        category: "interests",
      });
    }
    formMemories.push({
      id: `form_approach_${Date.now()}`,
      key: "Learning approach",
      value: APPROACH_LABELS[form.approach],
      category: "interests",
    });

    // Merge: replace memories with matching keys, keep others
    const formKeys = new Set(formMemories.map((m) => m.key));
    const kept = memories.filter((m) => !formKeys.has(m.key));
    onMemoriesChange([...kept, ...formMemories]);
    setFormSaved(true);
    setTimeout(() => setFormSaved(false), 2000);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function handleChatSend() {
    const content = chatInput.trim();
    if (!content || isLoading || interviewDone) return;

    const newTurnCount = userTurnCount + 1;
    const isLastTurn = newTurnCount >= MAX_USER_TURNS;

    const updated = [...chatMessages, { role: "user" as const, content }];
    setChatMessages(updated);
    setChatInput("");
    setUserTurnCount(newTurnCount);
    setIsLoading(true);

    try {
      const res = await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, is_last_turn: isLastTurn }),
      });

      const data = await res.json();
      const assistantContent =
        data.content ||
        "Thanks for sharing! Your preferences have been noted.";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantContent },
      ]);

      if (data.done && data.memories) {
        const chatMems = data.memories as PersonalizationMemory[];
        const chatKeys = new Set(chatMems.map((m) => m.key));
        const kept = memories.filter((m) => !chatKeys.has(m.key));
        onMemoriesChange([...kept, ...chatMems]);
        markDone();
      } else if (isLastTurn) {
        markDone();
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I had trouble connecting. You can use the quick form above to save your preferences!",
        },
      ]);
      if (isLastTurn) markDone();
    } finally {
      setIsLoading(false);
    }
  }

  function markDone() {
    setInterviewDone(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("mit_advisor_onboarding_done", "true");
    }
  }

  // ── Memory card callbacks ────────────────────────────────────────────────
  function handleEditMemory(id: string, value: string) {
    onMemoriesChange(
      memories.map((m) => (m.id === id ? { ...m, value } : m))
    );
  }

  function handleDeleteMemory(id: string) {
    onMemoriesChange(memories.filter((m) => m.id !== id));
  }

  const turnsLeft = MAX_USER_TURNS - userTurnCount;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4 min-w-0">
      {/* Header */}
      <div>
        <h1 className="font-serif text-[26px] leading-none text-[#1c1c1c]">
          Personalization
        </h1>
        <p className="text-[13px] text-[#888] mt-1.5">
          Tell us about your learning style to get better course recommendations.
        </p>
      </div>

      {/* ── Quick Setup ──────────────────────────────────────────────────── */}
      <div
        className="bg-surface rounded-xl border border-border"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <div>
            <div className="font-serif text-[15px] text-[#1c1c1c]">
              Quick Setup
            </div>
            <div className="text-[11px] text-[#aaa] mt-0.5">
              A few quick questions to get started
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {/* Schedule */}
            <FormSection label="When do you prefer classes?">
              {(
                [
                  { val: "morning",   label: "Morning (8am – 12pm)" },
                  { val: "afternoon", label: "Afternoon / evening (12pm+)" },
                  { val: "none",      label: "No strong preference" },
                ] as const
              ).map(({ val, label }) => (
                <RadioOption
                  key={val}
                  name="schedule"
                  value={val}
                  label={label}
                  checked={form.schedule === val}
                  onChange={() => setForm((f) => ({ ...f, schedule: val }))}
                />
              ))}
            </FormSection>

            {/* Class format */}
            <FormSection label="Preferred class format">
              {["Lectures", "Labs", "Seminars", "Recitations"].map((f) => (
                <CheckOption
                  key={f}
                  label={f}
                  checked={form.format.includes(f)}
                  onChange={() => toggleFormat(f)}
                />
              ))}
            </FormSection>

            {/* Work style */}
            <FormSection label="Preferred work style">
              {(
                [
                  { val: "psets",    label: "Problem sets" },
                  { val: "projects", label: "Projects & building" },
                  { val: "papers",   label: "Papers & readings" },
                  { val: "mixed",    label: "Mixed / no preference" },
                ] as const
              ).map(({ val, label }) => (
                <RadioOption
                  key={val}
                  name="workStyle"
                  value={val}
                  label={label}
                  checked={form.workStyle === val}
                  onChange={() => setForm((f) => ({ ...f, workStyle: val }))}
                />
              ))}
            </FormSection>

            {/* Interests */}
            <FormSection label="Academic interests">
              {[
                "Theory / Math",
                "Systems / Engineering",
                "Applied / Industry",
                "Humanities / Social science",
              ].map((i) => (
                <CheckOption
                  key={i}
                  label={i}
                  checked={form.interests.includes(i)}
                  onChange={() => toggleInterest(i)}
                />
              ))}
            </FormSection>

            {/* Intensity */}
            <FormSection label="Semester intensity">
              {(
                [
                  { val: "light",   label: "Light (~36 units, ~3 courses)" },
                  { val: "medium",  label: "Medium (~48 units, ~4 courses)" },
                  { val: "intense", label: "Intense (~54 units, 4–5 courses)" },
                ] as const
              ).map(({ val, label }) => (
                <RadioOption
                  key={val}
                  name="intensity"
                  value={val}
                  label={label}
                  checked={form.intensity === val}
                  onChange={() => setForm((f) => ({ ...f, intensity: val }))}
                />
              ))}
            </FormSection>

            {/* Approach */}
            <FormSection label="Breadth vs depth">
              {(
                [
                  { val: "breadth", label: "Broad exploration" },
                  { val: "depth",   label: "Deep specialization" },
                  { val: "balance", label: "Balanced" },
                ] as const
              ).map(({ val, label }) => (
                <RadioOption
                  key={val}
                  name="approach"
                  value={val}
                  label={label}
                  checked={form.approach === val}
                  onChange={() => setForm((f) => ({ ...f, approach: val }))}
                />
              ))}
            </FormSection>
          </div>

          <div className="mt-5 pt-4 border-t border-border flex items-center gap-3">
            <button
              onClick={handleFormSave}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Save Quick Preferences
            </button>
            {formSaved && (
              <span className="text-[11px] text-[#4E9E6E] font-medium">
                Saved!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Your Learning Profile (memory cards) ────────────────────────── */}
      <div
        className="bg-surface rounded-xl border border-border"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <div className="font-serif text-[15px] text-[#1c1c1c]">
              Your Learning Profile
            </div>
            <div className="text-[11px] text-[#aaa] mt-0.5">
              {memories.length}{" "}
              {memories.length === 1 ? "preference" : "preferences"} saved —
              hover to edit or delete
            </div>
          </div>
          {memories.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 text-[11px] text-[#C1496A] hover:opacity-75 transition-opacity"
            >
              <Trash2 size={11} />
              Clear all
            </button>
          )}
        </div>

        <div className="p-5">
          {memories.length === 0 ? (
            <p className="text-[12px] text-[#bbb] text-center py-4">
              No preferences saved yet. Fill out the quick form above or chat
              below!
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {memories.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  onEdit={handleEditMemory}
                  onDelete={handleDeleteMemory}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Interview Chat ───────────────────────────────────────────────── */}
      <div
        className="bg-surface rounded-xl border border-border"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <div className="font-serif text-[15px] text-[#1c1c1c]">
              Chat with the Advisor
            </div>
            <div className="text-[11px] text-[#aaa] mt-0.5">
              {interviewDone
                ? "Interview complete — preferences recorded above"
                : `${turnsLeft} ${turnsLeft === 1 ? "response" : "responses"} remaining`}
            </div>
          </div>
          {interviewDone && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: "rgba(78,158,110,0.12)",
                color: "#4E9E6E",
              }}
            >
              Complete
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="max-h-80 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                  msg.role === "user"
                    ? "text-white rounded-br-sm"
                    : "text-[#444] bg-bg border border-border rounded-bl-sm"
                }`}
                style={
                  msg.role === "user"
                    ? { backgroundColor: "var(--accent)" }
                    : {}
                }
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-bg border border-border rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[12px] text-[#aaa]">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input or completion state */}
        {interviewDone ? (
          <div className="px-5 py-4 border-t border-border">
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                backgroundColor: "rgba(78,158,110,0.07)",
                border: "1px solid rgba(78,158,110,0.25)",
              }}
            >
              <div className="text-[13px] font-semibold text-[#3d8a5e] mb-2.5">
                Preferences saved — here&apos;s how to use MIT Course Advisor:
              </div>
              <div className="text-[12px] text-[#555] leading-relaxed space-y-1.5">
                <p>
                  <strong>Dashboard</strong> — Overview of your schedule,
                  requirements, and quick-access preferences panel.
                </p>
                <p>
                  <strong>Schedule</strong> — Weekly course calendar. Advisor
                  suggestions appear here after each chat.
                </p>
                <p>
                  <strong>Requirements</strong> — Track GIR and major progress.
                  Upload your <strong>CourseRoad (.road)</strong> file to
                  auto-populate.
                </p>
                <p>
                  <strong>Chat</strong> — Ask anything: what to take next
                  semester, course comparisons, workload advice, MIT life.
                </p>
                <p>
                  <strong>Preferences</strong> — Come back here anytime to
                  edit cards, or use the Prioritize / Avoid panel on the
                  Dashboard for quick updates.
                </p>
              </div>
            </div>
            <button
              onClick={onDone}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Go to Dashboard
              <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          <div className="px-5 pb-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleChatSend()
                }
                placeholder="Tell us about yourself..."
                disabled={isLoading}
                className="flex-1 text-[12px] bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-[#ccc] placeholder:text-[#ccc] disabled:opacity-50"
              />
              <button
                onClick={handleChatSend}
                disabled={isLoading || !chatInput.trim()}
                className="p-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <Send size={13} />
              </button>
            </div>
            {turnsLeft === 1 && (
              <p className="text-[10px] text-[#aaa] mt-1.5">
                Last response — the advisor will wrap up after this.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helper components ──────────────────────────────────────────────────
function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa] mb-0.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function RadioOption({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="accent-[#A31F34] w-3.5 h-3.5"
      />
      <span className="text-[12px] text-[#444]">{label}</span>
    </label>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[#A31F34] w-3.5 h-3.5"
      />
      <span className="text-[12px] text-[#444]">{label}</span>
    </label>
  );
}
