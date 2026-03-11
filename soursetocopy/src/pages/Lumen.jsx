import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Sparkles } from "lucide-react";

import DailyRoutine from "../components/lumen/DailyRoutine";

export default function Lumen() {
  const queryClient = useQueryClient();

  // --- Data ---
  const { data: areas = [] } = useQuery({ queryKey: ["lifeAreas"], queryFn: () => base44.entities.LifeArea.list("order") });
  const { data: habits = [] } = useQuery({ queryKey: ["habits"], queryFn: () => base44.entities.DailyHabit.list() });

  const weekAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const { data: habitLogs = [] } = useQuery({
    queryKey: ["habitLogs"],
    queryFn: () => base44.entities.HabitLog.filter({ date: { $gte: weekAgo } }),
  });

  // --- Mutations ---
  const inv = (keys) => () => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));

  const createHabit = useMutation({ mutationFn: d => base44.entities.DailyHabit.create(d), onSuccess: inv(["habits"]) });
  const deleteHabit = useMutation({ mutationFn: id => base44.entities.DailyHabit.delete(id), onSuccess: inv(["habits"]) });

  const toggleHabitLog = useMutation({
    mutationFn: async ({ habitId, date, completed, logId }) => {
      if (logId && !completed) {
        await base44.entities.HabitLog.update(logId, { completed: false });
      } else if (logId) {
        await base44.entities.HabitLog.update(logId, { completed: true });
      } else {
        await base44.entities.HabitLog.create({ habit_id: habitId, date, completed: true });
      }
      const habit = habits.find(h => h.id === habitId);
      if (habit) {
        const newStreak = completed ? (habit.streak || 0) + 1 : 0;
        const bestStreak = Math.max(newStreak, habit.best_streak || 0);
        await base44.entities.DailyHabit.update(habitId, { streak: newStreak, best_streak: bestStreak });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["habitLogs"] }); queryClient.invalidateQueries({ queryKey: ["habits"] }); },
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
        background: "linear-gradient(90deg, rgba(249,115,22,0.03), transparent)"
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.08))",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(249,115,22,0.2)",
          boxShadow: "0 2px 12px rgba(249,115,22,0.15)"
        }}>
          <Sparkles style={{ width: 18, height: 18, color: "#f97316" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>Lumen</h1>
          <p style={{ fontSize: 11, color: "#555", margin: 0, fontWeight: 500 }}>Become the best version of yourself</p>
        </div>
      </div>

      {/* Content - Two column layout */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Two column layout — Daily Routine left, right reserved */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            {/* Left - Daily Routine */}
            <DailyRoutine habits={habits} habitLogs={habitLogs} areas={areas}
              onToggle={(habitId, date, completed, logId) => toggleHabitLog.mutate({ habitId, date, completed, logId })}
              onAdd={d => createHabit.mutate(d)} onDelete={id => deleteHabit.mutate(id)} />

            {/* Right - placeholder for future content */}
            <div />
          </div>
        </div>
      </div>
    </div>
  );
}