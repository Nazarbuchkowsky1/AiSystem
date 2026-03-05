import React from "react";
import { Trash2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function KnowledgeBaseViewGrid({ knowledgeBases = [] }) {
  const queryClient = useQueryClient();

  const handleDelete = async (kbId) => {
    await base44.entities.KnowledgeBase.delete(kbId);
    queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
  };

  if (knowledgeBases.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
          <Upload style={{ width: 24, height: 24, color: "#f97316" }} />
        </div>
        <p style={{ fontSize: 13, color: "#f5f5f5" }}>No knowledge bases yet</p>
        <p style={{ fontSize: 11, color: "#555" }}>Create a knowledge base first</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, overflow: "auto" }}>
      {knowledgeBases.map((kb) => (
        <div key={kb.id} style={{
          background: "#181818", border: "1px solid #2a2a2a", borderRadius: 12, padding: 16,
          display: "flex", flexDirection: "column", gap: 10, cursor: "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "#2a2a2a";
          e.currentTarget.style.boxShadow = "none";
        }}
        >
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
            <button onClick={(e) => {
              e.stopPropagation();
              handleDelete(kb.id);
            }} style={{
              padding: 6, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "none",
              color: "#ef4444", cursor: "pointer", display: "flex", transition: "all 0.2s"
            }}>
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}