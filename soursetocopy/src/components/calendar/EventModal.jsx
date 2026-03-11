import React, { useState, useEffect } from "react";
import { X, Trash2, Clock, AlignLeft, Tag, Copy } from "lucide-react";
import { format } from "date-fns";

const EVENT_TYPES = [
  { value: "task", label: "Task", color: "#f97316" },
  { value: "meeting", label: "Meeting", color: "#3b82f6" },
  { value: "reminder", label: "Reminder", color: "#a855f7" },
  { value: "activity", label: "Activity", color: "#22c55e" },
];

export default function EventModal({ event, selectedDate, prefillTimes, onSave, onDelete, onDuplicate, onClose }) {
  const [form, setForm] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "10:00",
    description: "",
    event_type: "task",
  });

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("modal-open", { detail: true }));
    return () => window.dispatchEvent(new CustomEvent("modal-open", { detail: false }));
  }, []);

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title || "",
        date: event.date || format(new Date(), "yyyy-MM-dd"),
        start_time: event.start_time || "09:00",
        end_time: event.end_time || "10:00",
        description: event.description || "",
        event_type: event.event_type || "task",
      });
    } else {
      const newForm = { ...form };
      if (selectedDate) newForm.date = format(selectedDate, "yyyy-MM-dd");
      if (prefillTimes) {
        newForm.start_time = prefillTimes.start_time;
        newForm.end_time = prefillTimes.end_time;
      }
      setForm(newForm);
    }
  }, [event, selectedDate, prefillTimes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form, event?.id);
  };

  const currentTypeColor = EVENT_TYPES.find(t => t.value === form.event_type)?.color || "#f97316";

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
    background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)",
    color: "#f5f5f5", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s", fontFamily: "inherit"
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div style={{
        background: isMobile ? "#0a0a0a" : "#151515",
        border: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: isMobile ? 0 : 12,
        width: "100%", maxWidth: isMobile ? "100%" : 480,
        height: isMobile ? "100%" : "auto",
        maxHeight: isMobile ? "100%" : "90vh",
        overflow: "auto", msOverflowStyle: "none", scrollbarWidth: "none",
        boxShadow: isMobile ? "none" : "0 25px 50px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>

        <div style={{ height: 4, background: currentTypeColor, borderRadius: isMobile ? 0 : "12px 12px 0 0" }} />

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f5" }}>
              {event ? "Edit Event" : "New Event"}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {event && onDuplicate && (
                <button type="button" onClick={() => { onDuplicate(event); onClose(); }} title="Duplicate" style={iconBtnStyle}>
                  <Copy style={{ width: 16, height: 16 }} />
                </button>
              )}
              <button type="button" onClick={onClose} style={iconBtnStyle}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          {/* Title */}
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Add title"
            autoFocus
            style={{
              ...inputStyle, fontSize: 20, fontWeight: 500,
              background: "transparent", border: "none",
              borderBottom: "2px solid rgba(255,255,255,0.08)",
              borderRadius: 0, padding: "8px 0 12px", marginBottom: 24
            }}
            onFocus={e => e.target.style.borderBottomColor = currentTypeColor}
            onBlur={e => e.target.style.borderBottomColor = "rgba(255,255,255,0.08)"}
          />

          {/* Date & Time */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
            <Clock style={{ width: 18, height: 18, color: "#555", marginTop: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <input
                type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={{ ...inputStyle, marginBottom: 8, colorScheme: "dark" }}
                onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="time" value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  style={{ ...inputStyle, flex: 1, colorScheme: "dark" }}
                  onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                <span style={{ color: "#555", alignSelf: "center", fontSize: 13 }}>–</span>
                <input type="time" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  style={{ ...inputStyle, flex: 1, colorScheme: "dark" }}
                  onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
              </div>
            </div>
          </div>

          {/* Event Type */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
            <Tag style={{ width: 18, height: 18, color: "#555", marginTop: 6, flexShrink: 0 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EVENT_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm({ ...form, event_type: t.value })}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: form.event_type === t.value ? t.color : "rgba(255,255,255,0.04)",
                    color: form.event_type === t.value ? "#fff" : "#888",
                    border: `1px solid ${form.event_type === t.value ? t.color : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 28 }}>
            <AlignLeft style={{ width: 18, height: 18, color: "#555", marginTop: 10, flexShrink: 0 }} />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add description"
              rows={3}
              style={{ ...inputStyle, resize: "none", overflow: "auto", msOverflowStyle: "none", scrollbarWidth: "none" }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {event ? (
              <button type="button" onClick={() => onDelete(event.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  borderRadius: 8, background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
                  fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
              >
                <Trash2 style={{ width: 14, height: 14 }} /> Delete
              </button>
            ) : <div />}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose}
                style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#aaa", cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                Cancel
              </button>
              <button type="submit"
                style={{
                  padding: "8px 24px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: currentTypeColor, color: "#fff", border: "none",
                  cursor: form.title.trim() ? "pointer" : "not-allowed",
                  opacity: form.title.trim() ? 1 : 0.5, transition: "all 0.15s"
                }}
              >
                {event ? "Save" : "Create"}
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          {!event && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[["Esc", "Close"], ["C", "New event"], ["T", "Today"], ["D/W/M", "Views"]].map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#666", fontFamily: "monospace", fontWeight: 600 }}>{key}</span>
                  <span style={{ fontSize: 10, color: "#444" }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  background: "none", border: "none", cursor: "pointer", color: "#666",
  display: "flex", padding: 6, borderRadius: 8, transition: "all 0.15s"
};