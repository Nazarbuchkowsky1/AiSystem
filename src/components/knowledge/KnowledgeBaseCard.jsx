import React, { useState } from "react";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function KnowledgeBaseCard({ kb, onSelect }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const queryClient = useQueryClient();

  const handleDeleteKB = async () => {
    await base44.entities.KnowledgeBase.delete(kb.id);
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    setShowDeleteConfirm(false);
  };

  const handleAddFile = async (e) => {
    const selectedFiles = Array.from(e.target.files || []).slice(0, 100);
    if (selectedFiles.length === 0) return;

    const updatedFiles = kb.files ? [...kb.files] : [];
    
    for (const file of selectedFiles) {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      updatedFiles.push({
        name: file.name,
        url: uploadRes.file_url,
        size: file.size,
        type: file.name.split(".").pop().toLowerCase(),
        processed: false,
      });
    }

    await base44.entities.KnowledgeBase.update(kb.id, { 
      files: updatedFiles,
      processing: true 
    });
    
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    setShowFileInput(false);

    // Simulate processing completion after 3 seconds per file
    setTimeout(async () => {
      const processedFiles = updatedFiles.map(f => ({ ...f, processed: true }));
      await base44.entities.KnowledgeBase.update(kb.id, { 
        files: processedFiles,
        processing: false 
      });
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    }, 3000);
  };

  const files = kb.files || [];
  const processedCount = files.filter(f => f.processed).length;
  const totalCount = files.length;
  const isProcessing = kb.processing || false;

  return (
    <>
      <div
        onClick={() => onSelect(kb.id)}
        style={{
          background: "#181818",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          cursor: "pointer",
          transition: "all 0.2s",
          position: "relative",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#2a2a2a";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Header with title, description, and delete button */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>
              {kb.name}
            </h3>
            {kb.description && (
              <p style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>
                {kb.description}
              </p>
            )}
          </div>
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
              padding: 6,
              borderRadius: 6,
              display: "flex",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
          >
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Files count and processing indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <p style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>
              Files: {processedCount}/{totalCount}
            </p>
            {isProcessing && (
              <p style={{ fontSize: 10, color: "#f97316", fontWeight: 500 }}>
                Processing...
              </p>
            )}
          </div>
          {isProcessing && (
            <Loader2
              style={{
                width: 16,
                height: 16,
                color: "#f97316",
                animation: "spin 1s linear infinite",
              }}
            />
          )}
          {!isProcessing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFileInput(!showFileInput);
              }}
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
                color: "#22c55e",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.1)")}
            >
              <Plus style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        {/* File input */}
        {showFileInput && (
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
              marginTop: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)")}
            onClick={(e) => e.stopPropagation()}
          >
            <Plus style={{ width: 12, height: 12 }} />
            <span>Add file</span>
            <input
              type="file"
              onChange={handleAddFile}
              accept=".pdf,.txt,.md,.json,.csv"
              multiple
              style={{ display: "none" }}
            />
          </label>
        )}
      </div>

      {/* Delete confirmation modal */}
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
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 8 }}>
              Delete Knowledge Base?
            </h3>
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)")
                }
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}