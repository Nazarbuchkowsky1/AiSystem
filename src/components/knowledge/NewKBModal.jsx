import React, { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function NewKBModal({ onClose, onCreate, isLoading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !file) return;
    setIsUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const kbData = {
        name: name.trim(),
        description: description.trim(),
        file_url: uploadRes.file_url,
        file_type: file.name.split(".").pop()?.toLowerCase() || "txt",
        file_name: file.name,
        file_size: file.size,
      };
      await onCreate(kbData);
      reset();
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setName("");
    setDescription("");
    setFile(null);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 500, boxShadow: "0 20px 25px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>New Knowledge Base</h2>
          <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", padding: 4 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Knowledge base name"
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
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this knowledge base about?"
              rows={2}
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
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Upload File</label>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: 16, borderRadius: 10, background: "#0f0f0f", border: "2px dashed #2a2a2a",
              cursor: "pointer", transition: "all 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}>
              {file ? (
                <>
                  <span style={{ fontSize: 12, color: "#f5f5f5" }}>✓ {file.name}</span>
                </>
              ) : (
                <>
                  <Upload style={{ width: 16, height: 16, color: "#555" }} />
                  <span style={{ fontSize: 12, color: "#555" }}>Upload file (PDF, TXT, Markdown...)</span>
                </>
              )}
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.txt,.md,.json,.csv"
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || !file || isUploading || isLoading} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || !file || isUploading || isLoading ? "not-allowed" : "pointer",
              opacity: !name.trim() || !file || isUploading || isLoading ? 0.5 : 1,
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              {isUploading || isLoading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : null}
              {isUploading || isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}