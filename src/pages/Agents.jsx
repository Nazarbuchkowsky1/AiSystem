import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Bot, BookOpen, Upload } from "lucide-react";
import AgentCard from "../components/agents/AgentCard";
import AgentWorkspace from "../components/agents/AgentWorkspace";
import NewAgentModal from "../components/agents/NewAgentModal";
import KnowledgeBaseViewGrid from "../components/knowledge/KnowledgeBaseViewGrid.jsx";

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewKBModal, setShowNewKBModal] = useState(false);
  const [currentTab, setCurrentTab] = useState("agents");
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => base44.entities.Agent.list("-created_date"),
  });

  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["knowledgeBases"],
    queryFn: () => base44.entities.KnowledgeBase.list("-created_date"),
  });

  const createAgentMutation = useMutation({
    mutationFn: (agentData) => base44.entities.Agent.create(agentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const createKBMutation = useMutation({
    mutationFn: (kbData) => base44.entities.KnowledgeBase.create(kbData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBases"] });
      setShowNewKBModal(false);
    },
  });

  if (selectedAgent) {
    return <AgentWorkspace agent={selectedAgent} onBack={() => setSelectedAgent(null)} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "10px 16px", gap: 12, overflow: "hidden", background: "#0a0a0a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f5" }}>Agents</h1>
          <div style={{ display: "flex", gap: 4, borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a" }}>
            {[["agents", Bot, "Agents"], ["knowledge", BookOpen, "Knowledge Base"]].map(([tab, Icon, label]) => (
             <button key={tab} onClick={() => setCurrentTab(tab)}
               style={{
                 display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, fontWeight: 500,
                 background: currentTab === tab ? "rgba(249,115,22,0.15)" : "transparent",
                 color: currentTab === tab ? "#f97316" : "#555", border: "none", cursor: "pointer",
                 transition: "all 0.2s"
               }}>
               <Icon style={{ width: 11, height: 11 }} />
               {label}
             </button>
            ))}
          </div>
        </div>
        {currentTab === "agents" && (
          <button onClick={() => setShowNewModal(true)} style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 12, height: 12 }} /> New Agent
          </button>
        )}
        {currentTab === "knowledge" && (
          <button onClick={() => setShowNewKBModal(true)} style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 12, height: 12 }} /> New Knowledge Base
          </button>
        )}
      </div>

      {showNewModal && (
        <NewAgentModal
          onClose={() => setShowNewModal(false)}
          onCreate={(agentData) => createAgentMutation.mutate(agentData)}
          knowledgeBases={knowledgeBases}
        />
      )}

      {showNewKBModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#181818", border: "1px solid #2a2a2a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>New Knowledge Base</h2>
              <button onClick={() => setShowNewKBModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", marginBottom: 8, display: "block" }}>Name</label>
                <input type="text" placeholder="KB name" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f", border: "1px solid #2a2a2a", color: "#f5f5f5", boxSizing: "border-box", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowNewKBModal(false)} style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "transparent", border: "1px solid #2a2a2a", color: "#f5f5f5", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Cancel</button>
                <button style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTab === "agents" ? (
        agents.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
              <Bot style={{ width: 24, height: 24, color: "#f97316" }} />
            </div>
            <p style={{ fontSize: 13, color: "#f5f5f5" }}>No agents yet</p>
            <p style={{ fontSize: 11, color: "#555" }}>Create your first AI agent to get started</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, overflow: "auto" }}>
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onClick={() => setSelectedAgent(agent)} />
            ))}
          </div>
        )
      ) : (
        <KnowledgeBaseViewGrid knowledgeBases={knowledgeBases} />
      )}
    </div>
  );
}