import React from "react";
import { Terminal, Globe, Database, FileCode, Cpu, Cog } from "lucide-react";

const TOOLS = [
  { name: "Script Runner", description: "Execute custom scripts and automations", icon: Terminal, status: "active", runs: 142 },
  { name: "Web Scraper", description: "Extract data from websites and APIs", icon: Globe, status: "active", runs: 89 },
  { name: "Data Processor", description: "Transform and analyze datasets", icon: Database, status: "active", runs: 234 },
  { name: "Code Generator", description: "Generate code snippets and templates", icon: FileCode, status: "offline", runs: 67 },
  { name: "Local AI Bridge", description: "Connect to local AI models and services", icon: Cpu, status: "active", runs: 156 },
  { name: "System Utility", description: "System maintenance and monitoring tools", icon: Cog, status: "active", runs: 312 },
];

export default function Tools() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "10px 16px", gap: 12, overflow: "hidden", background: "#0a0a0a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>Tools</h1>
        <button
          style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
        >
          + Add Tool
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, overflow: "auto" }}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.status === "active";
          return (
            <button
              key={tool.name}
              className="glass-panel-hover"
              style={{ padding: 14, textAlign: "left", cursor: "pointer", transition: "all 0.2s", background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <Icon style={{ width: 16, height: 16, color: "#f97316" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#22c55e" : "#555", boxShadow: isActive ? "0 0 6px rgba(34,197,94,0.5)" : "none" }} />
                  <span style={{ fontSize: 10, color: isActive ? "#22c55e" : "#555" }}>{isActive ? "Active" : "Offline"}</span>
                </div>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>{tool.name}</p>
              <p style={{ fontSize: 11, color: "#555", marginBottom: 8, lineHeight: 1.5 }}>{tool.description}</p>
              <p style={{ fontSize: 10, color: "#444" }}>{tool.runs} executions</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}