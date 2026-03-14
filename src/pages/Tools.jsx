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
    name: "YouTube Scraper",
    description: "Paste a YouTube URL and get back the full transcript text for use in chats or tools.",
    icon_name: "Youtube",
    tool_type: "builtin",
    status: "active",
    code: `// YouTube Scraper – Deno function
// Input:  { url: "https://youtube.com/..." }
// Output: { title, transcript, videoId, language, lineCount }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\\.com\\/watch\\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\\.be\\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\\.com\\/embed\\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\\.com\\/shorts\\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchTranscript(videoId) {
  const pageUrl = \`https://www.youtube.com/watch?v=\${videoId}\`;
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();

  const titleMatch = html.match(/<title>(.*?)<\\/title>/);
  const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "Unknown";

  const captionMatch = html.match(/"captionTracks":\\s*(\\[.*?\\])/);
  if (!captionMatch) throw new Error("No captions found for this video.");

  const captionTracks = JSON.parse(captionMatch[1]);
  const track =
    captionTracks.find(t => t.languageCode === "en" && t.kind !== "asr") ||
    captionTracks.find(t => t.languageCode === "en") ||
    captionTracks.find(t => t.kind !== "asr") ||
    captionTracks[0];

  const captionUrl = track.baseUrl;
  const captionRes = await fetch(captionUrl);
  const captionXml = await captionRes.text();

  const lines = [];
  const regex = /<text start="([\\d.]+)" dur="([\\d.]+)"[^>]*>(.*?)<\\/text>/g;
  let m;
  while ((m = regex.exec(captionXml)) !== null) {
    const text = m[3]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) lines.push(text);
  }

  return {
    title,
    videoId,
    language: track.languageCode,
    transcript: lines.join(" "),
    lineCount: lines.length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url) {
      return Response.json({ error: "Missing YouTube URL" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return Response.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const result = await fetchTranscript(videoId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});`
  },
  {
    name: "KB Expander",
    description: "Takes a YouTube URL or raw text, expands an existing Knowledge Base with new documents, and re-indexes it.",
    icon_name: "BookOpen",
    tool_type: "builtin",
    status: "active",
    code: `// Knowledge Base Expander
// High-level flow:
// 1) Input: { kbId, youtubeUrl?: string, rawText?: string }
// 2) If youtubeUrl -> call YouTube Scraper to get transcript text
// 3) Upload transcript/rawText as a new KB file
// 4) Trigger KB indexing function so future queries can use it

async function kbExpander({ kbId, youtubeUrl, rawText }) {
  if (!kbId) throw new Error("kbId is required");

  let text = rawText || "";

  if (youtubeUrl) {
    const ytRes = await fetch("https://YOUR_APP_URL/functions/youtubeTranscript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl }),
    });
    const ytData = await ytRes.json();
    if (ytData.error) throw new Error(ytData.error);
    text = ytData.transcript;
  }

  if (!text) throw new Error("No text to add to Knowledge Base");

  // Example: upload text somewhere and attach to KB entity.
  // const fileUrl = await uploadToStorage("yt-" + Date.now() + ".txt", text);
  // await base44.entities.KnowledgeBase.update(kbId, {
  //   files: [...kb.files, { name: "YouTube transcript", url: fileUrl, type: "txt" }]
  // });

  await fetch("https://YOUR_APP_URL/functions/index-knowledge-base", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kbId }),
  });

  return { ok: true };
}`
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