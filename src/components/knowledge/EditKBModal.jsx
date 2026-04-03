import React, { useState, useEffect } from "react";
import { X, Trash2, Upload, Loader2, FileText, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logStep } from "@/lib/clientLogger";
import { extractTextFromPdfIfLarge } from "@/lib/pdfTextExtract";

const SUPPORTED_EXTENSIONS = [
  "pdf","txt","md","csv","json",
  "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
  "java","php","swift","kt","html","css","scss",
  "yaml","yml","xml","sh","bash","sql","toml","ini","env",
  "xmind","docx","xlsx","xls","pptx","ppt",
];

function getFileAccessUrl(file) {
  return file?.source_url || file?.file_path || file?.url || "";
}

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
  // New files: upload starts when added; Save only does KB.update (quick)
  const [newFiles, setNewFiles] = useState([]); // { key, file, status: 'uploading'|'done'|'error', url?, error? }
  const [isSaving, setIsSaving] = useState(false);
  const [removedFileIndexes, setRemovedFileIndexes] = useState(new Set());
  const [rejectedFiles, setRejectedFiles] = useState([]);

  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => onClose(), 280);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  const handleClose = () => {
    if (isSaving || closing) return;
    setClosing(true);
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("modal-open", { detail: true }));
    return () => window.dispatchEvent(new CustomEvent("modal-open", { detail: false }));
  }, []);

  const originalFiles = kb.files || [];

  const handleDownloadExisting = (file, index) => {
    // Prefer remote URL when available (uploaded files)
    const accessUrl = getFileAccessUrl(file);
    if (accessUrl) {
      try {
        window.open(accessUrl, "_blank", "noopener,noreferrer");
        return;
      } catch {
        // fall back to blob path below
      }
    }

    // Fallbacks for inline KB content:
    // 1) inline_text (for YouTube transcripts and text snippets)
    // 2) index_tree.paragraphs (for already indexed docs without inline_text on client)
    let textPayload = "";
    if (typeof file.inline_text === "string" && file.inline_text.length > 0) {
      textPayload = file.inline_text;
    } else if (
      file.index_tree &&
      Array.isArray(file.index_tree.paragraphs) &&
      file.index_tree.paragraphs.length > 0
    ) {
      textPayload = file.index_tree.paragraphs.join("\n\n");
    }

    if (textPayload) {
      const blob = new Blob([textPayload], { type: "text/plain;charset=utf-8" });
      const safeName =
        (file.name || `kb-file-${index}.txt`).replace(/[^\w.\-]+/g, "_") || `kb-file-${index}.txt`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = safeName.endsWith(".txt") ? safeName : `${safeName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }
  };

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

  const startUploadForNewFile = async (file, key) => {
    let fileToUpload = file;
    const extracted = await extractTextFromPdfIfLarge(file);
    if (extracted) {
      logStep("KB", "EditKBModal: large PDF → text only", file.name);
      fileToUpload = extracted;
    }
    logStep("KB", "EditKBModal: UploadFile (background)", fileToUpload.name);
    base44.integrations.Core.UploadFile({ file: fileToUpload })
      .then((res) => {
        setNewFiles(prev => prev.map(item => item.key === key ? { ...item, status: "done", url: res?.file_url, file: fileToUpload } : item));
      })
      .catch((e) => {
        logStep("KB", "EditKBModal: UploadFile error", file.name + " " + String(e?.message || e));
        setNewFiles(prev => prev.map(item => item.key === key ? { ...item, status: "error", error: e?.message || String(e) } : item));
      });
  };

  const handleAddFiles = (e) => {
    const all = Array.from(e.target.files || []);
    if (all.length === 0) return;
    const accepted = [];
    const rejected = [];
    for (const f of all) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.includes(ext)) accepted.push(f);
      else rejected.push(f.name);
    }
    const toAdd = accepted.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "uploading",
    }));
    setNewFiles(prev => [...prev, ...toAdd]);
    setRejectedFiles(rejected);
    toAdd.forEach(({ file, key }) => startUploadForNewFile(file, key));
    e.target.value = "";
  };

  const uploadingCount = newFiles.filter(n => n.status === "uploading").length;
  const canSave = !isSaving && name.trim() && uploadingCount === 0;

  const handleSave = async () => {
    if (!canSave) return;
    logStep("KB", "EditKBModal: save start", kb.id);
    setIsSaving(true);
    try {
      const keptFiles = originalFiles.filter((_, i) => !removedFileIndexes.has(i));
      const uploadedNewFiles = newFiles
        .filter(n => n.status === "done" && n.url)
        .map(n => ({
          name: n.file.name,
          source_type: "upload",
          file_path: n.url,
          source_url: "",
          url: n.url,
          size: n.file.size,
          type: n.file.name.split(".").pop()?.toLowerCase(),
          processed: false,
        }));
      const finalFiles = [...keptFiles, ...uploadedNewFiles];
      const filesChanged = removedFileIndexes.size > 0 || uploadedNewFiles.length > 0;
      const updateData = {
        name: name.trim(),
        description: description.trim(),
        files: finalFiles,
        processing: filesChanged,
      };

      logStep("KB", "EditKBModal: KnowledgeBase.update");
      await base44.entities.KnowledgeBase.update(kb.id, updateData);

      if (filesChanged) {
        logStep("KB", "EditKBModal: indexKnowledgeBase start", kb.id);
        base44.functions.invoke("indexKnowledgeBase", { kbId: kb.id }).catch((e) => {
          logStep("KB", "EditKBModal: indexKnowledgeBase error", String(e?.message || e));
        });
      }
      logStep("KB", "EditKBModal: save done");
      onSaved();
    } catch (e) {
      logStep("KB", "EditKBModal: save error", String(e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const visibleExistingFiles = originalFiles.filter((_, i) => !removedFileIndexes.has(i));
  const show = mounted && !closing;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)",
      opacity: show ? 1 : 0,
      transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
    }} onClick={handleClose}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 25px rgba(0,0,0,0.5)", msOverflowStyle: "none", scrollbarWidth: "none",
        opacity: show ? 1 : 0,
        transform: show ? "scale(1)" : "scale(0.96)",
        transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>Редагувати базу знань</h2>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", padding: 4, borderRadius: 6, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Назва</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Назва бази знань"
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
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Опис</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Про що ця база знань?"
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
                Файли ({visibleExistingFiles.length + newFiles.length})
              </p>
              <label style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
                background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#f97316", transition: "all 0.2s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}>
                <Upload style={{ width: 12, height: 12 }} />
                Додати файли
                <input type="file" onChange={handleAddFiles} multiple style={{ display: "none" }} />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflow: "auto", msOverflowStyle: "none", scrollbarWidth: "none" }}>
              {visibleExistingFiles.length === 0 && newFiles.length === 0 && (
                <p style={{ fontSize: 11, color: "#555", textAlign: "center", padding: 16 }}>Файлів немає</p>
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
                    <button
                      type="button"
                      onClick={() => handleDownloadExisting(file, index)}
                      style={{
                        background: "rgba(148,163,184,0.12)",
                        border: "none",
                        color: "#e5e7eb",
                        cursor: "pointer",
                        padding: 5,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(148,163,184,0.25)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(148,163,184,0.12)"}
                    >
                      <Download style={{ width: 13, height: 13 }} />
                    </button>
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

              {/* New files: upload runs in background when added */}
              {newFiles.map((n, index) => (
                <div key={n.key ?? "new-" + index} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: 8, background: "#0f0f0f", border: "1px dashed rgba(249,115,22,0.3)"
                }}>
                  {n.status === "uploading" ? (
                    <Loader2 style={{ width: 14, height: 14, color: "#f97316", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                  ) : n.status === "error" ? (
                    <span style={{ fontSize: 10, color: "#ef4444", flexShrink: 0 }}>!</span>
                  ) : (
                    <FileText style={{ width: 14, height: 14, color: "#22c55e", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.file.name}</p>
                    <p style={{ fontSize: 10, color: n.status === "error" ? "#ef4444" : n.status === "uploading" ? "#f97316" : "#22c55e" }}>
                      {n.status === "uploading" ? "Завантаження…" : n.status === "error" ? (n.error || "Помилка завантаження") : `Готово • ${formatFileSize(n.file.size)}`}
                    </p>
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

            {rejectedFiles.length > 0 && (
              <p style={{ fontSize: 10, color: "#ef4444", marginTop: 8 }}>
                Непідтримуваний формат: {rejectedFiles.join(", ")}
              </p>
            )}
            {(removedFileIndexes.size > 0 || newFiles.length > 0) && (
              <p style={{ fontSize: 10, color: "#f97316", marginTop: 8 }}>
                {uploadingCount > 0 ? "Зачекайте, поки завершиться завантаження, потім збережіть. Індексація запуститься після збереження." : "Нові файли буде проіндексовано після збереження."}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={handleClose} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              Скасувати
            </button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", fontSize: 14, fontWeight: 500,
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.5, transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}
              onMouseEnter={e => { if (canSave) e.currentTarget.style.background = "rgba(249,115,22,0.2)"; }}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}>
              {isSaving && <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />}
              {isSaving ? "Збереження…" : uploadingCount > 0 ? `Завантаження (${uploadingCount})…` : "Зберегти"}
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