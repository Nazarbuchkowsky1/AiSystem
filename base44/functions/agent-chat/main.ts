import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import TranscriptClient from 'npm:youtube-transcript-api';
import { DEFAULT_AGENT_SYSTEM_PROMPT } from './defaultSystemPrompt.ts';

// ─── Kimi K2.5 via OpenRouter configuration ───────────────────────────────────
// Secrets in Base44: KIMI_API_KEY (OpenRouter key for Kimi), GEMINI_API_KEY for Gemini.
const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY");
const KIMI_MODEL = "moonshotai/kimi-k2.5";
const KIMI_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── RapidAPI key (read from env in fetchYouTubeTranscript) ────────────────────
// Reuse a single YouTube transcript client instance (from
// https://github.com/0x6a69616e/youtube-transcript-api) across requests.
const ytTranscriptClient: any = new (TranscriptClient as any)();

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

// ─── Built‑in Tool: YouTube Scraper ──────────────────────────────────────────

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
];

function extractYouTubeVideoIdFromText(text: string): { url: string; videoId: string } | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const url = m[1];
    for (const p of YT_PATTERNS) {
      const pm = url.match(p);
      if (pm?.[1]) {
        return { url, videoId: pm[1] };
      }
    }
  }
  return null;
}

/** Fetch the real YouTube video title via the free oEmbed endpoint (no API key needed). */
async function fetchYouTubeTitle(videoId: string): Promise<string> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.title && typeof data.title === "string" && data.title.trim()) {
        return data.title.trim();
      }
    }
  } catch (e) {
    console.warn("[YT] oEmbed title fetch failed:", e instanceof Error ? e.message : String(e));
  }
  return "YouTube Video";
}

/** Normalize one transcript segment: API sometimes returns text: "[]" or empty. */
function normalizeSegmentText(val: unknown): string {
  if (val == null) return "";
  const s = typeof val === "string" ? val.trim() : String(val).trim();
  if (!s || s === "[]" || s === "{}") return "";
  return s;
}

/** Clean RapidAPI/array transcript response into a single full text. Supports items with .text or .snippet. */
function transcriptArrayToFullText(transcriptData: unknown): string {
  if (!transcriptData || !Array.isArray(transcriptData)) return "";
  const parts = transcriptData
    .map((item: any) => {
      if (!item) return "";
      return normalizeSegmentText(item.text) || normalizeSegmentText(item.snippet) || (typeof item === "string" ? normalizeSegmentText(item) : "");
    })
    .filter(Boolean);
  return parts.join(" ").trim();
}

/** Extract transcript array from various RapidAPI response shapes. */
function extractTranscriptArray(json: any): unknown[] | null {
  if (!json) return null;

  const candidates: any[] = [];
  // Common top-level fields
  candidates.push(json.content, json.transcript, json.data);
  // Nested shapes like { content: { transcript: [...] } }
  if (json.content && typeof json.content === "object") {
    candidates.push(json.content.transcript, json.content.data);
  }
  if (json.data && typeof json.data === "object") {
    candidates.push(json.data.transcript);
  }
  // Finally consider the whole object/array itself
  candidates.push(json);

  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) return c;
    if (Array.isArray((c as any).transcript)) return (c as any).transcript;
  }

  if (typeof json === "string" && json.trim()) {
    return [{ text: json.trim() }];
  }
  return null;
}

