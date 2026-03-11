import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { Flame, Plus, Trash2, Check, Sun, Moon, Coffee, Star } from "lucide-react";

const TIME_BLOCKS = [
  { key: "morning", label: "Morning", icon: Sun, color: "#fbbf24" },
  { key: "afternoon", label: "Afternoon", icon: Coffee, color: "#f97316" },
  { key: "evening", label: "Evening", icon: Moon, color: "#a855f7" },
];

export default function DailyRoutine({ habits, habitLogs, areas, onToggle, onAdd, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAreaId, setNewAreaId] = useState("");
  const [newBlock, setNewBlock] = useState("morning");

  const today = format(new Date(), "yyyy-MM-dd");
  const activeHabits = (habits || []).filter(h => h.is_active !== false);
  
  const todayLogs = useMemo(() => {
    const map = {};
    (habitLogs || []).filter(l => l.date === today).forEach(l => { map[l.habit_id] = l; });
    return map;
  }, [habitLogs, today]);

  const completedCount = activeHabits.filter(h => todayLogs[h.id]?.completed).length;
  const totalCount = activeHabits.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Calculate general streak (consecutive days where ALL habits were completed)
  const generalStreak = useMemo(() => {
    if (activeHabits.length === 0) return 0;
    let streak = 0;
    const d = new Date();
    // Check if today is done — if yes, count from today, otherwise from yesterday
    const todayAllDone = allDone;
    if (!todayAllDone) {
      d.setDate(d.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayLogs = (habitLogs || []).filter(l => l.date === dateStr && l.completed);
      const habitsCompletedToday = new Set(dayLogs.map(l => l.habit_id));
      const allCompleted = activeHabits.every(h => habitsCompletedToday.has(h.id));
      if (allCompleted) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    if (todayAllDone) return streak;
    return streak;
  }, [activeHabits, habitLogs, allDone]);

  // Group habits by time block (stored in notes field or default to "morning")
  const groupedHabits = useMemo(() => {
    const groups = { morning: [], afternoon: [], evening: [] };
    activeHabits.forEach(h => {
      const block = h.notes || "morning"; // using notes field to store time block
      if (groups[block]) groups[block].push(h);
      else groups.morning.push(h);
    });
    return groups;
  }, [activeHabits]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ name: newName.trim(), area_id: newAreaId || undefined, frequency: "daily", is_active: true, notes: newBlock });
    setNewName("");
    setNewAreaId("");
    setShowAdd(false);
  };

  return (
    <div style={{
      background: "linear-gradient(180deg, #111111 0%, #0d0d0d 100%)",
      borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
      padding: 0, overflow: "hidden", display: "flex", flexDirection: "column",
      position: "relative"
    }}>
      {/* Glow accent */}
      <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)" }} />

      {/* Header with streak */}
      <div style={{ padding: "20px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.02em" }}>Daily Routine</span>
            </div>
            <div style={{ fontSize: 11, color: "#555" }}>{format(new Date(), "EEEE, MMMM d")}</div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} style={{
            width: 30, height: 30, borderRadius: 10,
            background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
            color: "#f97316"
          }}>
            <Plus style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Streak banner */}
        <div style={{
          background: allDone
            ? "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.1))"
            : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
          borderRadius: 14, padding: "14px 16px", marginBottom: 16,
          border: allDone ? "1px solid rgba(249,115,22,0.25)" : "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 14,
          transition: "all 0.4s ease"
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: generalStreak > 0 ? "linear-gradient(135deg, #f97316, #fb923c)" : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: generalStreak > 0 ? "0 4px 20px rgba(249,115,22,0.3)" : "none",
            flexShrink: 0
          }}>
            <Flame style={{ width: 24, height: 24, color: generalStreak > 0 ? "#fff" : "#555" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: generalStreak > 0 ? "#f97316" : "#444", lineHeight: 1 }}>
              {generalStreak}
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {generalStreak === 0 ? "Complete all habits to start your streak" : generalStreak === 1 ? "day streak — keep going!" : "days streak — you're on fire!"}
            </div>
          </div>
          {allDone && <Star style={{ width: 20, height: 20, color: "#fbbf24", fill: "#fbbf24" }} />}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#888" }}>Today's progress</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? "#22c55e" : "#f97316" }}>{completedCount}/{totalCount}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: allDone
                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                : "linear-gradient(90deg, #f97316, #fb923c)",
              width: `${progressPct}%`,
              transition: "width 0.4s ease, background 0.4s ease",
              boxShadow: progressPct > 0 ? (allDone ? "0 0 12px rgba(34,197,94,0.4)" : "0 0 12px rgba(249,115,22,0.4)") : "none"
            }} />
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ padding: "0 22px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New habit..."
            onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", color: "#f5f5f5", fontSize: 13, outline: "none" }} />
          <div style={{ display: "flex", gap: 6 }}>
            {TIME_BLOCKS.map(b => (
              <button key={b.key} onClick={() => setNewBlock(b.key)}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
                  background: newBlock === b.key ? `${b.color}20` : "transparent",
                  border: newBlock === b.key ? `1px solid ${b.color}40` : "1px solid rgba(255,255,255,0.06)",
                  color: newBlock === b.key ? b.color : "#666", cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                }}>
                <b.icon style={{ width: 12, height: 12 }} /> {b.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={newAreaId} onChange={e => setNewAreaId(e.target.value)}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px", color: "#888", fontSize: 11 }}>
              <option value="">No area</option>
              {(areas || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={handleAdd} style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "6px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
        </div>
      )}

      {/* Habits list by time blocks */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 6px 10px" }}>
        {totalCount === 0 && !showAdd && (
          <div style={{ textAlign: "center", padding: "32px 20px", color: "#444" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌅</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#666", marginBottom: 4 }}>Build your routine</div>
            <div style={{ fontSize: 11, color: "#444" }}>Add daily habits to start tracking</div>
          </div>
        )}

        {TIME_BLOCKS.map(block => {
          const blockHabits = groupedHabits[block.key];
          if (!blockHabits || blockHabits.length === 0) return null;
          return (
            <div key={block.key} style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px 4px" }}>
                <block.icon style={{ width: 12, height: 12, color: block.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: block.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{block.label}</span>
              </div>
              {blockHabits.map(habit => {
                const log = todayLogs[habit.id];
                const done = log?.completed;
                const area = areas?.find(a => a.id === habit.area_id);
                return (
                  <div key={habit.id}
                    onClick={() => onToggle(habit.id, today, !done, log?.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", margin: "2px 0",
                      borderRadius: 12, cursor: "pointer",
                      background: done ? "rgba(249,115,22,0.08)" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={e => { if (!done) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!done) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Custom checkbox */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                      border: done ? "none" : "2px solid rgba(255,255,255,0.15)",
                      background: done ? "linear-gradient(135deg, #f97316, #fb923c)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.25s ease",
                      boxShadow: done ? "0 2px 10px rgba(249,115,22,0.3)" : "none"
                    }}>
                      {done && <Check style={{ width: 13, height: 13, color: "#fff", strokeWidth: 3 }} />}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500,
                        color: done ? "#888" : "#eee",
                        textDecoration: done ? "line-through" : "none",
                        transition: "all 0.2s",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        {habit.name}
                      </div>
                      {area && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <div style={{ width: 4, height: 4, borderRadius: 2, background: area.color || "#f97316" }} />
                          <span style={{ fontSize: 10, color: "#555" }}>{area.name}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(habit.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0, flexShrink: 0, transition: "opacity 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.7}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    >
                      <Trash2 style={{ width: 12, height: 12, color: "#ef4444" }} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}