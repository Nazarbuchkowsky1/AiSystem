import React, { useState, useEffect } from "react";
import {
  X, Download, Trash2, Code, Play, Copy, Check, Maximize2,
  Youtube, BookOpen, Wrench, Terminal, Globe, Database,
  FileCode, Cpu, Cog, Zap, Brain, Search, FileText,
  Bot, Sparkles, Settings, Palette, Rocket
} from "lucide-react";
import FullscreenCodeEditor from "./FullscreenCodeEditor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/themes/prism-tomorrow.css";

const ICON_MAP = {
  Youtube, BookOpen, Wrench, Terminal, Globe, Database,
  FileCode, Cpu, Cog, Code, Zap, Brain, Search, FileText,
  Bot, Sparkles, Settings, Palette, Rocket
};

export default function ToolDetailModal({ tool, onClose, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editCode, setEditCode] = useState(tool.code || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  const Icon = ICON_MAP[tool.icon_name] || Wrench;
  const isBuiltin = tool.tool_type === "builtin";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => onClose(), 220);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
  };

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

  const show = mounted && !closing;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        opacity: show ? 1 : 0,
        transition: "opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onClick={showFullscreen ? undefined : handleClose}
    >
      <div
        style={{
          position: "relative",
          width: "90%",
          maxWidth: 560,
          background: "linear-gradient(145deg, #141414, #0c0c0c)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
          transform: show ? "scale(1)" : "scale(0.96)",
          opacity: show ? 1 : 0,
          transition:
            "opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)" }} />

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
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
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isBuiltin && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#f97316",
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    BUILT-IN
                  </span>
                )}
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: tool.status === "active" ? "#22c55e" : "#ef4444",
                    boxShadow:
                      tool.status === "active"
                        ? "0 0 8px rgba(34,197,94,0.5)"
                        : "0 0 8px rgba(239,68,68,0.5)",
                  }}
                />
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#f5f5f5",
                  }}
                >
                  {tool.name}
                </div>
              </div>
              {tool.description && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#888",
                    marginTop: 4,
                    maxWidth: 360,
                    lineHeight: 1.5,
                  }}
                >
                  {tool.description}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#555",
              display: "flex",
              padding: 4,
              borderRadius: 6,
              transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.12)"; e.currentTarget.style.color = "#f97316"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#555"; }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "0 22px 22px", overflow: "visible", flex: 1 }}>
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
                      borderRadius: 12, padding: "12px 14px", color: "#e5e7eb", fontSize: 12,
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
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  padding: "12px 14px",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <pre
                    style={{
                      fontSize: 11,
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      lineHeight: 1.6,
                      whiteSpace: "pre",
                      margin: 0,
                    }}
                  >
                    <code
                      className="language-tsx"
                      dangerouslySetInnerHTML={{
                        __html: Prism.highlight(
                          tool.code || "// No code configured",
                          Prism.languages.tsx,
                          "tsx"
                        ),
                      }}
                    />
                  </pre>
                  {tool.code && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <button
                        onClick={() => {
                        navigator.clipboard.writeText(tool.code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                        style={{
                          background: copied ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${copied ? "rgba(249,115,22,0.25)" : "transparent"}`,
                          borderRadius: 6,
                          padding: 5,
                          cursor: "pointer",
                          color: copied ? "#f97316" : "#666",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      </button>
                      <button
                        onClick={() => setShowFullscreen(true)}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid transparent",
                          borderRadius: 6,
                          padding: 5,
                          cursor: "pointer",
                          color: "#666",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
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
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end" }}>
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

