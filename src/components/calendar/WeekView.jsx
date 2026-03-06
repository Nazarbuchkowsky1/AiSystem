import React, { useRef, useEffect, useState, useCallback } from "react";
import { startOfWeek, addDays, format, isSameDay, isToday } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;
const SNAP_MINUTES = 15;

const EVENT_COLORS = {
  task: { bg: "rgba(249,115,22,0.22)", border: "#f97316", text: "#f97316" },
  meeting: { bg: "rgba(59,130,246,0.22)", border: "#3b82f6", text: "#3b82f6" },
  reminder: { bg: "rgba(168,85,247,0.22)", border: "#a855f7", text: "#a855f7" },
  activity: { bg: "rgba(34,197,94,0.22)", border: "#22c55e", text: "#22c55e" },
};

function snapMin(m) { return Math.round(m / SNAP_MINUTES) * SNAP_MINUTES; }
function minToTime(m) { return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`; }
function timeToMin(t) { if (!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; }

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const top = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, zIndex: 20, pointerEvents: "none" }}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
        <div style={{ height: 2, background: "#ef4444", width: "100%" }} />
      </div>
    </div>
  );
}

export default function WeekView({ currentDate, events, onSlotClick, onEventClick, onEventUpdate }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useRef(null);
  const gridRef = useRef(null);

  // Drag state
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const [resizeState, setResizeState] = useState(null);
  const resizeRef = useRef(null);
  const [createDrag, setCreateDrag] = useState(null);
  const createRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - 2) * HOUR_HEIGHT);
    }
  }, []);

  const getEventsForDay = (day) =>
    events.filter((e) => isSameDay(new Date(e.date), day));

  const getEventPos = (ev) => {
    if (!ev.start_time) return { top: 0, height: HOUR_HEIGHT };
    const s = timeToMin(ev.start_time), e = timeToMin(ev.end_time || ev.start_time);
    return { top: (s / 60) * HOUR_HEIGHT, height: Math.max(((e - s) / 60) * HOUR_HEIGHT, 22) };
  };

  const getMinFromY = useCallback((clientY) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop || 0;
    const rawM = ((clientY - rect.top + scrollTop) / HOUR_HEIGHT) * 60;
    return snapMin(Math.max(0, Math.min(rawM, 23 * 60 + 45)));
  }, []);

  const getDayFromX = useCallback((clientX) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const colW = rect.width / 7;
    return Math.max(0, Math.min(6, Math.floor((clientX - rect.left) / colW)));
  }, []);

  // --- Drag to create ---
  const handleMouseDown = useCallback((e, dayIndex) => {
    if (e.button !== 0) return;
    const m = getMinFromY(e.clientY);
    const s = { dayIndex, startMin: m, endMin: m + SNAP_MINUTES, active: true };
    setCreateDrag(s);
    createRef.current = s;
  }, [getMinFromY]);

  // --- Drag to move ---
  const handleEventMouseDown = useCallback((e, ev, dayIndex) => {
    e.stopPropagation();
    e.preventDefault();
    const startM = timeToMin(ev.start_time);
    const endM = timeToMin(ev.end_time || ev.start_time);
    const dur = (endM - startM) || 60;
    const clickOffset = getMinFromY(e.clientY) - startM;
    const s = { event: ev, dayIndex, startMin: startM, duration: dur, clickOffset };
    setDragState(s);
    dragRef.current = s;
  }, [getMinFromY]);

  // --- Drag to resize ---
  const handleResizeMouseDown = useCallback((e, ev, dayIndex) => {
    e.stopPropagation();
    e.preventDefault();
    const startM = timeToMin(ev.start_time);
    const endM = timeToMin(ev.end_time || ev.start_time) || startM + 60;
    const s = { event: ev, dayIndex, startMin: startM, endMin: endM };
    setResizeState(s);
    resizeRef.current = s;
  }, []);

  // Global mouse handlers
  useEffect(() => {
    const handleMove = (e) => {
      // Create drag
      if (createRef.current) {
        const m = getMinFromY(e.clientY);
        const s = createRef.current;
        const newState = { ...s, endMin: Math.max(m + SNAP_MINUTES, s.startMin + SNAP_MINUTES) };
        setCreateDrag(newState);
        createRef.current = newState;
      }
      // Move drag
      if (dragRef.current) {
        const m = getMinFromY(e.clientY);
        const di = getDayFromX(e.clientX);
        const offset = dragRef.current.clickOffset || 0;
        const newStart = snapMin(Math.max(0, m - offset));
        const newState = { ...dragRef.current, dayIndex: di, startMin: newStart };
        setDragState(newState);
        dragRef.current = newState;
      }
      // Resize drag
      if (resizeRef.current) {
        const m = getMinFromY(e.clientY);
        const s = resizeRef.current;
        const newEnd = Math.max(m + SNAP_MINUTES, s.startMin + SNAP_MINUTES);
        const newState = { ...s, endMin: newEnd };
        setResizeState(newState);
        resizeRef.current = newState;
      }
    };

    const handleUp = () => {
      // End create
      if (createRef.current) {
        const { dayIndex, startMin, endMin } = createRef.current;
        const realStart = Math.min(startMin, endMin);
        const realEnd = Math.max(startMin, endMin);
        if (realEnd - realStart >= SNAP_MINUTES) {
          const dateStr = format(days[dayIndex], "yyyy-MM-dd");
          onSlotClick(days[dayIndex], minToTime(realStart), minToTime(realEnd));
        }
        setCreateDrag(null);
        createRef.current = null;
      }
      // End move
      if (dragRef.current) {
        const { event, dayIndex, startMin, duration } = dragRef.current;
        const dateStr = format(days[dayIndex], "yyyy-MM-dd");
        onEventUpdate(event.id, {
          date: dateStr,
          start_time: minToTime(startMin),
          end_time: minToTime(startMin + duration),
        });
        setDragState(null);
        dragRef.current = null;
      }
      // End resize
      if (resizeRef.current) {
        const { event, startMin, endMin } = resizeRef.current;
        onEventUpdate(event.id, {
          start_time: minToTime(startMin),
          end_time: minToTime(endMin),
        });
        setResizeState(null);
        resizeRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [getMinFromY, getDayFromX, days, onSlotClick, onEventUpdate]);

  const isDragging = !!(createDrag || dragState || resizeState);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", userSelect: isDragging ? "none" : "auto" }}>
      {/* Sticky Header */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ width: 56, flexShrink: 0 }} />
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: today ? "#f97316" : "#555", letterSpacing: "0.03em" }}>
                {format(day, "EEE").toUpperCase()}
              </div>
              <div style={{
                fontSize: 22, fontWeight: today ? 500 : 300,
                color: today ? "#fff" : "#ccc",
                background: today ? "#f97316" : "transparent",
                width: 40, height: 40, borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginTop: 2, cursor: "pointer"
              }}>
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
            <div key={h} style={{ height: HOUR_HEIGHT, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 8 }}>
              <span style={{ fontSize: 10, color: "#555", fontWeight: 500, marginTop: -6 }}>
                {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div ref={gridRef} style={{ display: "flex", flex: 1 }}>
          {days.map((day, di) => {
            const dayEvents = getEventsForDay(day);
            const today = isToday(day);

            // Check if an event is being moved here
            const movedEvent = dragState && dragState.dayIndex === di ? dragState : null;
            // Filter out the event being moved from its original day
            const filteredEvents = dragState
              ? dayEvents.filter(ev => ev.id !== dragState.event.id)
              : dayEvents;

            return (
              <div
                key={di}
                style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(255,255,255,0.04)", cursor: "crosshair" }}
                onMouseDown={(e) => handleMouseDown(e, di)}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: "1px solid rgba(255,255,255,0.04)" }} />
                ))}

                {today && <CurrentTimeLine />}

                {/* Create drag preview */}
                {createDrag && createDrag.dayIndex === di && (
                  <div style={{
                    position: "absolute", left: 2, right: 4,
                    top: (Math.min(createDrag.startMin, createDrag.endMin) / 60) * HOUR_HEIGHT,
                    height: (Math.abs(createDrag.endMin - createDrag.startMin) / 60) * HOUR_HEIGHT,
                    background: "rgba(249,115,22,0.25)", border: "1px solid rgba(249,115,22,0.5)",
                    borderRadius: 6, zIndex: 30, pointerEvents: "none",
                    display: "flex", alignItems: "flex-start", padding: "3px 6px"
                  }}>
                    <span style={{ fontSize: 10, color: "#f97316", fontWeight: 600 }}>
                      {minToTime(Math.min(createDrag.startMin, createDrag.endMin))} – {minToTime(Math.max(createDrag.startMin, createDrag.endMin))}
                    </span>
                  </div>
                )}

                {/* Move drag preview */}
                {movedEvent && (
                  <div style={{
                    position: "absolute", left: 2, right: 4,
                    top: (movedEvent.startMin / 60) * HOUR_HEIGHT,
                    height: (movedEvent.duration / 60) * HOUR_HEIGHT,
                    background: "rgba(249,115,22,0.3)", border: "1px dashed #f97316",
                    borderRadius: 6, zIndex: 30, pointerEvents: "none",
                    padding: "3px 6px", opacity: 0.8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#f97316" }}>{movedEvent.event.title}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>{minToTime(movedEvent.startMin)} – {minToTime(movedEvent.startMin + movedEvent.duration)}</div>
                  </div>
                )}

                {/* Events */}
                {filteredEvents.map(ev => {
                  const { top, height } = getEventPos(ev);
                  const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.task;
                  // If resizing this event
                  const isResizing = resizeState && resizeState.event.id === ev.id;
                  const displayTop = isResizing ? (resizeState.startMin / 60) * HOUR_HEIGHT : top;
                  const displayHeight = isResizing ? ((resizeState.endMin - resizeState.startMin) / 60) * HOUR_HEIGHT : height;
                  return (
                    <div
                      key={ev.id}
                      style={{
                        position: "absolute", left: 2, right: 4, top: displayTop,
                        height: displayHeight, minHeight: 22, borderRadius: 6,
                        background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                        padding: "3px 6px", cursor: "grab", overflow: "hidden", zIndex: 10
                      }}
                      onMouseDown={(e) => handleEventMouseDown(e, ev, di)}
                      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onEventClick(e, ev); } }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.text, lineHeight: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </div>
                      {displayHeight > 30 && (
                        <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                          {isResizing ? `${minToTime(resizeState.startMin)} – ${minToTime(resizeState.endMin)}` : `${ev.start_time}${ev.end_time ? ` – ${ev.end_time}` : ""}`}
                        </div>
                      )}
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e, ev, di)}
                        style={{
                          position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
                          cursor: "s-resize", borderRadius: "0 0 6px 6px"
                        }}
                      />
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