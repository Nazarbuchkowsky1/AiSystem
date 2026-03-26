import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { DEFAULT_AGENT_SYSTEM_PROMPT, FINAL_ENFORCEMENT } from './defaultSystemPrompt.ts';

// ─── Kimi K2.5 via OpenRouter configuration ───────────────────────────────────
const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY");
const KIMI_MODEL = "moonshotai/kimi-k2.5";
const KIMI_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── Supadata API (transcript + metadata for YouTube, TikTok, Instagram, etc.) ──
const SUPADATA_API_KEY = "sd_8ca36aab85b68983db4fcddfc3298d5d";
const SUPADATA_BASE = "https://api.supadata.ai/v1";

function formatTreeForRouting(doc: any, fileName: string): string {
  if (!doc || !doc.root) return "";
  const lines: string[] = [];
  if (doc.doc_title || fileName) lines.push(`Document: ${doc.doc_title || fileName}`);
  if (doc.doc_description) lines.push(`Overview: ${doc.doc_description}`);

  const walk = (node: any, depth: number) => {
    const indent = "  ".repeat(depth);
    const title = node.title || "Untitled";
    const id = node.node_id || "?";
    const range = typeof node.start_index === "number" && typeof node.end_index === "number"
      ? ` [p${node.start_index}-p${node.end_index}]`
      : "";
    const summary = node.summary ? ` — ${node.summary}` : "";
    lines.push(`${indent}[${id}] ${title}${range}${summary}`);
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) walk(child, depth + 1);
    }
  };

  walk(doc.root, 0);
  return lines.join("\n");
}

function extractSectionText(doc: any, selectedNodeIds: string[]): string {
  if (!doc?.root || !doc?.paragraphs || !Array.isArray(doc.paragraphs)) return "";

  const paragraphs: string[] = doc.paragraphs;
  const collected: Set<number> = new Set();

  function findNodes(node: any) {
    if (selectedNodeIds.includes(node.node_id)) {
      const start = typeof node.start_index === "number" ? node.start_index : 0;
      const end = typeof node.end_index === "number" ? node.end_index : start;
      for (let i = start; i <= end && i < paragraphs.length; i++) {
        collected.add(i);
      }
    }
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) findNodes(child);
    }
  }

  findNodes(doc.root);
  // If router did not select any specific nodes, fall back to full document text.
  if (collected.size === 0) {
    return paragraphs.join("\n\n");
  }

  const sorted = Array.from(collected).sort((a, b) => a - b);
  return sorted.map(i => paragraphs[i]).join("\n\n");
}

// OpenRouter pricing for moonshotai/kimi-k2.5 (USD per 1M tokens).
const KIMI_INPUT_COST_PER_1M = 0.45;
const KIMI_OUTPUT_COST_PER_1M = 2.20;

// ─── Gemini (Google) configuration ───────────────────────────────────────────
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
// Gemini 3.1 Flash-Lite Preview: input $0.25/1M (text), output $1.50/1M — https://ai.google.dev/gemini-api/docs/pricing
const GEMINI_INPUT_COST_PER_1M = 0.25;
const GEMINI_OUTPUT_COST_PER_1M = 1.50;

// ─── Built‑in Tool: Media Scraper (via Supadata API) ────────────────────────

