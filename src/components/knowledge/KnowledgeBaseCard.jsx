import React, { useState } from "react";
import { Trash2, Plus, Loader2, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

const SUPPORTED_EXTENSIONS = [
  "pdf","txt","md","csv","json",
  "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
  "java","php","swift","kt","html","css","scss",
  "yaml","yml","xml","sh","bash","sql","toml","ini","env",
];

export default function KnowledgeBaseCard({ kb, onSelect }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState([]);
  const queryClient = useQueryClient();

  const handleDeleteKB = async () => {
    await base44.entities.KnowledgeBase.delete(kb.id);
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    setShowDeleteConfirm(false);
  };

  const handleAddFile = async (e) => {
    const allFiles = Array.from(e.target.files || []).slice(0, 100);
    const rejected = [];
    const selectedFiles = allFiles.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.includes(ext)) return true;
      rejected.push(f.name);
      return false;
    });
    setRejectedFiles(rejected);
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

    // Trigger real PageIndex tree indexing (runs in background, 30+ sec for docs)
    base44.functions.invoke("indexKnowledgeBase", { kbId: kb.id }).catch(() => {});
  };

  const handleRetryIndexing = (e) => {
    e.stopPropagation();
    base44.entities.KnowledgeBase.update(kb.id, { processing: true }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      base44.functions.invoke("indexKnowledgeBase", { kbId: kb.id }).catch(() => {});
    });
  };

  const files = kb.files || [];
  const indexableTypes = ["txt", "md", "csv", "json"];
  const indexableFiles = files.filter(f => indexableTypes.includes(f.type));
  const processedCount = files.filter(f => f.processed).length;
  const totalCount = files.length;
  const isProcessing = kb.processing || kb.index_status === "indexing";
  const hasFailedIndexing = kb.index_status === "failed";
  const kbProgress = typeof kb.index_progress === "number" ? kb.index_progress : null;
  const derivedProgress = indexableFiles.length > 0 ? Math.round((processedCount / indexableFiles.length) * 100) : null;
  const progress = kbProgress !== null ? kbProgress : (derivedProgress !== null ? derivedProgress : 0);

  const statusColor = hasFailedIndexing ? "#ef4444" : isProcessing ? "#f97316" : "#22c55e";
  const statusLabel = hasFailedIndexing ? "Failed" : isProcessing ? "Indexing" : "Ready";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(kb.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(kb.id);
          }
        }}
        style={{
          padding: 18,
          textAlign: "left",
          cursor: "pointer",
          transition: "all 0.25s ease",
          width: "100%",
          background: "linear-gradient(145deg, #141414, #0f0f0f)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(249,115,22,0.2)";
          e.currentTarget.style.boxShadow = "0 4px 24px rgba(249,115,22,0.08)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "none";
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.2), transparent)",
          }}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <BookOpen style={{ width: 18, height: 18, color: "#f97316" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: statusColor,
                  boxShadow: hasFailedIndexing
                    ? "0 0 8px rgba(239,68,68,0.5)"
                    : isProcessing
                      ? "0 0 8px rgba(249,115,22,0.5)"
                      : "0 0 8px rgba(34,197,94,0.5)",
                }}
              />
              <span style={{ fontSize: 10, color: statusColor, fontWeight: 500 }}>
                {statusLabel}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
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
                  marginLeft: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>

          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#f5f5f5",
              marginBottom: 4,
              letterSpacing: "-0.01em",
            }}
          >
            {kb.name}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "#555",
              marginBottom: 8,
              lineHeight: 1.5,
              flex: 1,
            }}
          >
            {kb.description || "No description"}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ fontSize: 10, color: "#333" }}>
            Files: {processedCount}/{totalCount}
            {isProcessing && progress > 0 ? ` · ${progress}%` : ""}
          </span>
          {isProcessing ? (
            <Loader2
              style={{
                width: 12,
                height: 12,
                color: "#f97316",
                animation: "spin 1s linear infinite",
              }}
            />
          ) : hasFailedIndexing ? (
            <button
              type="button"
              onClick={handleRetryIndexing}
              style={{
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.2)",
                color: "#f97316",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(249,115,22,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(249,115,22,0.1)")
              }
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFileInput(!showFileInput);
              }}
              style={{
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.2)",
                color: "#f97316",
                cursor: "pointer",
                padding: 5,
                borderRadius: 6,
                display: "flex",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(249,115,22,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(249,115,22,0.1)")
              }
            >
              <Plus style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>

        {rejectedFiles.length > 0 && (
          <p style={{ fontSize: 10, color: "#ef4444", padding: "4px 0 0", margin: 0 }}>
            Unsupported: {rejectedFiles.join(", ")}
          </p>
        )}

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