import { db, deserializeRow, serializeRow, getTable } from '../db.js';
import { DEFAULT_AGENT_SYSTEM_PROMPT, FINAL_ENFORCEMENT } from './defaultSystemPrompt.js';

const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_MODEL = 'moonshotai/kimi-k2.5';
const KIMI_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_GEMINI_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.0-flash-001',
];

const SUPADATA_API_KEY = 'sd_8ca36aab85b68983db4fcddfc3298d5d';
const SUPADATA_BASE = 'https://api.supadata.ai/v1';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const KIMI_INPUT_COST_PER_1M = 0.45;
const KIMI_OUTPUT_COST_PER_1M = 2.20;
const GEMINI_INPUT_COST_PER_1M = 0.25;
const GEMINI_OUTPUT_COST_PER_1M = 1.50;

const MEDIA_URL_PATTERNS = [
  { platform: 'youtube', regex: /(?:youtube\.com\/(?:watch|embed|shorts|live)|youtu\.be)\//i },
  { platform: 'tiktok', regex: /tiktok\.com\//i },
  { platform: 'instagram', regex: /instagram\.com\//i },
  { platform: 'twitter', regex: /(?:twitter\.com|x\.com)\//i },
  { platform: 'facebook', regex: /(?:facebook\.com|fb\.com|fb\.watch)\//i },
];

function getSourceUrl(file) {
  return file?.source_url || file?.file_path || file?.url || '';
}

function resolveFetchUrl(rawUrl, req) {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/')) {
    return `${req.protocol}://${req.get('host')}${rawUrl}`;
  }
  return rawUrl;
}

function extractAllMediaUrls(text) {
  if (!text) return [];
  const results = [];
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const rawUrl = m[1].replace(/[.,;:!?)]+$/, '');
    for (const { platform, regex } of MEDIA_URL_PATTERNS) {
      if (regex.test(rawUrl)) { results.push({ url: rawUrl, platform }); break; }
    }
  }
  return results;
}

function formatTreeForRouting(doc, fileName) {
  if (!doc || !doc.root) return '';
  const lines = [];
  if (doc.doc_title || fileName) lines.push(`Document: ${doc.doc_title || fileName}`);
  if (doc.doc_description) lines.push(`Overview: ${doc.doc_description}`);
  const walk = (node, depth) => {
    const indent = '  '.repeat(depth);
    const title = node.title || 'Untitled';
    const id = node.node_id || '?';
    const range = typeof node.start_index === 'number' && typeof node.end_index === 'number' ? ` [p${node.start_index}-p${node.end_index}]` : '';
    const summary = node.summary ? ` — ${node.summary}` : '';
    lines.push(`${indent}[${id}] ${title}${range}${summary}`);
    if (Array.isArray(node.nodes)) for (const child of node.nodes) walk(child, depth + 1);
  };
  walk(doc.root, 0);
  return lines.join('\n');
}

function extractSectionText(doc, selectedNodeIds) {
  if (!doc?.root || !doc?.paragraphs || !Array.isArray(doc.paragraphs)) return '';
  const paragraphs = doc.paragraphs;
  const collected = new Set();
  function findNodes(node) {
    if (selectedNodeIds.includes(node.node_id)) {
      const start = typeof node.start_index === 'number' ? node.start_index : 0;
      const end = typeof node.end_index === 'number' ? node.end_index : start;
      for (let i = start; i <= end && i < paragraphs.length; i++) collected.add(i);
    }
    if (Array.isArray(node.nodes)) for (const child of node.nodes) findNodes(child);
  }
  findNodes(doc.root);
  if (collected.size === 0) return paragraphs.join('\n\n');
  return Array.from(collected).sort((a, b) => a - b).map(i => paragraphs[i]).join('\n\n');
}

function normalizeTokens(text) {
  const raw = String(text || '').toLowerCase().match(/[a-zа-яіїєґ0-9_#@-]{3,}/gi) || [];
  const stop = new Set(['the','and','for','with','that','this','from','are','was','were','you','your','или','что','это','как','для','або','як','щоб']);
  return raw.filter(t => !stop.has(t));
}

function lexicalScore(query, text, sourceGuide) {
  const q = normalizeTokens(query);
  if (q.length === 0) return 0;
  const hay = new Set([
    ...normalizeTokens(text),
    ...normalizeTokens(sourceGuide?.summary || ''),
    ...(Array.isArray(sourceGuide?.topics) ? sourceGuide.topics.flatMap(normalizeTokens) : []),
    ...(Array.isArray(sourceGuide?.keywords) ? sourceGuide.keywords.flatMap(normalizeTokens) : []),
  ]);
  let score = 0;
  for (const t of q) if (hay.has(t)) score += 1;
  return score / q.length;
}

function buildNotebookMemory(messages, sourcesMap, subQuestions) {
  const recent = (messages || []).slice(-12);
  const userTexts = recent.filter(m => m?.role === 'user').map(m => String(m.content || ''));
  const assistantTexts = recent.filter(m => m?.role === 'assistant').map(m => String(m.content || ''));
  const activeTopics = normalizeTokens([userTexts.join(' '), subQuestions.join(' ')].join(' ')).slice(0, 24);
  const usefulSources = (sourcesMap || []).slice(0, 8).map(s => ({ index: s.index, name: s.name }));
  return {
    turns_considered: recent.length,
    active_topics: [...new Set(activeTopics)],
    useful_sources: usefulSources,
    previous_user_intents: userTexts.slice(-4),
    assistant_focus_summary: assistantTexts.slice(-2).map(t => t.slice(0, 220)),
  };
}

function parseCitationIndices(text) {
  const set = new Set();
  const re = /\[(\d+)\]/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) set.add(Number(m[1]));
  return [...set].filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function scoreOverlap(a, b) {
  const A = new Set(normalizeTokens(a));
  const B = new Set(normalizeTokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(1, Math.min(A.size, B.size));
}

function alignCitationsToSpans(responseText, indexedFiles, sourcesMap) {
  const byIndex = new Map((sourcesMap || []).map(s => [s.index, s]));
  const sourceNameToDoc = new Map((indexedFiles || []).map(f => [String(f.doc?.doc_title || f.name), f.doc]));
  const claims = splitSentences(responseText).slice(0, 60);
  const out = [];
  for (const claim of claims) {
    const cited = parseCitationIndices(claim);
    for (const ci of cited) {
      const src = byIndex.get(ci);
      if (!src) continue;
      const doc = sourceNameToDoc.get(String(src.name));
      const paragraphs = Array.isArray(doc?.paragraphs) ? doc.paragraphs : [];
      let best = { i: -1, score: 0, text: '' };
      for (let i = 0; i < Math.min(paragraphs.length, 500); i++) {
        const p = String(paragraphs[i] || '');
        const s = scoreOverlap(claim, p);
        if (s > best.score) best = { i, score: s, text: p };
      }
      if (best.i >= 0 && best.score >= 0.12) {
        out.push({
          source_index: ci,
          source_name: src.name,
          claim: claim.slice(0, 320),
          quote: best.text.slice(0, 320),
          paragraph_start: best.i,
          paragraph_end: best.i,
          score: Number(best.score.toFixed(3)),
        });
      }
    }
  }
  return out;
}

function hasAnyCitationTag(text) {
  return /\[\d+\]/.test(String(text || ''));
}

function stripCitationTags(text) {
  return String(text || '')
    .replace(/\s*\[(\d+)\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function buildStyleReference(agent, req) {
  const stylePrompt = String(agent?.style_prompt || '').trim();
  const styleSamples = Array.isArray(agent?.style_samples) ? agent.style_samples : [];
  if (!stylePrompt && styleSamples.length === 0) return { block: '', sampleCount: 0 };

  const snippets = [];
  const maxFiles = 4;
  const maxCharsPerFile = 3500;

  for (const sample of styleSamples.slice(0, maxFiles)) {
    const sourceUrl = getSourceUrl(sample);
    const fetchUrl = resolveFetchUrl(sourceUrl, req);
    if (!fetchUrl) continue;
    try {
      const resp = await fetch(fetchUrl);
      if (!resp.ok) continue;
      const text = (await resp.text()).replace(/\r\n/g, '\n').trim();
      if (!text) continue;
      const compact = text.length > maxCharsPerFile ? text.slice(0, maxCharsPerFile) + '\n[...truncated]' : text;
      snippets.push(`Sample "${sample?.name || 'style-sample'}":\n${compact}`);
    } catch {
      // Ignore sample fetch errors; style block is optional.
    }
  }

  const parts = [];
  if (stylePrompt) parts.push(`Style directive:\n${stylePrompt}`);
  if (snippets.length > 0) parts.push(`Reference writing samples (imitate voice, rhythm, wording patterns):\n${snippets.join('\n\n')}`);
  parts.push('Style rule: Use these references only for HOW to answer (voice/tone/wording), not as factual evidence.');

  return {
    block: parts.join('\n\n'),
    sampleCount: snippets.length,
  };
}

async function fetchTranscriptViaSupadata(url, debug) {
  if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY not configured');
  const t0 = Date.now();
  let title = 'Video';
  try {
    const metaRes = await fetch(`${SUPADATA_BASE}/metadata?url=${encodeURIComponent(url)}`, { headers: { 'x-api-key': SUPADATA_API_KEY } });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      title = meta.title || meta.description?.slice(0, 100) || 'Video';
    }
  } catch {}

  const tUrl = `${SUPADATA_BASE}/transcript?url=${encodeURIComponent(url)}&text=true&mode=auto`;
  const res = await fetch(tUrl, { headers: { 'x-api-key': SUPADATA_API_KEY } });

  if (res.status === 202) {
    const { jobId } = await res.json();
    debug?.push(`[Supadata] Async job: ${jobId}`);
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, { headers: { 'x-api-key': SUPADATA_API_KEY } });
      if (!pollRes.ok) throw new Error(`Poll HTTP error: ${pollRes.status}`);
      const job = await pollRes.json();
      if (job.status === 'completed') {
        const text = typeof job.content === 'string' ? job.content : '';
        if (!text.trim()) throw new Error('Empty transcript');
        return { title, transcript: text, platform: 'video', language: job.lang || 'auto', lineCount: text.split(/\s+/).length };
      }
      if (job.status === 'failed') throw new Error(`Job failed: ${job.error?.message || 'unknown'}`);
    }
    throw new Error('Poll timeout');
  }

  if (!res.ok) throw new Error(`Transcript error: ${res.status}`);
  const data = await res.json();
  const text = typeof data.content === 'string' ? data.content : '';
  if (text.length > 0) return { title, transcript: text, platform: 'video', language: data.lang || 'auto', lineCount: text.split(/\s+/).length };
  throw new Error('Empty transcript');
}

function buildInlineTranscriptIndex(text, fileName) {
  const cleaned = (text || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) return { doc_title: fileName, doc_description: 'Empty transcript', root: { title: fileName, node_id: '0000', start_index: 0, end_index: 0, summary: 'Empty transcript', nodes: [] }, paragraphs: [''] };

  const roughParts = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const paragraphs = [];
  const MAX_PARA = 600;
  for (const part of roughParts) {
    if (part.length <= MAX_PARA) { paragraphs.push(part); continue; }
    let start = 0;
    while (start < part.length) {
      let slice = part.slice(start, start + MAX_PARA);
      const lastSentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
      if (lastSentenceEnd > MAX_PARA / 2 && start + lastSentenceEnd < part.length) slice = part.slice(start, start + lastSentenceEnd + 1);
      if (slice.trim()) paragraphs.push(slice.trim());
      start += slice.length;
    }
  }

  const nodes = [];
  const PARA_PER_NODE = 5;
  for (let i = 0; i < paragraphs.length; i += PARA_PER_NODE) {
    const end = Math.min(i + PARA_PER_NODE - 1, paragraphs.length - 1);
    const sectionText = paragraphs.slice(i, end + 1).join(' ');
    let summary = sectionText.substring(0, 160);
    if (sectionText.length > 160) summary += '...';
    nodes.push({ title: `Section ${Math.floor(i / PARA_PER_NODE) + 1}`, node_id: (Math.floor(i / PARA_PER_NODE) + 1).toString().padStart(4, '0'), start_index: i, end_index: end, summary, nodes: [] });
  }

  return {
    doc_title: fileName || 'YouTube Video',
    doc_description: `Transcript (${paragraphs.length} chunks)`,
    root: { title: fileName || 'Transcript', node_id: '0000', start_index: 0, end_index: Math.max(paragraphs.length - 1, 0), summary: `Transcript (${paragraphs.length} paragraphs)`, nodes },
    paragraphs,
  };
}

function getLastHumanMessageText(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const last = [...messages].reverse().find(m => m && m.role && m.role !== 'assistant');
  return typeof last?.content === 'string' ? last.content : '';
}

async function callKimi(systemText, contents, opts = {}) {
  if (!KIMI_API_KEY) throw new Error('Kimi API key not configured');
  const messages = [
    { role: 'system', content: systemText },
    ...contents.map(c => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c?.parts?.[0]?.text ?? '' })),
  ];
  const body = { model: KIMI_MODEL, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxOutputTokens ?? 4096 };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const resp = await fetch(KIMI_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KIMI_API_KEY}` },
    body: JSON.stringify(body), signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!resp.ok) { const e = await resp.text(); throw new Error(`Kimi API error: ${resp.status} ${e.slice(0, 200)}`); }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  const um = data?.usage;
  let promptTokens = um?.prompt_tokens ?? 0, outputTokens = um?.completion_tokens ?? 0;
  if (!promptTokens && !outputTokens && text.length) { outputTokens = Math.ceil(text.length / 4); promptTokens = 100; }
  return { text, usage: { promptTokens, outputTokens } };
}

async function callGemini(systemText, contents, opts = {}) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxOutputTokens ?? 4096 },
  };
  if (opts.jsonMode) body.generationConfig.responseMimeType = 'application/json';
  const resp = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) {
    const e = await resp.text();
    const msg = `Gemini API error: ${resp.status} ${e.slice(0, 200)}`;
    const unavailable = resp.status === 503 || /UNAVAILABLE|overloaded|high demand|try again later/i.test(e);
    if (unavailable && KIMI_API_KEY) {
      return callGeminiViaOpenRouter(systemText, contents, opts);
    }
    throw new Error(msg);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const um = data?.usageMetadata ?? data?.usage_metadata;
  let promptTokens = um?.promptTokenCount ?? 0, outputTokens = um?.candidatesTokenCount ?? 0;
  if (!promptTokens && !outputTokens && text.length) { outputTokens = Math.ceil(text.length / 4); promptTokens = 100; }
  return { text, usage: { promptTokens, outputTokens } };
}

async function callGeminiViaOpenRouter(systemText, contents, opts = {}) {
  if (!KIMI_API_KEY) throw new Error('OpenRouter key not configured');
  const messages = [
    { role: 'system', content: systemText },
    ...contents.map(c => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c?.parts?.[0]?.text ?? '' })),
  ];

  let lastErr = null;
  for (const model of OPENROUTER_GEMINI_MODELS) {
    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxOutputTokens ?? 4096,
    };
    if (opts.jsonMode) body.response_format = { type: 'json_object' };

    const resp = await fetch(KIMI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const e = await resp.text();
      lastErr = new Error(`OpenRouter Gemini error (${model}): ${resp.status} ${e.slice(0, 200)}`);
      continue;
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const um = data?.usage;
    let promptTokens = um?.prompt_tokens ?? 0;
    let outputTokens = um?.completion_tokens ?? 0;
    if (!promptTokens && !outputTokens && text.length) {
      outputTokens = Math.ceil(text.length / 4);
      promptTokens = 100;
    }
    return { text, usage: { promptTokens, outputTokens } };
  }

  throw lastErr || new Error('OpenRouter Gemini fallback failed');
}

function hasStructure(text) {
  if (!text || text.length < 80) return true;
  return /^#{2,3}\s/m.test(text) || text.includes('\n## ') || /^\s*[-*]\s/m.test(text) || /^\s*\d+[.)]\s/m.test(text);
}

const HISTORY_MAX_MESSAGES = 20;
const HISTORY_KEEP_RECENT = 6;

async function summarizeHistory(msgs, callLLMFn) {
  if (msgs.length <= HISTORY_MAX_MESSAGES) return msgs;
  const toSummarize = msgs.slice(0, msgs.length - HISTORY_KEEP_RECENT);
  const toKeep = msgs.slice(msgs.length - HISTORY_KEEP_RECENT);
  const conversationText = toSummarize.map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${(m.content || '').substring(0, 500)}`).join('\n\n');
  try {
    const { text } = await callLLMFn('You are a conversation summarizer. Summarize concisely, preserving key facts. Output ONLY the summary.', [{ role: 'user', parts: [{ text: conversationText }] }], { temperature: 0.2, maxOutputTokens: 1024 });
    return [{ role: 'user', content: `[Previous conversation summary]\n${text}` }, { role: 'assistant', content: 'I have the context. Let\'s continue.' }, ...toKeep];
  } catch { return msgs.slice(-HISTORY_MAX_MESSAGES); }
}

async function decomposeQuery(query, recentContext, callLLMFn) {
  if (query.length < 15) return [query];
  try {
    const { text } = await callLLMFn(
      'You are a query decomposition engine. Break the question into 3-7 sub-questions. Output ONLY a JSON array of strings.',
      [{ role: 'user', parts: [{ text: `Context:\n${recentContext}\n\nQuestion: ${query}` }] }],
      { temperature: 0.3, maxOutputTokens: 1024, jsonMode: true }
    );
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) { const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/); if (m?.[1]) cleaned = m[1].trim(); }
    const parsed = JSON.parse(cleaned);
    const result = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    const valid = result.filter(q => typeof q === 'string' && q.length > 5);
    return valid.length > 0 ? valid.slice(0, 8) : [query];
  } catch { return [query]; }
}

