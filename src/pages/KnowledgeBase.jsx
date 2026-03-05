import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeft, Upload, Loader2 } from "lucide-react";
import KnowledgeBaseCard from "../components/knowledge/KnowledgeBaseCard";

export default function KnowledgeBasePage({ onBack }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedKBId, setSelectedKBId] = useState(null);
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, overflow: "auto" }}>
          {knowledgeBases.map((kb) => (
            <KnowledgeBaseCard
              key={kb.id}
              kb={kb}
              onSelect={setSelectedKBId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewKBModal({ onClose, onCreate, isLoading }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);

  const handleCreate = async () => {
    if (!name.trim() || files.length === 0) return;
    
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

    await onCreate({
      name: name.trim(),
      description: description.trim(),
      files: uploadedFiles,
    });
    setName("");
    setDescription("");
    setFiles([]);
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
              cursor: "pointer"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || files.length === 0 || isLoading} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || files.length === 0 || isLoading ? "not-allowed" : "pointer",
              opacity: !name.trim() || files.length === 0 || isLoading ? 0.5 : 1,
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