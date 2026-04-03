import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeft, Upload } from "lucide-react";
import { logStep } from "@/lib/clientLogger";
import KnowledgeBaseCard from "../components/knowledge/KnowledgeBaseCard";
import NewKBModal from "../components/knowledge/NewKBModal";

export default function KnowledgeBasePage({ onBack }) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedKBId, setSelectedKBId] = useState(null);
  const queryClient = useQueryClient();

  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["knowledgeBases"],
    queryFn: async () => {
      logStep("KB", "KnowledgeBase.list: start");
      const list = await base44.entities.KnowledgeBase.list("-created_date");
      logStep("KB", "KnowledgeBase.list: done count", list?.length);
      return list;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return Array.isArray(data) && data.some((kb) => kb.processing || kb.index_status === "indexing") ? 3000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeBase.create(data),
    onSuccess: (created) => {
      logStep("KB", "KnowledgeBase.create: done", created?.id);
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      if (created?.id && created?.files?.length) {
        logStep("KB", "indexKnowledgeBase: start", created.id);
        base44.functions.invoke("indexKnowledgeBase", { kbId: created.id }).catch((e) => {
          logStep("KB", "indexKnowledgeBase: error", String(e?.message || e));
        });
      }
    },
    onError: (e) => {
      logStep("KB", "KnowledgeBase.create: error", String(e?.message || e));
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
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>База знань</h1>
        </div>
        <button onClick={() => setShowNewModal(true)} style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus style={{ width: 12, height: 12 }} /> Нова база
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
          <p style={{ fontSize: 13, color: "#f5f5f5" }}>Баз знань ще немає</p>
          <p style={{ fontSize: 11, color: "#555" }}>Створіть базу знань, щоб підключити її до агентів</p>
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
