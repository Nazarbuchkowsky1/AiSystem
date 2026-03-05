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
      className="glass-panel glass-panel-hover p-6 text-left transition-all duration-300 group w-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-105"
          style={{ background: "var(--accent-dim)" }}
        >
          <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isActive ? "#22c55e" : "#555",
              boxShadow: isActive ? "0 0 8px rgba(34,197,94,0.5)" : "none",
            }}
          />
          <span className="text-[10px] font-medium" style={{ color: isActive ? "#22c55e" : "var(--text-muted)" }}>
            {isActive ? "Active" : "Offline"}
          </span>
        </div>
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {agent.name}
      </h3>
      <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
        {agent.description}
      </p>
      <div className="flex items-center gap-1">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {agent.message_count || 0} messages
        </span>
      </div>
    </button>
  );
}