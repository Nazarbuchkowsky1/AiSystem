import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import TOOLS_LIST from "../components/shared/toolsList";

export default function Tools() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "10px 16px", gap: 12, overflow: "hidden", background: "#0a0a0a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>Tools</h1>
        <button
          style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
        >
          + Add Tool
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "auto" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(10,10,10,0.75)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              zIndex: 10,
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 style={{ width: 32, height: 32, color: "#f97316", animation: "tools-page-spin 1s linear infinite" }} />
            </div>
          </div>
        )}
        {!loading && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {TOOLS_LIST.map((tool) => {
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
                   <div style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#22c55e" : "#ef4444", boxShadow: isActive ? "0 0 6px rgba(34,197,94,0.5)" : "0 0 6px rgba(239,68,68,0.5)" }} />
                   <span style={{ fontSize: 10, color: isActive ? "#22c55e" : "#ef4444" }}>{isActive ? "Active" : "Offline"}</span>
                 </div>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>{tool.label}</p>
              <p style={{ fontSize: 11, color: "#555", marginBottom: 8, lineHeight: 1.5 }}>{tool.description}</p>
              <p style={{ fontSize: 10, color: "#444" }}>{tool.runs} executions</p>
            </button>
          );
        })}
      </div>
        )}
      </div>
      <style>{`@keyframes tools-page-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}