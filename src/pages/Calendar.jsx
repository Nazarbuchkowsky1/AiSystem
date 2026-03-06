import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import CalendarHeader from "../components/calendar/CalendarHeader";
import MonthView from "../components/calendar/MonthView";
import WeekView from "../components/calendar/WeekView";
import DayView from "../components/calendar/DayView";
import EventModal from "../components/calendar/EventModal";
import EventPopover from "../components/calendar/EventPopover";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week");
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [prefillTimes, setPrefillTimes] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Popover state
  const [popover, setPopover] = useState(null); // { event, position: {x,y} }

  const queryClient = useQueryClient();

  const { data: allEvents = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.CalendarEvent.list("-date"),
  });

  // Filter events by search
  const events = searchQuery.trim()
    ? allEvents.filter(e => {
        const q = searchQuery.toLowerCase();
        return (e.title || "").toLowerCase().includes(q)
          || (e.description || "").toLowerCase().includes(q)
          || (e.event_type || "").toLowerCase().includes(q);
      })
    : allEvents;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CalendarEvent.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CalendarEvent.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previous = queryClient.getQueryData(["events"]);
      // Optimistically update the cache
      queryClient.setQueryData(["events"], (old) =>
        (old || []).map(ev => ev.id === id ? { ...ev, ...data } : ev)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      if (context?.previous) queryClient.setQueryData(["events"], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CalendarEvent.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); closeModal(); },
  });

  const closeModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
    setSelectedDate(null);
    setPrefillTimes(null);
  };

  // Open modal for editing from popover
  const openEditModal = (event) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setPrefillTimes(null);
    setShowModal(true);
  };

  // Click on time slot — opens modal with pre-filled times
  const handleSlotClick = useCallback((date, startTime, endTime) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setPrefillTimes({ start_time: startTime, end_time: endTime });
    setShowModal(true);
    setPopover(null);
  }, []);

  // Click on date (month view / day header)
  const handleDateClick = (date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setPrefillTimes(null);
    setShowModal(true);
    setPopover(null);
  };

  // Quick event click — show popover (for week/day) or modal (for month)
  const handleEventClick = useCallback((e, event) => {
    if (view === "month") {
      setSelectedEvent(event);
      setShowModal(true);
    } else {
      setPopover({
        event,
        position: { x: e.clientX, y: e.clientY }
      });
    }
  }, [view]);

  // Inline event update (drag/resize)
  const handleEventUpdate = useCallback((id, data) => {
    updateMutation.mutate({ id, data });
  }, [updateMutation]);

  // Duplicate event
  const handleDuplicate = useCallback((event) => {
    const { id, created_date, updated_date, created_by, ...rest } = event;
    createMutation.mutate({ ...rest, title: `${rest.title} (copy)` });
  }, [createMutation]);

  const handleSave = (data, eventId) => {
    if (eventId) {
      updateMutation.mutate({ id: eventId, data });
      closeModal();
    } else {
      createMutation.mutate(data);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      // Don't trigger if typing in input/textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSelectedDate(new Date());
        setSelectedEvent(null);
        setPrefillTimes(null);
        setShowModal(true);
      }
      if (e.key === "t") {
        e.preventDefault();
        setCurrentDate(new Date());
      }
      if (e.key === "d") { e.preventDefault(); setView("day"); }
      if (e.key === "w") { e.preventDefault(); setView("week"); }
      if (e.key === "m") { e.preventDefault(); setView("month"); }
      if (e.key === "/") { e.preventDefault(); setSearchQuery(""); }
      if (e.key === "Escape") {
        if (showModal) closeModal();
        if (popover) setPopover(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (popover && popover.event) {
          deleteMutation.mutate(popover.event.id);
          setPopover(null);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showModal, popover]);

  const viewProps = {
    currentDate,
    events,
    onEventClick: handleEventClick,
    onEventUpdate: handleEventUpdate,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <CalendarHeader
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        view={view}
        setView={setView}
        onNewEvent={() => { setSelectedDate(new Date()); setPrefillTimes(null); setShowModal(true); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Search results indicator */}
      {searchQuery && (
        <div style={{ padding: "6px 16px", background: "rgba(249,115,22,0.05)", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#888" }}>
          {events.length} result{events.length !== 1 ? "s" : ""} for "{searchQuery}"
        </div>
      )}

      {view === "month" && (
        <MonthView {...viewProps} onDateClick={handleDateClick} onEventClick={(e, ev) => handleEventClick(e, ev)} />
      )}
      {view === "week" && (
        <WeekView {...viewProps} onSlotClick={handleSlotClick} />
      )}
      {view === "day" && (
        <DayView {...viewProps} onSlotClick={handleSlotClick} />
      )}

      {/* Event Popover (quick view) */}
      {popover && (
        <EventPopover
          event={popover.event}
          position={popover.position}
          onEdit={openEditModal}
          onDelete={(id) => { deleteMutation.mutate(id); setPopover(null); }}
          onDuplicate={handleDuplicate}
          onClose={() => setPopover(null)}
        />
      )}

      {/* Full Event Modal */}
      {showModal && (
        <EventModal
          event={selectedEvent}
          selectedDate={selectedDate}
          prefillTimes={prefillTimes}
          onSave={handleSave}
          onDelete={(id) => deleteMutation.mutate(id)}
          onDuplicate={handleDuplicate}
          onClose={closeModal}
        />
      )}
    </div>
  );
}