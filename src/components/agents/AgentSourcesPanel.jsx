import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { logStep, logStepJSON } from "@/lib/clientLogger";
import { extractTextFromPdfIfLarge } from "@/lib/pdfTextExtract";
import {
  Plus, Upload, FileText, Loader2, Trash2, X, Download,
  CheckCircle, AlertCircle, BookOpen, Link, Youtube
} from "lucide-react";

const SUPPORTED_EXTENSIONS = [
  "pdf","txt","md","csv","json",
  "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
  "java","php","swift","kt","html","css","scss",
  "yaml","yml","xml","sh","bash","sql","toml","ini","env",
  "xmind","docx","xlsx","xls","pptx","ppt",
];

const ACCEPT_STRING = SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(",");

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(type) {
  const codeTypes = ["js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs","java","php","swift","kt","html","css","scss","sh","bash","sql"];
  if (type === "youtube") return { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "youtube" };
  if (codeTypes.includes(type)) return { color: "#a855f7", bg: "rgba(168,85,247,0.15)" };
  if (type === "pdf") return { color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
  if (["xlsx","xls","csv"].includes(type)) return { color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  if (["docx","doc","pptx","ppt"].includes(type)) return { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
  return { color: "#f97316", bg: "rgba(249,115,22,0.12)" };
}

export default function AgentSourcesPanel({ agent, onKbIdsChange }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [kb, setKb] = useState(null);
  const [kbLoading, setKbLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [rejectedFiles, setRejectedFiles] = useState([]);
  const [isCreatingKb, setIsCreatingKb] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [addModalMounted, setAddModalMounted] = useState(false);
  const [indexingStartedAt, setIndexingStartedAt] = useState(null);
  const lastDebugLogCount = useRef(0);
  const pollRef = useRef(null);

  useEffect(() => {
    loadKbData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [agent.id]);

  useEffect(() => {
    const needsPolling = kb && (kb.processing || kb.index_status === "indexing");
    if (needsPolling && !pollRef.current) {
      if (!indexingStartedAt) setIndexingStartedAt(Date.now());
      pollRef.current = setInterval(() => refreshKb(), 3000);
    } else if (!needsPolling && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      if (indexingStartedAt) {
        logStepJSON("Indexing", "completed", { durationMs: Date.now() - indexingStartedAt, status: kb?.index_status, fileCount: files.length });
        setIndexingStartedAt(null);
        lastDebugLogCount.current = 0;
      }
    }
  }, [kb?.processing, kb?.index_status]);

  const loadKbData = async () => {
    setKbLoading(true);
    try {
      const kbIds = agent.knowledge_base_ids || [];
      if (kbIds.length > 0) {
        const kbList = await base44.entities.KnowledgeBase.list("-created_date");
        const found = kbList.find(k => kbIds.includes(String(k.id)));
        if (found) {
          setKb(found);
          setFiles(found.files || []);
        }
      }
    } catch (e) {
      logStep("Sources", "loadKbData error", String(e?.message || e));
    } finally {
      setKbLoading(false);
    }
  };

  const refreshKb = async () => {
    try {
      const kbIds = agent.knowledge_base_ids || [];
      const currentKbId = kb?.id;
      const idToFetch = currentKbId || (kbIds.length > 0 ? kbIds[0] : null);
      if (!idToFetch) return;
      const kbList = await base44.entities.KnowledgeBase.filter({ id: idToFetch });
      const found = kbList?.[0];
      if (found) {
        // Stream new backend debug_logs into the client console
        if (Array.isArray(found.debug_logs) && found.debug_logs.length > lastDebugLogCount.current) {
          const newLogs = found.debug_logs.slice(lastDebugLogCount.current);
          for (const entry of newLogs) {
            try {
              const parsed = JSON.parse(entry);
              logStepJSON("Indexing", parsed.step || "log", parsed);
            } catch {
              logStep("Indexing", entry);
            }
          }
          lastDebugLogCount.current = found.debug_logs.length;
        }

        // Detect stuck indexing (>90 seconds)
        if (indexingStartedAt && (found.processing || found.index_status === "indexing") && Date.now() - indexingStartedAt > 90000) {
          logStep("Indexing", "Timeout: indexing has been running for over 90s, resetting status");
          await base44.entities.KnowledgeBase.update(found.id, {
            processing: false,
            index_status: "failed",
            last_error: "Indexing timed out after 90 seconds",
          });
          found.processing = false;
          found.index_status = "failed";
          found.last_error = "Indexing timed out after 90 seconds";
          setIndexingStartedAt(null);
        }

        setKb(found);
        setFiles(found.files || []);
      }
    } catch (e) {
      logStep("Sources", "refreshKb error", String(e?.message || e));
    }
  };

  const ensureKb = async () => {
    if (kb) return kb;
    setIsCreatingKb(true);
    try {
      logStep("Sources", "Creating KB for agent", agent.name);
      const newKb = await base44.entities.KnowledgeBase.create({
        name: `${agent.name} Sources`,
        description: `Knowledge base for ${agent.name}`,
        files: [],
        processing: false,
        index_status: "idle",
        index_progress: 0,
        last_error: "",
      });
      const newKbId = String(newKb.id);
      const existingIds = agent.knowledge_base_ids || [];
      const updatedIds = [...existingIds, newKbId];
      await base44.entities.Agent.update(agent.id, { knowledge_base_ids: updatedIds });
      agent.knowledge_base_ids = updatedIds;
      if (onKbIdsChange) onKbIdsChange(updatedIds);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setKb(newKb);
      logStep("Sources", "KB created", newKbId);
      return newKb;
    } catch (e) {
      logStep("Sources", "ensureKb error", String(e?.message || e));
      return null;
    } finally {
      setIsCreatingKb(false);
    }
  };

  const handleFileSelect = async (e) => {
    const raw = e.target.files || e;
    if (!raw || raw.length === 0) return;
    const all = Array.from(raw).slice(0, 100);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowAddModal(false);

    const accepted = [];
    const rejected = [];
    for (const f of all) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.includes(ext)) accepted.push(f);
      else rejected.push(f.name);
    }
    setRejectedFiles(rejected);
    if (accepted.length === 0) return;

    logStepJSON("Sources", "files_selected", {
      totalSelected: all.length,
      accepted: accepted.map(f => f.name),
      rejected,
    });

    const uploadEntries = accepted.map(file => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "uploading",
      url: null,
    }));
    setUploadingFiles(prev => [...prev, ...uploadEntries]);

    const targetKb = await ensureKb();
    if (!targetKb) {
      setUploadingFiles(prev => prev.map(uf =>
        uploadEntries.some(e => e.key === uf.key) ? { ...uf, status: "error" } : uf
      ));
      return;
    }

    const newFileEntries = [];
    for (const entry of uploadEntries) {
      try {
        let fileToUpload = entry.file;
        const extracted = await extractTextFromPdfIfLarge(entry.file);
        if (extracted) {
          logStep("Sources", "Large PDF → text", entry.file.name);
          fileToUpload = extracted;
        }

        logStep("Sources", "Uploading file", fileToUpload.name);
        const uploadRes = await base44.integrations.Core.UploadFile({ file: fileToUpload });
        if (!uploadRes?.file_url) throw new Error("No URL returned");

        const fileEntry = {
          name: fileToUpload.name,
          url: uploadRes.file_url,
          size: fileToUpload.size,
          type: (fileToUpload.name.split(".").pop() || "txt").toLowerCase(),
          processed: false,
        };
        newFileEntries.push(fileEntry);

        setUploadingFiles(prev => prev.map(uf =>
          uf.key === entry.key ? { ...uf, status: "done", url: uploadRes.file_url } : uf
        ));
      } catch (e) {
        logStep("Sources", "Upload error", entry.file.name + " " + String(e?.message || e));
        setUploadingFiles(prev => prev.map(uf =>
          uf.key === entry.key ? { ...uf, status: "error" } : uf
        ));
      }
    }

    if (newFileEntries.length > 0) {
      try {
        const currentFiles = [...(targetKb.files || []), ...newFileEntries];
        await base44.entities.KnowledgeBase.update(targetKb.id, {
          files: currentFiles,
          processing: true,
          index_status: "indexing",
        });
        setFiles(currentFiles);
        setKb(prev => prev ? { ...prev, files: currentFiles, processing: true, index_status: "indexing" } : prev);

        logStepJSON("Sources", "trigger_indexing", {
          kbId: String(targetKb.id),
          totalFiles: currentFiles.length,
          newFiles: newFileEntries.map(f => ({ name: f.name, type: f.type, size: f.size })),
        });
        lastDebugLogCount.current = 0;
        setIndexingStartedAt(Date.now());
        base44.functions.invoke("indexKnowledgeBase", { kbId: String(targetKb.id) })
          .then(res => {
            logStepJSON("Indexing", "function_returned", res?.data || res);
            if (res?.data?.debug) {
              (res.data.debug || []).forEach(d => {
                try { logStepJSON("Indexing", JSON.parse(d).step || "debug", JSON.parse(d)); } catch { logStep("Indexing", d); }
              });
            }
          })
          .catch(e => {
            logStepJSON("Sources", "indexKnowledgeBase_error", { error: String(e?.message || e), stack: e?.stack });
          });

        queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      } catch (e) {
        logStep("Sources", "KB update error", String(e?.message || e));
      }
    }

    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(uf => uf.status === "uploading"));
    }, 2000);
  };

  const handleRemoveFile = async (fileIndex) => {
    if (!kb) return;
    setShowDeleteConfirm(null);
    try {
      const updatedFiles = files.filter((_, i) => i !== fileIndex);
      await base44.entities.KnowledgeBase.update(kb.id, {
        files: updatedFiles,
        processing: updatedFiles.some(f => !f.processed),
      });
      setFiles(updatedFiles);
      setKb(prev => prev ? { ...prev, files: updatedFiles } : prev);
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      logStep("Sources", "File removed", files[fileIndex]?.name);

      if (updatedFiles.some(f => !f.processed) && updatedFiles.length > 0) {
        base44.functions.invoke("indexKnowledgeBase", { kbId: String(kb.id) })
          .then(res => logStepJSON("Indexing", "function_returned", res?.data || res))
          .catch(e => logStepJSON("Sources", "indexKnowledgeBase_error", { error: String(e?.message || e) }));
      }
    } catch (e) {
      logStep("Sources", "Remove file error", String(e?.message || e));
    }
  };

  const handleRetryIndexing = async () => {
    if (!kb) return;
    logStepJSON("Sources", "retry_indexing", { kbId: kb.id, fileCount: files.length });
    const resetFiles = files.map(f => {
      if (!f.processed || !f.index_tree?.root) return { ...f, processed: false };
      return f;
    });
    try {
      await base44.entities.KnowledgeBase.update(kb.id, {
        files: resetFiles,
        processing: true,
        index_status: "indexing",
        last_error: "",
        debug_logs: [],
      });
      setFiles(resetFiles);
      setKb(prev => prev ? { ...prev, files: resetFiles, processing: true, index_status: "indexing", last_error: "", debug_logs: [] } : prev);
      lastDebugLogCount.current = 0;
      setIndexingStartedAt(Date.now());
      base44.functions.invoke("indexKnowledgeBase", { kbId: String(kb.id) })
        .then(res => logStepJSON("Indexing", "function_returned", res?.data || res))
        .catch(e => logStepJSON("Sources", "retry_error", { error: String(e?.message || e) }));
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    } catch (e) {
      logStep("Sources", "Retry error", String(e?.message || e));
    }
  };

  const isYouTubeUrl = (url) => {
    return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]+/.test(url);
  };

  const handleLinkSubmit = async () => {
    const url = linkInput.trim();
    if (!url) return;
    setLinkError("");

    if (!isYouTubeUrl(url)) {
      setLinkError("Only YouTube links are supported for now.");
      return;
    }

    setLinkLoading(true);
    try {
      const targetKb = await ensureKb();
      if (!targetKb) { setLinkError("Failed to create knowledge base."); return; }

      const fileEntry = {
        name: `YouTube: ${url.length > 60 ? url.slice(0, 60) + "..." : url}`,
        url: url,
        size: 0,
        type: "youtube",
        processed: false,
      };

      const currentFiles = [...(targetKb.files || []), fileEntry];
      await base44.entities.KnowledgeBase.update(targetKb.id, {
        files: currentFiles,
        processing: true,
        index_status: "indexing",
      });
      setFiles(currentFiles);
      setKb(prev => prev ? { ...prev, files: currentFiles, processing: true, index_status: "indexing" } : prev);

      logStepJSON("Sources", "youtube_link_added", {
        url,
        kbId: String(targetKb.id),
        totalFiles: currentFiles.length,
      });
      lastDebugLogCount.current = 0;
      setIndexingStartedAt(Date.now());
      base44.functions.invoke("indexKnowledgeBase", { kbId: String(targetKb.id) })
        .then(res => {
          logStepJSON("Indexing", "yt_function_returned", res?.data || res);
          if (res?.data?.debug) {
            (res.data.debug || []).forEach(d => {
              try { logStepJSON("Indexing", JSON.parse(d).step || "debug", JSON.parse(d)); } catch { logStep("Indexing", d); }
            });
          }
        })
        .catch(e => {
          logStepJSON("Sources", "indexKnowledgeBase_error", { error: String(e?.message || e), url });
        });

      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      setLinkInput("");
      setShowAddModal(false);
    } catch (e) {
      logStep("Sources", "Link add error", String(e?.message || e));
      setLinkError("Failed to add link. Try again.");
    } finally {
      setLinkLoading(false);
    }
  };

  const openAddModal = () => {
    setShowAddModal(true);
    setLinkInput("");
    setLinkError("");
    setTimeout(() => setAddModalMounted(true), 20);
  };
  const closeAddModal = () => {
    setAddModalMounted(false);
    setTimeout(() => setShowAddModal(false), 200);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles?.length > 0) handleFileSelect(droppedFiles);
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const handleDownloadFile = (file) => {
    if (!file.url) return;
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name || "download";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isProcessing = kb?.processing || kb?.index_status === "indexing";

  return (
    <div style={{
      width: 280,
      minWidth: 280,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#0f0f0f",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        height: 64,
        padding: "0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen style={{ width: 15, height: 15, color: "#f97316" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>Sources</span>
          {files.length > 0 && (
            <span style={{
              fontSize: 10, color: "#f97316", background: "rgba(249,115,22,0.15)",
              padding: "2px 6px", borderRadius: 6, fontWeight: 500,
            }}>
              {files.length}
            </span>
          )}
        </div>
      </div>

      {/* Add Sources button */}
      <div style={{ padding: "12px 12px 0" }}>
        <button
          onClick={openAddModal}
          disabled={isCreatingKb}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px", borderRadius: 10, width: "100%",
            background: "rgba(249,115,22,0.08)",
            border: "1px solid rgba(249,115,22,0.2)",
            cursor: isCreatingKb ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: isCreatingKb ? 0.5 : 1,
          }}
          onMouseEnter={e => { if (!isCreatingKb) { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.35)"; }}}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.08)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.2)"; }}
        >
          {isCreatingKb ? (
            <Loader2 style={{ width: 14, height: 14, color: "#f97316", animation: "spin 1s linear infinite" }} />
          ) : (
            <Plus style={{ width: 14, height: 14, color: "#f97316" }} />
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: "#f97316" }}>
            {isCreatingKb ? "Setting up..." : "Add Sources"}
          </span>
        </button>
      </div>

      {/* Failed / retry bar */}
      {(kb?.index_status === "failed" || kb?.last_error) && !isProcessing && (
        <div style={{
          margin: "8px 12px 0", padding: "8px 10px", borderRadius: 8,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle style={{ width: 12, height: 12, color: "#ef4444", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "#ef4444", flex: 1 }}>
            {kb?.last_error ? kb.last_error.slice(0, 80) : "Indexing failed"}
          </span>
          <button
            onClick={handleRetryIndexing}
            style={{
              background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)",
              color: "#f97316", cursor: "pointer", padding: "3px 8px", borderRadius: 5,
              fontSize: 10, fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Rejected files warning */}
      {rejectedFiles.length > 0 && (
        <div style={{ padding: "6px 12px 0" }}>
          <p style={{ fontSize: 10, color: "#ef4444", lineHeight: 1.4, margin: 0 }}>
            Unsupported: {rejectedFiles.join(", ")}
          </p>
        </div>
      )}

      {/* File list */}
      <div style={{
        flex: 1, overflow: "auto", padding: "8px 12px 12px",
        display: "flex", flexDirection: "column", gap: 4,
        scrollbarWidth: "none", msOverflowStyle: "none",
      }}>
        {kbLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 style={{ width: 20, height: 20, color: "#f97316", animation: "spin 1s linear infinite" }} />
          </div>
        ) : files.length === 0 && uploadingFiles.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload style={{ width: 18, height: 18, color: "#555" }} />
            </div>
            <p style={{ fontSize: 11, color: "#555", textAlign: "center", lineHeight: 1.5, maxWidth: 200 }}>
              Upload files to build this agent's knowledge base
            </p>
            <p style={{ fontSize: 10, color: "#333", textAlign: "center" }}>
              PDF, TXT, DOCX, XLSX, code files, and more
            </p>
          </div>
        ) : (
          <>
            {/* Uploading files */}
            {uploadingFiles.map(uf => (
              <div key={uf.key} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 10,
                background: "#141414",
                border: "1px dashed rgba(249,115,22,0.25)",
              }}>
                {uf.status === "uploading" ? (
                  <Loader2 style={{ width: 13, height: 13, color: "#f97316", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                ) : uf.status === "error" ? (
                  <AlertCircle style={{ width: 13, height: 13, color: "#ef4444", flexShrink: 0 }} />
                ) : (
                  <CheckCircle style={{ width: 13, height: 13, color: "#22c55e", flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: uf.status === "error" ? "#ef4444" : "#888",
                }}>
                  {uf.file.name}
                </span>
              </div>
            ))}

            {/* Existing files */}
            {files.map((file, index) => {
              const iconStyle = getFileIcon(file.type);
              const isReady = file.processed && file.index_tree?.root;
              const FileIcon = iconStyle.icon === "youtube" ? Youtube : FileText;
              return (
                <div key={`file-${index}-${file.name}`} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 10,
                  background: "#141414",
                  border: "1px solid rgba(255,255,255,0.04)",
                  transition: "all 0.2s",
                  position: "relative",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.15)"; e.currentTarget.style.background = "#181818"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = "#141414"; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: iconStyle.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <FileIcon style={{ width: 13, height: 13, color: iconStyle.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 11, color: "#e5e5e5", margin: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.name}
                    </p>
                    <p style={{
                      fontSize: 9, margin: 0, marginTop: 1,
                      color: isReady ? "#555" : (kb?.index_status === "failed" && !file.processed) ? "#ef4444" : "#f97316",
                    }}>
                      {isReady ? (
                        `${(file.type === "youtube" ? "YT" : (file.type || "").toUpperCase())}${file.size ? " · " + formatFileSize(file.size) : ""}`
                      ) : isProcessing ? (
                        "Indexing..."
                      ) : (kb?.index_status === "failed" && !file.processed) ? (
                        "Failed"
                      ) : (
                        "Pending"
                      )}
                    </p>
                  </div>
                  {isReady && file.url && file.type !== "youtube" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#555", padding: 3, borderRadius: 5, display: "flex",
                        transition: "color 0.2s", flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
                      onMouseLeave={e => e.currentTarget.style.color = "#555"}
                      title="Download file"
                    >
                      <Download style={{ width: 12, height: 12 }} />
                    </button>
                  )}
                  {!isReady && !isProcessing && (
                    <Loader2 style={{ width: 12, height: 12, color: "#f97316", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(index); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#333", padding: 3, borderRadius: 5, display: "flex",
                      transition: "color 0.2s", flexShrink: 0, opacity: 0.6,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#333"; e.currentTarget.style.opacity = "0.6"; }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm !== null && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }} onClick={() => setShowDeleteConfirm(null)}>
          <div style={{
            background: "#181818", border: "1px solid #2a2a2a", borderRadius: 12,
            padding: 20, maxWidth: 260, width: "90%",
            boxShadow: "0 20px 25px rgba(0,0,0,0.5)",
          }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", marginBottom: 6 }}>
              Remove source?
            </p>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 14, lineHeight: 1.4 }}>
              "{files[showDeleteConfirm]?.name}" will be removed from this agent's knowledge.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  flex: 1, padding: "7px 12px", borderRadius: 8, background: "transparent",
                  border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveFile(showDeleteConfirm)}
                style={{
                  flex: 1, padding: "7px 12px", borderRadius: 8, background: "#ef4444",
                  border: "none", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Sources Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
          opacity: addModalMounted ? 1 : 0,
          transition: "opacity 0.2s ease",
        }} onClick={closeAddModal}>
          <div style={{
            background: "#181818", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
            padding: 24, width: "90%", maxWidth: 400,
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            transform: addModalMounted ? "scale(1)" : "scale(0.95)",
            opacity: addModalMounted ? 1 : 0,
            transition: "transform 0.2s ease, opacity 0.2s ease",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f5f5f5", margin: 0 }}>Add Sources</h3>
              <button onClick={closeAddModal} style={{
                background: "none", border: "none", cursor: "pointer", color: "#555",
                display: "flex", padding: 4, borderRadius: 6,
              }}
                onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
                onMouseLeave={e => e.currentTarget.style.color = "#555"}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Drag & drop / file picker area */}
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 12, padding: "32px 20px", borderRadius: 12,
                border: `2px dashed ${isDragging ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.1)"}`,
                background: isDragging ? "rgba(249,115,22,0.06)" : "#0f0f0f",
                cursor: "pointer", transition: "all 0.2s",
                marginBottom: 16,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"; e.currentTarget.style.background = "rgba(249,115,22,0.04)"; }}
              onMouseLeave={e => { if (!isDragging) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "#0f0f0f"; }}}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Upload style={{ width: 22, height: 22, color: "#f97316" }} />
              </div>
              <p style={{ fontSize: 13, color: "#e5e5e5", fontWeight: 500, margin: 0, textAlign: "center" }}>
                Drag files here or click to browse
              </p>
              <p style={{ fontSize: 11, color: "#555", margin: 0, textAlign: "center" }}>
                PDF, TXT, DOCX, XLSX, code files, and more
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                multiple
                accept={ACCEPT_STRING}
                style={{ display: "none" }}
                disabled={isCreatingKb}
              />
            </label>

            {/* URL input */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Link style={{ width: 14, height: 14, color: "#f97316", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#e5e5e5", fontWeight: 500 }}>Or paste a YouTube URL</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={linkInput}
                  onChange={e => { setLinkInput(e.target.value); setLinkError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleLinkSubmit(); }}
                  placeholder="https://youtube.com/watch?v=..."
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 10, fontSize: 13,
                    background: "#0f0f0f", border: "1px solid #2a2a2a", color: "#f5f5f5",
                    outline: "none", minWidth: 0,
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
                  onBlur={e => e.target.style.borderColor = "#2a2a2a"}
                />
                <button
                  onClick={handleLinkSubmit}
                  disabled={linkLoading || !linkInput.trim()}
                  style={{
                    padding: "9px 16px", borderRadius: 10, border: "none",
                    background: linkInput.trim() ? "#f97316" : "#2a2a2a",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: linkLoading || !linkInput.trim() ? "not-allowed" : "pointer",
                    opacity: linkLoading ? 0.6 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.2s",
                  }}
                >
                  {linkLoading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : "Add"}
                </button>
              </div>
              {linkError && (
                <p style={{ fontSize: 11, color: "#ef4444", margin: "6px 0 0" }}>{linkError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
