import { useState, useCallback, useRef } from "react";

const HOUR_HEIGHT = 60;
const SNAP_MINUTES = 15;

function snapToGrid(minutes) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function useCalendarDrag({ events, onEventUpdate, onCreateEvent }) {
  // Drag to create state
  const [dragCreate, setDragCreate] = useState(null); // { dayIndex, startMinutes, endMinutes }
  const dragCreateRef = useRef(null);
  
  // Drag to move state
  const [dragMove, setDragMove] = useState(null); // { eventId, dayIndex, startMinutes, duration }
  const dragMoveRef = useRef(null);

  // Drag to resize state
  const [dragResize, setDragResize] = useState(null); // { eventId, dayIndex, startMinutes, endMinutes }
  const dragResizeRef = useRef(null);

  const getMinutesFromY = useCallback((y, containerTop) => {
    const rawMinutes = ((y - containerTop) / HOUR_HEIGHT) * 60;
    return snapToGrid(Math.max(0, Math.min(rawMinutes, 24 * 60 - SNAP_MINUTES)));
  }, []);

  // --- DRAG TO CREATE ---
  const startDragCreate = useCallback((dayIndex, y, containerTop) => {
    const minutes = getMinutesFromY(y, containerTop);
    const state = { dayIndex, startMinutes: minutes, endMinutes: minutes + SNAP_MINUTES };
    setDragCreate(state);
    dragCreateRef.current = state;
  }, [getMinutesFromY]);

  const updateDragCreate = useCallback((y, containerTop) => {
    if (!dragCreateRef.current) return;
    const minutes = getMinutesFromY(y, containerTop);
    const start = dragCreateRef.current.startMinutes;
    const newState = {
      ...dragCreateRef.current,
      endMinutes: Math.max(minutes + SNAP_MINUTES, start + SNAP_MINUTES)
    };
    setDragCreate(newState);
    dragCreateRef.current = newState;
  }, [getMinutesFromY]);

  const endDragCreate = useCallback((dayDate) => {
    if (!dragCreateRef.current) return;
    const { startMinutes, endMinutes } = dragCreateRef.current;
    const realStart = Math.min(startMinutes, endMinutes);
    const realEnd = Math.max(startMinutes, endMinutes);
    if (realEnd - realStart >= SNAP_MINUTES) {
      onCreateEvent({
        date: dayDate,
        start_time: minutesToTime(realStart),
        end_time: minutesToTime(realEnd),
      });
    }
    setDragCreate(null);
    dragCreateRef.current = null;
  }, [onCreateEvent]);

  const cancelDragCreate = useCallback(() => {
    setDragCreate(null);
    dragCreateRef.current = null;
  }, []);

  // --- DRAG TO MOVE ---
  const startDragMove = useCallback((event, dayIndex, y, containerTop) => {
    const startM = timeToMinutes(event.start_time);
    const endM = timeToMinutes(event.end_time || event.start_time);
    const duration = endM - startM || 60;
    const clickOffset = getMinutesFromY(y, containerTop) - startM;
    const state = { eventId: event.id, event, dayIndex, startMinutes: startM, duration, clickOffset };
    setDragMove(state);
    dragMoveRef.current = state;
  }, [getMinutesFromY]);

  const updateDragMove = useCallback((dayIndex, y, containerTop) => {
    if (!dragMoveRef.current) return;
    const minutes = getMinutesFromY(y, containerTop);
    const offset = dragMoveRef.current.clickOffset || 0;
    const newStart = snapToGrid(Math.max(0, minutes - offset));
    const newState = { ...dragMoveRef.current, dayIndex, startMinutes: newStart };
    setDragMove(newState);
    dragMoveRef.current = newState;
  }, [getMinutesFromY]);

  const endDragMove = useCallback((dayDate) => {
    if (!dragMoveRef.current) return;
    const { eventId, event, startMinutes, duration } = dragMoveRef.current;
    onEventUpdate(eventId, {
      date: dayDate,
      start_time: minutesToTime(startMinutes),
      end_time: minutesToTime(startMinutes + duration),
    });
    setDragMove(null);
    dragMoveRef.current = null;
  }, [onEventUpdate]);

  const cancelDragMove = useCallback(() => {
    setDragMove(null);
    dragMoveRef.current = null;
  }, []);

  // --- DRAG TO RESIZE ---
  const startDragResize = useCallback((event, dayIndex, y, containerTop) => {
    const startM = timeToMinutes(event.start_time);
    const endM = timeToMinutes(event.end_time || event.start_time) || startM + 60;
    const state = { eventId: event.id, event, dayIndex, startMinutes: startM, endMinutes: endM };
    setDragResize(state);
    dragResizeRef.current = state;
  }, []);

  const updateDragResize = useCallback((y, containerTop) => {
    if (!dragResizeRef.current) return;
    const minutes = getMinutesFromY(y, containerTop);
    const newEnd = Math.max(minutes + SNAP_MINUTES, dragResizeRef.current.startMinutes + SNAP_MINUTES);
    const newState = { ...dragResizeRef.current, endMinutes: newEnd };
    setDragResize(newState);
    dragResizeRef.current = newState;
  }, [getMinutesFromY]);

  const endDragResize = useCallback(() => {
    if (!dragResizeRef.current) return;
    const { eventId, startMinutes, endMinutes } = dragResizeRef.current;
    onEventUpdate(eventId, {
      start_time: minutesToTime(startMinutes),
      end_time: minutesToTime(endMinutes),
    });
    setDragResize(null);
    dragResizeRef.current = null;
  }, [onEventUpdate]);

  const cancelDragResize = useCallback(() => {
    setDragResize(null);
    dragResizeRef.current = null;
  }, []);

  const isDragging = !!(dragCreate || dragMove || dragResize);

  return {
    dragCreate, startDragCreate, updateDragCreate, endDragCreate, cancelDragCreate,
    dragMove, startDragMove, updateDragMove, endDragMove, cancelDragMove,
    dragResize, startDragResize, updateDragResize, endDragResize, cancelDragResize,
    isDragging, HOUR_HEIGHT, snapToGrid, minutesToTime, timeToMinutes,
  };
}