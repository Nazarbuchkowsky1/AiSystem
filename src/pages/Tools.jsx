import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus } from "lucide-react";
import { logStep } from "@/lib/clientLogger";
import ToolCard from "../components/tools/ToolCard";
import NewToolModal from "../components/tools/NewToolModal";
import ToolDetailModal from "../components/tools/ToolDetailModal";

const BUILTIN_TOOLS = [
  {
    name: "Media Scraper",
    description: "Extract video transcripts from YouTube, TikTok, Instagram, Twitter/X, and Facebook via Supadata API.",
    icon_name: "Video",
    tool_type: "builtin",
    status: "active",
    code: `// Media Scraper — powered by Supadata API
// Supports: YouTube, TikTok, Instagram, Twitter/X, Facebook
// Input:  { url: "https://..." }
// Output: { title, transcript, platform, language }
//
// Uses Supadata's /transcript and /metadata endpoints.
// API key is read from SUPADATA_API_KEY env variable.
// Integrated directly into agent-chat/main.ts as a built-in tool.
// No standalone function needed — the agent backend handles it automatically.`
  }
];

export default function Tools() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);

  const { data: dbTools = [] } = useQuery({
    queryKey: ["tools"],
    queryFn: async () => {
      logStep("Tools", "Tool.list: start");
      const list = await base44.entities.Tool.list("-created_date");
      logStep("Tools", "Tool.list: done count", list?.length);
      return list;
    },
  });

  const allTools = [...BUILTIN_TOOLS, ...dbTools];

  const createTool = useMutation({
    mutationFn: d => base44.entities.Tool.create(d),
    onSuccess: (created) => {
      logStep("Tools", "Tool.create: done", created?.id);
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      setShowNew(false);
    },
    onError: (e) => logStep("Tools", "Tool.create: error", String(e?.message || e)),
  });

  const updateTool = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tool.update(id, data),
    onSuccess: (_, { id }) => {
      logStep("Tools", "Tool.update: done", id);
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
    onError: (e) => logStep("Tools", "Tool.update: error", String(e?.message || e)),
  });

  const deleteTool = useMutation({
    mutationFn: id => base44.entities.Tool.delete(id),
    onSuccess: (_, id) => {
      logStep("Tools", "Tool.delete: done", id);
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
    onError: (e) => logStep("Tools", "Tool.delete: error", String(e?.message || e)),
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
      <div style={{
        padding: "14px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, rgba(249,115,22,0.03), transparent)",
        height: 64,
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.08))",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(249,115,22,0.2)",
            boxShadow: "0 2px 12px rgba(249,115,22,0.15)"
          }}>
            <Wrench style={{ width: 18, height: 18, color: "#f97316" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>Tools</h1>
            <p style={{ fontSize: 11, color: "#555", margin: 0, fontWeight: 500 }}>
              {allTools.length} tool{allTools.length !== 1 ? "s" : ""} available
            </p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(249,115,22,0.15)", color: "#f97316",
          border: "1px solid rgba(249,115,22,0.3)", padding: "8px 16px",
          borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.25)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; }}
        >
          <Plus style={{ width: 14, height: 14 }} /> New Tool
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {allTools.map(tool => (
            <ToolCard
              key={tool.id || tool.name}
              tool={tool}
              onClick={setSelectedTool}
            />
          ))}
          </div>
        </div>

        {allTools.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#666", marginBottom: 4 }}>No tools yet</div>
            <div style={{ fontSize: 12, color: "#444" }}>Create your first tool to get started.</div>
          </div>
        )}
      </div>

      {showNew && <NewToolModal onClose={() => setShowNew(false)} onSave={d => createTool.mutate(d)} />}
      {selectedTool && (
        <ToolDetailModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          onDelete={id => {
            if (!selectedTool.tool_type || selectedTool.tool_type === "builtin") return;
            deleteTool.mutate(id);
          }}
          onUpdate={(id, data) => {
            if (!selectedTool.tool_type || selectedTool.tool_type === "builtin") return;
            updateTool.mutate({ id, data });
          }}
        />
      )}
    </div>
  );
}