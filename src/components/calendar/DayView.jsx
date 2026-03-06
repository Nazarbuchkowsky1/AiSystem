import React, { useRef, useEffect, useState, useCallback } from "react";
import { format, isSameDay, isToday } from "date-fns";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD = 4;

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

export default function DayView({ currentDate, events, onSlotClick, onEventClick, onEventUpdate }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.date), currentDate));
  const scrollRef = useRef(null);
  const colRef = useRef(null);
  const today = isToday(currentDate);

  const [createDrag, setCreateDrag] = useState(null);
  const createRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const [resizeState, setResizeState] = useState(null);
  const resizeRef = useRef(null);

  const mouseDownPos = useRef(null);
  const hasDragged = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (new Date().getHours() - 2) * HOUR_HEIGHT);
    }
  }, []);

  const getMinFromY = useCallback((clientY) => {
    if (!colRef.current) return 0;
    const rect = colRef.current.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop || 0;
    const rawM = ((clientY - rect.top + scrollTop) / HOUR_HEIGHT) * 60;
    return snapMin(Math.max(0, Math.min(rawM, 23 * 60 + 45)));
  }, []);

  const getEventPos = (ev) => {
    if (!ev.start_time) return { top: 0, height: HOUR_HEIGHT };
    const s = timeToMin(ev.start_time), e = timeToMin(ev.end_time || ev.start_time);
    return { top: (s / 60) * HOUR_HEIGHT, height: Math.max(((e - s) / 60) * HOUR_HEIGHT, 28) };
  };

  const handleSlotMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
  }, []);

  const handleEventMouseDown = useCallback((e, ev) => {
    e.stopPropagation();
    e.preventDefault();
    mouseDownPos.current = { x: e.clientX, y: e.clientY, isEvent: true, event: ev };
    hasDragged.current = false;
  }, []);

  const handleResizeMouseDown = useCallback((e, ev) => {
    e.stopPropagation();
    e.preventDefault();
    const startM = timeToMin(ev.start_time);
    const endM = timeToMin(ev.end_time || ev.start_time) || startM + 60;
    const s = { event: ev, startMin: startM, endMin: endM };
    setResizeState(s);
    resizeRef.current = s;
    hasDragged.current = true;
  }, []);

  useEffect(() => {
    const handleMove = (e) => {
      if (mouseDownPos.current && !hasDragged.current) {
        const dx = Math.abs(e.clientX - mouseDownPos.current.x);
        const dy = Math.abs(e.clientY - mouseDownPos.current.y);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          hasDragged.current = true;
          if (mouseDownPos.current.isEvent) {
            const ev = mouseDownPos.current.event;
            const startM = timeToMin(ev.start_time);
            const endM = timeToMin(ev.end_time || ev.start_time);
            const dur = (endM - startM) || 60;
            const offset = getMinFromY(mouseDownPos.current.y) - startM;
            const s = { event: ev, startMin: startM, duration: dur, clickOffset: offset };
            setDragState(s);
            dragRef.current = s;
          } else {
            const m = getMinFromY(mouseDownPos.current.y);
            const s = { startMin: m, endMin: m + SNAP_MINUTES };
            setCreateDrag(s);
            createRef.current = s;
          }
        }
      }

      if (createRef.current) {
        const m = getMinFromY(e.clientY);
        const s = createRef.current;
        const n = { ...s, endMin: Math.max(m + SNAP_MINUTES, s.startMin + SNAP_MINUTES) };
        setCreateDrag(n);
        createRef.current = n;
      }
      if (dragRef.current) {
        const m = getMinFromY(e.clientY);
        const offset = dragRef.current.clickOffset || 0;
        const newStart = snapMin(Math.max(0, m - offset));
        const n = { ...dragRef.current, startMin: newStart };
        setDragState(n);
        dragRef.current = n;
      }
      if (resizeRef.current) {
        const m = getMinFromY(e.clientY);
        const s = resizeRef.current;
        const n = { ...s, endMin: Math.max(m + SNAP_MINUTES, s.startMin + SNAP_MINUTES) };
        setResizeState(n);
        resizeRef.current = n;
      }
    };

    const handleUp = (e) => {
      const wasRealDrag = hasDragged.current;
      const downPos = mouseDownPos.current;

      if (createRef.current && wasRealDrag) {
        const { startMin, endMin } = createRef.current;
        const rs = Math.min(startMin, endMin), re = Math.max(startMin, endMin);
        if (re - rs >= SNAP_MINUTES) {
          onSlotClick(currentDate, minToTime(rs), minToTime(re));
        }
      }
      setCreateDrag(null);
      createRef.current = null;

      if (dragRef.current && wasRealDrag) {
        const { event, startMin, duration } = dragRef.current;
        onEventUpdate(event.id, {
          start_time: minToTime(startMin),
          end_time: minToTime(startMin + duration),
        });
      }
      setDragState(null);
      dragRef.current = null;

      if (resizeRef.current) {
        const { event, startMin, endMin } = resizeRef.current;
        onEventUpdate(event.id, {
          start_time: minToTime(startMin),
          end_time: minToTime(endMin),
        });
      }
      setResizeState(null);
      resizeRef.current = null;

      // Simple click
      if (!wasRealDrag && downPos) {
        if (downPos.isEvent) {
          onEventClick(e, downPos.event);
        } else {
          const m = getMinFromY(downPos.y);
          onSlotClick(currentDate, minToTime(m), minToTime(m + 60));
        }
      }

      mouseDownPos.current = null;
      hasDragged.current = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [getMinFromY, currentDate, onSlotClick, onEventUpdate, onEventClick]);

  const isDragging = !!(createDrag || dragState || resizeState);
  const filteredEvents = dragState ? dayEvents.filter(ev => ev.id !== dragState.event.id) : dayEvents;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", userSelect: isDragging ? "none" : "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: today ? "#f97316" : "#555", letterSpacing: "0.03em" }}>
            {format(currentDate, "EEEE").toUpperCase()}
          </div>
          <div style={{
            fontSize: 32, fontWeight: today ? 500 : 300,
            color: today ? "#fff" : "#ccc",
            background: today ? "#f97316" : "transparent",
            width: 52, height: 52, borderRadius: "50%",
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 4
          }}>
            {format(currentDate, "d")}
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", display: "flex", msOverflowStyle: "none", scrollbarWidth: "none" }}>
        <div style={{ width: 64, flexShrink: 0 }}>
          {HOURS.map(h => (
            <div key={h} style={{ height: HOUR_HEIGHT, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 12 }}>
              <span style={{ fontSize: 10, color: "#555", fontWeight: 500, marginTop: -6 }}>
                {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
              </span>
            </div>
          ))}
        </div>

        <div ref={colRef} style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(255,255,255,0.06)", cursor: "crosshair" }}
          onMouseDown={handleSlotMouseDown}>
          {HOURS.map(h => (
            <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: "1px solid rgba(255,255,255,0.04)" }} />
          ))}

          {today && <CurrentTimeLine />}

          {createDrag && (
            <div style={{
              position: "absolute", left: 4, right: 24,
              top: (Math.min(createDrag.startMin, createDrag.endMin) / 60) * HOUR_HEIGHT,
              height: (Math.abs(createDrag.endMin - createDrag.startMin) / 60) * HOUR_HEIGHT,
              background: "rgba(249,115,22,0.25)", border: "1px solid rgba(249,115,22,0.5)",
              borderRadius: 8, zIndex: 30, pointerEvents: "none", padding: "6px 12px"
            }}>
              <span style={{ fontSize: 11, color: "#f97316", fontWeight: 600 }}>
                {minToTime(Math.min(createDrag.startMin, createDrag.endMin))} – {minToTime(Math.max(createDrag.startMin, createDrag.endMin))}
              </span>
            </div>
          )}

          {dragState && (
            <div style={{
              position: "absolute", left: 4, right: 24,
              top: (dragState.startMin / 60) * HOUR_HEIGHT,
              height: (dragState.duration / 60) * HOUR_HEIGHT,
              background: "rgba(249,115,22,0.3)", border: "1px dashed #f97316",
              borderRadius: 8, zIndex: 30, pointerEvents: "none", padding: "6px 12px", opacity: 0.8
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f97316" }}>{dragState.event.title}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{minToTime(dragState.startMin)} – {minToTime(dragState.startMin + dragState.duration)}</div>
            </div>
          )}

          {filteredEvents.map(ev => {
            const { top, height } = getEventPos(ev);
            const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.task;
            const isResizing = resizeState && resizeState.event.id === ev.id;
            const dTop = isResizing ? (resizeState.startMin / 60) * HOUR_HEIGHT : top;
            const dHeight = isResizing ? ((resizeState.endMin - resizeState.startMin) / 60) * HOUR_HEIGHT : height;
            return (
              <div key={ev.id}
                style={{
                  position: "absolute", left: 4, right: 24, top: dTop,
                  height: dHeight, minHeight: 28, borderRadius: 8,
                  background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                  padding: "6px 12px", cursor: "grab", overflow: "hidden", zIndex: 10
                }}
                onMouseDown={(e) => handleEventMouseDown(e, ev)}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.title}
                </div>
                {dHeight > 40 && (
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    {isResizing ? `${minToTime(resizeState.startMin)} – ${minToTime(resizeState.endMin)}` : `${ev.start_time}${ev.end_time ? ` – ${ev.end_time}` : ""}`}
                  </div>
                )}
                {dHeight > 60 && ev.description && (
                  <div style={{ fontSize: 11, color: "#666", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.description}
                  </div>
                )}
                <div onMouseDown={(e) => handleResizeMouseDown(e, ev)}
                  style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, cursor: "s-resize", borderRadius: "0 0 8px 8px" }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}