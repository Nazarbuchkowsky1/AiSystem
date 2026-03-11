import React, { useState } from "react";
import { X, Copy, Check, Save } from "lucide-react";

export default function FullscreenCodeEditor({ code, onClose, onSave, readOnly }) {
  const [value, setValue] = useState(code || "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "#0a0a0a", display: "flex", flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Code Editor</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleCopy} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: copied ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${copied ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)"}`,
            color: copied ? "#f97316" : "#888",
            borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer",
            transition: "all 0.2s"
          }}>
            {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {!readOnly && onSave && (
            <button onClick={() => { onSave(value); onClose(); }} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)",
              color: "#f97316", borderRadius: 8, padding: "6px 12px", fontSize: 11,
              fontWeight: 600, cursor: "pointer"
            }}>
              <Save style={{ width: 12, height: 12 }} /> Save
            </button>
          )}
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#888", borderRadius: 8, padding: 6, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        value={value}
        onChange={e => !readOnly && setValue(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        style={{
          flex: 1, width: "100%", background: "#0a0a0a",
          border: "none", padding: "20px 24px",
          color: "#22c55e", fontSize: 13,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          lineHeight: 1.7, outline: "none", resize: "none",
          boxSizing: "border-box",
          caretColor: "#f97316"
        }}
      />
    </div>
  );
}