import React, { useState, useEffect } from "react";
import { X, Trash2, Upload, Loader2, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function EditKBModal({ kb, onClose, onSaved }) {
  const [name, setName] = useState(kb.name || "");
  const [description, setDescription] = useState(kb.description || "");
  const [files, setFiles] = useState(kb.files || []);
  const [newFiles, setNewFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [removedFileIndexes, setRemovedFileIndexes] = useState(new Set());

  const originalFiles = kb.files || [];

  const handleRemoveExisting = (index) => {
    setRemovedFileIndexes(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleRemoveNew = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setNewFiles(prev => [...prev, ...selected]);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name.trim() || isSaving) return;
    setIsSaving(true);

    const keptFiles = originalFiles.filter((_, i) => !removedFileIndexes.has(i));
    const filesChanged = removedFileIndexes.size > 0 || newFiles.length > 0;

    // Upload new files
    const uploadedNewFiles = [];
    for (const file of newFiles) {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      uploadedNewFiles.push({
        name: file.name,
        url: uploadRes.file_url,
        size: file.size,
        type: file.name.split(".").pop().toLowerCase(),
        processed: false,
      });
    }

    const finalFiles = [...keptFiles, ...uploadedNewFiles];

    const updateData = {
      name: name.trim(),
      description: description.trim(),
      files: filesChanged ? finalFiles.map(f => ({ ...f, processed: false })) : finalFiles,
      processing: filesChanged,
    };

    await base44.entities.KnowledgeBase.update(kb.id, updateData);

    // If files changed, simulate reprocessing
    if (filesChanged) {
      setTimeout(async () => {
        const processedFiles = finalFiles.map(f => ({ ...f, processed: true }));
        await base44.entities.KnowledgeBase.update(kb.id, {
          files: processedFiles,
          processing: false,
        });
        onSaved();
      }, 2000);
    }

    onSaved();
    setIsSaving(false);
  };

  const visibleExistingFiles = originalFiles.filter((_, i) => !removedFileIndexes.has(i));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 25px rgba(0,0,0,0.5)", msOverflowStyle: "none", scrollbarWidth: "none"
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>Edit Knowledge Base</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", padding: 4, borderRadius: 6, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Knowledge base name"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box", outline: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
              onBlur={e => e.target.style.borderColor = "#2a2a2a"}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Description</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
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

          {/* Files section */}
          <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5" }}>
                Files ({visibleExistingFiles.length + newFiles.length})
              </p>
              <label style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
                background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#f97316", transition: "all 0.2s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}>
                <Upload style={{ width: 12, height: 12 }} />
                Add Files
                <input type="file" onChange={handleAddFiles} accept=".pdf,.txt,.md,.json,.csv" multiple style={{ display: "none" }} />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflow: "auto", msOverflowStyle: "none", scrollbarWidth: "none" }}>
              {visibleExistingFiles.length === 0 && newFiles.length === 0 && (
                <p style={{ fontSize: 11, color: "#555", textAlign: "center", padding: 16 }}>No files</p>
              )}

              {/* Existing files */}
              {originalFiles.map((file, index) => {
                if (removedFileIndexes.has(index)) return null;
                return (
                  <div key={"existing-" + index} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    borderRadius: 8, background: "#0f0f0f", border: "1px solid #2a2a2a"
                  }}>
                    <FileText style={{ width: 14, height: 14, color: "#f97316", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                      <p style={{ fontSize: 10, color: "#555" }}>{file.type?.toUpperCase()} {formatFileSize(file.size)}</p>
                    </div>
                    <button onClick={() => handleRemoveExisting(index)} style={{
                      background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444",
                      cursor: "pointer", padding: 5, borderRadius: 6, display: "flex", transition: "all 0.2s", flexShrink: 0
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                );
              })}

              {/* New files (not yet uploaded) */}
              {newFiles.map((file, index) => (
                <div key={"new-" + index} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: 8, background: "#0f0f0f", border: "1px dashed rgba(249,115,22,0.3)"
                }}>
                  <FileText style={{ width: 14, height: 14, color: "#22c55e", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                    <p style={{ fontSize: 10, color: "#22c55e" }}>New • {formatFileSize(file.size)}</p>
                  </div>
                  <button onClick={() => handleRemoveNew(index)} style={{
                    background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444",
                    cursor: "pointer", padding: 5, borderRadius: 6, display: "flex", transition: "all 0.2s", flexShrink: 0
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>

            {(removedFileIndexes.size > 0 || newFiles.length > 0) && (
              <p style={{ fontSize: 10, color: "#f97316", marginTop: 8 }}>
                Files will be reprocessed after saving.
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!name.trim() || isSaving} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || isSaving ? "not-allowed" : "pointer",
              opacity: !name.trim() || isSaving ? 0.5 : 1, transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}
              onMouseEnter={e => { if (name.trim() && !isSaving) e.currentTarget.style.background = "rgba(249,115,22,0.2)"; }}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}>
              {isSaving && <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />}
              {isSaving ? "Saving..." : "Save"}
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