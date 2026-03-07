"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import type { Message } from "../types";

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm your MIT Course Advisor. Tell me about yourself — your year, major, and what requirements you still need — and I'll help you find the right courses for next semester.",
  timestamp: new Date(),
};

interface Props {
  messages: Message[];
  onSend: (content: string) => void;
  onReset: () => void;
  isLoading: boolean;
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

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`msg-in flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-[#1c1c1c] text-white rounded-br-sm"
            : "bg-surface border border-border text-[#1c1c1c] rounded-bl-sm"
        }`}
        style={{
          boxShadow: isUser
            ? "none"
            : "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, onSend, onReset, isLoading }: Props) {
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
            Powered by Claude
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
          <Bubble key={i} msg={msg} />
        ))}
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
