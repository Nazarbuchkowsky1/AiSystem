import React, { useState } from "react";
import { Plus, Trash2, Compass } from "lucide-react";

const PRESET_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#06b6d4", "#ec4899"];
const PRESET_AREAS = [
  { name: "Health", color: "#22c55e", icon: "heart" },
  { name: "Career", color: "#3b82f6", icon: "briefcase" },
  { name: "Mindset", color: "#a855f7", icon: "brain" },
  { name: "Finance", color: "#eab308", icon: "wallet" },
  { name: "Relationships", color: "#ec4899", icon: "users" },
  { name: "Fitness", color: "#ef4444", icon: "dumbbell" },
  { name: "Skills", color: "#06b6d4", icon: "zap" },
  { name: "Creativity", color: "#f97316", icon: "palette" },
];

export default function AreaManager({ areas, onCreate, onUpdate, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#f97316" });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    onCreate({ name: form.name.trim(), color: form.color, current_score: 1, target_score: 10, order: (areas || []).length });
    setForm({ name: "", color: "#f97316" });
    setShowAdd(false);
  };

  const handlePreset = (preset) => {
    onCreate({ ...preset, current_score: 1, target_score: 10, order: (areas || []).length });
  };

  const existingNames = (areas || []).map(a => a.name.toLowerCase());
  const availablePresets = PRESET_AREAS.filter(p => !existingNames.includes(p.name.toLowerCase()));

  return (
    <div style={{
      background: "linear-gradient(145deg, #131313, #0e0e0e)",
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
      padding: 22, position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: 0, left: "30%", right: "30%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Compass style={{ width: 15, height: 15, color: "#f97316" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>Life Areas</span>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          width: 30, height: 30, borderRadius: 10,
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#f97316"
        }}>
          <Plus style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {(areas || []).length === 0 && availablePresets.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>Quick start — choose your areas:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {availablePresets.map(p => (
              <button key={p.name} onClick={() => handlePreset(p)}
                style={{
                  background: `${p.color}10`, border: `1px solid ${p.color}30`, color: p.color,
                  borderRadius: 20, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${p.color}20`; e.currentTarget.style.borderColor = `${p.color}50`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${p.color}10`; e.currentTarget.style.borderColor = `${p.color}30`; }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Area name..." onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus
            style={{ flex: 1, minWidth: 120, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#f5f5f5", fontSize: 13, outline: "none" }} />
          <div style={{ display: "flex", gap: 3 }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                style={{
                  width: 22, height: 22, borderRadius: "50%", background: c,
                  border: form.color === c ? "2px solid #fff" : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: form.color === c ? `0 0 8px ${c}60` : "none"
                }} />
            ))}
          </div>
          <button onClick={handleCreate} style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(areas || []).map(area => (
          <div key={area.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 8px", borderRadius: 12,
            transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{
              width: 10, height: 10, borderRadius: "50%", background: area.color || "#f97316", flexShrink: 0,
              boxShadow: `0 0 10px ${area.color || "#f97316"}50`
            }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#eee" }}>{area.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: area.color || "#f97316", minWidth: 16, textAlign: "center" }}>{area.current_score || 1}</span>
              <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{
                  width: `${((area.current_score || 1) / 10) * 100}%`, height: "100%", borderRadius: 3,
                  background: `linear-gradient(90deg, ${area.color || "#f97316"}, ${area.color || "#f97316"}80)`,
                  transition: "width 0.3s ease"
                }} />
              </div>
              <input type="range" min={1} max={10} step={1} value={area.current_score || 1}
                onChange={e => onUpdate(area.id, { current_score: Number(e.target.value) })}
                style={{ width: 60, height: 4, appearance: "none", background: "transparent", outline: "none", cursor: "pointer", accentColor: area.color || "#f97316", flexShrink: 0 }} />
              <button onClick={() => onDelete(area.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0, flexShrink: 0, transition: "opacity 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <Trash2 style={{ width: 12, height: 12, color: "#ef4444" }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}