import React from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";

export default function CalendarHeader({ currentDate, setCurrentDate, view, setView, onNewEvent }) {
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
      flexShrink: 0, gap: 12, flexWrap: "wrap", minHeight: 52
    }}>
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          Create
        </button>
      </div>

      {/* Center - Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}>
        <button
          onClick={() => setCurrentDate(new Date())}
          style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
            color: "#f5f5f5", cursor: "pointer", transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          Today
        </button>
        <button onClick={() => navigate("prev")} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", display: "flex", padding: 6, borderRadius: 20, transition: "all 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          <ChevronLeft style={{ width: 18, height: 18 }} />
        </button>
        <button onClick={() => navigate("next")} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", display: "flex", padding: 6, borderRadius: 20, transition: "all 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          <ChevronRight style={{ width: 18, height: 18 }} />
        </button>
        <span style={{ fontSize: 18, fontWeight: 400, color: "#f5f5f5", marginLeft: 4, whiteSpace: "nowrap" }}>{label}</span>
      </div>

      {/* Right side - View Selector */}
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
  );
}