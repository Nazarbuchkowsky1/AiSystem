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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.status === "active";
          return (
            <button
              key={tool.name}
              className="glass-panel glass-panel-hover p-5 text-left transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
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
                  <span className="text-[10px]" style={{ color: isActive ? "#22c55e" : "var(--text-muted)" }}>
                    {isActive ? "Active" : "Offline"}
                  </span>
                </div>
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tool.name}</h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{tool.description}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tool.runs} executions</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}