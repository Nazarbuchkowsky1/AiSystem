import React, { useState } from "react";
import { X } from "lucide-react";

export default function NewAgentModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Bot");
  const [isCreating, setIsCreating] = useState(false);

  const ICON_OPTIONS = ["Bot", "Zap", "Brain", "Sparkles", "Cpu", "Settings"];

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim(), icon, status: "active" });
      setName("");
      setDescription("");
      setIcon("Bot");
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>Create New Agent</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Content Writer"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box",
                outline: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
              onBlur={e => e.target.style.borderColor = "#2a2a2a"}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box",
                outline: "none", fontFamily: "inherit", resize: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
              onBlur={e => e.target.style.borderColor = "#2a2a2a"}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Icon</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {ICON_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setIcon(opt)}
                  style={{
                    padding: 10, borderRadius: 8, background: icon === opt ? "rgba(249,115,22,0.15)" : "#0f0f0f",
                    border: `1px solid ${icon === opt ? "rgba(249,115,22,0.4)" : "#2a2a2a"}`,
                    color: icon === opt ? "#f97316" : "#555", fontSize: 12, fontWeight: 500,
                    cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || isCreating} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || isCreating ? "not-allowed" : "pointer", opacity: !name.trim() || isCreating ? 0.5 : 1,
              transition: "all 0.2s"
            }}>
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}