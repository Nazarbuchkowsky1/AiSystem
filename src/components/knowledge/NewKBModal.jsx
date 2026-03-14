import React, { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logStep, logStepJSON } from "@/lib/clientLogger";
import { extractTextFromPdfIfLarge } from "@/lib/pdfTextExtract";

const SUPPORTED_EXTENSIONS = [
  "pdf","txt","md","csv","json",
  "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
  "java","php","swift","kt","html","css","scss",
  "yaml","yml","xml","sh","bash","sql","toml","ini","env",
  "xmind","docx","xlsx","xls","pptx","ppt",
];

export default function NewKBModal({ onClose, onCreate, isLoading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]); // { key, file, status: 'uploading'|'done'|'error', url?, error? }
  const [isCreating, setIsCreating] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => onClose(), 280);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  const handleClose = () => {
    if (isCreating || closing) return;
    setClosing(true);
  };

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("modal-open", { detail: true }));
    return () => window.dispatchEvent(new CustomEvent("modal-open", { detail: false }));
  }, []);

  const startUploadForFile = async (file, key) => {
    let fileToUpload = file;
    const extracted = await extractTextFromPdfIfLarge(file);
    if (extracted) {
      logStep("KB", "NewKBModal: large PDF → text only", file.name);
      fileToUpload = extracted;
    }
    logStep("KB", "NewKBModal: UploadFile (background)", fileToUpload.name);
    base44.integrations.Core.UploadFile({ file: fileToUpload })
      .then((res) => {
        setFiles((prev) => prev.map((n) => (n.key === key ? { ...n, status: "done", url: res?.file_url, file: fileToUpload } : n)));
      })
      .catch((e) => {
        logStep("KB", "NewKBModal: UploadFile error", file.name + " " + String(e?.message || e));
        setFiles((prev) => prev.map((n) => (n.key === key ? { ...n, status: "error", error: e?.message || String(e) } : n)));
      });
  };

  const handleFileSelect = (e) => {
    const raw = e.target.files;
    if (!raw || raw.length === 0) return;
    const all = Array.from(raw).slice(0, 100);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const accepted = [];
    const rejected = [];
    for (const f of all) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.includes(ext)) accepted.push(f);
      else rejected.push(f.name);
    }
    setRejectedFiles(rejected);
    const toAdd = accepted.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "uploading",
    }));
    setFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach(({ file, key }) => startUploadForFile(file, key));
  };

  const uploadingCount = files.filter((n) => n.status === "uploading").length;
  const canCreate = name.trim() && files.length > 0 && uploadingCount === 0 && !isCreating && !isLoading;

  const handleCreate = () => {
    if (!canCreate) return;
    const uploadedFiles = files
      .filter((n) => n.status === "done" && n.url)
      .map((n) => ({
        name: n.file.name,
        url: n.url,
        size: n.file.size,
        type: n.file.name.split(".").pop()?.toLowerCase(),
        processed: false,
      }));
    if (uploadedFiles.length === 0) return;
    logStepJSON("KB", "user_create_kb", {
      action: "create",
      name: name.trim(),
      filesCount: uploadedFiles.length,
      fileNames: uploadedFiles.map((f) => f.name),
    });
    setIsCreating(true);
    try {
      logStep("KB", "NewKBModal: KnowledgeBase.create");
      onCreate({
        name: name.trim(),
        description: description.trim(),
        files: uploadedFiles,
        processing: true,
      });
      logStep("KB", "NewKBModal: create done");
    } catch (e) {
      logStep("KB", "NewKBModal: create error", String(e?.message || e));
    } finally {
      setIsCreating(false);
    }
  };

  const show = mounted && !closing;
  return (
    <div style={{
      position: "fixed", inset: 0, background: `rgba(0,0,0,${isCreating ? 0.8 : 0.6})`, display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: `blur(${isCreating ? 8 : 4}px)`,
      opacity: show ? 1 : 0,
      transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
    }} onClick={handleClose}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.5)",
        opacity: isCreating ? 0.3 : (show ? 1 : 0),
        transform: show ? "scale(1)" : "scale(0.96)",
        pointerEvents: isCreating ? "none" : "auto",
        transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>New Knowledge Base</h2>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", padding: 4 }}>
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
                  {files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""}${uploadingCount > 0 ? ` · ${uploadingCount} uploading…` : ""}` : "Click to upload files (up to 100)"}
                </span>
              </div>
              {files.length > 0 && (
                <div style={{ fontSize: 10, marginTop: 8, maxHeight: 100, overflow: "auto", width: "100%" }}>
                  {files.map((n) => (
                    <div key={n.key} style={{ padding: "4px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                      {n.status === "uploading" && <Loader2 style={{ width: 10, height: 10, color: "#f97316", flexShrink: 0, animation: "spin 1s linear infinite" }} />}
                      {n.status === "error" && <span style={{ color: "#ef4444", flexShrink: 0 }}>!</span>}
                      {n.status === "done" && <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>}
                      <span style={{ color: n.status === "error" ? "#ef4444" : "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.file.name}{n.status === "error" ? ` — ${n.error || "failed"}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} multiple accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",")} style={{ display: "none" }} />
            </label>
            {uploadingCount > 0 && (
              <p style={{ fontSize: 10, color: "#f97316", marginTop: 6 }}>Wait for uploads to finish, then Create.</p>
            )}
          </div>

          {rejectedFiles.length > 0 && (
            <p style={{ fontSize: 11, color: "#ef4444", lineHeight: 1.4 }}>
              Unsupported format: {rejectedFiles.join(", ")}
            </p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!canCreate} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: canCreate ? "pointer" : "not-allowed",
              opacity: canCreate ? 1 : 0.5,
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              {isCreating ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : null}
              {isCreating ? "Creating..." : uploadingCount > 0 ? `Uploading (${uploadingCount})…` : "Create"}
            </button>
          </div>
        </div>
      </div>

      {(isCreating || isLoading) && (
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