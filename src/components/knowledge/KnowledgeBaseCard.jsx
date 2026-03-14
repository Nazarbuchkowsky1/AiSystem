import React, { useState, useEffect, useRef } from "react";
import { Trash2, Plus, Loader2, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { logStep, logStepJSON } from "@/lib/clientLogger";
import { extractTextFromPdfIfLarge } from "@/lib/pdfTextExtract";

const SUPPORTED_EXTENSIONS = [
  "pdf","txt","md","csv","json",
  "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
  "java","php","swift","kt","html","css","scss",
  "yaml","yml","xml","sh","bash","sql","toml","ini","env",
  "xmind","docx","xlsx","xls","pptx","ppt",
];

export default function KnowledgeBaseCard({ kb, onSelect }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [addFileError, setAddFileError] = useState(null);
  const [rejectedFiles, setRejectedFiles] = useState([]);
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef(null);

  const debugLogs = kb.debug_logs || [];
  const logLengthRef = useRef(0);

  useEffect(() => {
    if (debugLogs.length > logLengthRef.current) {
      const newLogs = debugLogs.slice(logLengthRef.current);
      newLogs.forEach(entry => {
        if (typeof entry !== "string") return;
        try {
          const parsed = JSON.parse(entry);
          if (parsed && typeof parsed.step === "string") {
            logStepJSON("KB", parsed.step, parsed);
          } else {
            logStep("KB", "index_log", entry);
          }
        } catch {
          logStep("KB", "index_log", entry);
        }
      });
      logLengthRef.current = debugLogs.length;
    }
  }, [debugLogs, kb.name]);

  const handleDeleteKB = async () => {
    logStep("KB", "KnowledgeBase.delete: start", kb.id);
    await base44.entities.KnowledgeBase.delete(kb.id);
    logStep("KB", "KnowledgeBase.delete: done", kb.id);
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    setShowDeleteConfirm(false);
  };

  const handleAddFile = async (e) => {
    const rawList = e.target.files;
    if (!rawList || rawList.length === 0) return;
    const allFiles = Array.from(rawList).slice(0, 100);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const rejected = [];
    const selectedFiles = allFiles.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.includes(ext)) return true;
      rejected.push(f.name);
      return false;
    });
    setRejectedFiles(rejected);
    setAddFileError(null);
    if (selectedFiles.length === 0) return;

    setShowFileInput(false);
    setIsAddingFile(true);
    logStep("KB", "KnowledgeBaseCard: addFile start", { kbId: kb.id, count: selectedFiles.length });

    try {
      const updatedFiles = kb.files ? [...kb.files] : [];
      for (const file of selectedFiles) {
        let fileToUpload = file;
        const extracted = await extractTextFromPdfIfLarge(file);
        if (extracted) {
          logStep("KB", "KnowledgeBaseCard: large PDF → text only", { original: file.name, size: file.size });
          fileToUpload = extracted;
        }
        logStep("KB", "KnowledgeBaseCard: UploadFile", fileToUpload.name);
        const uploadRes = await base44.integrations.Core.UploadFile({ file: fileToUpload });
        if (!uploadRes?.file_url) throw new Error(`Upload did not return URL for ${fileToUpload.name}`);
        updatedFiles.push({
          name: fileToUpload.name,
          url: uploadRes.file_url,
          size: fileToUpload.size,
          type: (fileToUpload.name.split(".").pop() || "txt").toLowerCase(),
          processed: false,
        });
      }
      logStep("KB", "KnowledgeBaseCard: KnowledgeBase.update");
      await base44.entities.KnowledgeBase.update(kb.id, { files: updatedFiles, processing: true });
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      setShowFileInput(false);
      logStep("KB", "KnowledgeBaseCard: indexKnowledgeBase start", kb.id);
      base44.functions.invoke("indexKnowledgeBase", { kbId: kb.id }).catch((err) => {
        logStep("KB", "KnowledgeBaseCard: indexKnowledgeBase error", String(err?.message || err));
      });
    } catch (err) {
      const msg = err?.message || String(err);
      logStep("KB", "KnowledgeBaseCard: addFile error", msg);
      setAddFileError(msg);
    } finally {
      setIsAddingFile(false);
    }
  };

  const handleRetryIndexing = (e) => {
    e.stopPropagation();
    logStep("KB", "KnowledgeBaseCard: retryIndexing start", kb.id);
    const resetFiles = (kb.files || []).map(f => {
      if (!f.processed || !f.index_tree?.root) return { ...f, processed: false };
      return f;
    });
    base44.entities.KnowledgeBase.update(kb.id, {
      files: resetFiles,
      processing: true,
      index_status: "idle",
      last_error: "",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      base44.functions.invoke("indexKnowledgeBase", { kbId: kb.id }).catch((err) => {
        logStep("KB", "KnowledgeBaseCard: retry indexKnowledgeBase error", String(err?.message || err));
      });
      logStep("KB", "KnowledgeBaseCard: retryIndexing done", kb.id);
    }).catch((err) => {
      logStep("KB", "KnowledgeBaseCard: retryIndexing error", String(err?.message || err));
    });
  };

  const files = kb.files || [];
  // Count all files that the backend indexer supports (the full SUPPORTED_EXTENSIONS list)
  const indexableFiles = files.filter(f => SUPPORTED_EXTENSIONS.includes((f.type || "").toLowerCase()));
  const processedCount = indexableFiles.filter(f => f.processed).length;
  const totalCount = indexableFiles.length;
  const isProcessing = kb.processing || kb.index_status === "indexing";
  const hasFailedIndexing = kb.index_status === "failed";
  // Detect incomplete indexing: files exist but not all are processed, and we're not currently processing
  const hasUnprocessedFiles = totalCount > 0 && processedCount < totalCount && !isProcessing;
  const kbProgress = typeof kb.index_progress === "number" ? kb.index_progress : null;
  const derivedProgress = indexableFiles.length > 0 ? Math.round((processedCount / indexableFiles.length) * 100) : null;
  const progress = kbProgress !== null ? kbProgress : (derivedProgress !== null ? derivedProgress : 0);

  const statusColor = isAddingFile ? "#f97316" : hasFailedIndexing ? "#ef4444" : isProcessing ? "#f97316" : hasUnprocessedFiles ? "#eab308" : "#22c55e";
  const statusLabel = isAddingFile ? "Uploading…" : hasFailedIndexing ? "Failed" : isProcessing ? "Indexing" : hasUnprocessedFiles ? "Incomplete" : "Ready";

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
              {isAddingFile ? (
                <Loader2 style={{ width: 12, height: 12, color: "#f97316", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              ) : (
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
                        : hasUnprocessedFiles
                          ? "0 0 8px rgba(234,179,8,0.5)"
                          : "0 0 8px rgba(34,197,94,0.5)",
                  }}
                />
              )}
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
          ) : (hasFailedIndexing || hasUnprocessedFiles) ? (
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

        {showFileInput && !isAddingFile && (
          <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {addFileError && (
              <p style={{ fontSize: 10, color: "#ef4444", marginBottom: 6 }}>
                {addFileError}
              </p>
            )}
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
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)"}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)")}
              onClick={(e) => e.stopPropagation()}
            >
              <Plus style={{ width: 12, height: 12 }} />
              <span>Add file</span>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleAddFile}
                multiple
                accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
                style={{ display: "none" }}
              />
            </label>
          </div>
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