async function retrieveRelevantSections(subQuestions, idxFiles, callLLMFn) {
  const treeSummaries = idxFiles.map((f, i) => `═══ File [${i}]: ${f.doc?.doc_title || f.name} ═══\n${f.tree}`).join('\n\n');
  const questionsText = subQuestions.map((q, i) => `Q${i + 1}: ${q}`).join('\n');
  try {
    const { text } = await callLLMFn(
      'You are a document section retrieval engine. Select relevant SECTIONS by node_id. Output JSON: {"selections":[{"file_index":0,"node_ids":["0001"],"relevance":"high"}]}. Be generous.',
      [{ role: 'user', parts: [{ text: `Sub-questions:\n${questionsText}\n\nDocument index:\n${treeSummaries}` }] }],
      { temperature: 0.1, maxOutputTokens: 4096, jsonMode: true }
    );
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) { const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/); if (m?.[1]) cleaned = m[1].trim(); }
    const parsed = JSON.parse(cleaned);
    const selections = parsed.selections || parsed;
    if (!Array.isArray(selections)) return [];
    return selections.filter(s => typeof s.file_index === 'number' && Array.isArray(s.node_ids)).map(s => ({
      fileIndex: s.file_index, nodeIds: s.node_ids.filter(id => typeof id === 'string'), score: s.relevance === 'high' ? 3 : s.relevance === 'medium' ? 2 : 1,
    }));
  } catch { return idxFiles.map((_, i) => ({ fileIndex: i, nodeIds: ['root'], score: 1 })); }
}

