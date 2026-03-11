import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus } from "lucide-react";
import ToolCard from "../components/tools/ToolCard";
import NewToolModal from "../components/tools/NewToolModal";
import ToolDetailModal from "../components/tools/ToolDetailModal";

const BUILTIN_TOOLS = [
  {
    name: "YouTube Scraper",
    description: "Extract transcript text from any YouTube video. Paste a link and get the full text content.",
    icon_name: "Youtube",
    tool_type: "builtin",
    status: "active",
    code: "// Built-in: Extracts transcript from YouTube videos\n// Usage: Provide a YouTube URL → returns full video text\n// Backend: functions/youtubeTranscript.js"
  },
  {
    name: "KB Expander",
    description: "Expand your knowledge base by feeding it videos, text, or documents. Auto-scrapes and adds to KB.",
    icon_name: "BookOpen",
    tool_type: "builtin",
    status: "active",
    code: "// Built-in: Expands knowledge bases with new content\n// Workflow: YouTube URL → Scrape transcript → Add to KB as text file\n// Can also accept raw text or documents"
  }
];

export default function Tools() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);

  const { data: dbTools = [] } = useQuery({
    queryKey: ["tools"],
    queryFn: () => base44.entities.Tool.list("-created_date"),
  });

  // Seed built-in tools if they don't exist
  const seedMutation = useMutation({
    mutationFn: async () => {
      const existing = await base44.entities.Tool.list();
      const existingNames = existing.map(t => t.name);
      const toCreate = BUILTIN_TOOLS.filter(bt => !existingNames.includes(bt.name));
      for (const bt of toCreate) {
        await base44.entities.Tool.create(bt);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tools"] }),
  });

  useEffect(() => {
    seedMutation.mutate();
  }, []); // eslint-disable-line

  const createTool = useMutation({
    mutationFn: d => base44.entities.Tool.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tools"] }); setShowNew(false); },
  });

  const updateTool = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tool.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tools"] }); },
  });

  const deleteTool = useMutation({
    mutationFn: id => base44.entities.Tool.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tools"] }),
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(90deg, rgba(249,115,22,0.03), transparent)"
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
            <p style={{ fontSize: 11, color: "#555", margin: 0, fontWeight: 500 }}>{dbTools.length} tool{dbTools.length !== 1 ? "s" : ""} configured</p>
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

      {/* Grid */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, maxWidth: 1200, margin: "0 auto" }}>
          {dbTools.map(tool => (
            <ToolCard key={tool.id} tool={tool} onClick={setSelectedTool} />
          ))}
        </div>

        {dbTools.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#666", marginBottom: 4 }}>No tools yet</div>
            <div style={{ fontSize: 12, color: "#444" }}>Built-in tools are being set up...</div>
          </div>
        )}
      </div>

      {showNew && <NewToolModal onClose={() => setShowNew(false)} onSave={d => createTool.mutate(d)} />}
      {selectedTool && (
        <ToolDetailModal
          tool={selectedTool}
          onClose={() => setSelectedTool(null)}
          onDelete={id => deleteTool.mutate(id)}
          onUpdate={(id, data) => updateTool.mutate({ id, data })}
        />
      )}
    </div>
  );
}