import React, { useState, useRef } from "react";
import { X, Upload, Download, Code } from "lucide-react";

export default function NewToolModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("Wrench");
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState("details"); // details | code
  const fileRef = useRef(null);

  const ICONS = ["Wrench", "Terminal", "Globe", "Database", "FileCode", "Cpu", "Code", "Zap", "Brain", "Search", "FileText", "Youtube", "BookOpen"];

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      icon_name: iconName,
      tool_type: "custom",
      code: code.trim(),
      status: "active",
      execution_count: 0
    });
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      try {
        const data = JSON.parse(content);
        if (data.name) setName(data.name);
        if (data.description) setDescription(data.description);
        if (data.icon_name) setIconName(data.icon_name);
        if (data.code) { setCode(data.code); setActiveTab("code"); }
      } catch {
        // If it's not JSON, treat as code
        setCode(content);
        setActiveTab("code");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} />
      <div style={{
        position: "relative", width: "90%", maxWidth: 560,
        background: "linear-gradient(145deg, #141414, #0c0c0c)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, overflow: "hidden",
        maxHeight: "90vh", display: "flex", flexDirection: "column"
      }}>
        {/* Top glow */}
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)" }} />

        {/* Header */}
        <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>New Tool</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="file" ref={fileRef} accept=".json,.js,.txt" style={{ display: "none" }} onChange={handleImport} />
            <button onClick={() => fileRef.current?.click()} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#888", borderRadius: 10, padding: "6px 12px", fontSize: 11, cursor: "pointer"
            }}>
              <Upload style={{ width: 12, height: 12 }} /> Import
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "10px 22px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {[{ key: "details", label: "Details" }, { key: "code", label: "Code" }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              background: activeTab === t.key ? "rgba(249,115,22,0.1)" : "transparent",
              color: activeTab === t.key ? "#f97316" : "#666",
              border: "none", borderBottom: activeTab === t.key ? "2px solid #f97316" : "2px solid transparent",
              cursor: "pointer", borderRadius: "8px 8px 0 0"
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 22, overflow: "auto", flex: 1 }}>
          {activeTab === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 6, display: "block" }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Tool name..."
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#f5f5f5", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 6, display: "block" }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this tool do..."
                  rows={3}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#ccc", fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 6, display: "block" }}>Icon</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ICONS.map(ic => (
                    <button key={ic} onClick={() => setIconName(ic)} style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                      background: iconName === ic ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
                      border: iconName === ic ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      color: iconName === ic ? "#f97316" : "#888", cursor: "pointer"
                    }}>{ic}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "code" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Code style={{ width: 14, height: 14, color: "#f97316" }} />
                <span style={{ fontSize: 12, color: "#888" }}>Webhook / API / Custom code</span>
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)}
                placeholder={"// Your custom integration code here\n// This can be a webhook URL, API call, or any custom logic\n\n// Example:\n// POST https://your-api.com/webhook\n// { \"action\": \"process\", \"data\": \"...\" }"}
                rows={16}
                style={{
                  width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: "14px 16px", color: "#22c55e", fontSize: 12,
                  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace", lineHeight: 1.6,
                  outline: "none", resize: "vertical", boxSizing: "border-box"
                }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 10, fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#888", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            padding: "8px 24px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: name.trim() ? "#f97316" : "#333", color: "#fff",
            border: "none", cursor: name.trim() ? "pointer" : "default",
            opacity: name.trim() ? 1 : 0.5
          }}>Create Tool</button>
        </div>
      </div>
    </div>
  );
}