async function rerankEvidence(candidates, originalQuery, callLLMFn) {
  if (candidates.length <= 5) return candidates.map((_, i) => i);
  const list = candidates.map((c, i) => `[${i}] ${c.fileName}\n${c.text.substring(0, 600)}`).join('\n\n');
  try {
    const { text } = await callLLMFn('Rank passages by relevance. Output ONLY a JSON array of indices.', [{ role: 'user', parts: [{ text: `Question: ${originalQuery}\n\nCandidates:\n${list}` }] }], { temperature: 0.1, maxOutputTokens: 1024, jsonMode: true });
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) { const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/); if (m?.[1]) cleaned = m[1].trim(); }
    const parsed = JSON.parse(cleaned);
    const indices = Array.isArray(parsed) ? parsed : (parsed.ranking || []);
    return indices.filter(i => typeof i === 'number' && i >= 0 && i < candidates.length);
  } catch { return candidates.map((_, i) => i); }
}

function updateKb(kbId, data) {
  const table = getTable('KnowledgeBase');
  const serialized = serializeRow(table, data);
  const cols = Object.keys(serialized);
  if (!cols.length) return;
  const setClause = cols.map(c => `${c} = ?`).join(', ');
  const values = cols.map(c => serialized[c]);
  values.push(kbId);
  db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values);
}

