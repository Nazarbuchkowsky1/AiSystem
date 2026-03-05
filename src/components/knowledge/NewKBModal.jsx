import React, { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function NewKBModal({ onClose, onCreate, isLoading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || files.length === 0 || isLoading || isCreating) return;
    
    setIsCreating(true);
    const uploadedFiles = [];
    for (const file of files) {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      uploadedFiles.push({
        name: file.name,
        url: uploadRes.file_url,
        size: file.size,
        type: file.name.split(".").pop().toLowerCase(),
        processed: false,
      });
    }

    const createdKB = await onCreate({
      name: name.trim(),
      description: description.trim(),
      files: uploadedFiles,
      processing: true,
    });
    
    setIsCreating(false);
    onClose();
    
    if (createdKB?.id) {
      setTimeout(async () => {
        await base44.entities.KnowledgeBase.update(createdKB.id, { processing: false });
      }, 2000);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: `rgba(0,0,0,${isCreating ? 0.8 : 0.6})`, display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: `blur(${isCreating ? 8 : 4}px)`,
      transition: "all 0.3s ease"
    }} onClick={!isCreating ? onClose : undefined}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.5)",
        opacity: isCreating ? 0.3 : 1,
        pointerEvents: isCreating ? "none" : "auto",
        transition: "opacity 0.3s ease"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>New Knowledge Base</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", padding: 4 }}>
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
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Upload Files</label>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: 16, borderRadius: 10, background: "#0f0f0f", border: "2px dashed #2a2a2a",
              cursor: "pointer", transition: "all 0.2s", flexDirection: "column"
            }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Upload style={{ width: 16, height: 16, color: files.length > 0 ? "#f97316" : "#555" }} />
                <span style={{ fontSize: 12, color: files.length > 0 ? "#f5f5f5" : "#555" }}>
                  {files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""} selected` : "Click to upload files (up to 100)"}
                </span>
              </div>
              {files.length > 0 && (
                <div style={{ fontSize: 10, color: "#888", marginTop: 8, maxHeight: 80, overflow: "auto", width: "100%" }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ padding: "2px 4px", textAlign: "center" }}>{f.name}</div>
                  ))}
                </div>
              )}
              <input
                type="file"
                onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 100))}
                accept=".pdf,.txt,.md,.json,.csv"
                multiple
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || files.length === 0 || isLoading} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || files.length === 0 || isLoading ? "not-allowed" : "pointer",
              opacity: !name.trim() || files.length === 0 || isLoading ? 0.5 : 1,
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              {isLoading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : null}
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>

      {isCreating && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16, zIndex: 100
        }}>
          <Loader2 style={{
            width: 48, height: 48, color: "#f97316",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ fontSize: 14, color: "#f5f5f5", fontWeight: 500 }}>Creating knowledge base...</p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}