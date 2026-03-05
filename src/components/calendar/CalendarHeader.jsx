import React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
    ? `Week of ${format(currentDate, "MMM d, yyyy")}`
    : format(currentDate, "EEEE, MMM d, yyyy");

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Calendar</h1>
        <div className="flex items-center gap-1 ml-4">
          <button onClick={() => navigate("prev")} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 rounded-lg text-xs font-medium hover:bg-white/5 transition"
            style={{ color: "var(--accent)" }}
          >
            Today
          </button>
          <button onClick={() => navigate("next")} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm font-medium ml-2" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-subtle)" }}>
          {["month", "week", "day"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-medium transition capitalize"
              style={{
                background: view === v ? "var(--accent-dim)" : "transparent",
                color: view === v ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={onNewEvent}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>
    </div>
  );
}