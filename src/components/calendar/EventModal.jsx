import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { format } from "date-fns";

const EVENT_TYPES = ["task", "reminder", "meeting", "activity"];

export default function EventModal({ event, selectedDate, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "10:00",
    description: "",
    event_type: "task",
  });

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
    } else if (selectedDate) {
      setForm((f) => ({ ...f, date: format(selectedDate, "yyyy-MM-dd") }));
    }
  }, [event, selectedDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form, event?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="glass-panel w-full max-w-md p-6" style={{ border: "1px solid rgba(249,115,22,0.15)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {event ? "Edit Event" : "New Event"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none transition"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
              placeholder="Event title..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Start</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>End</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", colorScheme: "dark" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Type</label>
            <div className="flex gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, event_type: t })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize"
                  style={{
                    background: form.event_type === t ? "var(--accent-dim)" : "var(--bg-secondary)",
                    color: form.event_type === t ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${form.event_type === t ? "rgba(249,115,22,0.3)" : "var(--border-subtle)"}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {event ? (
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition hover:bg-red-500/10"
                style={{ color: "#ef4444" }}
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium transition hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-medium transition hover:opacity-90"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {event ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}