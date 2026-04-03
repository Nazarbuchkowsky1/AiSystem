import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Brain, Loader2 } from "lucide-react";
import { logStep } from "@/lib/clientLogger";
import { useAuth } from "@/lib/AuthContext";
import AgentCard from "../components/agents/AgentCard";
import AgentWorkspace from "../components/agents/AgentWorkspace";
import NewAgentModal from "../components/agents/NewAgentModal";

export default function Agents() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
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

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      logStep("Agents", "Agent.list: start");
      const list = await base44.entities.Agent.list("-created_date");
      logStep("Agents", "Agent.list: done count", list?.length);
      return list;
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: (agentData) => base44.entities.Agent.create(agentData),
    onSuccess: (created, agentData) => {
      logStep("Agents", "Agent.create: done", created?.id);
      if (created?.id != null) {
        const withModel = { ...created, model: created.model ?? agentData?.model ?? "gemini" };
        queryClient.setQueryData(["agents"], (old) => {
          if (!Array.isArray(old)) return old;
          const exists = old.some((a) => String(a.id) === String(created.id));
          if (exists) return old.map((a) => (String(a.id) === String(created.id) ? { ...a, ...withModel } : a));
          return [withModel, ...old];
        });
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e) => logStep("Agents", "Agent.create: error", String(e?.message || e)),
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agent.update(id, data),
    onSuccess: (_, variables) => {
      logStep("Agents", "Agent.update: done", variables.id);
      const { id, data } = variables;
      queryClient.setQueryData(["agents"], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((a) => (String(a.id) === String(id) ? { ...a, ...data } : a));
      });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setSelectedAgent((prev) =>
        prev && String(prev.id) === String(id) ? { ...prev, ...data } : prev
      );
    },
    onError: (e) => logStep("Agents", "Agent.update: error", String(e?.message || e)),
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: (_, id) => {
      logStep("Agents", "Agent.delete: done", id);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e) => logStep("Agents", "Agent.delete: error", String(e?.message || e)),
  });

  if (selectedAgent) {
    return (
      <AgentWorkspace
        agent={selectedAgent}
        onBack={() => setSelectedAgent(null)}
        canManageSources={isAdmin}
      />
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
      {/* Header */}
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
              Агенти
            </h1>
          </div>
        </div>
        {!isMobile && isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
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
                minWidth: 118,
                justifyContent: "center",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; }}
            >
              <Plus style={{ width: 12, height: 12 }} /> Новий агент
            </button>
          </div>
        )}
      </div>

      {(showNewModal || editingAgent) && isAdmin && (
        <NewAgentModal
          onClose={() => { setShowNewModal(false); setEditingAgent(null); }}
          onCreate={(agentData) => createAgentMutation.mutate(agentData)}
          onUpdate={(id, data) => updateAgentMutation.mutate({ id, data })}
          onDelete={(id) => deleteAgentMutation.mutate(id)}
          editAgent={editingAgent}
          isAdmin={isAdmin}
        />
      )}

      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", padding: "16px 16px 16px 16px" }}>
        {agentsLoading && (
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
        {!agentsLoading && (
          agents.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
                <Brain style={{ width: 24, height: 24, color: "#f97316" }} />
              </div>
              <p style={{ fontSize: 13, color: "#f5f5f5" }}>Агентів ще немає</p>
              <p style={{ fontSize: 11, color: "#555" }}>
                {isAdmin ? "Створіть свого першого AI-агента, щоб почати" : "Очікуйте, поки адміністратор додасть агентів"}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, alignItems: "stretch" }}>
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => setSelectedAgent(agent)}
                  onEdit={(a) => setEditingAgent(a)}
                  showEdit={isAdmin}
                />
              ))}
            </div>
          )
        )}
      </div>

      <style>{`@keyframes agents-page-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
