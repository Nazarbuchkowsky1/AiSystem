import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Code,
  Wrench,
  Terminal,
  Globe,
  Database,
  FileCode,
  Cpu,
  Zap,
  Brain,
  Search,
  FileText,
  Youtube,
  BookOpen,
} from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/themes/prism-tomorrow.css";

const ICON_OPTIONS = [
  { name: "Wrench", Icon: Wrench },
  { name: "Terminal", Icon: Terminal },
  { name: "Globe", Icon: Globe },
  { name: "Database", Icon: Database },
  { name: "FileCode", Icon: FileCode },
  { name: "Cpu", Icon: Cpu },
  { name: "Code", Icon: Code },
  { name: "Zap", Icon: Zap },
  { name: "Brain", Icon: Brain },
  { name: "Search", Icon: Search },
  { name: "FileText", Icon: FileText },
  { name: "Youtube", Icon: Youtube },
  { name: "BookOpen", Icon: BookOpen },
];

export default function NewToolModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("Wrench");
  const [code, setCode] = useState("");
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [activeTab, setActiveTab] = useState("details"); // details | code
  const fileRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

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

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      icon_name: iconName,
      icon_url: iconPreview || undefined,
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
        setCode(content);
        setActiveTab("code");
      }
    };
    reader.readAsText(file);
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
      onClick={handleClose}
    >
      <div
        style={{
        position: "relative", width: "90%", maxWidth: 560,
        background: "linear-gradient(145deg, #141414, #0c0c0c)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, overflow: "hidden",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        transform: show ? "scale(1)" : "scale(0.96)",
        opacity: show ? 1 : 0,
        transition: "opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onClick={e => e.stopPropagation()}
      >
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)" }} />

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
        </div>

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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ICON_OPTIONS.map(({ name: icName, Icon }) => (
                    <button
                      key={icName}
                      onClick={() => { setIconName(icName); setIconPreview(null); setIconFile(null); }}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        background:
                          iconName === icName ? "rgba(249,115,22,0.15)" : "#0f0f0f",
                        border:
                          iconName === icName
                            ? "1px solid rgba(249,115,22,0.4)"
                            : "1px solid #2a2a2a",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: iconName === icName ? "#f97316" : "#555",
                        transition: "all 0.2s",
                      }}
                      title={icName}
                    >
                      <Icon style={{ width: 20, height: 20 }} />
                    </button>
                  ))}
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: iconPreview ? "rgba(249,115,22,0.12)" : "rgba(0,0,0,0.3)",
                    border: `1px dashed ${iconPreview ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.16)"}`,
                    cursor: "pointer",
                  }}
                  onClick={() => fileRef.current?.click()}
                >
                  {iconPreview ? (
                    <>
                      <img
                        src={iconPreview}
                        alt="Custom icon"
                        style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                      />
                      <span style={{ fontSize: 11, color: "#f5f5f5" }}>Custom icon selected</span>
                    </>
                  ) : (
                    <>
                      <Upload style={{ width: 14, height: 14, color: "#666" }} />
                      <span style={{ fontSize: 11, color: "#666" }}>Or upload custom icon</span>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIconFile(file);
                      const url = URL.createObjectURL(file);
                      setIconPreview(url);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "code" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Code style={{ width: 14, height: 14, color: "#f97316" }} />
                <span style={{ fontSize: 12, color: "#888" }}>Webhook / API / Custom code</span>
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.3)",
                  overflow: "hidden",
                }}
              >
                <Editor
                  value={code}
                  onValueChange={setCode}
                  highlight={value => Prism.highlight(value, Prism.languages.tsx, "tsx")}
                  padding={14}
                  textareaId="new-tool-code"
                  textareaStyle={{ outline: "none" }}
                  placeholder={
                    "// Your custom integration code here\n" +
                    "// This can be a webhook URL, API call, or any custom logic\n\n" +
                    "// Example:\n" +
                    "// POST https://your-api.com/webhook\n" +
                    '// { \"action\": \"process\", \"data\": \"...\" }'
                  }
                  style={{
                    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                    fontSize: 12,
                    lineHeight: 1.6,
                    minHeight: 260,
                    background: "transparent",
                    color: "#e5e7eb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={handleClose}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#888",
              cursor: "pointer",
              transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
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

