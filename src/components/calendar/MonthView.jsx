import React from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday
} from "date-fns";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({ currentDate, events, onDateClick, onEventClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day) =>
    events.filter((e) => isSameDay(new Date(e.date), day));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <button
              key={i}
              onClick={() => onDateClick(day)}
              className="border-b border-r p-1.5 text-left hover:bg-white/[0.02] transition relative min-h-0 overflow-hidden"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <span
                className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  today ? "" : ""
                }`}
                style={{
                  color: today ? "#fff" : inMonth ? "var(--text-secondary)" : "var(--text-muted)",
                  background: today ? "var(--accent)" : "transparent",
                  boxShadow: today ? "0 0 12px rgba(249,115,22,0.4)" : "none",
                }}
              >
                {format(day, "d")}
              </span>
              <div className="mt-0.5 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    className="text-[10px] truncate px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition"
                    style={{
                      background: "rgba(249,115,22,0.15)",
                      color: "var(--accent)",
                      borderLeft: "2px solid var(--accent)",
                    }}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[9px] px-1.5" style={{ color: "var(--text-muted)" }}>
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}