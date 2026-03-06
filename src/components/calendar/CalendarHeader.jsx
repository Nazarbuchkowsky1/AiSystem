import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";

export default function CalendarHeader({ currentDate, setCurrentDate, view, setView, onNewEvent, searchQuery, setSearchQuery }) {
  const [showSearch, setShowSearch] = useState(false);

  const navigate = (dir) => {
    const fn = dir === "next"
      ? view === "month" ? addMonths : view === "week" ? addWeeks : addDays
      : view === "month" ? subMonths : view === "week" ? subWeeks : subDays;
    setCurrentDate(fn(currentDate, 1));
  };

  const label = view === "month"
    ? format(currentDate, "MMMM yyyy")
    : view === "week"
    ? format(currentDate, "MMMM yyyy")
    : format(currentDate, "MMMM d, yyyy");

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0, gap: 8, minHeight: 52
    }}>
      {/* Left - Create */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onNewEvent}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 20px", borderRadius: 24,
            background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)",
            color: "#f97316", fontSize: 14, fontWeight: 500, cursor: "pointer",
            transition: "all 0.2s", whiteSpace: "nowrap"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.2)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.12)"}
        >
          <Plus style={{ width: 18, height: 18 }} />
          <span className="hidden sm:inline">Create</span>
        </button>
      </div>

      {/* Center - Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center", minWidth: 0 }}>
        <button
          onClick={() => setCurrentDate(new Date())}
          style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
            color: "#f5f5f5", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          Today
        </button>
        <button onClick={() => navigate("prev")} style={navBtnStyle}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          <ChevronLeft style={{ width: 18, height: 18 }} />
        </button>
        <button onClick={() => navigate("next")} style={navBtnStyle}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          <ChevronRight style={{ width: 18, height: 18 }} />
        </button>
        <span style={{ fontSize: 18, fontWeight: 400, color: "#f5f5f5", marginLeft: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>

      {/* Right - Search + Views */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Search */}
        {showSearch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "4px 8px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Search style={{ width: 14, height: 14, color: "#666", flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              autoFocus
              style={{
                background: "transparent", border: "none", outline: "none",
                color: "#f5f5f5", fontSize: 12, width: 140
              }}
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ ...navBtnStyle, padding: 4 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowSearch(true)} style={navBtnStyle} title="Search events (/)">
            <Search style={{ width: 16, height: 16 }} />
          </button>
        )}

        {/* View selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2, border: "1px solid rgba(255,255,255,0.06)" }}>
          {["day", "week", "month"].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: view === v ? "rgba(249,115,22,0.15)" : "transparent",
                color: view === v ? "#f97316" : "#888",
                border: view === v ? "1px solid rgba(249,115,22,0.25)" : "1px solid transparent",
                cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize"
              }}
            >
              {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: "none", border: "none", cursor: "pointer", color: "#888",
  display: "flex", padding: 6, borderRadius: 20, transition: "all 0.15s", flexShrink: 0
};