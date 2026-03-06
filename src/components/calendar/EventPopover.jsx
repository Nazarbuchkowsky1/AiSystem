import React from "react";
import { X, Pencil, Trash2, Clock, Copy, Tag } from "lucide-react";
import { format, parseISO } from "date-fns";

const TYPE_COLORS = {
  task: "#f97316",
  meeting: "#3b82f6",
  reminder: "#a855f7",
  activity: "#22c55e",
};

export default function EventPopover({ event, position, onEdit, onDelete, onDuplicate, onClose }) {
  if (!event) return null;
  const color = TYPE_COLORS[event.event_type] || "#f97316";

  let dateStr = "";
  try {
    dateStr = format(parseISO(event.date), "EEEE, MMMM d");
  } catch { dateStr = event.date; }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 45 }} onClick={onClose} />
      <div style={{
        position: "fixed",
        top: Math.min(position.y, window.innerHeight - 280),
        left: Math.min(position.x, window.innerWidth - 320),
        zIndex: 50, width: 300,
        background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        overflow: "hidden"
      }}>
        {/* Color bar */}
        <div style={{ height: 4, background: color }} />

        {/* Header actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 2, padding: "8px 8px 0" }}>
          <button onClick={() => { onDuplicate(event); onClose(); }} title="Duplicate" style={iconBtnStyle}>
            <Copy style={{ width: 15, height: 15 }} />
          </button>
          <button onClick={() => { onEdit(event); onClose(); }} title="Edit" style={iconBtnStyle}>
            <Pencil style={{ width: 15, height: 15 }} />
          </button>
          <button onClick={() => { onDelete(event.id); onClose(); }} title="Delete" style={{ ...iconBtnStyle, color: "#ef4444" }}>
            <Trash2 style={{ width: 15, height: 15 }} />
          </button>
          <button onClick={onClose} title="Close" style={iconBtnStyle}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "8px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {event.title}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Clock style={{ width: 14, height: 14, color: "#666", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#aaa" }}>
              {dateStr}
              {event.start_time && ` · ${event.start_time}`}
              {event.end_time && ` – ${event.end_time}`}
            </span>
          </div>

          {event.event_type && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Tag style={{ width: 14, height: 14, color: "#666", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#888", textTransform: "capitalize" }}>{event.event_type}</span>
            </div>
          )}

          {event.description && (
            <p style={{ fontSize: 12, color: "#777", marginTop: 8, lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
              {event.description}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

const iconBtnStyle = {
  background: "none", border: "none", cursor: "pointer", color: "#888",
  display: "flex", padding: 6, borderRadius: 6, transition: "all 0.15s"
};