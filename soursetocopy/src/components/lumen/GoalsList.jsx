import React, { useState } from "react";
import { Target, Plus, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function GoalsList({ goals, areas, onCreate, onUpdate, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", area_id: "", deadline: "", description: "" });

  const handleCreate = () => {
    if (!form.title.trim()) return;
    onCreate({ ...form, status: "active", progress: 0 });
    setForm({ title: "", area_id: "", deadline: "", description: "" });
    setShowAdd(false);
  };

  const activeGoals = (goals || []).filter(g => g.status === "active");
  const completedGoals = (goals || []).filter(g => g.status === "completed");

  return (
    <div style={{
      background: "linear-gradient(145deg, #131313, #0e0e0e)",
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
      padding: 22, position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: 0, left: "30%", right: "30%", height: 1, background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target style={{ width: 15, height: 15, color: "#3b82f6" }} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>Goals</span>
            <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>{activeGoals.length} active</span>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          width: 30, height: 30, borderRadius: 10,
          background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#3b82f6"
        }}>
          <Plus style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.02)", borderRadius: 14, padding: 14, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="What do you want to achieve?" onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#f5f5f5", fontSize: 13, outline: "none" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <select value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value })}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 8px", color: "#888", fontSize: 11 }}>
              <option value="">No area</option>
              {(areas || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 8px", color: "#888", fontSize: 11 }} />
          </div>
          <button onClick={handleCreate} style={{ alignSelf: "flex-end", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "7px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Create</button>
        </div>
      )}

      {activeGoals.length === 0 && !showAdd && (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "#444" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🎯</div>
          <div style={{ fontSize: 12, color: "#555" }}>Set goals to track your progress</div>
        </div>
      )}

      {activeGoals.map(goal => {
        const area = areas?.find(a => a.id === goal.area_id);
        const pct = goal.progress || 0;
        return (
          <div key={goal.id} style={{
            padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {area && <div style={{ width: 3, height: 20, borderRadius: 2, background: area.color || "#3b82f6", flexShrink: 0 }} />}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#eee" }}>{goal.title}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => onUpdate(goal.id, { status: "completed", progress: 100 })}
                  style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check style={{ width: 12, height: 12, color: "#22c55e" }} />
                </button>
                <button onClick={() => onDelete(goal.id)}
                  style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 style={{ width: 12, height: 12, color: "#ef4444" }} />
                </button>
              </div>
            </div>
            {goal.description && <p style={{ fontSize: 11, color: "#555", marginBottom: 6, paddingLeft: 14 }}>{goal.description}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 14 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${area?.color || "#3b82f6"}, ${area?.color || "#60a5fa"}90)`, transition: "width 0.4s ease" }} />
              </div>
              <span style={{ fontSize: 10, color: "#888", fontWeight: 700, minWidth: 28 }}>{pct}%</span>
              {goal.deadline && <span style={{ fontSize: 10, color: "#444" }}>{format(new Date(goal.deadline), "MMM d")}</span>}
            </div>
            <div style={{ paddingLeft: 14, marginTop: 6 }}>
              <input type="range" min={0} max={100} step={5} value={pct}
                onChange={e => onUpdate(goal.id, { progress: Number(e.target.value) })}
                style={{ width: "100%", height: 4, appearance: "none", background: "rgba(255,255,255,0.04)", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: area?.color || "#3b82f6" }} />
            </div>
          </div>
        );
      })}

      {completedGoals.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 10, color: "#444", fontWeight: 700, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Completed · {completedGoals.length}</div>
          {completedGoals.slice(0, 3).map(g => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", opacity: 0.4 }}>
              <Check style={{ width: 12, height: 12, color: "#22c55e" }} />
              <span style={{ fontSize: 11, color: "#888", textDecoration: "line-through" }}>{g.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}