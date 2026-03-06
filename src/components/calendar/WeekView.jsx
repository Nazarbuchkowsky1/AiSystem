import React, { useRef, useEffect, useState } from "react";
import { startOfWeek, addDays, format, isSameDay, isToday } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;

const EVENT_COLORS = {
  task: { bg: "rgba(249,115,22,0.18)", border: "#f97316", text: "#f97316" },
  meeting: { bg: "rgba(59,130,246,0.18)", border: "#3b82f6", text: "#3b82f6" },
  reminder: { bg: "rgba(168,85,247,0.18)", border: "#a855f7", text: "#a855f7" },
  activity: { bg: "rgba(34,197,94,0.18)", border: "#22c55e", text: "#22c55e" },
};

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * HOUR_HEIGHT;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, zIndex: 20, pointerEvents: "none" }}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
        <div style={{ height: 2, background: "#ef4444", width: "100%" }} />
      </div>
    </div>
  );
}

export default function WeekView({ currentDate, events, onDateClick, onEventClick }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(0, (now.getHours() - 2) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  const getEventsForDay = (day) =>
    events.filter((e) => isSameDay(new Date(e.date), day));

  const getEventStyle = (event) => {
    if (!event.start_time) return { top: 0, height: HOUR_HEIGHT };
    const [sh, sm] = event.start_time.split(":").map(Number);
    const [eh, em] = (event.end_time || event.start_time).split(":").map(Number);
    const top = ((sh * 60 + sm) / 60) * HOUR_HEIGHT;
    const height = Math.max(((eh * 60 + em - sh * 60 - sm) / 60) * HOUR_HEIGHT, 24);
    return { top, height };
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Sticky Header */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ width: 56, flexShrink: 0 }} />
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div key={i} style={{
              flex: 1, textAlign: "center", padding: "8px 0",
              borderLeft: "1px solid rgba(255,255,255,0.04)"
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: today ? "#f97316" : "#555", letterSpacing: "0.03em" }}>
                {format(day, "EEE").toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 22, fontWeight: today ? 500 : 300,
                  color: today ? "#fff" : "#ccc",
                  background: today ? "#f97316" : "transparent",
                  width: 40, height: 40, borderRadius: "50%",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  marginTop: 2, cursor: "pointer", transition: "all 0.15s"
                }}
                onClick={() => onDateClick(day)}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", display: "flex", msOverflowStyle: "none", scrollbarWidth: "none" }}>
        {/* Time gutter */}
        <div style={{ width: 56, flexShrink: 0 }}>
          {HOURS.map(h => (
            <div key={h} style={{ height: HOUR_HEIGHT, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 8, paddingTop: 0 }}>
              <span style={{ fontSize: 10, color: "#555", fontWeight: 500, marginTop: -6 }}>
                {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, di) => {
          const dayEvents = getEventsForDay(day);
          const today = isToday(day);
          return (
            <div
              key={di}
              style={{
                flex: 1, position: "relative",
                borderLeft: "1px solid rgba(255,255,255,0.04)"
              }}
              onClick={() => onDateClick(day)}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div key={h} style={{
                  height: HOUR_HEIGHT,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.01)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                />
              ))}

              {/* Current time line */}
              {today && <CurrentTimeLine />}

              {/* Events */}
              {dayEvents.map(ev => {
                const { top, height } = getEventStyle(ev);
                const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.task;
                return (
                  <div
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                    style={{
                      position: "absolute", left: 2, right: 4, top,
                      height, minHeight: 22, borderRadius: 6,
                      background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                      padding: "3px 6px", cursor: "pointer",
                      overflow: "hidden", zIndex: 10, transition: "opacity 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.text, lineHeight: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.title}
                    </div>
                    {height > 30 && (
                      <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                        {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}