"use client";

import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  MessageSquare,
  Sparkles,
  Settings,
} from "lucide-react";

const navItems = [
  { id: "dashboard",        label: "Dashboard",        icon: LayoutDashboard },
  { id: "schedule",         label: "Schedule",          icon: Calendar },
  { id: "requirements",     label: "Requirements",      icon: BookOpen },
  { id: "chat",             label: "Chat",              icon: MessageSquare },
  { id: "personalization",  label: "Personalization",   icon: Sparkles },
];

interface Props {
  active: string;
  onNav: (id: string) => void;
}

export default function Sidebar({ active, onNav }: Props) {
  return (
    <aside className="w-[200px] bg-surface border-r border-border flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <div
          className="font-serif text-[24px] leading-none"
          style={{ color: "var(--accent)" }}
        >
          MIT
        </div>
        <div
          className="text-[10px] tracking-[0.15em] uppercase mt-1"
          style={{ color: "var(--muted)" }}
        >
          Course Advisor
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-[13px] transition-all duration-150 ${
                isActive
                  ? "text-[#1c1c1c] font-semibold bg-bg"
                  : "text-[#888] hover:text-[#1c1c1c] hover:bg-bg/60"
              }`}
            >
              <Icon
                size={14}
                strokeWidth={isActive ? 2.2 : 1.8}
                color={isActive ? "var(--accent)" : "currentColor"}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-border">
        <button className="flex items-center gap-2 text-[12px] text-[#888] hover:text-[#1c1c1c] transition-colors">
          <Settings size={13} strokeWidth={1.8} />
          Settings
        </button>
      </div>
    </aside>
  );
}
