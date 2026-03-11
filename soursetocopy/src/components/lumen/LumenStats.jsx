import React from "react";
import { TrendingUp, Target, Flame, Zap, Trophy } from "lucide-react";

export default function LumenStats({ areas, goals, habits, habitLogs, skills }) {
  const avgScore = areas?.length
    ? (areas.reduce((s, a) => s + (a.current_score || 1), 0) / areas.length).toFixed(1)
    : "—";

  const activeGoals = (goals || []).filter(g => g.status === "active").length;
  const completedGoals = (goals || []).filter(g => g.status === "completed").length;

  const today = new Date().toISOString().slice(0, 10);
  const activeHabits = (habits || []).filter(h => h.is_active !== false);
  const todayDone = (habitLogs || []).filter(l => l.date === today && l.completed).length;
  const todayRate = activeHabits.length ? Math.round((todayDone / activeHabits.length) * 100) : 0;

  const totalSkills = (skills || []).length;
  const avgSkillLevel = totalSkills > 0 ? Math.round(skills.reduce((s, sk) => s + (sk.level || 0), 0) / totalSkills) : 0;

  const stats = [
    { label: "Life Score", value: avgScore, sub: "average", icon: TrendingUp, color: "#f97316", glow: "rgba(249,115,22,0.15)" },
    { label: "Today", value: `${todayRate}%`, sub: `${todayDone}/${activeHabits.length}`, icon: Flame, color: "#22c55e", glow: "rgba(34,197,94,0.15)" },
    { label: "Active Goals", value: activeGoals, sub: `${completedGoals} completed`, icon: Target, color: "#3b82f6", glow: "rgba(59,130,246,0.15)" },
    { label: "Skills", value: totalSkills, sub: `${avgSkillLevel}% avg`, icon: Zap, color: "#a855f7", glow: "rgba(168,85,247,0.15)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: "linear-gradient(145deg, #131313, #0e0e0e)",
          borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 18px", position: "relative", overflow: "hidden",
          transition: "all 0.3s ease"
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}30`; e.currentTarget.style.boxShadow = `0 4px 20px ${s.glow}`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {/* Top glow line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}50, transparent)` }} />
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `${s.color}12`, border: `1px solid ${s.color}20`,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <s.icon style={{ width: 15, height: 15, color: s.color }} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f5f5f5", lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
          <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}