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
  Flame,
  BookOpen
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
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#f5f5f5",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: collapsed ? 72 : 240,
          minWidth: collapsed ? 72 : 240,
          flexShrink: 0,
          background: "linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          transition: "width 0.3s ease, min-width 0.3s ease",
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0 16px",
            height: 64,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "rgba(249,115,22,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Flame style={{ width: 16, height: 16, color: "#f97316" }} />
            </div>
            {!collapsed && (
              <span style={{ color: "#f5f5f5", fontWeight: 600, fontSize: 14, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                NEXUS AI
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#555",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 6,
              flexShrink: 0,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#f97316"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed
              ? <ChevronRight style={{ width: 16, height: 16 }} />
              : <ChevronLeft style={{ width: 16, height: 16 }} />}
            {collapsed
              ? <ChevronRight style={{ width: 16, height: 16 }} />
              : <ChevronLeft style={{ width: 16, height: 16 }} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? "#f97316" : "#888",
                  background: isActive ? "rgba(249,115,22,0.12)" : "transparent",
                  border: `1px solid ${isActive ? "rgba(249,115,22,0.3)" : "transparent"}`,
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(249,115,22,0.07)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Status */}
        <div style={{ padding: 16, flexShrink: 0 }}>
          {!collapsed && (
            <div
              style={{
                borderRadius: 12,
                padding: 16,
                background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.03))",
                border: "1px solid rgba(249,115,22,0.15)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f97316", marginBottom: 4 }}>System Status</p>
              <p style={{ fontSize: 11, color: "#555" }}>All systems operational</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
                  boxShadow: "0 0 8px rgba(34,197,94,0.6)"
                }} />
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>Online</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          background: "#0a0a0a",
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}