const MEDIA_URL_PATTERNS = [
  { platform: "youtube", regex: /(?:youtube\.com\/(?:watch|embed|shorts|live)|youtu\.be)\//i },
  { platform: "tiktok", regex: /tiktok\.com\//i },
  { platform: "instagram", regex: /instagram\.com\//i },
  { platform: "twitter", regex: /(?:twitter\.com|x\.com)\//i },
  { platform: "facebook", regex: /(?:facebook\.com|fb\.com|fb\.watch)\//i },
];

function extractAllMediaUrls(text: string): { url: string; platform: string }[] {
  if (!text) return [];
  const results: { url: string; platform: string }[] = [];
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const rawUrl = m[1].replace(/[.,;:!?)]+$/, "");
    for (const { platform, regex } of MEDIA_URL_PATTERNS) {
      if (regex.test(rawUrl)) {
        results.push({ url: rawUrl, platform });
        break;
      }
    }
  }
  return results;
}

async function fetchTranscriptViaSupadata(
  url: string,
  debug?: string[]
): Promise<{
  title: string;
  transcript: string;
  platform: string;
  language: string;
  lineCount: number;
} | null> {
  if (!SUPADATA_API_KEY) {
    debug?.push("[Supadata] FATAL: SUPADATA_API_KEY is not configured — cannot fetch transcripts");
    throw new Error("SUPADATA_API_KEY is not set. Configure it as an environment variable to enable media transcript fetching.");
  }

  const t0 = Date.now();
  debug?.push(`[Supadata] Start transcript fetch for: ${url}`);

  let title = "Video";
  try {
    const metaRes = await fetch(`${SUPADATA_BASE}/metadata?url=${encodeURIComponent(url)}`, {
      headers: { "x-api-key": SUPADATA_API_KEY },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      title = meta.title || meta.description?.slice(0, 100) || "Video";
      debug?.push(`[Supadata] Metadata OK: title="${title.slice(0, 60)}" platform=${meta.platform}`);
    } else {
      debug?.push(`[Supadata] Metadata failed: status=${metaRes.status}`);
    }
  } catch (e) {
    debug?.push(`[Supadata] Metadata error: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const tUrl = `${SUPADATA_BASE}/transcript?url=${encodeURIComponent(url)}&text=true&mode=auto`;
    debug?.push(`[Supadata] Transcript call: ${tUrl}`);
    const res = await fetch(tUrl, {
      headers: { "x-api-key": SUPADATA_API_KEY },
    });

    if (res.status === 202) {
      const { jobId } = await res.json();
      debug?.push(`[Supadata] Async job started: ${jobId}`);
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const pollRes = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, {
          headers: { "x-api-key": SUPADATA_API_KEY },
        });
        if (!pollRes.ok) {
          debug?.push(`[Supadata] Poll HTTP error: ${pollRes.status}`);
          throw new Error(`Supadata poll HTTP error: ${pollRes.status}`);
        }
        const job = await pollRes.json();
        debug?.push(`[Supadata] Poll status=${job.status} elapsed=${Date.now() - t0}ms`);

        if (job.status === "completed") {
          const text = typeof job.content === "string" ? job.content : "";
          if (!text.trim()) throw new Error("Supadata job completed but transcript is empty");
          debug?.push(`[Supadata] Transcript OK (async): ${text.length} chars, ${Date.now() - t0}ms`);
          return { title, transcript: text, platform: "video", language: job.lang || "auto", lineCount: text.split(/\s+/).length };
        }
        if (job.status === "failed") {
          const errDetail = job.error?.message || job.error?.details || "unknown";
          throw new Error(`Supadata transcript job failed: ${errDetail}`);
        }
      }
      throw new Error(`Supadata transcript job timed out after ${Date.now() - t0}ms`);
    }

    if (!res.ok) {
      const body = await res.text();
      debug?.push(`[Supadata] Transcript error: status=${res.status} body=${body.slice(0, 200)}`);
      throw new Error(`Supadata transcript error: ${res.status}`);
    }

    const data = await res.json();
    const text = typeof data.content === "string" ? data.content : "";
    if (text.length > 0) {
      debug?.push(`[Supadata] Transcript OK (sync): ${text.length} chars, ${Date.now() - t0}ms`);
      return { title, transcript: text, platform: "video", language: data.lang || "auto", lineCount: text.split(/\s+/).length };
    }
    debug?.push(`[Supadata] Transcript empty`);
    throw new Error("Supadata returned empty transcript");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    debug?.push(`[Supadata] Error: ${msg}`);
    throw new Error(msg);
  }
}

// Build a very simple page index structure from inline transcript text so that
// YouTube transcripts are immediately searchable even before/without the
// heavier index-knowledge-base function.
function buildInlineTranscriptIndex(text: string, fileName: string): any {
  const cleaned = (text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return {
      doc_title: fileName,
      doc_description: "Empty transcript",
      root: {
        title: fileName,
        node_id: "0000",
        start_index: 0,
        end_index: 0,
        summary: "Empty transcript",
        nodes: [],
      },
      paragraphs: [""],
    };
  }

  // Split on double newlines first; if paragraphs are still huge, chunk them.
  const roughParts = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const paragraphs: string[] = [];
  const MAX_PARA = 600;
  for (const part of roughParts) {
    if (part.length <= MAX_PARA) {
      const p = part.trim();
      if (p) paragraphs.push(p);
    } else {
      let start = 0;
      while (start < part.length) {
        let slice = part.slice(start, start + MAX_PARA);
        // Try to snap to the end of a sentence
        const lastSentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
        if (lastSentenceEnd > MAX_PARA / 2 && start + lastSentenceEnd < part.length) {
          slice = part.slice(start, start + lastSentenceEnd + 1);
        }
        const p = slice.trim();
        if (p) paragraphs.push(p);
        start += slice.length;
      }
    }
  }

  // Group paragraphs into sections (e.g., 5 paragraphs per section) for the routing index
  const nodes: any[] = [];
  const PARA_PER_NODE = 5;
  for (let i = 0; i < paragraphs.length; i += PARA_PER_NODE) {
    const end = Math.min(i + PARA_PER_NODE - 1, paragraphs.length - 1);
    const slice = paragraphs.slice(i, end + 1);
    
    // Create a very simple summary from the first 160 characters of the first paragraph
    const sectionText = slice.join(" ");
    let summary = sectionText.substring(0, 160);
    if (sectionText.length > 160) summary += "...";

    nodes.push({
      title: `Section ${Math.floor(i / PARA_PER_NODE) + 1}`,
      node_id: (Math.floor(i / PARA_PER_NODE) + 1).toString().padStart(4, "0"),
      start_index: i,
      end_index: end,
      summary: summary,
      nodes: [],
    });
  }

  const rootNode = {
    title: fileName || "Transcript",
    node_id: "0000",
    start_index: 0,
    end_index: Math.max(paragraphs.length - 1, 0),
    summary: `YouTube transcript (${paragraphs.length} paragraphs in ${nodes.length} sections)`,
    nodes: nodes,
  };

  return {
    doc_title: fileName || "YouTube Video",
    doc_description: `Transcript (${paragraphs.length} chunks)`,
    root: rootNode,
    paragraphs,
  };
}

function getLastHumanMessageText(messages: any[]): string {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  const lastNonAssistant =
    [...messages].reverse().find((m: any) => m && m.role && m.role !== "assistant") ||
    null;
  if (lastNonAssistant && typeof lastNonAssistant.content === "string") {
    return lastNonAssistant.content;
  }
  const lastUserLike = [...messages]
    .reverse()
    .find(
      (m: any) =>
        m &&
        typeof m.role === "string" &&
        ["user", "human", "user_message"].includes(m.role.toLowerCase()),
    );
  return typeof lastUserLike?.content === "string" ? lastUserLike.content : "";
}

async function callKimi(
  systemText: string,
  contents: any[],
  opts: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<{ text: string; usage?: { promptTokens: number; outputTokens: number } }> {
  if (!KIMI_API_KEY) {
    console.error("Missing Kimi API key (KIMI_API_KEY / kimi-k2.5 secret)");
    throw new Error("Kimi API key is not configured");
  }

  // Convert previous Gemini "contents" format into OpenAI-style messages that
  // Kimi's chat-completions endpoint accepts.
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemText },
    ...contents.map((c: any) => ({
      role: c.role === "model" ? "assistant" : "user",
      content: c?.parts?.[0]?.text ?? "",
    })),
  ];

  const body: any = {
    model: KIMI_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxOutputTokens ?? 4096,
  };

  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s safety timeout

  const resp = await fetch(KIMI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Kimi API error:", errText);
    throw new Error(`Kimi API error: ${resp.status}`);
  }

  const data = await resp.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    (typeof data === "string" ? data : "");

  const um = data?.usage;
  let promptTokens = 0;
  let outputTokens = 0;
  if (um && typeof um === "object") {
    promptTokens =
      um.prompt_tokens ??
      um.promptTokenCount ??
      um.prompt_token_count ??
      um.inputTokenCount ??
      0;
    outputTokens =
      um.completion_tokens ??
      um.candidatesTokenCount ??
      um.candidates_token_count ??
      um.outputTokenCount ??
      um.output_token_count ??
      0;
  }
  if (promptTokens === 0 && outputTokens === 0 && text.length > 0) {
    outputTokens = Math.max(50, Math.ceil(text.length / 4));
    promptTokens = 100;
  }
  const usage = promptTokens > 0 || outputTokens > 0 ? { promptTokens, outputTokens } : undefined;
  return { text, usage };
}

async function callGemini(
  systemText: string,
  contents: any[],
  opts: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<{ text: string; usage?: { promptTokens: number; outputTokens: number } }> {
  if (!GEMINI_API_KEY) {
    console.error("Missing Gemini API key (GEMINI_API_KEY)");
    throw new Error("Gemini API key is not configured");
  }
  const body: any = {
    system_instruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  };
  if (opts.jsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }
  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Gemini API error:", errText);
    throw new Error(`Gemini API error: ${resp.status}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const um = data?.usageMetadata ?? data?.usage_metadata;
  let promptTokens = 0;
  let outputTokens = 0;
  if (um && typeof um === "object") {
    promptTokens = um.promptTokenCount ?? um.prompt_token_count ?? 0;
    outputTokens = um.candidatesTokenCount ?? um.candidates_token_count ?? 0;
  }
  if (promptTokens === 0 && outputTokens === 0 && text.length > 0) {
    outputTokens = Math.max(50, Math.ceil(text.length / 4));
    promptTokens = 100;
  }
  const usage = promptTokens > 0 || outputTokens > 0 ? { promptTokens, outputTokens } : undefined;
  return { text, usage };
}

function hasStructure(text: string): boolean {
  if (!text || text.length < 80) return true;
  const hasHeading = /^#{2,3}\s/m.test(text) || text.includes("\n## ") || text.includes("\n### ");
  const hasList = /^\s*[-*]\s/m.test(text) || /^\s*\d+[.)]\s/m.test(text);
  return !!(hasHeading || hasList);
}

// ─── History Management ───────────────────────────────────────────────────────
const HISTORY_MAX_MESSAGES = 20;
const HISTORY_KEEP_RECENT = 6;

async function summarizeHistory(
  msgs: any[],
  callLLMFn: typeof callKimi
): Promise<any[]> {
  if (msgs.length <= HISTORY_MAX_MESSAGES) return msgs;

  const toSummarize = msgs.slice(0, msgs.length - HISTORY_KEEP_RECENT);
  const toKeep = msgs.slice(msgs.length - HISTORY_KEEP_RECENT);

  const conversationText = toSummarize
    .map((m: any) => `${m.role === "assistant" ? "Assistant" : "User"}: ${(m.content || "").substring(0, 500)}`)
    .join("\n\n");

  try {
    const { text } = await callLLMFn(
      "You are a conversation summarizer. Summarize the following conversation concisely, preserving key facts, decisions, and context needed to continue naturally. Output ONLY the summary.",
      [{ role: "user", parts: [{ text: conversationText }] }],
      { temperature: 0.2, maxOutputTokens: 1024 }
    );
    return [
      { role: "user", content: `[Previous conversation summary]\n${text}` },
      { role: "assistant", content: "I have the context from our earlier conversation. Let's continue." },
      ...toKeep,
    ];
  } catch {
    return msgs.slice(-HISTORY_MAX_MESSAGES);
  }
}

// ─── Query Decomposition ──────────────────────────────────────────────────────

async function decomposeQuery(
  query: string,
  recentContext: string,
  callLLMFn: typeof callKimi
): Promise<string[]> {
  if (query.length < 15) return [query];

  try {
    const { text } = await callLLMFn(
      `You are a query decomposition engine. Break the user's question into 3-7 intermediate sub-questions that explore different angles of the topic.

Sub-questions should:
- Cover different aspects of the original question
- Include related concepts not explicitly mentioned
- Use varied terminology to catch information described differently
- Be in the same language as the original query

Output ONLY a JSON array of strings. No explanation.`,
      [{ role: "user", parts: [{ text: `Context:\n${recentContext}\n\nQuestion: ${query}` }] }],
      { temperature: 0.3, maxOutputTokens: 1024, jsonMode: true }
    );

    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m?.[1]) cleaned = m[1].trim();
    }
    const parsed = JSON.parse(cleaned);
    const result = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    const valid = result.filter((q: unknown) => typeof q === "string" && (q as string).length > 5);
    return valid.length > 0 ? valid.slice(0, 8) : [query];
  } catch {
    return [query];
  }
}

// ─── Section-Level Retrieval ──────────────────────────────────────────────────

async function retrieveRelevantSections(
  subQuestions: string[],
  idxFiles: { name: string; tree: string; doc: any }[],
  callLLMFn: typeof callKimi
): Promise<{ fileIndex: number; nodeIds: string[]; score: number }[]> {
  const treeSummaries = idxFiles.map((f, i) =>
    `═══ File [${i}]: ${f.doc?.doc_title || f.name} ═══\n${f.tree}`
  ).join("\n\n");

  const questionsText = subQuestions.map((q, i) => `Q${i + 1}: ${q}`).join("\n");

  try {
    const { text } = await callLLMFn(
      `You are a document section retrieval engine. Given sub-questions and a hierarchical index of documents, select the most relevant SECTIONS (by node_id) that might contain answers.

Output JSON:
{
  "selections": [
    { "file_index": 0, "node_ids": ["0001", "0003"], "relevance": "high" },
    { "file_index": 2, "node_ids": ["0000", "0005"], "relevance": "medium" }
  ]
}

Rules:
- Be GENEROUS: select more sections rather than fewer.
- Match by MEANING across languages.
- For broad questions, select more sections.
- Include parent sections when multiple children are relevant.
- Output ONLY valid JSON.`,
      [{ role: "user", parts: [{ text: `Sub-questions:\n${questionsText}\n\nDocument index:\n${treeSummaries}` }] }],
      { temperature: 0.1, maxOutputTokens: 4096, jsonMode: true }
    );

    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m?.[1]) cleaned = m[1].trim();
    }
    const parsed = JSON.parse(cleaned);
    const selections = parsed.selections || parsed;
    if (!Array.isArray(selections)) return [];

    return selections
      .filter((s: any) => typeof s.file_index === "number" && Array.isArray(s.node_ids))
      .map((s: any) => ({
        fileIndex: s.file_index,
        nodeIds: s.node_ids.filter((id: any) => typeof id === "string"),
        score: s.relevance === "high" ? 3 : s.relevance === "medium" ? 2 : 1,
      }));
  } catch {
    return idxFiles.map((_, i) => ({ fileIndex: i, nodeIds: ["root"], score: 1 }));
  }
}

// ─── Evidence Reranking ───────────────────────────────────────────────────────

async function rerankEvidence(
  candidates: { fileIndex: number; fileName: string; text: string }[],
  originalQuery: string,
  callLLMFn: typeof callKimi
): Promise<number[]> {
  if (candidates.length <= 5) return candidates.map((_, i) => i);

  const list = candidates.map((c, i) =>
    `[${i}] ${c.fileName}\n${c.text.substring(0, 600)}${c.text.length > 600 ? "..." : ""}`
  ).join("\n\n");

  try {
    const { text } = await callLLMFn(
      "You are a relevance reranker. Rank the candidate passages by relevance to the question. Output ONLY a JSON array of indices, most relevant first. Include ALL indices.",
      [{ role: "user", parts: [{ text: `Question: ${originalQuery}\n\nCandidates:\n${list}` }] }],
      { temperature: 0.1, maxOutputTokens: 1024, jsonMode: true }
    );

    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m?.[1]) cleaned = m[1].trim();
    }
    const parsed = JSON.parse(cleaned);
    const indices = Array.isArray(parsed) ? parsed : (parsed.ranking || parsed.indices || []);
    const valid = indices.filter((i: any) => typeof i === "number" && i >= 0 && i < candidates.length);
    return valid.length > 0 ? valid : candidates.map((_, i) => i);
  } catch {
    return candidates.map((_, i) => i);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages, agent, mode, fileSources = [], isVoiceMessage = false } = body;
    const debugLog: string[] = [];
    const processLog: Record<string, unknown>[] = [];

    const pushProcess = (step: string, data: Record<string, unknown>) => {
      const entry = { step, _t: Date.now(), ...data };
      processLog.push(entry);
    };

    const requestedModel = agent?.model != null ? String(agent.model).toLowerCase() : "kimi";
    const effectiveModel: "kimi" | "gemini" =
      requestedModel === "gemini" ? "gemini" : "kimi";
    const callLLM =
      effectiveModel === "gemini" ? callGemini : callKimi;

    pushProcess("chat_start", {
      agentId: agent?.id,
      agentName: agent?.name,
      model: agent?.model ?? "kimi",
      effectiveModel,
      messagesCount: Array.isArray(messages) ? messages.length : 0,
      hasFileSources: Array.isArray(fileSources) && fileSources.length > 0,
    });

    const systemParts: string[] = [];
    const agentName = agent.name || "AI Assistant";
    const agentDesc = agent.description || "";
    systemParts.push(`You are "${agentName}". ${agentDesc}`);

    systemParts.push(`\n${DEFAULT_AGENT_SYSTEM_PROMPT}`);

    // ─── Collect KB files in one pass ─────────────────────────────────
    type IndexedFile = { name: string; tree: string; doc: any };
    const indexedFiles: IndexedFile[] = [];
    const unindexedFiles: { name: string; url: string }[] = [];

    pushProcess("kb_fetch_start", {
      kbIds: agent?.knowledge_base_ids ?? [],
      kbCount: (agent.knowledge_base_ids || []).length,
    });

    if (agent.knowledge_base_ids && agent.knowledge_base_ids.length > 0) {
      try {
        for (const kbId of agent.knowledge_base_ids) {
          const kbList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
          if (!kbList?.length) {
            pushProcess("kb_not_found", { kbId });
            continue;
          }
          const kb = kbList[0];
          pushProcess("kb_found", {
            kbId,
            kbName: kb.name,
            fileCount: kb.files?.length ?? 0,
            processing: kb.processing,
            indexStatus: kb.index_status,
          });
          if (!kb.files?.length) continue;

          const MEDIA_TYPES = ["youtube", "tiktok", "instagram", "twitter", "facebook", "media", "web"];
          const TEXT_TYPES = [
            "txt","md","csv","json","pdf",
            "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
            "java","php","swift","kt","html","css","scss",
            "yaml","yml","xml","sh","bash","sql","toml","ini","env",
            "xmind","docx","xlsx","xls","pptx","ppt",
          ];

          for (const file of kb.files) {
            const hasTree = !!(file.index_tree?.root && Array.isArray(file.index_tree?.paragraphs) && file.index_tree.paragraphs.length > 0);
            const paragraphCount = hasTree ? file.index_tree.paragraphs.length : 0;
            const charCount = hasTree ? file.index_tree.paragraphs.join("").length : 0;

            if (hasTree) {
              const treeText = formatTreeForRouting(file.index_tree, file.name);
              if (treeText) {
                indexedFiles.push({ name: file.name, tree: treeText, doc: file.index_tree });
                pushProcess("file_indexed_ok", { fileName: file.name, type: file.type, paragraphs: paragraphCount, chars: charCount, docDescription: file.index_tree.doc_description || "" });
              }
            } else if (MEDIA_TYPES.includes(file.type) && file.inline_text && file.inline_text.trim().length > 0) {
              const inlineDoc = buildInlineTranscriptIndex(file.inline_text, file.name);
              const treeText = formatTreeForRouting(inlineDoc, file.name);
              if (treeText) {
                indexedFiles.push({ name: file.name, tree: treeText, doc: inlineDoc });
                pushProcess("file_media_inline_rebuilt", { fileName: file.name, chars: file.inline_text.length, paragraphs: inlineDoc.paragraphs?.length });
              }
            } else if (MEDIA_TYPES.includes(file.type) && file.url && !file.processed) {
              pushProcess("file_media_unindexed", { fileName: file.name, type: file.type, url: file.url, reason: "media_not_indexed_yet_will_fetch_live" });
              try {
                const liveResult = await fetchTranscriptViaSupadata(file.url, debugLog);
                if (liveResult && liveResult.transcript.length > 0) {
                  const inlineDoc = buildInlineTranscriptIndex(liveResult.transcript, liveResult.title || file.name);
                  const treeText = formatTreeForRouting(inlineDoc, liveResult.title || file.name);
                  if (treeText) {
                    indexedFiles.push({ name: liveResult.title || file.name, tree: treeText, doc: inlineDoc });
                    pushProcess("file_media_live_indexed", { fileName: liveResult.title, chars: liveResult.transcript.length, paragraphs: inlineDoc.paragraphs?.length });
                  }
                  try {
                    const updatedFile = {
                      ...file,
                      name: liveResult.title || file.name,
                      processed: true,
                      inline_text: liveResult.transcript,
                      index_tree: inlineDoc,
                      doc_description: inlineDoc.doc_description || "",
                    };
                    const updatedFiles = kb.files.map((f: any) => f.url === file.url ? updatedFile : f);
                    await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, { files: updatedFiles, processing: false, index_status: "succeeded" });
                    pushProcess("file_media_persisted", { fileName: liveResult.title, kbId: kb.id });
                  } catch (persistErr) {
                    pushProcess("file_media_persist_error", { error: persistErr instanceof Error ? persistErr.message : String(persistErr) });
                  }
                } else {
                  pushProcess("file_media_live_empty", { fileName: file.name, url: file.url });
                }
              } catch (liveErr) {
                pushProcess("file_media_live_error", { fileName: file.name, error: liveErr instanceof Error ? liveErr.message : String(liveErr) });
              }
            } else if (file.url && TEXT_TYPES.includes(file.type)) {
              unindexedFiles.push({ name: file.name, url: file.url });
              pushProcess("file_unindexed", { fileName: file.name, type: file.type, processed: file.processed });
            } else {
              pushProcess("file_skipped", { fileName: file.name, type: file.type, reason: "no_tree_and_not_text_type" });
            }
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("KB fetch error:", errMsg);
        pushProcess("kb_fetch_error", { error: errMsg });
      }
    }

    pushProcess("kb_loaded", {
      kbIds: agent?.knowledge_base_ids ?? [],
      indexedFilesCount: indexedFiles.length,
      unindexedFilesCount: unindexedFiles.length,
      indexedFileNames: indexedFiles.map((f: IndexedFile) => f.name),
      totalIndexedCharsPreview: indexedFiles.reduce((sum, f) => sum + ((f.doc?.paragraphs || []).join("").length), 0),
    });

    // ─── Phase 0: Conversation History Management ────────────────────────
    let chatMessages = [...messages];
    if (Array.isArray(messages) && messages.length > HISTORY_MAX_MESSAGES) {
      pushProcess("history_summarize_start", { messageCount: messages.length });
      chatMessages = await summarizeHistory(messages, callLLM);
      pushProcess("history_summarize_done", { originalCount: messages.length, newCount: chatMessages.length });
    }

    // ─── Phase 1: Query Decomposition ─────────────────────────────────────
    const lastUserMessage = getLastHumanMessageText(messages);
    let subQuestions: string[] = [lastUserMessage];

    if (lastUserMessage.length > 15 && (indexedFiles.length > 0 || unindexedFiles.length > 0)) {
      const recentContext = messages.slice(-4)
        .map((m: any) => `${m.role}: ${(m.content || "").substring(0, 300)}`)
        .join("\n");
      pushProcess("query_decomposition_start", { query: lastUserMessage.substring(0, 200) });
      subQuestions = await decomposeQuery(lastUserMessage, recentContext, callLLM);
      pushProcess("query_decomposition_done", { subQuestions, count: subQuestions.length });
    }

    // ─── Phase 2: Retrieval + Ranking ─────────────────────────────────────
    let retrievedContext = "";
    const sourcesMap: { index: number; name: string; description: string }[] = [];

    let totalIndexedChars = 0;
    for (const f of indexedFiles) {
      if (f.doc?.paragraphs && Array.isArray(f.doc.paragraphs)) {
        for (const p of f.doc.paragraphs) totalIndexedChars += (p || "").length;
      }
    }

    const FULL_CONTEXT_CHAR_LIMIT = effectiveModel === "gemini" ? 3000000 : 400000;
    const useFullContext = totalIndexedChars < FULL_CONTEXT_CHAR_LIMIT;

    pushProcess("retrieval_strategy", {
      totalIndexedChars,
      indexedFilesCount: indexedFiles.length,
      unindexedFilesCount: unindexedFiles.length,
      strategy: useFullContext ? "full_context_injection" : "section_level_retrieval",
      charLimit: FULL_CONTEXT_CHAR_LIMIT,
      subQuestionCount: subQuestions.length,
    });

    if (useFullContext && (indexedFiles.length > 0 || unindexedFiles.length > 0)) {
      // ═══ FULL CONTEXT INJECTION (with numbered sources for citations) ════
      const docParts: string[] = [];
      let sourceIdx = 1;

      for (const f of indexedFiles) {
        const paragraphs: string[] = f.doc?.paragraphs || [];
        const docTitle = f.doc?.doc_title || f.name;
        const docDesc = f.doc?.doc_description || "";
        const allText = paragraphs.join("\n\n");
        if (allText.trim()) {
          sourcesMap.push({ index: sourceIdx, name: docTitle, description: docDesc });
          docParts.push(
            `━━━ Source [${sourceIdx}]: ${docTitle} ━━━` +
            (docDesc ? `\n[${docDesc}]` : "") +
            `\n\n${allText}`
          );
          sourceIdx++;
        }
      }

      for (const file of unindexedFiles) {
        try {
          const resp = await fetch(file.url);
          if (resp.ok) {
            const text = await resp.text();
            if (text.trim()) {
              const limit = FULL_CONTEXT_CHAR_LIMIT - totalIndexedChars > 60000 ? 60000 : 30000;
              const content = text.length > limit
                ? text.substring(0, limit) + "\n[...document truncated]"
                : text;
              sourcesMap.push({ index: sourceIdx, name: file.name, description: "" });
              docParts.push(`━━━ Source [${sourceIdx}]: ${file.name} ━━━\n\n${content}`);
              sourceIdx++;
            }
          }
        } catch { /* skip */ }
      }

      if (docParts.length > 0) {
        retrievedContext = docParts.join("\n\n\n");
      }

      pushProcess("full_context_injected", {
        documentsIncluded: docParts.length,
        totalChars: retrievedContext.length,
        sourcesCount: sourcesMap.length,
      });

    } else if (indexedFiles.length > 0 || unindexedFiles.length > 0) {
      // ═══ SECTION-LEVEL RETRIEVAL (for large knowledge bases) ═════════════
      // Multi-step: decompose → route to sections via tree → extract → rerank → pack
      pushProcess("section_retrieval_start", {
        indexedFiles: indexedFiles.length,
        subQuestions: subQuestions.length,
      });

      // Phase 2a: Route sub-questions to relevant sections via hierarchical tree index
      const routingResult = await retrieveRelevantSections(subQuestions, indexedFiles, callLLM);

      pushProcess("section_routing_done", {
        selectionsCount: routingResult.length,
        selections: routingResult.map(s => ({
          fileIndex: s.fileIndex,
          fileName: s.fileIndex < indexedFiles.length ? indexedFiles[s.fileIndex].name : "?",
          nodeCount: s.nodeIds.length,
          score: s.score,
        })),
      });

      // Phase 2b: Extract section text from matched files
      const candidates: { fileIndex: number; fileName: string; text: string; nodeIds: string[] }[] = [];
      for (const sel of routingResult) {
        if (sel.fileIndex < 0 || sel.fileIndex >= indexedFiles.length) continue;
        const f = indexedFiles[sel.fileIndex];
        const sectionText = extractSectionText(f.doc, sel.nodeIds);
        if (sectionText.trim()) {
          candidates.push({
            fileIndex: sel.fileIndex,
            fileName: f.doc?.doc_title || f.name,
            text: sectionText,
            nodeIds: sel.nodeIds,
          });
        }
      }

      pushProcess("sections_extracted", {
        candidateCount: candidates.length,
        totalChars: candidates.reduce((sum, c) => sum + c.text.length, 0),
      });

      // Phase 2c: Rerank candidates if there are many
      let rankedIndices = candidates.map((_, i) => i);
      if (candidates.length > 8) {
        pushProcess("rerank_start", { candidateCount: candidates.length });
        rankedIndices = await rerankEvidence(candidates, lastUserMessage, callLLM);
        pushProcess("rerank_done", { rankedOrder: rankedIndices.slice(0, 10) });
      }

      // Phase 2d: Pack evidence into context budget with source numbering
      const docParts: string[] = [];
      let currentChars = 0;
      let sourceIdx = 1;
      const seenFiles = new Map<number, number>();

      for (const ri of rankedIndices) {
        const c = candidates[ri];
        if (!c) continue;
        if (currentChars + c.text.length > FULL_CONTEXT_CHAR_LIMIT && docParts.length > 0) {
          const remaining = FULL_CONTEXT_CHAR_LIMIT - currentChars;
          if (remaining > 2000) {
            const sIdx = seenFiles.get(c.fileIndex) ?? sourceIdx;
            if (!seenFiles.has(c.fileIndex)) {
              sourcesMap.push({ index: sIdx, name: c.fileName, description: "(truncated)" });
              seenFiles.set(c.fileIndex, sIdx);
              sourceIdx++;
            }
            docParts.push(
              `━━━ Source [${sIdx}]: ${c.fileName} (truncated) ━━━\n\n${c.text.substring(0, remaining)}\n[...truncated]`
            );
          }
          break;
        }

        if (!seenFiles.has(c.fileIndex)) {
          const f = indexedFiles[c.fileIndex];
          const docDesc = f.doc?.doc_description || "";
          sourcesMap.push({ index: sourceIdx, name: c.fileName, description: docDesc });
          seenFiles.set(c.fileIndex, sourceIdx);
          docParts.push(
            `━━━ Source [${sourceIdx}]: ${c.fileName} ━━━` +
            (docDesc ? `\n[${docDesc}]` : "") +
            `\n\n${c.text}`
          );
          sourceIdx++;
        } else {
          const existingIdx = seenFiles.get(c.fileIndex)!;
          docParts.push(`\n[Additional section from Source [${existingIdx}]]\n${c.text}`);
        }
        currentChars += c.text.length;
      }

      for (const file of unindexedFiles) {
        if (currentChars >= FULL_CONTEXT_CHAR_LIMIT) break;
        try {
          const resp = await fetch(file.url);
          if (resp.ok) {
            const text = await resp.text();
            const remaining = FULL_CONTEXT_CHAR_LIMIT - currentChars;
            const limit = Math.min(remaining, 30000);
            if (limit > 500) {
              const content = text.substring(0, limit);
              sourcesMap.push({ index: sourceIdx, name: file.name, description: "" });
              docParts.push(`━━━ Source [${sourceIdx}]: ${file.name} ━━━\n${content}${text.length > limit ? "\n[...truncated]" : ""}`);
              currentChars += content.length;
              sourceIdx++;
            }
          }
        } catch { /* skip */ }
      }

      if (docParts.length > 0) {
        retrievedContext = docParts.join("\n\n\n");
      }

      pushProcess("evidence_packed", {
        documentsIncluded: docParts.length,
        totalChars: retrievedContext.length,
        sourcesCount: sourcesMap.length,
      });
    }

    // ─── Source Context Injection into System Prompt ──────────────────────
    if (retrievedContext) {
      const sourcesList = sourcesMap.map(s =>
        `[${s.index}] ${s.name}${s.description ? ` — ${s.description}` : ""}`
      ).join("\n");

      systemParts.push(`\n## Source Documents
Below is content from the user's knowledge base. Each source is numbered for citation.

Available sources:
${sourcesList}

YOUR INSTRUCTIONS FOR USING THESE SOURCES:
1. Read and analyze ALL provided source content thoroughly before answering.
2. Sources may be in a DIFFERENT language than the question — match by MEANING, not keywords.
3. Search the ENTIRE content deeply — important information may be anywhere.
4. CITE your sources: after each key claim, add the source number in brackets like [1], [2], or [1][3] for multiple.
5. If sources don't contain the answer, explicitly say: "This information is not found in the provided sources."
6. NEVER fabricate information. If partially covered, say what you found and what's missing.

${retrievedContext}`);

      if (subQuestions.length > 1) {
        systemParts.push(`\n## Investigation Guide\nTo fully answer the user's question, consider exploring these aspects:\n${subQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
      }
    }

    const BUILTIN_TOOL_NAMES = ["media_scraper"];
    const userTools = (agent.tools || []).filter((t: any) => t.enabled);
    const enabledToolNames = new Set(userTools.map((t: any) => t.name));
    for (const bt of BUILTIN_TOOL_NAMES) enabledToolNames.add(bt);
    if (enabledToolNames.has("youtube_scraper")) {
      enabledToolNames.delete("youtube_scraper");
      enabledToolNames.add("media_scraper");
    }
    const enabledTools = [...enabledToolNames].map(name => ({ name, enabled: true }));
    let toolContext = "";

    pushProcess("tools_resolved", {
      userDefinedTools: userTools.map((t: any) => t.name),
      builtinTools: BUILTIN_TOOL_NAMES,
      finalEnabledTools: enabledTools.map((t: any) => t.name),
    });
    if (enabledTools.length > 0) {
      const toolDescriptions: Record<string, string> = {
        script_runner: "Execute custom scripts and automations.",
        web_scraper: "Extract data from websites and APIs.",
        data_processor: "Transform and analyze datasets.",
        code_generator: "Generate code snippets and templates.",
        local_ai_bridge: "Connect to local AI models and services.",
        system_utility: "System maintenance and monitoring tools.",
        media_scraper: "media_scraper(url) — extracts video transcript and metadata from YouTube, TikTok, Instagram, Twitter/X, and Facebook URLs.",
      };

      const toolsText = enabledTools
        .map((t: any) => {
          const desc = toolDescriptions[t.name] || `Tool: ${t.name}`;
          return `- **${t.name}**: ${desc}`;
        })
        .join("\n");

      systemParts.push(`\n## Your Tools\n${toolsText}`);

      const hasMediaTool = enabledTools.some((t: any) => t.name === "media_scraper");
      const lastUserMessage = getLastHumanMessageText(messages);
      if (hasMediaTool) {
        const messageUrls = extractAllMediaUrls(lastUserMessage || "");

        const fileSourceUrls: { url: string; platform: string }[] = [];
        for (const fs of (fileSources || [])) {
          const candidates = [fs?.url, fs?.sourceUrl, fs?.originalUrl, fs?.metadata?.url].filter(Boolean);
          for (const candidate of candidates) {
            for (const { platform, regex } of MEDIA_URL_PATTERNS) {
              if (regex.test(candidate)) {
                fileSourceUrls.push({ url: candidate, platform });
                break;
              }
            }
          }
        }

        const seen = new Set<string>();
        const mediaUrls: { url: string; platform: string }[] = [];
        for (const u of [...messageUrls, ...fileSourceUrls]) {
          if (!seen.has(u.url)) {
            seen.add(u.url);
            mediaUrls.push(u);
          }
        }

        pushProcess("media_scraper_check", {
          hasMediaTool: true,
          urlsFromMessage: messageUrls.length,
          urlsFromFileSources: fileSourceUrls.length,
          totalUniqueUrls: mediaUrls.length,
          urls: mediaUrls.map(u => u.url),
        });
        if (mediaUrls.length > 0) {
          const limited = mediaUrls.slice(0, 3);
          for (const mu of limited) {
            const scrapeStart = Date.now();
            try {
              const result = await fetchTranscriptViaSupadata(mu.url, debugLog);
              if (!result) throw new Error("Supadata returned no transcript");

              const inlineDoc = buildInlineTranscriptIndex(result.transcript, result.title);
              const treeText = formatTreeForRouting(inlineDoc, result.title);
              if (treeText) {
                indexedFiles.push({ name: result.title, tree: treeText, doc: inlineDoc });
              }

              const transcriptSnippet =
                result.transcript.length > 4000
                  ? result.transcript.slice(0, 4000) + "\n[transcript truncated]"
                  : result.transcript;
              toolContext += `\n\n### Media Scraper result\nURL: ${mu.url}\nPlatform: ${mu.platform}\nTitle: ${result.title}\nLanguage: ${result.language}\nWords: ${result.lineCount}\n\nTranscript:\n${transcriptSnippet}`;
              pushProcess("media_scraper_result", {
                url: mu.url,
                platform: mu.platform,
                title: result.title,
                language: result.language,
                transcriptChars: result.transcript.length,
                lineCount: result.lineCount,
                durationMs: Date.now() - scrapeStart,
              });
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              console.error("Media scraper error:", errMsg);
              toolContext += `\n\n### Media Scraper error\nTried to fetch transcript for ${mu.url} (${mu.platform}) but got an error: ${errMsg}.\nYou should explain this limitation to the user.`;
              pushProcess("media_scraper_error", {
                url: mu.url,
                platform: mu.platform,
                error: errMsg,
                durationMs: Date.now() - scrapeStart,
              });
            }
          }
        }
      }

    }

    if (toolContext) {
      systemParts.push(`\n## Tool Outputs\nThe following tool calls were executed **before** answering. Use these results as authoritative context.\n${toolContext}`);
    }

    if (retrievedContext) {
      systemParts.push(`\n## Web / General Knowledge\nYou may use the internet ONLY if the source documents above do not contain the answer. Source documents always take priority over web results.`);
    }

    if (mode === "thinking") {
      systemParts.push("\n## Response Mode: Deep thinking\nBefore answering, reason through the problem internally: consider multiple angles, check your logic, look for edge cases. Then give the RESULT of that thinking, not the thinking itself. The output should still be concise, structured, and human. Deeper reasoning does not mean longer text. It means a better answer.");
    } else {
      systemParts.push("\n## Response Mode: Instant\nAnswer directly. Minimum viable response. No preamble.");
    }

    if (agent.system_instructions) {
      systemParts.push(`\n## Creator instructions\nThe agent's creator set these instructions. Follow them for topic, language, persona, and domain behavior. However, the 5 Absolute Rules (no AI openers, no AI closers, no filler, brevity, no AI vocabulary) always apply regardless.\n\n${agent.system_instructions}`);
    }

    systemParts.push(`\n${FINAL_ENFORCEMENT}`);

    const systemInstruction = systemParts.join("\n");

    pushProcess("system_prompt_built", {
      totalChars: systemInstruction.length,
      sections: systemParts.length,
      hasSourceDocuments: !!retrievedContext,
      sourceDocumentChars: retrievedContext.length,
      hasToolOutputs: !!toolContext,
      hasUserInstructions: !!agent.system_instructions,
      mode,
    });

    const geminiContents = chatMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    pushProcess("llm_call_start", {
      model: effectiveModel,
      temperature: mode === "thinking" ? 0.7 : 0.9,
      maxOutputTokens: mode === "thinking" ? 8192 : 2048,
      conversationMessages: geminiContents.length,
      systemPromptChars: systemInstruction.length,
    });

    const llmStartTime = Date.now();
    const res = await callLLM(systemInstruction, geminiContents, {
      temperature: mode === "thinking" ? 0.7 : 0.9,
      maxOutputTokens: mode === "thinking" ? 8192 : 2048,
    });
    let responseText = res.text;

    let totalPromptTokens = res.usage?.promptTokens ?? 0;
    let totalOutputTokens = res.usage?.outputTokens ?? 0;

    pushProcess("llm_call_done", {
      model: effectiveModel,
      durationMs: Date.now() - llmStartTime,
      promptTokens: totalPromptTokens,
      outputTokens: totalOutputTokens,
      responseChars: responseText?.length ?? 0,
      hasStructure: responseText ? hasStructure(responseText) : false,
    });

    if (mode === "thinking" && responseText && !hasStructure(responseText)) {
      pushProcess("structure_retry", { reason: "response_lacks_headings_or_lists" });
      const retrySystem = systemInstruction + "\n\n[REVIEWER] Your reply was a dense block without structure. Regenerate: use ## and ### headings, blank lines between paragraphs and sections, and bullet or numbered lists. No wall of text.";
      const retryRes = await callLLM(retrySystem, geminiContents, {
        temperature: mode === "thinking" ? 0.6 : 0.8,
        maxOutputTokens: mode === "thinking" ? 8192 : 2048,
      });
      responseText = retryRes.text;
      totalPromptTokens += retryRes.usage?.promptTokens ?? 0;
      totalOutputTokens += retryRes.usage?.outputTokens ?? 0;

      pushProcess("structure_retry_done", {
        promptTokens: retryRes.usage?.promptTokens ?? 0,
        outputTokens: retryRes.usage?.outputTokens ?? 0,
        responseChars: responseText?.length ?? 0,
      });
    }

    const cost =
      effectiveModel === "gemini"
        ? (totalPromptTokens / 1e6) * GEMINI_INPUT_COST_PER_1M +
          (totalOutputTokens / 1e6) * GEMINI_OUTPUT_COST_PER_1M
        : (totalPromptTokens / 1e6) * KIMI_INPUT_COST_PER_1M +
          (totalOutputTokens / 1e6) * KIMI_OUTPUT_COST_PER_1M;

    pushProcess("response_done", {
      model: effectiveModel,
      promptTokens: totalPromptTokens,
      outputTokens: totalOutputTokens,
      cost: Math.round(cost * 1e8) / 1e8,
      responseLength: responseText?.length ?? 0,
    });

    return Response.json({
      response: responseText || "I couldn't generate a response. Please try again.",
      cost: Math.round(cost * 1e8) / 1e8,
      citations: sourcesMap.length > 0 ? sourcesMap : undefined,
      debug: debugLog,
      processLog,
    });
  } catch (error: any) {
    console.error("agentChat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
