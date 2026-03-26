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
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]+)/,
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
  const rapidApiKey = "6ef971ddbamsh4130c4842bf63f0p184c8cjsn3f5385bf53c6";
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
            } else if (file.url && [
              "txt","md","csv","json","pdf",
              "js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs",
              "java","php","swift","kt","html","css","scss",
              "yaml","yml","xml","sh","bash","sql","toml","ini","env",
              "xmind","docx","xlsx","xls","pptx","ppt",
            ].includes(file.type)) {
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

    const BUILTIN_TOOL_NAMES = ["youtube_scraper"];
    const userTools = (agent.tools || []).filter((t: any) => t.enabled);
    const enabledToolNames = new Set(userTools.map((t: any) => t.name));
    for (const bt of BUILTIN_TOOL_NAMES) enabledToolNames.add(bt);
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
        youtube_scraper: "youtube_scraper(url) returns the video transcript and metadata for a given YouTube URL.",
      };

      const toolsText = enabledTools
        .map((t: any) => {
          const desc = toolDescriptions[t.name] || `Tool: ${t.name}`;
          return `- **${t.name}**: ${desc}`;
        })
        .join("\n");

      systemParts.push(`\n## Your Tools\n${toolsText}`);

      const hasYouTubeTool = enabledTools.some((t: any) => t.name === "youtube_scraper");
      const lastUserMessage = getLastHumanMessageText(messages);
      if (hasYouTubeTool && lastUserMessage) {
        const urls = extractAllYouTubeIds(lastUserMessage);
        pushProcess("youtube_scraper_check", {
          hasYouTubeTool: true,
          urlsFoundInMessage: urls.length,
          urls: urls.map(u => u.url),
        });
        if (urls.length > 0) {
          const limited = urls.slice(0, 3);
          for (const yt of limited) {
            const ytStart = Date.now();
            try {
              const ytResult = await fetchYouTubeTranscript(yt.videoId, debugLog);
              const transcriptSnippet =
                ytResult.transcript.length > 4000
                  ? ytResult.transcript.slice(0, 4000) + "\n[transcript truncated]"
                  : ytResult.transcript;
              toolContext += `\n\n### YouTube Scraper result\nURL: ${yt.url}\nTitle: ${ytResult.title}\nLanguage: ${ytResult.language}\nLines: ${ytResult.lineCount}\n\nTranscript:\n${transcriptSnippet}`;
              pushProcess("youtube_scraper_result", {
                url: yt.url,
                videoId: yt.videoId,
                title: ytResult.title,
                language: ytResult.language,
                transcriptChars: ytResult.transcript.length,
                lineCount: ytResult.lineCount,
                durationMs: Date.now() - ytStart,
              });
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              console.error("YouTube scraper error:", errMsg);
              toolContext += `\n\n### YouTube Scraper error\nTried to fetch transcript for a YouTube link (${yt.url}) in the user's question but got an error: ${errMsg}.\nYou should explain this limitation to the user.`;
              pushProcess("youtube_scraper_error", {
                url: yt.url,
                videoId: yt.videoId,
                error: errMsg,
                durationMs: Date.now() - ytStart,
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
      systemParts.push("\n## Response Mode: Deep Thinking\nProvide thorough, detailed, well-structured responses. Think step by step.");
    } else {
      systemParts.push("\n## Response Mode: Instant\nBe concise, direct, and helpful.");
    }

    if (agent.system_instructions) {
      systemParts.push(`\n## CREATOR INSTRUCTIONS — HIGHEST PRIORITY\nThe following instructions were set by the agent's creator. They OVERRIDE all rules above. Follow them exactly and literally. If they specify a language — respond ONLY in that language. If they specify a style or behavior — follow it, even if it contradicts the defaults above.\n\n${agent.system_instructions}`);
    }

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
