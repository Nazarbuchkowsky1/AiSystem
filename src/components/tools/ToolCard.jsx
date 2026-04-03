import React from "react";
import {
  Youtube, BookOpen, Wrench, Terminal, Globe, Database,
  FileCode, Cpu, Cog, Code, Zap, Brain, Search, FileText,
  Bot, Sparkles, Settings, Palette, Rocket
} from "lucide-react";

const ICON_MAP = {
  Youtube, BookOpen, Wrench, Terminal, Globe, Database,
  FileCode, Cpu, Cog, Code, Zap, Brain, Search, FileText,
  Bot, Sparkles, Settings, Palette, Rocket
};

export default function ToolCard({ tool, onClick }) {
  const Icon = ICON_MAP[tool.icon_name] || Wrench;
  const isActive = tool.status === "active";
  const isBuiltin = tool.tool_type === "builtin";

  return (
    <button
      onClick={() => onClick(tool)}
      style={{
        padding: 18, textAlign: "left", cursor: "pointer",
        transition: "all 0.25s ease",
        background: "linear-gradient(145deg, #141414, #0f0f0f)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18,
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", gap: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.06), 0 8px 28px rgba(249,115,22,0.12)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Top glow */}
      <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.2), transparent)" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
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
          }}
        >
          {tool.icon_url ? (
            <img
              src={tool.icon_url}
              alt={tool.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Icon style={{ width: 18, height: 18, color: "#f97316" }} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isBuiltin && (
            <span style={{ fontSize: 9, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "2px 6px", borderRadius: 6, fontWeight: 600, letterSpacing: "0.03em" }}>ВБУДОВАНИЙ</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#22c55e" : "#ef4444", boxShadow: isActive ? "0 0 8px rgba(34,197,94,0.5)" : "0 0 8px rgba(239,68,68,0.5)" }} />
            <span style={{ fontSize: 10, color: isActive ? "#22c55e" : "#ef4444", fontWeight: 500 }}>{isActive ? "Активний" : "Офлайн"}</span>
          </div>
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
        {tool.name}
      </p>
      <p style={{ fontSize: 11, color: "#555", lineHeight: 1.5, marginBottom: 0 }}>
        {tool.description}
      </p>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#333" }}>{(() => {
          const n = Number(tool.execution_count) || 0;
          const a = n % 10;
          const b = n % 100;
          if (a === 1 && b !== 11) return `${n} запуск`;
          if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return `${n} запуски`;
          return `${n} запусків`;
        })()}</span>
        {tool.tool_type === "custom" && (
          <span style={{ fontSize: 10, color: "#444", display: "flex", alignItems: "center", gap: 3 }}>
            <Code style={{ width: 10, height: 10 }} /> Власний код
          </span>
        )}
      </div>
    </button>
  );
}

