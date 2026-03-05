import React from "react";
import { Rocket, Brain, Palette, Bot } from "lucide-react";

const ICON_MAP = {
  Rocket,
  Brain,
  Palette,
  Bot,
};

export default function AgentCard({ agent, onClick }) {
  const Icon = ICON_MAP[agent.icon] || Bot;
  const isActive = agent.status === "active";

  return (
    <button
      onClick={onClick}
      className="glass-panel-hover"
      style={{ padding: 14, textAlign: "left", cursor: "pointer", transition: "all 0.2s", width: "100%", background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
         <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "4px 0 0", border: "1px solid rgba(249,115,22,0.2)" }}>
           <Icon style={{ width: 16, height: 16, color: "#f97316" }} />
         </div>
         <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
           <div className={isActive ? "status-pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#22c55e" : "#555", boxShadow: isActive ? "0 0 8px rgba(34,197,94,0.6), 0 0 16px rgba(34,197,94,0.3)" : "none" }} />
           <span style={{ fontSize: 10, color: isActive ? "#22c55e" : "#555" }}>{isActive ? "Active" : "Offline"}</span>
         </div>
       </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>{agent.name}</p>
      <p style={{ fontSize: 11, color: "#555", marginBottom: 8, lineHeight: 1.5 }}>{agent.description}</p>
      <span style={{ fontSize: 10, color: "#444" }}>{agent.message_count || 0} messages</span>
    </button>
  );
}