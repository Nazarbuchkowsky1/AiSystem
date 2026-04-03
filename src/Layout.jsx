import React, { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart3,
  Brain,
  Wrench,
  Settings,
  ChevronLeft,
  Plus,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ALL_NAV_ITEMS = [
  { name: "Аналітика", icon: BarChart3, page: "Analytics", adminOnly: true },
  { name: "Агенти", icon: Brain, page: "Agents" },
  { name: "Інструменти", icon: Wrench, page: "Tools" },
  { name: "Налаштування", icon: Settings, page: "Settings" },
];

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOverlayClosing, setMobileOverlayClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin"),
    [user?.role]
  );

  const isAdmin = user?.role === "admin";

  const displayHandle = useMemo(() => {
    const u = user?.telegram_username;
    if (u) return `@${u}`;
    const em = user?.email;
    if (em && !em.startsWith("tg_")) return em.split("@")[0] || "користувач";
    if (user?.display_name) return user.display_name;
    return "користувач";
  }, [user]);

  const roleLabel = user?.role === "admin" ? "Адмін" : "Користувач";

  const avatarLetter = (displayHandle.replace(/^@/, "").charAt(0) || "К").toUpperCase();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMobileOverlayClosing(false);
  }, [currentPageName]);

  useEffect(() => {
    if (!mobileOverlayClosing) return;
    const id = setTimeout(() => setMobileOverlayClosing(false), 280);
    return () => clearTimeout(id);
  }, [mobileOverlayClosing]);

  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    const handler = (e) => setModalOpen(e.detail);
    window.addEventListener("modal-open", handler);
    return () => window.removeEventListener("modal-open", handler);
  }, []);

  const showExpanded = isMobile || !collapsed;

  const accountBlock = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: showExpanded ? 12 : 8,
        padding: showExpanded ? "12px 14px" : "12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        flexDirection: showExpanded ? "row" : "column",
        justifyContent: showExpanded ? "space-between" : "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: showExpanded ? 1 : undefined }}>
        {user?.photo_url ? (
          <img
            src={user.photo_url}
            alt=""
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(249,115,22,0.15)",
              border: "1px solid rgba(249,115,22,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f97316",
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            {avatarLetter}
          </div>
        )}
        {showExpanded && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#f5f5f5",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayHandle}
            </div>
            <div style={{ fontSize: 11, color: "#a3a3a3", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#f97316",
                  flexShrink: 0,
                  boxShadow: "0 0 6px rgba(249,115,22,0.5)",
                }}
              />
              {roleLabel}
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => logout(true)}
        title="Вийти"
        className="layout-collapse-btn"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          flexShrink: 0,
        }}
      >
        <LogOut style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );

  const footerBlock = (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: collapsed && !isMobile ? "12px 8px" : "12px 14px",
        flexShrink: 0,
        display: "flex",
        flexDirection: collapsed && !isMobile ? "column" : "row",
        alignItems: "center",
        justifyContent: collapsed && !isMobile ? "center" : "space-between",
        gap: 10,
      }}
    >
      {collapsed && !isMobile ? (
        <button
          type="button"
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
          title="Розгорнути панель"
        >
          <img src="/logo.png?v=2" alt="Lumen" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />
        </button>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <img src="/logo.png?v=2" alt="Lumen" style={{ width: 32, height: 32, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            {!isMobile && !collapsed && (
              <span style={{ color: "#f5f5f5", fontWeight: 600, fontSize: 14, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                Lumen
              </span>
            )}
          </div>
          {!isMobile && !collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="layout-collapse-btn"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: 6,
                flexShrink: 0,
              }}
              title="Згорнути"
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
              <ChevronLeft style={{ width: 16, height: 16, marginLeft: "-8px" }} />
            </button>
          )}
        </>
      )}
    </div>
  );

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
        @keyframes layoutPageFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {isMobile && (mobileOpen || mobileOverlayClosing) && (
        <div
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
              setMobileOverlayClosing(true);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 40,
            backdropFilter: "blur(4px)",
            opacity: mobileOverlayClosing ? 0 : 1,
            transition: "opacity 0.25s ease-out",
          }}
        />
      )}

      {isMobile && !modalOpen && (
        <div
          style={{
            height: 52,
            flexShrink: 0,
            position: "relative",
            zIndex: 55,
            background: "#0f0f0f",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 8px",
              height: "100%",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <img src="/logo.png?v=2" alt="Lumen" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            <span style={{ color: "#f5f5f5", fontWeight: 600, fontSize: 13, letterSpacing: "0.05em" }}>Lumen</span>
          </button>
          {currentPageName === "Agents" && isAdmin && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("mobile-new-agent"))}
              style={{
                background: "rgba(249,115,22,0.15)",
                color: "#f97316",
                border: "1px solid rgba(249,115,22,0.3)",
                padding: "5px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <Plus style={{ width: 12, height: 12 }} /> Новий агент
            </button>
          )}
        </div>
      )}

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
        {isMobile ? accountBlock : (
          <>
            {showExpanded && accountBlock}
            {!showExpanded && (
              <div
                style={{
                  padding: "10px 8px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(249,115,22,0.15)",
                      border: "1px solid rgba(249,115,22,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#f97316",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {avatarLetter}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => logout(true)}
                  title="Вийти"
                  className="layout-collapse-btn"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 6,
                    display: "flex",
                    borderRadius: 8,
                  }}
                >
                  <LogOut style={{ width: 16, height: 16 }} />
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ flex: 1, minHeight: 0 }} aria-hidden />

        <nav
          style={{
            flexShrink: 0,
            padding: "8px 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.page}
              to={createPageUrl(item.page)}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "sidebar-item--active" : ""}`
              }
            >
              <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              {(isMobile || !collapsed) && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {footerBlock}
      </aside>

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
