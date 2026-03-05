import React, { useState } from "react";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function KnowledgeBaseCard({ kb, isSelected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const handleDeleteKB = async () => {
    await base44.entities.KnowledgeBase.delete(kb.id);
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    setShowDeleteConfirm(false);
  };

  const handleDeleteFile = async (fileIndex) => {
    const updatedFiles = kb.files ? [...kb.files] : [];
    updatedFiles.splice(fileIndex, 1);
    await base44.entities.KnowledgeBase.update(kb.id, { files: updatedFiles });
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
  };

  const handleAddFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    const updatedFiles = kb.files ? [...kb.files] : [];
    updatedFiles.push({
      name: file.name,
      url: uploadRes.file_url,
      size: file.size,
      type: file.name.split(".").pop().toLowerCase(),
    });

    await base44.entities.KnowledgeBase.update(kb.id, { files: updatedFiles });
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    setShowFileInput(false);
  };

  const files = kb.files || [];

  return (
    <div
      onClick={() => onSelect(kb.id)}
      style={{
        background: isSelected ? "rgba(249,115,22,0.15)" : "#181818",
        border: isSelected ? "1px solid rgba(249,115,22,0.4)" : "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "#2a2a2a";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>{kb.name}</h3>
          {kb.description && (
            <p style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>{kb.description}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
          >
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888",
              padding: 4,
              display: "flex",
              transition: "all 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDown style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: 10, color: "#444" }}>{files.length} file{files.length !== 1 ? "s" : ""}</p>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {files.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 8,
                    background: "#0f0f0f",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#888",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                    <p style={{ fontSize: 9, color: "#555" }}>{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(idx);
                    }}
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      padding: 4,
                      borderRadius: 6,
                      display: "flex",
                      flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showFileInput ? (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: 10,
                borderRadius: 8,
                background: "#0f0f0f",
                border: "2px dashed rgba(249,115,22,0.3)",
                cursor: "pointer",
                transition: "all 0.2s",
                fontSize: 11,
                color: "#888",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)")}
            >
              <Plus style={{ width: 12, height: 12 }} />
              <span>Add file</span>
              <input type="file" onChange={handleAddFile} accept=".pdf,.txt,.md,.json,.csv" style={{ display: "none" }} />
            </label>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFileInput(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: 8,
                borderRadius: 8,
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.2)",
                color: "#f97316",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(249,115,22,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(249,115,22,0.1)")}
            >
              <Plus style={{ width: 12, height: 12 }} />
              Add file
            </button>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: "#181818",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: 24,
              maxWidth: 320,
              boxShadow: "0 20px 25px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 8 }}>Delete Knowledge Base?</h3>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 16, lineHeight: 1.4 }}>
              This will permanently delete "{kb.name}" and all its files.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid #2a2a2a",
                  color: "#f5f5f5",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteKB}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#dc2626")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#ef4444")}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}