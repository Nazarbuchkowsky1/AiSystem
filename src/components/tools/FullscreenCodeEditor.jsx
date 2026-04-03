import React, { useState, useEffect } from "react";
import { X, Copy, Check, Save } from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/themes/prism-tomorrow.css";

export default function FullscreenCodeEditor({ code, onClose, onSave, readOnly }) {
  const [value, setValue] = useState(code || "");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(), 180);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const show = mounted && !closing;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 240, // align with sidebar width so code is fully visible
        zIndex: 200,
        background: "rgba(0,0,0,0.96)",
        display: "flex",
        flexDirection: "column",
        opacity: show ? 1 : 0,
        transition: "opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>Редактор коду</span>
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
            {copied ? "Скопійовано" : "Копіювати"}
          </button>
          {!readOnly && onSave && (
            <button onClick={() => { onSave(value); handleClose(); }} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)",
              color: "#f97316", borderRadius: 8, padding: "6px 12px", fontSize: 11,
              fontWeight: 600, cursor: "pointer"
            }}>
              <Save style={{ width: 12, height: 12 }} /> Зберегти
            </button>
          )}
          <button
            onClick={handleClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              background: closeHover ? "rgba(248,113,113,0.16)" : "rgba(255,255,255,0.05)",
              border: closeHover ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: closeHover ? "#fecaca" : "#888",
              borderRadius: 8,
              padding: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.18s ease-out",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          value={value}
          onValueChange={code => {
            if (!readOnly) setValue(code);
          }}
          highlight={code => Prism.highlight(code, Prism.languages.tsx, "tsx")}
          padding={20}
          textareaId="fullscreen-code-editor"
          textareaStyle={{
            outline: "none",
          }}
          readOnly={readOnly}
          tabSize={2}
          insertSpaces
          style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 13,
            lineHeight: 1.6,
            background: "#0a0a0a",
            color: "#e5e7eb",
            height: "100%",
            overflow: "auto",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
