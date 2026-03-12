"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, PrereqWarning } from "../types";

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm your MIT Course Advisor. Tell me about yourself — your year, major, and what requirements you still need — and I'll help you find the right courses for next semester.",
  timestamp: new Date(),
};

const COURSE_CODE_RE = /\b(\d+\.[A-Z0-9]+[A-Za-z]?)\b/g;

const GIR_TAG_COLORS: Record<string, string> = {
  "CI-H": "#A31F34",
  "CI-M": "#A31F34",
  "HASS-H": "#7B4EA6",
  "HASS-S": "#1B6B8A",
  "HASS-A": "#2D7A4F",
  REST: "#B8660A",
};

interface Props {
  messages: Message[];
  onSend: (content: string) => void;
  onReset: () => void;
  isLoading: boolean;
  prereqWarnings?: PrereqWarning[];
  courseMetadata?: Record<string, Record<string, string>>;
  completedCourses?: string[];
}

function CourseTags({
  content,
  courseMetadata,
  completedCourses,
}: {
  content: string;
  courseMetadata: Record<string, Record<string, string>>;
  completedCourses: string[];
}) {
  const codes = [...new Set([...content.matchAll(COURSE_CODE_RE)].map((m) => m[1]))];
  const tagged = codes
    .map((code) => {
      const meta = courseMetadata[code];
      if (!meta) return null;
      const tags: { label: string; color: string }[] = [];
      const reqTags: string = meta.requirement_tags || "";
      for (const [tag, color] of Object.entries(GIR_TAG_COLORS)) {
        if (reqTags.includes(tag)) tags.push({ label: tag, color });
      }
      const times: string = meta.meeting_times_raw || "";
      if (/\b(1[2-9]|[2-4])\b/.test(times)) tags.push({ label: "afternoon", color: "#555" });
      const prereqText: string = meta.prereq_text || "";
      if (prereqText && prereqText !== "None") {
        const prereqCodes = [...prereqText.matchAll(COURSE_CODE_RE)].map((m) => m[1]);
        const allMet = prereqCodes.every((p) =>
          completedCourses.some((c) => c.toUpperCase() === p.toUpperCase())
        );
        if (completedCourses.length > 0) {
          tags.push(
            allMet
              ? { label: "prereqs met", color: "#2D7A4F" }
              : { label: "check prereqs", color: "#B8660A" }
          );
        }
      }
      if (!tags.length) return null;
      return { code, tags };
    })
    .filter(Boolean) as { code: string; tags: { label: string; color: string }[] }[];

  if (!tagged.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {tagged.map(({ code, tags }) => (
        <div key={code} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono font-medium text-[#555]">{code}</span>
          {tags.map(({ label, color }) => (
            <span
              key={label}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${color}18`, color }}
            >
              {label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot inline-block w-1.5 h-1.5 rounded-full bg-[#bbb]"
        />
      ))}
    </div>
  );
}

function Bubble({
  msg,
  courseMetadata,
  completedCourses,
}: {
  msg: Message;
  courseMetadata?: Record<string, Record<string, string>>;
  completedCourses?: string[];
}) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`msg-in flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed break-words ${
          isUser
            ? "bg-[#1c1c1c] text-white rounded-br-sm"
            : "bg-surface border border-border text-[#1c1c1c] rounded-bl-sm prose prose-sm max-w-none"
        }`}
        style={{
          boxShadow: isUser ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {isUser ? (
          msg.content
        ) : (
          <>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="font-semibold text-[14px] mb-1 mt-2">{children}</h1>,
                h2: ({ children }) => <h2 className="font-semibold text-[13px] mb-1 mt-2">{children}</h2>,
                h3: ({ children }) => <h3 className="font-semibold text-[13px] mb-1 mt-2">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                  <code className="bg-bg px-1 py-0.5 rounded text-[12px] font-mono">{children}</code>
                ),
                hr: () => <hr className="border-border my-2" />,
                a: ({ href, children }) => (
                  <a href={href} className="text-[#A31F34] underline" target="_blank" rel="noreferrer">{children}</a>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {courseMetadata && completedCourses !== undefined && (
              <CourseTags
                content={msg.content}
                courseMetadata={courseMetadata}
                completedCourses={completedCourses}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  onSend,
  onReset,
  isLoading,
  prereqWarnings = [],
  courseMetadata = {},
  completedCourses = [],
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const allMessages = [WELCOME, ...messages];

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0">
        <div>
          <div className="font-semibold text-[13px] text-[#1c1c1c]">
            Course Advisor
          </div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            Powered by Qwen3-8B
          </div>
        </div>
        <button
          onClick={onReset}
          title="Start new conversation"
          className="p-1.5 rounded-lg text-[#aaa] hover:text-[#1c1c1c] hover:bg-bg transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {allMessages.map((msg, i) => (
          <Bubble
            key={i}
            msg={msg}
            courseMetadata={courseMetadata}
            completedCourses={completedCourses}
          />
        ))}
        {prereqWarnings.length > 0 && (
          <div
            className="mb-3 rounded-xl border px-3.5 py-2.5 text-[12px]"
            style={{
              borderColor: "#B8660A40",
              backgroundColor: "#B8660A0A",
              color: "#7A4500",
            }}
          >
            <div className="font-semibold mb-1">Prerequisite check</div>
            {prereqWarnings.map(({ code, unmet }) => (
              <div key={code}>
                <span className="font-mono">{code}</span> may require:{" "}
                {unmet.map((u) => (
                  <span key={u} className="font-mono font-medium">{u} </span>
                ))}
              </div>
            ))}
            <div className="mt-1 text-[11px] opacity-70">
              Upload your CourseRoad to get personalized prereq checks.
            </div>
          </div>
        )}
        {isLoading && (
          <div className="msg-in flex justify-start mb-3">
            <div className="bg-surface border border-border rounded-xl rounded-bl-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {[
            "I'm a 6-3 junior needing a CI-H",
            "What prereqs does 6.3900 need?",
            "Help me plan next semester",
          ].map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-bg hover:bg-surface hover:border-[#ccc] transition-colors text-[#555]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 flex items-end gap-2 px-4 py-3 border-t border-border"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about courses, requirements, scheduling..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-[13px] text-[#1c1c1c] placeholder:text-[#bbb] outline-none focus:border-[#ccc] focus:bg-surface transition-colors"
          style={{ minHeight: 40, maxHeight: 120 }}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-30"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
