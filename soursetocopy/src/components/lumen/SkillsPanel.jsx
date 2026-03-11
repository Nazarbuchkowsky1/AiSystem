import React, { useState } from "react";
import { Zap, Plus, Trash2 } from "lucide-react";

export default function SkillsPanel({ skills, areas, onCreate, onUpdate, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", area_id: "" });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    onCreate({ name: form.name.trim(), area_id: form.area_id || undefined, level: 0, target_level: 100 });
    setForm({ name: "", area_id: "" });
    setShowAdd(false);
  };

  const grouped = {};
  (skills || []).forEach(s => {
    const key = s.area_id || "other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  return (
    <div style={{
      background: "linear-gradient(145deg, #131313, #0e0e0e)",
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
      padding: 22, position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: 0, left: "30%", right: "30%", height: 1, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap style={{ width: 15, height: 15, color: "#a855f7" }} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>Skills</span>
            <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>{(skills || []).length} tracked</span>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          width: 30, height: 30, borderRadius: 10,
          background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#a855f7"
        }}>
          <Plus style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {showAdd && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Skill name..." onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus
            style={{ flex: 1, minWidth: 120, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#f5f5f5", fontSize: 13, outline: "none" }} />
          <select value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value })}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 8px", color: "#888", fontSize: 11 }}>
            <option value="">No area</option>
            {(areas || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={handleCreate} style={{ background: "#a855f7", color: "#fff", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
        </div>
      )}

      {(skills || []).length === 0 && !showAdd && (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "#444" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚡</div>
          <div style={{ fontSize: 12, color: "#555" }}>Add skills you want to master</div>
        </div>
      )}

      {Object.entries(grouped).map(([areaId, areaSkills]) => {
        const area = areas?.find(a => a.id === areaId);
        const areaColor = area?.color || "#a855f7";
        return (
          <div key={areaId} style={{ marginBottom: 14 }}>
            {area && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${areaColor}15` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: areaColor, boxShadow: `0 0 6px ${areaColor}40` }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: areaColor, letterSpacing: "0.03em" }}>{area.name}</span>
              </div>
            )}
            {!area && areaId === "other" && (skills || []).some(s => s.area_id) && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#444", marginBottom: 8, letterSpacing: "0.03em" }}>General</div>
            )}
            {areaSkills.map(skill => {
              const level = skill.level || 0;
              return (
                <div key={skill.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                  <span style={{ fontSize: 12, color: "#ddd", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{skill.name}</span>
                  <div style={{ width: 90, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ width: `${level}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${areaColor}, ${areaColor}90)`, transition: "width 0.4s ease" }} />
                  </div>
                  <input type="range" min={0} max={100} step={5} value={level}
                    onChange={e => onUpdate(skill.id, { level: Number(e.target.value) })}
                    style={{ width: 50, height: 4, appearance: "none", background: "transparent", outline: "none", cursor: "pointer", accentColor: areaColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#777", fontWeight: 700, minWidth: 26, textAlign: "right" }}>{level}%</span>
                  <button onClick={() => onDelete(skill.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0, flexShrink: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <Trash2 style={{ width: 11, height: 11, color: "#ef4444" }} />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}