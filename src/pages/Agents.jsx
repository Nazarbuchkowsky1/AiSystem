import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Bot, BookOpen, Loader2 } from "lucide-react";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
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
      {/* Header, styled similar to Tools */}
      <div style={{
        padding: "14px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, rgba(249,115,22,0.03), transparent)",
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              <Bot style={{ width: 18, height: 18, color: "#f97316" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#f5f5f5",
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                }}
              >
                Agents
              </h1>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexShrink: 0,
              marginTop: 6,
            }}
          >
            {[["agents", Bot, "Agents"], ["knowledge", BookOpen, "Knowledge Base"]].map(([tab, Icon, label]) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 14px",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  background: currentTab === tab ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
                  color: currentTab === tab ? "#f97316" : "#777",
                  border: currentTab === tab ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  borderRadius: 999,
                  transition: "all 0.2s ease",
                }}
              >
                <Icon style={{ width: 11, height: 11, flexShrink: 0 }} />
                {label}
              </button>
            ))}
          </div>
        </div>
        {!isMobile && (
          currentTab === "agents" ? (
            <button
              onClick={() => setShowNewModal(true)}
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
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New Agent
            </button>
          ) : (
            <button
              onClick={() => setShowNewKBModal(true)}
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
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New KB
            </button>
          )
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
                <Bot style={{ width: 24, height: 24, color: "#f97316" }} />
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, alignItems: "flex-start" }}>
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