export default async function agentChat(req, res) {
  try {
    const body = req.body;
    const { messages, agent, mode, fileSources = [], isVoiceMessage = false } = body;
    const debugLog = [];
    const processLog = [];
    const pushProcess = (step, data) => processLog.push({ step, _t: Date.now(), ...data });

    const requestedModel = agent?.model != null ? String(agent.model).toLowerCase() : 'kimi';
    const effectiveModel = requestedModel === 'gemini' ? 'gemini' : 'kimi';
    const callLLM = effectiveModel === 'gemini' ? callGemini : callKimi;

    pushProcess('chat_start', { agentName: agent?.name, model: effectiveModel, messagesCount: messages?.length || 0 });

    const systemParts = [];
    systemParts.push(`You are "${agent?.name || 'AI Assistant'}". ${agent?.description || ''}`);
    systemParts.push(`\n${DEFAULT_AGENT_SYSTEM_PROMPT}`);

    const styleReference = await buildStyleReference(agent, req);
    if (styleReference.block) {
      systemParts.push(`\n## Voice & Tone Profile\n${styleReference.block}`);
      pushProcess('style_profile_loaded', { sampleCount: styleReference.sampleCount, hasStylePrompt: !!(agent?.style_prompt || '').trim() });
    }

    const indexedFiles = [];
    const unindexedFiles = [];

    if (agent?.knowledge_base_ids?.length) {
      const kbTable = getTable('KnowledgeBase');
      for (const kbId of agent.knowledge_base_ids) {
        const kbRow = db.prepare(`SELECT * FROM ${kbTable} WHERE id = ?`).get(kbId);
        if (!kbRow) continue;
        const kb = deserializeRow(kbTable, kbRow);
        if (!kb.files?.length) continue;

        const MEDIA_TYPES = ['youtube','tiktok','instagram','twitter','facebook','media','web'];
        const TEXT_TYPES = ['txt','md','csv','json','pdf','js','ts','jsx','tsx','py','rb','go','rs','cpp','c','cs','java','php','swift','kt','html','css','scss','yaml','yml','xml','sh','bash','sql','toml','ini','env','xmind','docx','xlsx','xls','pptx','ppt'];

        for (const file of kb.files) {
          const sourceUrl = getSourceUrl(file);
          const fetchUrl = resolveFetchUrl(sourceUrl, req);
          const hasTree = !!(file.index_tree?.root && Array.isArray(file.index_tree?.paragraphs) && file.index_tree.paragraphs.length > 0);
          if (hasTree) {
            const treeText = formatTreeForRouting(file.index_tree, file.name);
              if (treeText) indexedFiles.push({ name: file.name, tree: treeText, doc: file.index_tree, sourceGuide: file.source_guide || null });
          } else if (MEDIA_TYPES.includes(file.type) && file.inline_text?.trim()) {
            const inlineDoc = buildInlineTranscriptIndex(file.inline_text, file.name);
            const treeText = formatTreeForRouting(inlineDoc, file.name);
              if (treeText) indexedFiles.push({ name: file.name, tree: treeText, doc: inlineDoc, sourceGuide: file.source_guide || null });
          } else if (MEDIA_TYPES.includes(file.type) && sourceUrl && !file.processed) {
            try {
              const liveResult = await fetchTranscriptViaSupadata(fetchUrl, debugLog);
              if (liveResult?.transcript) {
                const inlineDoc = buildInlineTranscriptIndex(liveResult.transcript, liveResult.title || file.name);
                const treeText = formatTreeForRouting(inlineDoc, liveResult.title || file.name);
                if (treeText) indexedFiles.push({ name: liveResult.title || file.name, tree: treeText, doc: inlineDoc, sourceGuide: file.source_guide || null });
                try {
                  const updatedFile = { ...file, name: liveResult.title || file.name, processed: true, inline_text: liveResult.transcript, index_tree: inlineDoc };
                  const updatedFiles = kb.files.map(f => (getSourceUrl(f) === sourceUrl ? updatedFile : f));
                  updateKb(kb.id, { files: updatedFiles, processing: false, index_status: 'succeeded' });
                } catch {}
              }
            } catch {}
          } else if (sourceUrl && TEXT_TYPES.includes(file.type)) {
            unindexedFiles.push({ name: file.name, url: fetchUrl });
          }
        }
      }
    }

    let chatMessages = [...(messages || [])];
    if (chatMessages.length > HISTORY_MAX_MESSAGES) {
      chatMessages = await summarizeHistory(chatMessages, callLLM);
    }

    const lastUserMessage = getLastHumanMessageText(messages);
    let subQuestions = [lastUserMessage];

    if (lastUserMessage.length > 15 && (indexedFiles.length > 0 || unindexedFiles.length > 0)) {
      const recentContext = (messages || []).slice(-4).map(m => `${m.role}: ${(m.content || '').substring(0, 300)}`).join('\n');
      subQuestions = await decomposeQuery(lastUserMessage, recentContext, callLLM);
    }

    let retrievedContext = '';
    const sourcesMap = [];
    let totalIndexedChars = 0;
    for (const f of indexedFiles) {
      if (f.doc?.paragraphs && Array.isArray(f.doc.paragraphs)) for (const p of f.doc.paragraphs) totalIndexedChars += (p || '').length;
    }

    const FULL_CONTEXT_CHAR_LIMIT = effectiveModel === 'gemini' ? 3000000 : 400000;
    const useFullContext = totalIndexedChars < FULL_CONTEXT_CHAR_LIMIT;

    if (useFullContext && (indexedFiles.length > 0 || unindexedFiles.length > 0)) {
      const docParts = [];
      let sourceIdx = 1;
      for (const f of indexedFiles) {
        const paragraphs = f.doc?.paragraphs || [];
        const allText = paragraphs.join('\n\n');
        if (allText.trim()) {
          sourcesMap.push({ index: sourceIdx, name: f.doc?.doc_title || f.name, description: f.doc?.doc_description || f.sourceGuide?.summary || '' });
          docParts.push(`━━━ Source [${sourceIdx}]: ${f.doc?.doc_title || f.name} ━━━\n\n${allText}`);
          sourceIdx++;
        }
      }
      for (const file of unindexedFiles) {
        try {
          const resp = await fetch(file.url);
          if (resp.ok) {
            const text = await resp.text();
            if (text.trim()) {
              const limit = 60000;
              const content = text.length > limit ? text.substring(0, limit) + '\n[...truncated]' : text;
              sourcesMap.push({ index: sourceIdx, name: file.name, description: '' });
              docParts.push(`━━━ Source [${sourceIdx}]: ${file.name} ━━━\n\n${content}`);
              sourceIdx++;
            }
          }
        } catch {}
      }
      if (docParts.length > 0) retrievedContext = docParts.join('\n\n\n');
    } else if (indexedFiles.length > 0 || unindexedFiles.length > 0) {
      const routingResult = await retrieveRelevantSections(subQuestions, indexedFiles, callLLM);
      const candidates = [];
      for (const sel of routingResult) {
        if (sel.fileIndex < 0 || sel.fileIndex >= indexedFiles.length) continue;
        const f = indexedFiles[sel.fileIndex];
        const sectionText = extractSectionText(f.doc, sel.nodeIds);
        if (sectionText.trim()) candidates.push({ fileIndex: sel.fileIndex, fileName: f.doc?.doc_title || f.name, text: sectionText, nodeIds: sel.nodeIds });
      }

      // Hybrid retrieval: add lexical candidates across full documents/source guides.
      const combinedQuery = subQuestions.join(' \n ');
      const lexicalRank = indexedFiles
        .map((f, idx) => ({
          idx,
          score: lexicalScore(combinedQuery, (f.doc?.paragraphs || []).join('\n\n').slice(0, 12000), f.sourceGuide),
        }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      const seenLex = new Set(candidates.map(c => c.fileIndex));
      for (const lx of lexicalRank) {
        if (seenLex.has(lx.idx)) continue;
        const f = indexedFiles[lx.idx];
        const text = (f.doc?.paragraphs || []).slice(0, 40).join('\n\n');
        if (text.trim()) {
          candidates.push({ fileIndex: lx.idx, fileName: f.doc?.doc_title || f.name, text, nodeIds: ['root'] });
          seenLex.add(lx.idx);
        }
      }

      let rankedIndices = candidates.map((_, i) => i);
      if (candidates.length > 8) rankedIndices = await rerankEvidence(candidates, lastUserMessage, callLLM);

      const docParts = [];
      let currentChars = 0, sourceIdx = 1;
      const seenFiles = new Map();
      for (const ri of rankedIndices) {
        const c = candidates[ri];
        if (!c) continue;
        if (currentChars + c.text.length > FULL_CONTEXT_CHAR_LIMIT && docParts.length > 0) break;
        if (!seenFiles.has(c.fileIndex)) {
          const f = indexedFiles[c.fileIndex];
          sourcesMap.push({ index: sourceIdx, name: c.fileName, description: f.doc?.doc_description || '' });
          seenFiles.set(c.fileIndex, sourceIdx);
          docParts.push(`━━━ Source [${sourceIdx}]: ${c.fileName} ━━━\n\n${c.text}`);
          sourceIdx++;
        } else {
          docParts.push(`\n[Additional section from Source [${seenFiles.get(c.fileIndex)}]]\n${c.text}`);
        }
        currentChars += c.text.length;
      }
      if (docParts.length > 0) retrievedContext = docParts.join('\n\n\n');
    }

    if (retrievedContext) {
      const sourcesList = sourcesMap.map(s => `[${s.index}] ${s.name}${s.description ? ` — ${s.description}` : ''}`).join('\n');
      systemParts.push(`\n## Source Documents\nAvailable sources:\n${sourcesList}\n\nINSTRUCTIONS:\n1. Read ALL sources before answering.\n2. Do NOT show citations, source indices, or phrases like "from source/file".\n3. Reply naturally like a human dialogue.\n4. If not found, say so.\n\n${retrievedContext}`);
      if (subQuestions.length > 1) systemParts.push(`\n## Investigation Guide\n${subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
    }

    const notebookMemory = buildNotebookMemory(messages || [], sourcesMap, subQuestions);
    systemParts.push(`\n## Notebook Memory\n${JSON.stringify(notebookMemory, null, 2)}`);
    pushProcess('notebook_memory_built', {
      activeTopicsCount: notebookMemory.active_topics.length,
      usefulSourcesCount: notebookMemory.useful_sources.length,
      turnsConsidered: notebookMemory.turns_considered,
    });

    let toolContext = '';
    const enabledToolNames = new Set((agent?.tools || []).filter(t => t.enabled).map(t => t.name));
    enabledToolNames.add('media_scraper');
    if (enabledToolNames.has('youtube_scraper')) { enabledToolNames.delete('youtube_scraper'); enabledToolNames.add('media_scraper'); }

    const hasMediaTool = enabledToolNames.has('media_scraper');
    if (hasMediaTool) {
      const messageUrls = extractAllMediaUrls(lastUserMessage || '');
      const fileSourceUrls = [];
      for (const fs of (fileSources || [])) {
        const candidates = [fs?.url, fs?.sourceUrl, fs?.originalUrl, fs?.metadata?.url].filter(Boolean);
        for (const candidate of candidates) {
          for (const { platform, regex } of MEDIA_URL_PATTERNS) {
            if (regex.test(candidate)) { fileSourceUrls.push({ url: candidate, platform }); break; }
          }
        }
      }
      const seen = new Set();
      const mediaUrls = [];
      for (const u of [...messageUrls, ...fileSourceUrls]) { if (!seen.has(u.url)) { seen.add(u.url); mediaUrls.push(u); } }

      if (mediaUrls.length > 0) {
        for (const mu of mediaUrls.slice(0, 3)) {
          try {
            const result = await fetchTranscriptViaSupadata(mu.url, debugLog);
            if (!result) throw new Error('No transcript');
            const inlineDoc = buildInlineTranscriptIndex(result.transcript, result.title);
            const treeText = formatTreeForRouting(inlineDoc, result.title);
            if (treeText) indexedFiles.push({ name: result.title, tree: treeText, doc: inlineDoc });
            const snippet = result.transcript.length > 4000 ? result.transcript.slice(0, 4000) + '\n[truncated]' : result.transcript;
            toolContext += `\n\n### Media Scraper result\nURL: ${mu.url}\nTitle: ${result.title}\n\nTranscript:\n${snippet}`;
          } catch (e) {
            toolContext += `\n\n### Media Scraper error\n${mu.url}: ${e.message}`;
          }
        }
      }
    }

    if (toolContext) systemParts.push(`\n## Tool Outputs\n${toolContext}`);
    if (retrievedContext) systemParts.push('\n## Web / General Knowledge\nUse internet ONLY if sources don\'t contain the answer.');

    if (mode === 'thinking') systemParts.push('\n## Response Mode: Deep thinking\nReason internally, then give the RESULT. Concise and structured.');
    else systemParts.push('\n## Response Mode: Instant\nAnswer directly. Minimum viable response.');

    if (agent?.system_instructions) systemParts.push(`\n## Creator instructions\n${agent.system_instructions}`);
    systemParts.push(`\n${FINAL_ENFORCEMENT}`);

    const systemInstruction = systemParts.join('\n');
    const geminiContents = chatMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    const llmStartTime = Date.now();
    const llmRes = await callLLM(systemInstruction, geminiContents, {
      temperature: mode === 'thinking' ? 0.7 : 0.9,
      maxOutputTokens: mode === 'thinking' ? 8192 : 2048,
    });
    let responseText = llmRes.text;
    let totalPromptTokens = llmRes.usage?.promptTokens ?? 0;
    let totalOutputTokens = llmRes.usage?.outputTokens ?? 0;

    if (mode === 'thinking' && responseText && !hasStructure(responseText)) {
      const retrySystem = systemInstruction + '\n\n[REVIEWER] Your reply lacked structure. Use ## headings and lists.';
      const retryRes = await callLLM(retrySystem, geminiContents, { temperature: 0.6, maxOutputTokens: 8192 });
      responseText = retryRes.text;
      totalPromptTokens += retryRes.usage?.promptTokens ?? 0;
      totalOutputTokens += retryRes.usage?.outputTokens ?? 0;
    }

    // Enforce chat-style output: hide inline citation markers if model emits them.
    responseText = stripCitationTags(responseText);

    const cost = effectiveModel === 'gemini'
      ? (totalPromptTokens / 1e6) * GEMINI_INPUT_COST_PER_1M + (totalOutputTokens / 1e6) * GEMINI_OUTPUT_COST_PER_1M
      : (totalPromptTokens / 1e6) * KIMI_INPUT_COST_PER_1M + (totalOutputTokens / 1e6) * KIMI_OUTPUT_COST_PER_1M;

    pushProcess('response_done', { model: effectiveModel, promptTokens: totalPromptTokens, outputTokens: totalOutputTokens, cost: Math.round(cost * 1e8) / 1e8, durationMs: Date.now() - llmStartTime });

    const citationSpans = alignCitationsToSpans(responseText, indexedFiles, sourcesMap);
    pushProcess('citation_alignment_done', { spans: citationSpans.length });

    res.json({
      response: responseText || 'I couldn\'t generate a response. Please try again.',
      cost: Math.round(cost * 1e8) / 1e8,
      citations: undefined,
      citation_spans: citationSpans,
      notebook_memory: notebookMemory,
      debug: debugLog,
      processLog,
    });
  } catch (error) {
    console.error('agentChat error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
