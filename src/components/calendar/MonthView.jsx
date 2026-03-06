import React from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday
} from "date-fns";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const EVENT_COLORS = {
  task: { bg: "rgba(249,115,22,0.15)", border: "#f97316", text: "#f97316" },
  meeting: { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", text: "#3b82f6" },
  reminder: { bg: "rgba(168,85,247,0.15)", border: "#a855f7", text: "#a855f7" },
  activity: { bg: "rgba(34,197,94,0.15)", border: "#22c55e", text: "#22c55e" },
};

export default function MonthView({ currentDate, events, onDateClick, onEventClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getEventsForDay = (day) =>
    events.filter((e) => isSameDay(new Date(e.date), day))
      .sort((a, b) => (a.start_time || "00:00").localeCompare(b.start_time || "00:00"));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Day Headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {DAYS.map((d) => (
          <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: "0.05em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 0, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {week.map((day, di) => {
              const dayEvents = getEventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <div
                  key={di}
                  onClick={() => onDateClick(day)}
                  style={{
                    borderRight: di < 6 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    padding: 4, cursor: "pointer", overflow: "hidden",
                    transition: "background 0.15s",
                    background: today ? "rgba(249,115,22,0.03)" : "transparent",
                    display: "flex", flexDirection: "column", minHeight: 0
                  }}
                  onMouseEnter={e => { if (!today) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { if (!today) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Date number */}
                  <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 4px" }}>
                    <span style={{
                      fontSize: 12, fontWeight: today ? 600 : 400,
                      color: today ? "#fff" : inMonth ? "#ccc" : "#444",
                      background: today ? "#f97316" : "transparent",
                      width: 26, height: 26, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s"
                    }}>
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Events */}
                  <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.task;
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          style={{
                            fontSize: 10, fontWeight: 500, padding: "2px 6px",
                            borderRadius: 4, cursor: "pointer",
                            background: colors.bg, color: colors.text,
                            borderLeft: `2px solid ${colors.border}`,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            transition: "opacity 0.15s", lineHeight: "16px"
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                          {ev.start_time && <span style={{ marginRight: 4, opacity: 0.7 }}>{ev.start_time.slice(0,5)}</span>}
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: 10, color: "#888", padding: "1px 6px", fontWeight: 500 }}>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}