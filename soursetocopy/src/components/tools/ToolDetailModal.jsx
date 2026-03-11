import React, { useState } from "react";
import {
  X, Download, Trash2, Code, Play, Copy, Check, Maximize2,
  Youtube, BookOpen, Wrench, Terminal, Globe, Database,
  FileCode, Cpu, Cog, Zap, Brain, Search, FileText
} from "lucide-react";
import FullscreenCodeEditor from "./FullscreenCodeEditor";

const ICON_MAP = {
  Youtube, BookOpen, Wrench, Terminal, Globe, Database,
  FileCode, Cpu, Cog, Code, Zap, Brain, Search, FileText
};

export default function ToolDetailModal({ tool, onClose, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editCode, setEditCode] = useState(tool.code || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const Icon = ICON_MAP[tool.icon_name] || Wrench;
  const isBuiltin = tool.tool_type === "builtin";

  const handleExport = () => {
    const exportData = {
      name: tool.name,
      description: tool.description,
      icon_name: tool.icon_name,
      tool_type: tool.tool_type,
      code: tool.code || ""
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tool.name.toLowerCase().replace(/\s+/g, "-")}.tool.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveCode = () => {
    onUpdate(tool.id, { code: editCode });
    setEditing(false);
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
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)" }} />

        {/* Header */}
        <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Icon style={{ width: 18, height: 18, color: "#f97316" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{tool.name}</div>
              {isBuiltin && <span style={{ fontSize: 9, color: "#f97316", fontWeight: 600, letterSpacing: "0.03em" }}>BUILT-IN</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 22, overflow: "auto", flex: 1 }}>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 20 }}>{tool.description}</p>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: "#444", background: "rgba(255,255,255,0.03)", padding: "4px 10px", borderRadius: 8 }}>
              {tool.execution_count || 0} executions
            </span>
            <span style={{ fontSize: 11, color: tool.status === "active" ? "#22c55e" : "#ef4444", background: tool.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", padding: "4px 10px", borderRadius: 8 }}>
              {tool.status}
            </span>
          </div>

          {/* Code section */}
          {(tool.code || !isBuiltin) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Code style={{ width: 13, height: 13, color: "#f97316" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#888" }}>Code</span>
                </div>
                {!isBuiltin && (
                  <button onClick={() => setEditing(!editing)} style={{
                    fontSize: 11, color: "#f97316", background: "rgba(249,115,22,0.1)",
                    border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "4px 10px", cursor: "pointer"
                  }}>{editing ? "Cancel" : "Edit"}</button>
                )}
              </div>
              {editing ? (
                <>
                  <textarea value={editCode} onChange={e => setEditCode(e.target.value)}
                    rows={12}
                    style={{
                      width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, padding: "12px 14px", color: "#22c55e", fontSize: 12,
                      fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.6,
                      outline: "none", resize: "vertical", boxSizing: "border-box"
                    }} />
                  <button onClick={handleSaveCode} style={{
                    marginTop: 8, background: "#f97316", color: "#fff", border: "none",
                    borderRadius: 10, padding: "7px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>Save Code</button>
                </>
              ) : (
                <div style={{
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: "12px 14px", position: "relative"
                }}>
                  <pre style={{ color: "#22c55e", fontSize: 11, fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
                    {tool.code || "// No code configured"}
                  </pre>
                  {tool.code && (
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                      <button onClick={() => {
                        navigator.clipboard.writeText(tool.code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }} style={{
                        background: copied ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${copied ? "rgba(249,115,22,0.25)" : "transparent"}`,
                        borderRadius: 6, padding: 5, cursor: "pointer",
                        color: copied ? "#f97316" : "#666",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s"
                      }}>
                        {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      </button>
                      <button onClick={() => setShowFullscreen(true)} style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid transparent",
                        borderRadius: 6, padding: 5, cursor: "pointer", color: "#666",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <Maximize2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleExport} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#888", borderRadius: 10, padding: "7px 14px", fontSize: 11, cursor: "pointer"
            }}>
              <Download style={{ width: 12, height: 12 }} /> Export
            </button>
          </div>
          {!isBuiltin && (
            confirmDelete ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#ef4444" }}>Delete?</span>
                <button onClick={() => { onDelete(tool.id); onClose(); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Yes</button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: "rgba(255,255,255,0.06)", color: "#888", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11, cursor: "pointer" }}>No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                color: "#ef4444", borderRadius: 10, padding: "7px 14px", fontSize: 11, cursor: "pointer"
              }}>
                <Trash2 style={{ width: 12, height: 12 }} /> Delete
              </button>
            )
          )}
        </div>
      </div>

      {showFullscreen && (
        <FullscreenCodeEditor
          code={tool.code || ""}
          readOnly={isBuiltin}
          onClose={() => setShowFullscreen(false)}
          onSave={!isBuiltin ? (newCode) => {
            onUpdate(tool.id, { code: newCode });
            setEditCode(newCode);
          } : undefined}
        />
      )}
    </div>
  );
}