async function fetchYouTubeTranscript(videoId: string, debug?: string[]) {
  debug?.push(`[YT] fetchYouTubeTranscript start videoId=${videoId}`);
  console.log(`[YT] fetchYouTubeTranscript start videoId=${videoId}`);
  // 1) RapidAPI YouTube Transcripts — primary path when RAPIDAPI_KEY is configured.
  const rapidApiKey = "6138d0add7mshb46e8560e14eab0p196722jsn3eb2bf85ad2b";
  const keySource = `[YT] Using RapidAPI key: ${rapidApiKey.slice(0, 10)}...`;
  debug?.push(keySource);
  console.log(keySource);
  if (rapidApiKey) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      // Match RapidAPI HTTP example: GET /youtube/transcript?url=<videoUrl>&chunkSize=500&text=false&lang=en
      const apiUrl =
        `https://youtube-transcripts.p.rapidapi.com/youtube/transcript?url=${encodeURIComponent(videoUrl)}&chunkSize=500&text=false&lang=en`;
      const reqLog = `[YT] RapidAPI HTTP-style request videoId=${videoId} apiUrl=${apiUrl}`;
      debug?.push(reqLog);
      console.log(reqLog);
      const res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "x-rapidapi-host": "youtube-transcripts.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
          "Content-Type": "application/json",
        },
      });
      const statusLog = `[YT] RapidAPI response status=${res.status}`;
      debug?.push(statusLog);
      console.log(statusLog);
      if (!res.ok) {
        const errBody = await res.text();
        const errLog = `[YT] RapidAPI error status=${res.status} body=${errBody.slice(0, 300)}`;
        debug?.push(errLog);
        console.error(errLog);
      } else {
        const textBody = await res.text();
        const bodyLog = `[YT] RapidAPI raw body prefix=${textBody.slice(0, 160)}`;
        debug?.push(bodyLog);
        console.log(bodyLog);
        let json: any;
        try {
          json = JSON.parse(textBody);
        } catch (e) {
          const parseErr = `[YT] RapidAPI JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
          debug?.push(parseErr);
          console.error(parseErr);
        }
        const segments = json ? extractTranscriptArray(json) : null;
        if (!segments || !Array.isArray(segments) || segments.length === 0) {
          const noSeg = "[YT] RapidAPI returned no transcript segments";
          debug?.push(noSeg);
          console.warn(noSeg);
        }
        const fullText = segments ? transcriptArrayToFullText(segments) : "";
        if (fullText && fullText.length > 0) {
          const lang = json?.lang || json?.language || "auto";
          const okLog = `[YT] RapidAPI transcript ok videoId=${videoId} lang=${lang} chars=${fullText.length}`;
          debug?.push(okLog);
          console.log(okLog);
          return {
            title: json?.title || await fetchYouTubeTitle(videoId),
            videoId,
            language: lang,
            transcript: fullText,
            lineCount: fullText.split(/\s+/).filter(Boolean).length,
          };
        }
      }
    } catch (e) {
      const netErr = `[YT] RapidAPI transcript network/parse error: ${e instanceof Error ? e.message : String(e)}`;
      debug?.push(netErr);
      console.error(netErr);
    }
  } else {
    const disabled = "[YT] RapidAPI disabled: RAPIDAPI_KEY / YOUTUBE_TRANSCRIPTS_RAPIDAPI_KEY not set in environment";
    debug?.push(disabled);
    console.warn(disabled);
  }

  // 2) Try github.com/0x6a69616e/youtube-transcript-api (npm:youtube-transcript-api)
  try {
    if (ytTranscriptClient?.ready) {
      await ytTranscriptClient.ready;
    }
    const result = await ytTranscriptClient.getTranscript(videoId);
    if (result && Array.isArray(result.tracks) && result.tracks.length > 0) {
      const track = result.tracks[0];
      const segments: any[] = Array.isArray(track.transcript) ? track.transcript : [];
      const text = segments.map((s) => s.text).join(" ").trim();
      if (text.length > 0) {
        return {
          title: result.title || "YouTube Video",
          videoId,
          language: track.language || "unknown",
          transcript: text,
          lineCount: segments.length,
        };
      }
    }
  } catch (e) {
    console.error("youtube-transcript-api error, falling back to TubeText:", e);
  }

  // 3) Try free TubeText API (fast, JSON, no auth).
  try {
    const apiUrl = `https://tubetext.vercel.app/youtube/transcript?video_id=${videoId}`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        "User-Agent": "LumenAgents/1.0 (+https://openrouter.ai/)",
      },
    });
    if (apiRes.ok) {
      const json: any = await apiRes.json();
      if (json?.success && json.data) {
        const d = json.data;
        const transcriptArray: string[] = Array.isArray(d.transcript) ? d.transcript : [];
        const fullText: string =
          typeof d.full_text === "string" && d.full_text.trim().length > 0
            ? d.full_text
            : transcriptArray.join(" ");
        if (fullText && fullText.trim().length > 0) {
          return {
            title: d.details?.title || "YouTube Video",
            videoId,
            language: "unknown",
            transcript: fullText.trim(),
            lineCount: transcriptArray.length || fullText.split(/\s+/).length,
          };
        }
      }
    }
  } catch (e) {
    console.error("TubeText API error, falling back to HTML scraper:", e);
  }

  // 4) Second fallback: public FastAPI service youtube-transcript-api-tau-one.vercel.app
  try {
    const tauUrl = "https://youtube-transcript-api-tau-one.vercel.app/transcript";
    const tauRes = await fetch(tauUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LumenAgents/1.0 (+https://openrouter.ai/)",
      },
      body: JSON.stringify({
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
      }),
    });
    if (tauRes.ok) {
      const json: any = await tauRes.json();
      const t = (json?.transcript || "").toString().trim();
      if (t.length > 0) {
        return {
          title: json?.title || "YouTube Video",
          videoId,
          language: json?.language || "unknown",
          transcript: t,
          lineCount: t.split(/\s+/).length,
        };
      }
    }
  } catch (e) {
    console.error("Tau-one YouTube transcript API error, falling back to HTML scraper:", e);
  }

  // 5) Final fallback: direct HTML + captionTracks scraping from YouTube.
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();

  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "Unknown";

  const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
  if (!captionMatch) {
    throw new Error("No captions found for this video. The video may not have subtitles enabled.");
  }

  const captionTracks = JSON.parse(captionMatch[1]);
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error("No caption tracks available for this video.");
  }

  let track =
    captionTracks.find((t: any) => t.languageCode === "en" && t.kind !== "asr") ||
    captionTracks.find((t: any) => t.languageCode === "uk" && t.kind !== "asr") ||
    captionTracks.find((t: any) => t.languageCode === "en") ||
    captionTracks.find((t: any) => t.languageCode === "uk") ||
    captionTracks.find((t: any) => t.kind !== "asr") ||
    captionTracks[0];

  const captionUrl = track.baseUrl;
  const captionRes = await fetch(captionUrl);
  const captionXml = await captionRes.text();

  const lines: string[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(captionXml)) !== null) {
    const text = match[3]
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

function extractAllYouTubeIds(text: string): { url: string; videoId: string }[] {
  if (!text) return [];
  const urls: { url: string; videoId: string }[] = [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const url = m[1];
    for (const p of YT_PATTERNS) {
      const pm = url.match(p);
      if (pm?.[1]) {
        urls.push({ url, videoId: pm[1] });
        break;
      }
    }
  }
  return urls;
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
      role: (c.role === "model" ? "assistant" : "user") as "assistant" | "user",
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
  const timeout = setTimeout(() => controller.abort(), 120000); // 120s safety timeout


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

    const agentName = agent.name || "AI Assistant";
    const agentDesc = agent.description || "";
    
    // Use agent's chosen model for the reply (voice or text). Only "gemini" → Gemini; anything else → Kimi.
    const requestedModel = agent?.model != null ? String(agent.model).toLowerCase() : "kimi";
    const effectiveModel: "kimi" | "gemini" =
      requestedModel === "gemini" ? "gemini" : "kimi";
    
    debugLog.push(`[System] Initializing chat | Model: ${effectiveModel} | Agent: ${agentName} | Mode: ${mode}`);
    debugLog.push(`[System] File sources provided in request: ${fileSources.length}`);

    const callLLM =
      effectiveModel === "gemini" ? callGemini : callKimi;

    const systemParts: string[] = [];
    systemParts.push(`You are "${agentName}". ${agentDesc}`);


    if (agent.system_instructions) {
      systemParts.push(`\n## Your Instructions:\n${agent.system_instructions}`);
    }

    systemParts.push(`\n${DEFAULT_AGENT_SYSTEM_PROMPT}`);

    // ─── Collect KB files in one pass ─────────────────────────────────
    type IndexedFile = { name: string; tree: string; doc: any };
    const indexedFiles: IndexedFile[] = [];
    const unindexedFiles: { name: string; url: string }[] = [];

    if (agent.knowledge_base_ids && agent.knowledge_base_ids.length > 0) {
      try {
        for (const kbId of agent.knowledge_base_ids) {
          const kbList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
          if (!kbList?.length) continue;
          const kb = kbList[0];
          if (!kb.files?.length) continue;

          for (const file of kb.files) {
            if (file.index_tree?.root && Array.isArray(file.index_tree?.paragraphs) && file.index_tree.paragraphs.length > 0) {
              const treeText = formatTreeForRouting(file.index_tree, file.name);
              if (treeText) {
                indexedFiles.push({ name: file.name, tree: treeText, doc: file.index_tree });
              }
            } else if (file.url && [
              "txt","md","csv","json","pdf",
              "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
              "java","php","swift","kt","html","css","scss",
              "yaml","yml","xml","sh","bash","sql","toml","ini","env",
            ].includes(file.type)) {
              unindexedFiles.push({ name: file.name, url: file.url });
            }
          }
        }
        debugLog.push(`[KB] Knowledge Base scan complete: ${indexedFiles.length} indexed files, ${unindexedFiles.length} unindexed files.`);
      } catch (e) {
        const errorMsg = `[KB] KB fetch error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(errorMsg);
        debugLog.push(errorMsg);
      }
    }


    // ─── PageIndex 2-step retrieval ───────────────────────────────────
    let retrievedContext = "";

    if (indexedFiles.length > 0) {
      const lastUserMessage = getLastHumanMessageText(messages);

      const treeOverview = indexedFiles
        .map((f, i) => `### File ${i}: ${f.name}\n${f.tree}`)
        .join("\n\n");

      const routingSystem = `You are a document retrieval router. You will receive:
1. A user's question
2. Hierarchical tree indexes of documents (like tables of contents with summaries)

Your job: decide which sections of which documents are most likely to contain the answer. Think like a human expert navigating these documents — "where would I look for this answer?"

Output a JSON object:
{
  "reasoning": "Brief explanation of why you chose these sections",
  "selections": [
    { "file_index": 0, "node_ids": ["0002", "0005"] }
  ]
}

Rules:
- Select the MOST relevant sections (typically 2-6 node_ids total).
- Prefer leaf nodes or specific subsections over broad parent sections, UNLESS the parent or root section is the main or only relevant entry.
- If the question is very broad, select more sections. If specific, select fewer.
- If no section seems relevant, return empty selections: []
- Output ONLY valid JSON.`;

      const routingContents = [
        { role: "user", parts: [{ text: `Question: ${lastUserMessage}\n\nDocument indexes:\n${treeOverview}` }] },
      ];

      debugLog.push(`[PageIndex] Starting document routing for ${indexedFiles.length} files...`);
      let routingSucceeded = false;


      try {
        const { text: routingRaw } = await callGemini(routingSystem, routingContents, {
          temperature: 0.1,
          maxOutputTokens: 1024,
          jsonMode: true,
        });

        let routingResult: any = null;
        try {
          let cleaned = routingRaw.trim();
          if (cleaned.startsWith("```")) {
            const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (m?.[1]) cleaned = m[1].trim();
          }
          routingResult = JSON.parse(cleaned);
        } catch {
          console.error("Failed to parse routing JSON:", routingRaw.slice(0, 300));
        }

        if (routingResult?.selections && Array.isArray(routingResult.selections)) {
          const parts: string[] = [];
          if (routingResult.reasoning) {
            parts.push(`Retrieval reasoning: ${routingResult.reasoning}`);
          }

          for (const sel of routingResult.selections) {
            const fileIdx = sel.file_index;
            const nodeIds = sel.node_ids;
            if (typeof fileIdx !== "number" || fileIdx < 0 || fileIdx >= indexedFiles.length) continue;
            if (!Array.isArray(nodeIds) || nodeIds.length === 0) continue;

            const file = indexedFiles[fileIdx];
            const sectionText = extractSectionText(file.doc, nodeIds);
            if (sectionText) {
              parts.push(`\n--- Retrieved from: ${file.name} (sections: ${nodeIds.join(", ")}) ---\n${sectionText}`);
              routingSucceeded = true;
            }
          }

          if (parts.length > 0) {
            retrievedContext = parts.join("\n");
            debugLog.push(`[PageIndex] Successfully retrieved context from ${routingResult.selections.length} documents.`);
          }
        }
      } catch (e) {
        const errorMsg = `[PageIndex] Routing error: ${e instanceof Error ? e.message : String(e)}`;
        console.error(errorMsg);
        debugLog.push(errorMsg);
      }

      // Fallback: if routing failed or returned nothing, provide tree summaries as context
      if (!routingSucceeded) {
        retrievedContext = indexedFiles
          .map(f => `--- Document structure: ${f.name} ---\n${f.tree}`)
          .join("\n\n");
      }
    }

    // Unindexed files: fetch raw content as fallback
    if (unindexedFiles.length > 0) {
      debugLog.push(`[KB] Fetching content for ${unindexedFiles.length} unindexed files...`);
      for (const file of unindexedFiles) {
        try {
          const resp = await fetch(file.url);
          if (resp.ok) {
            const text = await resp.text();
            const trimmed = text.substring(0, 6000);
            retrievedContext += `\n\n--- File (unindexed): ${file.name} ---\n${trimmed}${text.length > 6000 ? "\n[...truncated]" : ""}`;
            debugLog.push(`[KB] Extracted content from unindexed file: ${file.name} (${text.length} chars)`);
          } else {
            debugLog.push(`[KB] Failed to fetch unindexed file: ${file.name} (Status: ${resp.status})`);
          }
        } catch (e) { 
           debugLog.push(`[KB] Error fetching unindexed file: ${file.name} - ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    if (retrievedContext) {
      systemParts.push(`\n## Retrieved Knowledge Base Content
The following content was retrieved from your knowledge bases using reasoning-based document navigation (PageIndex). These are the specific sections identified as most relevant to the user's question.

ALWAYS use this retrieved content to answer. If the content doesn't fully answer the question, say what you found and what's missing.
${retrievedContext}`);
    }


    const enabledTools = (agent.tools || []).filter((t: any) => t.enabled);
    let toolContext = "";
    if (enabledTools.length > 0) {
      const toolDescriptions: Record<string, string> = {
        script_runner: "Execute custom scripts and automations.",
        web_scraper: "Extract data from websites and APIs.",
        data_processor: "Transform and analyze datasets.",
        code_generator: "Generate code snippets and templates.",
        local_ai_bridge: "Connect to local AI models and services.",
        system_utility: "System maintenance and monitoring tools.",
        youtube_scraper: "youtube_scraper(url) returns the video transcript and metadata for a given YouTube URL.",
        kb_expander:
          "kb_expander({ kbId, text }) can be used to add new text to a knowledge base, then re-index it for future queries.",
      };

      const toolsText = enabledTools
        .map((t: any) => {
          const desc = toolDescriptions[t.name] || `Tool: ${t.name}`;
          return `- **${t.name}**: ${desc}`;
        })
        .join("\n");

      debugLog.push(`[Tools] Active tools: ${enabledTools.map((t: any) => t.name).join(", ")}`);

      systemParts.push(`\n## Your Tools\n${toolsText}`);


      // Inline YouTube Scraper execution when user message contains a YouTube URL.
      const hasYouTubeTool = enabledTools.some((t: any) => t.name === "youtube_scraper");
      const lastUserMessage = getLastHumanMessageText(messages);
      if (hasYouTubeTool && lastUserMessage) {
        console.log("[YT] YouTube scraper triggered from chat message");
        const urls = extractAllYouTubeIds(lastUserMessage);
        if (urls.length > 0) {
          debugLog.push(`[YT] Found ${urls.length} YouTube links for inline scraping.`);
          const limited = urls.slice(0, 3); // hard limit per turn for cost
          for (const yt of limited) {
            debugLog.push(`[YT] Scraping transcript for: ${yt.videoId}`);
            try {
              const ytResult = await fetchYouTubeTranscript(yt.videoId, debugLog);
              const transcriptSnippet =
                ytResult.transcript.length > 4000
                  ? ytResult.transcript.slice(0, 4000) + "\n[transcript truncated]"
                  : ytResult.transcript;
              toolContext += `\n\n### YouTube Scraper result\nURL: ${yt.url}\nTitle: ${ytResult.title}\nLanguage: ${ytResult.language}\nLines: ${ytResult.lineCount}\n\nTranscript:\n${transcriptSnippet}`;
            } catch (e) {
              console.error("YouTube scraper error:", e instanceof Error ? e.message : String(e));
              toolContext += `\n\n### YouTube Scraper error\nTried to fetch transcript for a YouTube link (${yt.url}) in the user's question but got an error: ${
                e instanceof Error ? e.message : String(e)
              }.\nYou should explain this limitation to the user.`;
            }
          }
        }
      }

      // ─── KB Expander: create/append KB from chat ─────────────────────
      const hasKbExpander = enabledTools.some((t: any) => t.name === "kb_expander");
      if (hasKbExpander && messages && messages.length > 0) {
        const lastText: string = getLastHumanMessageText(messages);

        const wantsKb =
          /knowledge base|kb\b|база знань|базу знань|додай до бз|додай до бази/i.test(lastText);
        const wantsCreate = /create.*knowledge base|new knowledge base|створ(и|іть).*баз[ау] знань/i.test(
          lastText
        );

        const ytSources = extractAllYouTubeIds(lastText);
        const plainTextSource =
          !ytSources.length && lastText && lastText.length > 200 ? lastText : "";

        const uploadedFiles: { name: string; url: string; type: string }[] = Array.isArray(
          fileSources
        )
          ? fileSources
          : [];

        if (wantsKb && (ytSources.length > 0 || plainTextSource || uploadedFiles.length > 0)) {
          console.log(
            `[KB] KB Expander triggered wantsCreate=${wantsCreate} ytLinks=${ytSources.length} uploadedFiles=${uploadedFiles.length} plainText=${plainTextSource ? "yes" : "no"}`,
          );
          const kbIds: string[] = Array.isArray(agent.knowledge_base_ids)
            ? agent.knowledge_base_ids.map(String)
            : [];

        // Try to detect specific KB name, e.g. "add to knowledge base Sales"
        // or "Створи нову базу знань Planning і завантаж..."
          let explicitKbName: string | null = null;
        const kbNameMatchAdd =
          lastText.match(/(?:to|into)\s+(?:knowledge base|KB)\s+["“]?([^"\n]+)["”]?/i) ||
          lastText.match(/баз[аи] знань\s+["“]?([^"\n]+)["”]?/i);
        const kbNameMatchCreate =
          lastText.match(/create(?:\s+new)?\s+knowledge base\s+["“]?([^"\n]+)["”]?/i) ||
          lastText.match(/створ(?:и|іть)\s+нову?\s+баз[ау] знань\s+["“]?([^"\n]+)["”]?/i);

        const cleanKbName = (raw: string) =>
          raw
            .split(/(?:\s+і\s+|\s+and\s+|,|\.|;|:|\n)/i)[0]
            .trim();

        if (kbNameMatchAdd?.[1]) {
          explicitKbName = cleanKbName(kbNameMatchAdd[1]);
        } else if (kbNameMatchCreate?.[1]) {
          explicitKbName = cleanKbName(kbNameMatchCreate[1]);
        }

          let targetKbId: string | null = null;
          let createdKbName = "";

          if (!kbIds.length || wantsCreate) {
            const kb = await base44.asServiceRole.entities.KnowledgeBase.create({
              name:
                explicitKbName ||
                `${agent.name || "Agent"} KB ${new Date().toISOString().slice(0, 10)}`,
              files: [],
              processing: false,
              index_status: "pending",
              index_progress: 0,
              last_error: "",
            });
            targetKbId = String(kb.id);
            createdKbName = kb.name || "Knowledge Base";

            if (agent.id) {
              const nextKbIds = [...kbIds, targetKbId];
              await base44.asServiceRole.entities.Agent.update(agent.id, {
                knowledge_base_ids: nextKbIds,
              });
            }
          } else {
            if (explicitKbName) {
              const allKbs = await base44.asServiceRole.entities.KnowledgeBase.filter({});
              const match = allKbs?.find(
                (k: any) =>
                  String(k.name || "")
                    .toLowerCase()
                    .includes(explicitKbName!.toLowerCase()) && kbIds.includes(String(k.id))
              );
              if (match) {
                targetKbId = String(match.id);
              }
            }
            if (!targetKbId) {
              targetKbId = kbIds[0];
            }
          }

          if (targetKbId) {
            const kbList = await base44.asServiceRole.entities.KnowledgeBase.filter({
              id: targetKbId,
            });
            if (kbList?.length) {
              const kb = kbList[0];
              const files = kb.files || [];
              const newFiles: any[] = [];
              const limitedYt = ytSources.slice(0, 50);
              for (const { url, videoId } of limitedYt) {

                try {
                  const ytData = await fetchYouTubeTranscript(videoId, debugLog);
                  newFiles.push({
                    name: ytData.title || `YouTube transcript ${videoId}`,
                    type: "txt",
                    url: url,
                    inline_text: `Source: ${url}\n\n${ytData.transcript}`,
                    processed: false, // Delegate to Smart Indexing
                  });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error("KB expander youtube error:", msg);
                  newFiles.push({
                    name: `YouTube transcript error ${videoId}`,
                    type: "txt",
                    url: url,
                    inline_text: `Source: ${url}\n\n[Error fetching transcript: ${msg}]`,
                    processed: false, // Still mark as unprocessed so we have a record and might retry
                  });
                }
              }

              if (plainTextSource) {
                const truncated =
                  plainTextSource.length > 20000
                    ? plainTextSource.slice(0, 20000)
                    : plainTextSource;
                newFiles.push({
                  name: "Chat text snippet",
                  type: "txt",
                  url: "",
                  inline_text: truncated,
                  processed: false,
                });
              }

              if (uploadedFiles.length > 0) {
                for (const f of uploadedFiles) {
                  newFiles.push({
                    name: f.name,
                    type: (f.type || "txt").toLowerCase(),
                    url: f.url,
                    inline_text: "",
                    processed: false,
                  });
                }
              }

              if (newFiles.length > 0) {
                const updatedFiles = [...files, ...newFiles];
                await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
                  files: updatedFiles,
                  processing: true,
                  index_status: "indexing",
                  index_progress: kb.index_progress || 0,
                  last_error: "",
                });

                const needsHeavyIndexing = updatedFiles.some(f => !f.processed);
                
                if (needsHeavyIndexing) {
                  try {
                    const invokeMsg = `[KB] Starting indexKnowledgeBase for kbId=${kb.id}`;
                    console.log(invokeMsg);
                    debugLog.push(invokeMsg);
                    
                    const indexResult: any = await base44.functions
                      .invoke("indexKnowledgeBase", { kbId: String(kb.id) });
                      
                    const doneMsg = `[KB] indexKnowledgeBase completed successfully!`;
                    console.log(doneMsg);
                    debugLog.push(doneMsg);
                    
                    // Forward debug traces from indexKnowledgeBase
                    const resultKeys = Object.keys(indexResult || {});
                    debugLog.push(`[KB_DEBUG] indexResult keys: ${resultKeys.join(", ")}`);
                    if (indexResult?.data) {
                      const data = indexResult.data;
                      const dataKeys = Object.keys(data).join(", ");
                      debugLog.push(`[KB_DEBUG] indexResult.data keys: ${dataKeys}`);
                      if (data.v) {
                        debugLog.push(`[KB_DEBUG] Function version: ${data.v}`);
                      } else {
                        debugLog.push(`[KB_DEBUG] WARNING: No version tag found! The function might be running OLD code.`);
                      }
                    }
                    
                    if (indexResult?.data?.debug && Array.isArray(indexResult.data.debug)) {
                      indexResult.data.debug.forEach((msg: string) => debugLog.push(msg));
                    } else if (indexResult?.debug && Array.isArray(indexResult.debug)) {
                      indexResult.debug.forEach((msg: string) => debugLog.push(msg));
                    }
                  } catch (e) {
                    const errMsg = `[KB] indexKnowledgeBase failed: ${e instanceof Error ? e.message : String(e)}`;
                    console.error(errMsg);
                    debugLog.push(errMsg);
                  }
                } else {
                  const skipMsg = "[KB] Skipping indexKnowledgeBase invocation because all files are already processed inline.";
                  console.log(skipMsg);
                  debugLog.push(skipMsg);
                  // Update KB status to succeeded since we skip indexing
                  await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
                    processing: false,
                    index_status: "succeeded",
                    index_progress: 100,
                  });
                }

                toolContext += `\n\n### KB Expander\nAdded ${
                  newFiles.length
                } document(s) into knowledge base **${
                  createdKbName || kb.name || targetKbId
                }** based on your last message${
                  ytSources.length
                    ? ` and the following YouTube links: ${ytSources.map((s) => s.url).join(", ")}`
                    : ""
                }${
                  uploadedFiles.length
                    ? ` and ${uploadedFiles.length} uploaded file(s).`
                    : "."
                }\nNew content will be used automatically in future answers once indexing finishes.`;
              }
            }
          }
        }
      }
    }

    if (toolContext) {
      systemParts.push(`\n## Tool Outputs\nThe following tool calls were executed **before** answering. Use these results as authoritative context.\n${toolContext}`);
    }

    systemParts.push(`\n## Web Access\nYou have access to the internet. ${
      retrievedContext ? "Prioritize knowledge base content and tool outputs first." : ""
    }`);

    if (mode === "thinking") {
      systemParts.push("\n## Response Mode: Deep Thinking\nProvide thorough, detailed, well-structured responses. Think step by step.");
    } else {
      systemParts.push("\n## Response Mode: Instant\nBe concise, direct, and helpful.");
    }

    const systemInstruction = systemParts.join("\n");
    debugLog.push(`[System] Final system prompt length: ${systemInstruction.length} chars`);
    debugLog.push(`[System] Calling LLM (${effectiveModel})...`);

    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await callLLM(systemInstruction, geminiContents, {
      temperature: mode === "thinking" ? 0.7 : 0.9,
      maxOutputTokens: mode === "thinking" ? 8192 : 2048,
    });
    let responseText = res.text;

    let totalPromptTokens = res.usage?.promptTokens ?? 0;
    let totalOutputTokens = res.usage?.outputTokens ?? 0;

    if (mode === "thinking" && responseText && !hasStructure(responseText)) {
      debugLog.push(`[System] Thinking response lacked structure. Retrying with explicit instructions.`);
      const retrySystem = systemInstruction + "\n\n[REVIEWER] Your reply was a dense block without structure. Regenerate: use ## and ### headings, blank lines between paragraphs and sections, and bullet or numbered lists. No wall of text.";
      const retryRes = await callLLM(retrySystem, geminiContents, {
        temperature: mode === "thinking" ? 0.6 : 0.8,
        maxOutputTokens: mode === "thinking" ? 8192 : 2048,
      });
      responseText = retryRes.text;
      totalPromptTokens += retryRes.usage?.promptTokens ?? 0;
      totalOutputTokens += retryRes.usage?.outputTokens ?? 0;
    }

    const cost =
      effectiveModel === "gemini"
        ? (totalPromptTokens / 1e6) * GEMINI_INPUT_COST_PER_1M +
          (totalOutputTokens / 1e6) * GEMINI_OUTPUT_COST_PER_1M
        : (totalPromptTokens / 1e6) * KIMI_INPUT_COST_PER_1M +
          (totalOutputTokens / 1e6) * KIMI_OUTPUT_COST_PER_1M;

    debugLog.push(`[System] LLM completed. Tokens: ${totalPromptTokens} in, ${totalOutputTokens} out. Cost: $${cost.toFixed(5)}`);


    return Response.json({
      response: responseText || "I couldn't generate a response. Please try again.",
      cost: Math.round(cost * 1e8) / 1e8,
      debug: debugLog,
    });
  } catch (error: any) {
    console.error("agentChat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
