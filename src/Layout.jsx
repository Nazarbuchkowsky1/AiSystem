import React, { useState, useEffect } from "react";
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

  BookOpen,
  Menu,
  X,
  Plus
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOverlayClosing, setMobileOverlayClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  // Close mobile menu on page change
  useEffect(() => { setMobileOpen(false); setMobileOverlayClosing(false); }, [currentPageName]);

  // Mobile overlay: wait for fade-out then unmount
  useEffect(() => {
    if (!mobileOverlayClosing) return;
    const id = setTimeout(() => setMobileOverlayClosing(false), 280);
    return () => clearTimeout(id);
  }, [mobileOverlayClosing]);

  const [agentsTab, setAgentsTab] = useState("agents");
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    const handler = (e) => setAgentsTab(e.detail);
    window.addEventListener("agents-tab-change", handler);
    return () => window.removeEventListener("agents-tab-change", handler);
  }, []);
  useEffect(() => {
    const handler = (e) => setModalOpen(e.detail);
    window.addEventListener("modal-open", handler);
    return () => window.removeEventListener("modal-open", handler);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#f5f5f5",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-12px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-12px); opacity: 0; }
        }
        @keyframes layoutPageFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {/* Mobile overlay */}
      {isMobile && (mobileOpen || mobileOverlayClosing) && (
        <div
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
              setMobileOverlayClosing(true);
            }
          }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(4px)",
            opacity: mobileOverlayClosing ? 0 : 1,
            transition: "opacity 0.25s ease-out",
          }}
        />
      )}

      {/* Mobile header bar */}
      {isMobile && !modalOpen && (
        <div style={{
          height: 52, flexShrink: 0, position: "relative", zIndex: 55,
          background: "#0f0f0f", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
        }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "0 8px", height: "100%", WebkitTapHighlightColor: "transparent" }}
          >
            <img src="/logo.png" alt="Lumen" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            <span style={{ color: "#f5f5f5", fontWeight: 600, fontSize: 13, letterSpacing: "0.05em" }}>Lumen</span>
          </button>
          {currentPageName === "Agents" && agentsTab === "agents" && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("mobile-new-agent"))}
              style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 12px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New Agent
            </button>
          )}
          {currentPageName === "Agents" && agentsTab === "knowledge" && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("mobile-new-kb"))}
              style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 12px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New KB
            </button>
          )}
        </div>
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: isMobile ? "fixed" : "relative",
          top: isMobile ? 52 : 0,
          height: isMobile ? "calc(100vh - 52px)" : undefined,
          left: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          width: isMobile ? 240 : collapsed ? 72 : 240,
          minWidth: isMobile ? 240 : collapsed ? 72 : 240,
          flexShrink: 0,
          background: "linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          transition: isMobile ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "width 0.3s ease, min-width 0.3s ease",
          zIndex: isMobile ? 50 : 10,
          transform: isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: isMobile ? "none" : "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 12,
            padding: collapsed ? "0" : "0 16px",
            height: 64,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(249,115,22,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(249,115,22,0.25)",
                cursor: "pointer",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(249,115,22,0.25)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.25)"; }}
              title="Expand sidebar"
            >
              <img src="/logo.png" alt="Lumen" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />
            </button>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <img src="/logo.png" alt="Lumen" style={{ width: 32, height: 32, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                <span style={{ color: "#f5f5f5", fontWeight: 600, fontSize: 14, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  Lumen
                </span>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#555",
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  padding: 6,
                  flexShrink: 0,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#f97316"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
                title="Collapse"
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
                <ChevronLeft style={{ width: 16, height: 16, marginLeft: "-8px" }} />
              </button>
            </>
          )}
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
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(249,115,22,0.07)";
                        e.currentTarget.style.color = "#f97316";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#888";
                      }
                    }}
                  >
                <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                {(isMobile || !collapsed) && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Status */}
        <div style={{ padding: 16, flexShrink: 0 }}>
          {(isMobile || !collapsed) && (
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
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "auto",
          background: "#0a0a0a",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <div
          key={currentPageName}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            animation: "layoutPageFadeIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}