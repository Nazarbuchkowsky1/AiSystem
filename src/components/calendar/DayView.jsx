import React from "react";
import { format, isSameDay } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayView({ currentDate, events, onDateClick, onEventClick }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.date), currentDate));

  const getEventPosition = (event) => {
    if (!event.start_time) return { top: 0, height: 48 };
    const [sh, sm] = event.start_time.split(":").map(Number);
    const [eh, em] = (event.end_time || event.start_time).split(":").map(Number);
    const top = (sh * 60 + sm) * (48 / 60);
    const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) * (48 / 60), 30);
    return { top, height };
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex relative" style={{ minHeight: HOURS.length * 48 }}>
        {/* Time Labels */}
        <div className="w-16 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} className="h-12 flex items-start justify-end pr-3 -mt-2">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {h === 0 ? "" : `${h}:00`}
              </span>
            </div>
          ))}
        </div>

        {/* Day Column */}
        <div className="flex-1 relative border-l" style={{ borderColor: "var(--border-subtle)" }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-12 border-b cursor-pointer hover:bg-white/[0.01] transition"
              style={{ borderColor: "rgba(255,255,255,0.03)" }}
              onClick={() => onDateClick(currentDate)}
            />
          ))}
          {dayEvents.map((ev) => {
            const { top, height } = getEventPosition(ev);
            return (
              <div
                key={ev.id}
                className="absolute left-1 right-4 rounded-xl px-3 py-2 cursor-pointer hover:opacity-80 transition"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  background: "rgba(249,115,22,0.12)",
                  borderLeft: "3px solid var(--accent)",
                }}
                onClick={() => onEventClick(ev)}
              >
                <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>{ev.title}</p>
                {ev.start_time && (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {ev.start_time} — {ev.end_time || ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}