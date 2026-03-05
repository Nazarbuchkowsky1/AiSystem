import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart3,
  Bot,
  Wrench,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Analytics", icon: BarChart3, page: "Analytics" },
  { name: "Agents", icon: Bot, page: "Agents" },
  { name: "Tools", icon: Wrench, page: "Tools" },
  { name: "Calendar", icon: Calendar, page: "Calendar" },
  { name: "Settings", icon: Settings, page: "Settings" },
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col border-r transition-all duration-300 ease-in-out ${
          collapsed ? "w-[72px]" : "w-[240px]"
        }`}
        style={{
          background: "linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 100%)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
            <Flame className="w-4 h-4" style={{ color: "var(--accent)" }} />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-wide" style={{ color: "var(--text-primary)" }}>
              NEXUS AI
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent text-sm font-medium transition-all ${
                  isActive ? "active" : ""
                }`}
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border flex items-center justify-center z-10 transition-colors hover:border-orange-500/30"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* Bottom Glow */}
        <div className="px-4 py-4">
          {!collapsed && (
            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(249, 115, 22, 0.03))",
                border: "1px solid rgba(249, 115, 22, 0.15)",
              }}
            >
              <div
                className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-30"
                style={{ background: "radial-gradient(circle, rgba(249, 115, 22, 0.4), transparent)" }}
              />
              <p className="text-xs font-medium mb-1" style={{ color: "var(--accent)" }}>System Status</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>All systems operational</p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="glow-dot" style={{ width: 6, height: 6 }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--accent)" }}>Online</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" style={{ background: "var(--bg-primary)" }}>
        {children}
      </main>
    </div>
  );
}