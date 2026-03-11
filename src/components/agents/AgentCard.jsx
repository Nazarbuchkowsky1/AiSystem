import React from "react";
import { Rocket, Brain, Palette, Bot, Zap, Sparkles, Cpu, Settings, Pencil } from "lucide-react";

const ICON_MAP = {
  Rocket,
  Brain,
  Palette,
  Bot,
  Zap,
  Sparkles,
  Cpu,
  Settings,
};

export default function AgentCard({ agent, onClick, onEdit }) {
  const Icon = ICON_MAP[agent.icon_name] || ICON_MAP[agent.icon] || Brain;
  const isActive = agent.status === "active";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        padding: 18,
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.25s ease",
        width: "100%",
        background: "linear-gradient(145deg, #141414, #0f0f0f)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(249,115,22,0.2)";
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(249,115,22,0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Top glow to match ToolCard */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "20%",
          right: "20%",
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.2), transparent)",
        }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {agent.icon_url ? (
              <img
                src={agent.icon_url}
                alt=""
                style={{ width: 40, height: 40, objectFit: "cover" }}
              />
            ) : (
              <Icon style={{ width: 18, height: 18, color: "#f97316" }} />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              className={isActive ? "status-pulse" : ""}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isActive ? "#22c55e" : "#ef4444",
                boxShadow: isActive
                  ? "0 0 8px rgba(34,197,94,0.5)"
                  : "0 0 8px rgba(239,68,68,0.5)",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: isActive ? "#22c55e" : "#ef4444",
                fontWeight: 500,
              }}
            >
              {isActive ? "Active" : "Offline"}
            </span>
          </div>
        </div>

        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#f5f5f5",
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          {agent.name}
        </p>
        <p
          style={{
            fontSize: 11,
            color: "#555",
            marginBottom: 8,
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {agent.description}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          cursor: "pointer",
        }}
        onClick={(e) => {
          if (!e.target.closest("button")) onClick?.();
        }}
      >
        <span style={{ fontSize: 10, color: "#333" }}>
          {agent.message_count || 0} messages
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onEdit(agent);
          }}
          style={{
            background: "rgba(249,115,22,0.1)",
            border: "1px solid rgba(249,115,22,0.2)",
            color: "#f97316",
            cursor: "pointer",
            padding: 5,
            borderRadius: 6,
            display: "flex",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(249,115,22,0.2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(249,115,22,0.1)")
          }
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}