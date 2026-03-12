import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Brain, BookOpen, Loader2 } from "lucide-react";
import AgentCard from "../components/agents/AgentCard";
import AgentWorkspace from "../components/agents/AgentWorkspace";
import NewAgentModal from "../components/agents/NewAgentModal";
import NewKBModal from "../components/knowledge/NewKBModal.jsx";
import KnowledgeBaseCard from "../components/knowledge/KnowledgeBaseCard";
import EditKBModal from "../components/knowledge/EditKBModal";

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewKBModal, setShowNewKBModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editingKB, setEditingKB] = useState(null);
  const [currentTab, setCurrentTab] = useState("agents");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const queryClient = useQueryClient();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = () => setShowNewModal(true);
    window.addEventListener("mobile-new-agent", handler);
    return () => window.removeEventListener("mobile-new-agent", handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowNewKBModal(true);
    window.addEventListener("mobile-new-kb", handler);
    return () => window.removeEventListener("mobile-new-kb", handler);
  }, []);

  // Broadcast current tab to layout header
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("agents-tab-change", { detail: currentTab }));
  }, [currentTab]);

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => base44.entities.Agent.list("-created_date"),
  });

  const { data: knowledgeBases = [], isLoading: kbLoading } = useQuery({
    queryKey: ["knowledgeBases"],
    queryFn: () => base44.entities.KnowledgeBase.list("-created_date"),
    refetchInterval: (query) => {
      const data = query.state.data;
      return Array.isArray(data) && data.some((kb) => kb.processing || kb.index_status === "indexing") ? 3000 : false;
    },
  });

  const contentLoading = currentTab === "agents" ? agentsLoading : kbLoading;

  const createAgentMutation = useMutation({
    mutationFn: (agentData) => base44.entities.Agent.create(agentData),
    onSuccess: (created, agentData) => {
      if (created?.id != null) {
        const withModel = { ...created, model: created.model ?? agentData?.model ?? "kimi" };
        queryClient.setQueryData(["agents"], (old) => {
          if (!Array.isArray(old)) return old;
          const exists = old.some((a) => String(a.id) === String(created.id));
          if (exists) return old.map((a) => (String(a.id) === String(created.id) ? { ...a, ...withModel } : a));
          return [withModel, ...old];
        });
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agent.update(id, data),
    onSuccess: (_, variables) => {
      const { id, data } = variables;
      // Update cache immediately so the next click on the agent card gets fresh data (e.g. model).
      queryClient.setQueryData(["agents"], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((a) => (String(a.id) === String(id) ? { ...a, ...data } : a));
      });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      // If user had this agent open in workspace, keep selectedAgent in sync (e.g. after editing from elsewhere).
      setSelectedAgent((prev) =>
        prev && String(prev.id) === String(id) ? { ...prev, ...data } : prev
      );
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const createKBMutation = useMutation({
    mutationFn: (kbData) => base44.entities.KnowledgeBase.create(kbData),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      setShowNewKBModal(false);
      // Trigger real PageIndex tree indexing (runs in background, 30+ sec for docs)
      if (created?.id && created?.files?.length) {
        base44.functions.invoke("indexKnowledgeBase", { kbId: created.id }).catch(() => {});
      }
    },
  });

  if (selectedAgent) {
    return <AgentWorkspace agent={selectedAgent} onBack={() => setSelectedAgent(null)} />;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
      {/* Header: height 64 to align border with sidebar logo block */}
      <div style={{
        height: 64,
        padding: "0 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, rgba(249,115,22,0.03), transparent)",
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(249,115,22,0.2)",
            boxShadow: "0 2px 12px rgba(249,115,22,0.15)",
            flexShrink: 0,
          }}>
            <Brain style={{ width: 18, height: 18, color: "#f97316" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              Agents
            </h1>
          </div>
        </div>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* Switcher: left segment fixed width so orange pill doesn't bleed; pill rounded like Instant */}
            <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a", position: "relative", width: 220 }}>
              <div style={{
                position: "absolute",
                left: currentTab === "agents" ? 0 : 94,
                top: 0,
                bottom: 0,
                width: currentTab === "agents" ? 94 : 126,
                background: "rgba(249,115,22,0.15)",
                borderRadius: 9,
                transition: "left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                zIndex: 0,
              }} />
              <button
                onClick={() => setCurrentTab("agents")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 500,
                  background: "transparent",
                  color: currentTab === "agents" ? "#f97316" : "#555",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  zIndex: 1,
                  width: 94,
                  flexShrink: 0,
                }}
              >
                <Brain style={{ width: 11, height: 11 }} />
                Agents
              </button>
              <button
                onClick={() => setCurrentTab("knowledge")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 500,
                  background: "transparent",
                  color: currentTab === "knowledge" ? "#f97316" : "#555",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  zIndex: 1,
                  flex: 1,
                }}
              >
                <BookOpen style={{ width: 11, height: 11 }} />
                Knowledge Base
              </button>
            </div>
            <button
              onClick={currentTab === "agents" ? () => setShowNewModal(true) : () => setShowNewKBModal(true)}
              style={{
                background: "rgba(249,115,22,0.15)",
                color: "#f97316",
                border: "1px solid rgba(249,115,22,0.3)",
                padding: "8px 16px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.2s",
                minWidth: 118,
                justifyContent: "center",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; }}
            >
              <Plus style={{ width: 12, height: 12 }} /> {currentTab === "agents" ? "New Agent" : "New KB"}
            </button>
          </div>
        )}
      </div>

      {(showNewModal || editingAgent) && (
        <NewAgentModal
          onClose={() => { setShowNewModal(false); setEditingAgent(null); }}
          onCreate={(agentData) => createAgentMutation.mutate(agentData)}
          onUpdate={(id, data) => updateAgentMutation.mutate({ id, data })}
          onDelete={(id) => deleteAgentMutation.mutate(id)}
          knowledgeBases={knowledgeBases}
          editAgent={editingAgent}
        />
      )}

      {showNewKBModal && (
        <NewKBModal 
          onClose={() => setShowNewKBModal(false)} 
          onCreate={(kbData) => createKBMutation.mutate(kbData)}
          isLoading={createKBMutation.isPending}
        />
      )}

      {editingKB && (
        <EditKBModal
          kb={editingKB}
          onClose={() => setEditingKB(null)}
          onSaved={() => {
            setEditingKB(null);
            queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
          }}
        />
      )}

      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", padding: "16px 16px 16px 16px" }}>
        {contentLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(10,10,10,0.75)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              zIndex: 10,
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 style={{ width: 32, height: 32, color: "#f97316", animation: "agents-page-spin 1s linear infinite" }} />
            </div>
          </div>
        )}
        {!contentLoading && (currentTab === "agents" ? (
          agents.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
                <Brain style={{ width: 24, height: 24, color: "#f97316" }} />
              </div>
              <p style={{ fontSize: 13, color: "#f5f5f5" }}>No agents yet</p>
              <p style={{ fontSize: 11, color: "#555" }}>Create your first AI agent to get started</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, alignItems: "stretch" }}>
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => setSelectedAgent(agent)}
                  onEdit={(a) => setEditingAgent(a)}
                />
              ))}
            </div>
          )
        ) : (
          knowledgeBases.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
                <BookOpen style={{ width: 24, height: 24, color: "#f97316" }} />
              </div>
              <p style={{ fontSize: 13, color: "#f5f5f5" }}>No knowledge bases yet</p>
              <p style={{ fontSize: 11, color: "#555" }}>Create a knowledge base to connect it to your agents</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, alignItems: "stretch" }}>
              {knowledgeBases.map((kb) => (
                <KnowledgeBaseCard
                  key={kb.id}
                  kb={kb}
                  onSelect={() => setEditingKB(kb)}
                />
              ))}
            </div>
          )
        ))}
      </div>

      <style>{`@keyframes agents-page-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}