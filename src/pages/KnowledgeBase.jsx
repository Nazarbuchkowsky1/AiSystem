import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeft, Trash2, Upload, Loader2 } from "lucide-react";

export default function KnowledgeBasePage({ onBack }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["knowledgeBases"],
    queryFn: () => base44.entities.KnowledgeBase.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeBase.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeBase.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
    },
  });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "10px 16px", gap: 12, overflow: "hidden", background: "#0a0a0a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 6, borderRadius: 10, display: "flex", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f5f5f5"}
            onMouseLeave={e => e.currentTarget.style.color = "#555"}>
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>Knowledge Base</h1>
        </div>
        <button onClick={() => setShowNewModal(true)} style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus style={{ width: 12, height: 12 }} /> New KB
        </button>
      </div>

      {showNewModal && (
        <NewKBModal
          onClose={() => setShowNewModal(false)}
          onCreate={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {knowledgeBases.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
            <Upload style={{ width: 24, height: 24, color: "#f97316" }} />
          </div>
          <p style={{ fontSize: 13, color: "#f5f5f5" }}>No knowledge bases yet</p>
          <p style={{ fontSize: 11, color: "#555" }}>Create a knowledge base to connect it to your agents</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, overflow: "auto" }}>
          {knowledgeBases.map((kb) => (
            <div key={kb.id} style={{
              background: "#181818", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", gap: 10
            }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>{kb.name}</h3>
                {kb.description && (
                  <p style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>{kb.description}</p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#444" }}>{kb.file_type.toUpperCase()}</p>
                  <p style={{ fontSize: 9, color: "#333" }}>{(kb.file_size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => deleteMutation.mutate(kb.id)} disabled={deleteMutation.isPending} style={{
                  padding: 6, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "none",
                  color: "#ef4444", cursor: "pointer", display: "flex", transition: "all 0.2s"
                }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewKBModal({ onClose, onCreate, isLoading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const handleCreate = async () => {
    if (!name.trim() || !file) return;
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    await onCreate({
      name: name.trim(),
      description: description.trim(),
      file_url: uploadRes.file_url,
      file_type: file.name.split(".").pop().toLowerCase(),
      file_name: file.name,
      file_size: file.size,
    });
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
        padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 25px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5", marginBottom: 20 }}>Create Knowledge Base</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Company Documentation"
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
            <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this KB contain?"
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
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: 16, borderRadius: 10, background: "#0f0f0f", border: "2px dashed #2a2a2a",
              cursor: "pointer", transition: "all 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}>
              {file ? (
                <>
                  <Upload style={{ width: 16, height: 16, color: "#f97316" }} />
                  <span style={{ fontSize: 12, color: "#f5f5f5" }}>{file.name}</span>
                </>
              ) : (
                <>
                  <Upload style={{ width: 16, height: 16, color: "#555" }} />
                  <span style={{ fontSize: 12, color: "#555" }}>Click to upload file</span>
                </>
              )}
              <input
                type="file"
                onChange={e => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.txt,.md,.json,.csv"
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || !file || isLoading} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || !file || isLoading ? "not-allowed" : "pointer",
              opacity: !name.trim() || !file || isLoading ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              {isLoading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : null}
              {isLoading ? "Creating..." : "Create"}
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