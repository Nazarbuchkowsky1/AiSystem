import React from "react";
import { startOfWeek, addDays, format, isSameDay, isToday } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekView({ currentDate, events, onDateClick, onEventClick }) {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventsForDay = (day) =>
    events.filter((e) => isSameDay(new Date(e.date), day));

  const getEventPosition = (event) => {
    if (!event.start_time) return { top: 0, height: 40 };
    const [sh, sm] = event.start_time.split(":").map(Number);
    const [eh, em] = (event.end_time || event.start_time).split(":").map(Number);
    const top = (sh * 60 + sm) * (48 / 60);
    const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) * (48 / 60), 24);
    return { top, height };
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="w-14" />
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div key={i} className="py-2 text-center">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{format(day, "EEE")}</span>
              <div
                className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full mx-auto mt-0.5`}
                style={{
                  background: today ? "var(--accent)" : "transparent",
                  color: today ? "#fff" : "var(--text-primary)",
                  boxShadow: today ? "0 0 12px rgba(249,115,22,0.4)" : "none",
                }}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 relative" style={{ minHeight: HOURS.length * 48 }}>
          {/* Time Labels */}
          <div className="w-14">
            {HOURS.map((h) => (
              <div key={h} className="h-12 flex items-start justify-end pr-2 -mt-2">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {h === 0 ? "" : `${h}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {days.map((day, di) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={di}
                className="relative border-l"
                style={{ borderColor: "var(--border-subtle)" }}
                onClick={() => onDateClick(day)}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="h-12 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.03)" }}
                  />
                ))}
                {dayEvents.map((ev) => {
                  const { top, height } = getEventPosition(ev);
                  return (
                    <div
                      key={ev.id}
                      className="absolute left-0.5 right-0.5 rounded-lg px-1.5 py-1 cursor-pointer hover:opacity-80 transition overflow-hidden"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        background: "rgba(249,115,22,0.15)",
                        borderLeft: "3px solid var(--accent)",
                      }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    >
                      <p className="text-[10px] font-medium truncate" style={{ color: "var(--accent)" }}>
                        {ev.title}
                      </p>
                      {height > 30 && ev.start_time && (
                        <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                          {ev.start_time}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}