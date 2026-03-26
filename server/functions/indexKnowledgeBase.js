import { db, deserializeRow, serializeRow, getTable } from '../db.js';
import { createRequire } from 'module';
import { createHash } from 'crypto';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_MODEL = 'moonshotai/kimi-k2.5';
const KIMI_URL = 'https://openrouter.ai/api/v1/chat/completions';
const KIMI_INPUT_COST_PER_1M = 0.45;
const KIMI_OUTPUT_COST_PER_1M = 2.20;

const MAX_PARAGRAPHS_PER_CHUNK = 120;
const MAX_CHARS_PER_CHUNK = 50000;
const MAX_PARAGRAPH_LENGTH = 4000;
const PREMIUM_PARALLEL_CHUNKS = 2;
const PREMIUM_MIN_CHARS_FOR_PLAIN_TEXT = 10000;

const INDEXABLE_TYPES = [
  'txt','md','csv','json','pdf',
  'js','ts','jsx','tsx','py','rb','go','rs','cpp','c','cs',
  'java','php','swift','kt','html','css','scss',
  'yaml','yml','xml','sh','bash','sql','toml','ini','env',
  'xmind','docx','xlsx','xls','pptx','ppt',
  'youtube','tiktok','instagram','twitter','facebook','media','web',
];

const SUPADATA_API_KEY = 'sd_8ca36aab85b68983db4fcddfc3298d5d';
const SUPADATA_BASE = 'https://api.supadata.ai/v1';
const MEDIA_FILE_TYPES = ['youtube','tiktok','instagram','twitter','facebook','media'];
const ACTIVE_KB_RUNS = new Set();

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

function hashText(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function buildFileFingerprint(file, sourceUrl, text) {
  if (text && text.length > 0) return hashText(text);
  const meta = `${file?.name || ''}|${file?.type || ''}|${file?.size || 0}|${sourceUrl || ''}`;
  return hashText(meta);
}

function detectPlatformFromUrl(url) {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/instagram\.com/.test(u)) return 'instagram';
  if (/(?:twitter\.com|x\.com)\//.test(u)) return 'twitter';
  if (/facebook\.com|fb\.com|fb\.watch/.test(u)) return 'facebook';
  return 'media';
}

async function fetchSupadataTranscript(url, logDebug) {
  if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY is not configured');
  const t0 = Date.now();
  const platform = detectPlatformFromUrl(url);
  logDebug(JSON.stringify({ step: 'supadata_start', url, platform }));

  let title = `${platform} video`;
  try {
    const metaRes = await fetch(`${SUPADATA_BASE}/metadata?url=${encodeURIComponent(url)}`, {
      headers: { 'x-api-key': SUPADATA_API_KEY },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      title = meta.title || meta.description?.slice(0, 100) || title;
      logDebug(JSON.stringify({ step: 'supadata_metadata_ok', title: title.slice(0, 80) }));
    }
  } catch (e) {
    logDebug(JSON.stringify({ step: 'supadata_metadata_error', error: e.message }));
  }

  try {
    const tUrl = `${SUPADATA_BASE}/transcript?url=${encodeURIComponent(url)}&text=true&mode=auto`;
    const res = await fetch(tUrl, { headers: { 'x-api-key': SUPADATA_API_KEY } });

    if (res.status === 202) {
      const { jobId } = await res.json();
      logDebug(JSON.stringify({ step: 'supadata_transcript_async', jobId }));
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const pollRes = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, {
          headers: { 'x-api-key': SUPADATA_API_KEY },
        });
        if (!pollRes.ok) return null;
        const job = await pollRes.json();
        if (job.status === 'completed') {
          const text = typeof job.content === 'string' ? job.content : '';
          if (text.length > 0) {
            logDebug(JSON.stringify({ step: 'supadata_transcript_ok', chars: text.length, ms: Date.now() - t0 }));
            return { title, transcript: text, platform };
          }
          return null;
        }
        if (job.status === 'failed') return null;
      }
      return null;
    }

    if (!res.ok) return null;
    const data = await res.json();
    const text = typeof data.content === 'string' ? data.content : '';
    if (text.length > 0) {
      logDebug(JSON.stringify({ step: 'supadata_transcript_ok', chars: text.length, ms: Date.now() - t0 }));
      return { title, transcript: text, platform };
    }
    return null;
  } catch (e) {
    logDebug(JSON.stringify({ step: 'supadata_transcript_error', error: e.message }));
    return null;
  }
}

async function fetchSupadataWebScrape(url, logDebug) {
  if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY is not configured');
  try {
    const res = await fetch(`${SUPADATA_BASE}/web/scrape?url=${encodeURIComponent(url)}`, {
      headers: { 'x-api-key': SUPADATA_API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.name || data.description || url, content: data.content || '' };
  } catch {
    return null;
  }
}

async function parseXMindFile(arrayBuf, logDebug) {
  try {
    const zip = await JSZip.loadAsync(arrayBuf);
    let contentFile = zip.file('content.json') || zip.file('metadata/content.json');
    if (contentFile) {
      const raw = await contentFile.async('string');
      const data = JSON.parse(raw);
      const lines = [];
      const sheets = Array.isArray(data) ? data : [data];
      for (const sheet of sheets) {
        const rootTopic = sheet.rootTopic || sheet.root || sheet;
        if (rootTopic) walkXMindTopic(rootTopic, 0, lines);
      }
      if (lines.length > 0) return lines.join('\n');
    }
    const xmlFile = zip.file('content.xml');
    if (xmlFile) {
      const xmlText = await xmlFile.async('string');
      const titles = [];
      const regex = /<title[^>]*>([\s\S]*?)<\/title>/gi;
      let m;
      while ((m = regex.exec(xmlText)) !== null) {
        const t = m[1].replace(/<[^>]+>/g, '').trim();
        if (t) titles.push(t);
      }
      if (titles.length > 0) return titles.join('\n');
    }
    return '[XMind file: could not extract readable content]';
  } catch (e) {
    return `[XMind parse error: ${e.message}]`;
  }
}

function walkXMindTopic(topic, depth, lines) {
  if (!topic) return;
  const indent = '  '.repeat(depth);
  const title = topic.title || topic.name || topic.text || '';
  if (title) lines.push(`${indent}${title}`);
  if (topic.notes?.plain?.content) lines.push(`${indent}  [Note: ${topic.notes.plain.content}]`);
  if (topic.labels && Array.isArray(topic.labels)) {
    for (const label of topic.labels) {
      if (typeof label === 'string' && label.trim()) lines.push(`${indent}  [Label: ${label}]`);
    }
  }
  const children = topic.children?.attached || topic.children?.detached || topic.children || topic.topics || topic.subTopics || [];
  const childArray = Array.isArray(children) ? children : [];
  for (const child of childArray) walkXMindTopic(child, depth + 1, lines);
}

async function parseDocxFile(arrayBuf, logDebug) {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuf) });
    return result.value || '';
  } catch (e) {
    return `[DOCX parse error: ${e.message}]`;
  }
}

async function parseXlsxFile(arrayBuf, logDebug) {
  try {
    const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: 'array' });
    const parts = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      parts.push(`## Sheet: ${sheetName}`);
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) parts.push(csv.trim());
    }
    return parts.join('\n\n') || '';
  } catch (e) {
    return `[XLSX parse error: ${e.message}]`;
  }
}

async function parsePptxFile(arrayBuf, logDebug) {
  try {
    const zip = await JSZip.loadAsync(arrayBuf);
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
        return na - nb;
      });
    if (slideFiles.length === 0) return '[PPTX file: no slides found]';
    const parts = [];
    for (const slidePath of slideFiles) {
      const slideNum = slidePath.match(/slide(\d+)/i)?.[1] || '?';
      const xml = await zip.files[slidePath].async('string');
      const texts = [];
      const regex = /<a:t>([\s\S]*?)<\/a:t>/gi;
      let m;
      while ((m = regex.exec(xml)) !== null) {
        const t = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        if (t) texts.push(t);
      }
      if (texts.length > 0) parts.push(`## Slide ${slideNum}\n${texts.join(' ')}`);
    }
    return parts.join('\n\n') || '[PPTX file: no text content found]';
  } catch (e) {
    return `[PPTX parse error: ${e.message}]`;
  }
}

async function parsePdfFile(arrayBuf, logDebug) {
  try {
    const pdfData = await pdf(Buffer.from(arrayBuf));
    return pdfData.text || '';
  } catch (e) {
    return `[PDF parse error: ${e.message}]`;
  }
}

function getFileType(f) {
  const t = (f.type || '').toLowerCase().trim();
  if (t && INDEXABLE_TYPES.includes(t)) return t;
  const ext = (f.name || '').split('.').pop()?.toLowerCase() || '';
  return INDEXABLE_TYPES.includes(ext) ? ext : '';
}

function smartSplitText(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  let paragraphs = normalized.split(/\n{2,}/).filter(p => p.trim().length > 0);
  if (paragraphs.length <= 3 || paragraphs.some(p => p.length > MAX_PARAGRAPH_LENGTH * 2)) {
    paragraphs = normalized.split(/\n/).filter(p => p.trim().length > 0);
  }
  const result = [];
  for (const p of paragraphs) {
    if (p.length <= MAX_PARAGRAPH_LENGTH) {
      result.push(p);
    } else {
      const sentences = p.split(/(?<=[.!?])\s+/);
      let buf = '';
      for (const s of sentences) {
        if (buf.length + s.length + 1 > MAX_PARAGRAPH_LENGTH && buf.length > 0) {
          result.push(buf);
          buf = s;
        } else {
          buf = buf ? buf + ' ' + s : s;
        }
      }
      if (buf.length > 0) {
        if (buf.length > MAX_PARAGRAPH_LENGTH) {
          for (let i = 0; i < buf.length; i += MAX_PARAGRAPH_LENGTH) {
            result.push(buf.slice(i, i + MAX_PARAGRAPH_LENGTH));
          }
        } else {
          result.push(buf);
        }
      }
    }
  }
  return result;
}

function splitParagraphsIntoChunks(paragraphs) {
  const chunks = [];
  let start = 0;
  while (start < paragraphs.length) {
    let charCount = 0, count = 0, end = start;
    while (end < paragraphs.length && count < MAX_PARAGRAPHS_PER_CHUNK && charCount + paragraphs[end].length <= MAX_CHARS_PER_CHUNK) {
      charCount += paragraphs[end].length;
      count += 1;
      end += 1;
    }
    if (end === start) end = start + 1;
    chunks.push({ start, end });
    start = end;
  }
  return chunks;
}

function addParagraphOffsetToNode(node, offset) {
  node.start_index += offset;
  node.end_index += offset;
  if (node.nodes?.length) for (const child of node.nodes) addParagraphOffsetToNode(child, offset);
}

function renumberNodes(nodes) {
  let counter = 0;
  function walk(list) {
    for (const node of list) {
      node.node_id = String(counter).padStart(4, '0');
      counter++;
      if (node.nodes?.length) walk(node.nodes);
    }
  }
  walk(nodes);
}

const SYSTEM_PROMPT = `You are a document indexing engine that builds hierarchical tree structures from documents for retrieval.

You will receive the FULL document text with each paragraph tagged as <paragraph_N>.

Analyze the natural structure and output JSON with section hierarchy.

Output format:
{
  "doc_title": "Document title",
  "doc_description": "1-2 sentence overview of the entire document",
  "structure": [
    {
      "title": "Section name (extracted from document headings/structure)",
      "node_id": "0000",
      "start_index": 0,
      "end_index": 5,
      "summary": "1-2 sentence summary of what this section covers",
      "nodes": [
        {
          "title": "Subsection name",
          "node_id": "0001",
          "start_index": 0,
          "end_index": 2,
          "summary": "What this subsection covers",
          "nodes": []
        }
      ]
    }
  ]
}

Rules:
- Output ONLY valid JSON (no markdown, no extra text).
- start_index/end_index are 0-based paragraph indices.
- node_ids must be sequential: "0000", "0001", ...
- Parent ranges must include child ranges.
- Cover the whole document with nodes.
- Keep summaries short (1-2 sentences).
- Use real headings when present, otherwise concise descriptive titles.`;

async function buildPageIndexForText(text, fileName, logDebug) {
  if (!KIMI_API_KEY) return { doc: null, cost: 0 };
  if (!text || text.trim().length === 0) return { doc: null, cost: 0 };

  const paragraphs = smartSplitText(text);
  if (paragraphs.length === 0) return { doc: null, cost: 0 };

  const taggedText = paragraphs.map((p, i) => `<paragraph_${i}>\n${p}\n</paragraph_${i}>`).join('\n\n');
  const userPrompt = `Document name: ${fileName}\nTotal paragraphs: ${paragraphs.length}\n\n${taggedText}`;

  const body = {
    model: KIMI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  };

  logDebug(`[AI] Calling Kimi API... (Prompt chars: ${userPrompt.length})`);
  const startTime = Date.now();
  const resp = await fetch(KIMI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    logDebug(`[AI] Request failed: Kimi API error ${resp.status}: ${errText}`);
    return { doc: null, cost: 0 };
  }
  const data = await resp.json();
  logDebug(`[AI] Received API response in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  const um = data?.usage;
  let promptTokens = 0, outputTokens = 0;
  if (um && typeof um === 'object') {
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
      0;
  }

  let textOut = data?.choices?.[0]?.message?.content || '';
  if (promptTokens === 0 && outputTokens === 0) {
    promptTokens = Math.max(100, Math.ceil(userPrompt.length / 4));
    outputTokens = textOut ? Math.max(50, Math.ceil(textOut.length / 4)) : 50;
  }
  const cost = (promptTokens / 1e6) * KIMI_INPUT_COST_PER_1M + (outputTokens / 1e6) * KIMI_OUTPUT_COST_PER_1M;

  if (!textOut) return { doc: null, cost };

  textOut = textOut.trim();
  if (textOut.startsWith('```')) {
    const match = textOut.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) textOut = match[1].trim();
  }

  try {
    const parsed = JSON.parse(textOut);
    let structure = null, docTitle = fileName, docDescription = '';

    if (parsed.structure && Array.isArray(parsed.structure)) {
      structure = parsed.structure;
      docTitle = parsed.doc_title || fileName;
      docDescription = parsed.doc_description || '';
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
      structure = parsed;
    } else if (parsed.root) {
      structure = parsed.root.nodes || [parsed.root];
      docTitle = parsed.doc_title || fileName;
      docDescription = parsed.doc_description || '';
    }

    if (!structure || structure.length === 0) return { doc: null, cost };

    renumberNodes(structure);
    const doc = {
      doc_title: docTitle,
      doc_description: docDescription,
      paragraphs,
      root: { title: docTitle, node_id: 'root', start_index: 0, end_index: paragraphs.length - 1, summary: docDescription, nodes: structure },
    };
    return { doc, cost };
  } catch {
    return { doc: null, cost };
  }
}

async function buildPageIndexWithChunking(text, fileName, logDebug) {
  const paragraphs = smartSplitText(text || '');
  if (paragraphs.length === 0) return { doc: null, cost: 0 };

  const totalChars = paragraphs.join('').length;
  if (paragraphs.length <= MAX_PARAGRAPHS_PER_CHUNK && totalChars <= MAX_CHARS_PER_CHUNK) {
    return buildPageIndexForText(text, fileName, logDebug);
  }

  const chunks = splitParagraphsIntoChunks(paragraphs);
  const mergedNodes = [];
  let docTitle = fileName, docDescription = '', totalCost = 0;

  const results = new Array(chunks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const idx = cursor++;
      const { start, end } = chunks[idx];
      const chunkText = paragraphs.slice(start, end).join('\n\n');
      const chunkResult = await buildPageIndexForText(chunkText, `${fileName} (Part ${idx + 1})`, logDebug);
      results[idx] = { idx, start, end, chunkText, chunkResult };
    }
  }
  await Promise.all(Array.from({ length: Math.min(PREMIUM_PARALLEL_CHUNKS, chunks.length) }, () => worker()));

  for (const r of results) {
    if (!r) continue;
    const { start, chunkText, chunkResult } = r;
    totalCost += chunkResult.cost;
    if (chunkResult.doc?.root?.nodes?.length) {
      docTitle = chunkResult.doc.doc_title;
      if (chunkResult.doc.doc_description) docDescription = chunkResult.doc.doc_description;
      for (const node of chunkResult.doc.root.nodes) {
        addParagraphOffsetToNode(node, start);
        mergedNodes.push(node);
      }
    } else {
      const fallback = buildFallbackTree(chunkText, fileName);
      for (const node of fallback.root.nodes || []) {
        addParagraphOffsetToNode(node, start);
        mergedNodes.push(node);
      }
    }
  }

  renumberNodes(mergedNodes);
  return {
    doc: {
      doc_title: docTitle,
      doc_description: docDescription || fileName,
      paragraphs,
      root: { title: docTitle, node_id: 'root', start_index: 0, end_index: paragraphs.length - 1, summary: docDescription || docTitle, nodes: mergedNodes },
    },
    cost: totalCost,
  };
}

function buildFallbackTree(text, fileName) {
  const paragraphs = smartSplitText(text || '');
  if (paragraphs.length === 0) {
    return { doc_title: fileName, doc_description: fileName, paragraphs: [], root: { title: fileName, node_id: '0000', start_index: 0, end_index: 0, summary: fileName, nodes: [] } };
  }
  const summary = paragraphs.slice(0, 10).join(' ').trim().slice(0, 500);
  const sectionCount = Math.min(5, paragraphs.length);
  const sectionSize = Math.max(1, Math.ceil(paragraphs.length / sectionCount));
  const sections = [];
  for (let i = 0; i < paragraphs.length; i += sectionSize) {
    const end = Math.min(i + sectionSize - 1, paragraphs.length - 1);
    sections.push({
      title: `Section ${sections.length + 1}`,
      node_id: String(sections.length + 1).padStart(4, '0'),
      start_index: i,
      end_index: end,
      summary: paragraphs.slice(i, end + 1).join(' ').trim().slice(0, 300),
      nodes: [],
    });
  }
  return {
    doc_title: fileName,
    doc_description: summary,
    paragraphs,
    root: { title: fileName, node_id: '0000', start_index: 0, end_index: paragraphs.length - 1, summary: summary || fileName, nodes: sections },
  };
}

function buildSourceGuide(text, fileName, indexDoc) {
  const content = String(text || '').trim();
  const lower = content.toLowerCase();
  const stop = new Set([
    'the','and','for','that','with','this','from','are','was','were','have','has','had','you','your',
    'they','them','their','или','это','как','что','для','она','они','его','её','also','into','about',
    'can','not','but','или','або','так','якщо','щоб','був','була','було','при','без','над','під',
  ]);
  const words = lower.match(/[a-zа-яіїєґ0-9_#@-]{3,}/gi) || [];
  const freq = new Map();
  for (const w of words) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k);

  const paragraphs = Array.isArray(indexDoc?.paragraphs) ? indexDoc.paragraphs : smartSplitText(content).slice(0, 80);
  const topics = [];
  const topNodes = Array.isArray(indexDoc?.root?.nodes) ? indexDoc.root.nodes : [];
  for (const n of topNodes.slice(0, 8)) {
    if (n?.title) topics.push(String(n.title));
  }
  const summary = (indexDoc?.doc_description || paragraphs.slice(0, 3).join(' ').slice(0, 500) || fileName || '').trim();

  const entities = [];
  const entityRegex = /\b([A-Z][a-zA-Z0-9_]{2,}(?:\s+[A-Z][a-zA-Z0-9_]{2,})?)\b/g;
  let m;
  const seen = new Set();
  while ((m = entityRegex.exec(content)) !== null && entities.length < 20) {
    const v = m[1].trim();
    if (!seen.has(v)) {
      seen.add(v);
      entities.push(v);
    }
  }

  return {
    version: 1,
    source_name: fileName,
    summary,
    topics,
    keywords,
    entities,
    paragraph_count: paragraphs.length,
    char_count: content.length,
    generated_at: new Date().toISOString(),
  };
}

function updateKb(kbId, data) {
  const table = getTable('KnowledgeBase');
  const serialized = serializeRow(table, data);
  const cols = Object.keys(serialized);
  if (cols.length === 0) return;
  const setClause = cols.map(c => `${c} = ?`).join(', ');
  const values = cols.map(c => serialized[c]);
  values.push(kbId);
  db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values);
}

function recordIndexingCost(kbName, dollars) {
  if (dollars <= 0) return;
  try {
    db.prepare('INSERT INTO messages (conversation_id, role, content, cost, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?)').run(
      '__kb_indexing__', 'assistant', `Knowledge Base indexing: ${kbName}`,
      Math.round(dollars * 1e8) / 1e8, new Date().toISOString(), new Date().toISOString()
    );
  } catch (e) {
    console.error('KB cost record error:', e);
  }
}

async function runPremiumEnhancement({ kbId, candidates, logPrefix = '[PREMIUM]' }) {
  if (!KIMI_API_KEY || !Array.isArray(candidates) || candidates.length === 0) return;
  const table = getTable('KnowledgeBase');
  for (const c of candidates) {
    try {
      const kbRow = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(kbId);
      if (!kbRow) break;
      const kb = deserializeRow(table, kbRow);
      const files = Array.isArray(kb.files) ? [...kb.files] : [];
      const current = files[c.fileIndex];
      if (!current) continue;
      if (current.index_fingerprint !== c.fingerprint) continue;
      if (current.index_quality === 'premium') continue;

      const aiResult = await buildPageIndexWithChunking(c.text, current.name || c.fileName, () => {});
      if (!aiResult?.doc) continue;

      const sourceGuide = buildSourceGuide(c.text, current.name || c.fileName, aiResult.doc);
      files[c.fileIndex] = {
        ...current,
        processed: true,
        index_tree: aiResult.doc,
        doc_description: aiResult.doc.doc_description || '',
        source_guide: sourceGuide,
        index_quality: 'premium',
        index_upgrade_pending: false,
      };
      const progress = 100;
      const payload = serializeRow(table, {
        files,
        processing: false,
        index_status: 'succeeded',
        index_progress: progress,
      });
      const cols = Object.keys(payload);
      if (cols.length > 0) {
        const setClause = cols.map(k => `${k} = ?`).join(', ');
        const values = cols.map(k => payload[k]);
        values.push(kbId);
        db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values);
      }
      console.log(`${logPrefix} Upgraded file to premium: ${current.name || c.fileName}`);
    } catch (e) {
      console.error(`${logPrefix} candidate error:`, e?.message || e);
    }
  }
}

export default async function indexKnowledgeBase(req, res) {
  let kbId = null;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const debugLogs = [];
  const logDebug = (msg) => {
    const tagged = `[run:${runId}] ${msg}`;
    console.log(tagged);
    debugLogs.push(tagged);
    if (kbId) {
      try { updateKb(kbId, { debug_logs: debugLogs }); } catch {}
    }
  };

  try {
    debugLogs.push(JSON.stringify({ step: 'function_invoked', _t: Date.now(), v: '2.0-local' }));

    const { kbId: bodyKbId, expectedFileCount, expectedPendingCount, filesSnapshot } = req.body;
    kbId = bodyKbId;
    if (!kbId) return res.status(400).json({ error: 'kbId is required', debug: debugLogs });

    if (ACTIVE_KB_RUNS.has(String(kbId))) {
      const msg = `Index already running for kbId=${kbId}, skipping duplicate invoke`;
      logDebug(msg);
      return res.json({ ok: true, indexed: false, skipped: true, reason: 'already_running', debug: debugLogs });
    }
    ACTIVE_KB_RUNS.add(String(kbId));

    const table = getTable('KnowledgeBase');
    let kbRow = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(kbId);
    if (!kbRow) return res.status(404).json({ error: 'Knowledge base not found', debug: debugLogs });

    let kb = deserializeRow(table, kbRow);
    let files = kb.files || [];
    logDebug(JSON.stringify({ step: 'kb_loaded', kbId, totalFiles: files.length }));

    const hasBuiltTree = (f) => !!(f.index_tree?.root && Array.isArray(f.index_tree?.paragraphs) && f.index_tree.paragraphs.length > 0);
    const isIndexableFile = (f) => {
      const type = getFileType(f);
      return (getSourceUrl(f) || typeof f.inline_text === 'string') && type && INDEXABLE_TYPES.includes(type);
    };
    const countPendingFiles = (list) => list.filter(f => isIndexableFile(f) && !hasBuiltTree(f)).length;

    const snap = Array.isArray(filesSnapshot) ? filesSnapshot : null;
    if (snap && snap.length > 0) {
      const snapshotPending = countPendingFiles(snap);
      const dbPending = countPendingFiles(files);
      if (snap.length > files.length || snapshotPending > dbPending ||
        (expectedFileCount > 0 && snap.length >= expectedFileCount) ||
        (expectedPendingCount > 0 && snapshotPending >= expectedPendingCount)) {
        files = snap;
        logDebug(`[KB_DEBUG] Using client filesSnapshot`);
      }
    }

    let indexableFiles = files.filter(isIndexableFile);
    let pendingFiles = indexableFiles.filter(f => !hasBuiltTree(f));

    let syncAttempt = 0;
    while (syncAttempt < 6 && ((expectedFileCount > 0 && files.length < expectedFileCount) || (expectedPendingCount > 0 && pendingFiles.length < expectedPendingCount))) {
      syncAttempt++;
      await new Promise(r => setTimeout(r, 1200));
      kbRow = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(kbId);
      if (kbRow) {
        kb = deserializeRow(table, kbRow);
        files = kb.files || [];
        indexableFiles = files.filter(isIndexableFile);
        pendingFiles = indexableFiles.filter(f => !hasBuiltTree(f));
      }
    }

    if (pendingFiles.length === 0) {
      updateKb(kbId, { processing: false, index_status: 'succeeded', index_progress: 100, last_error: '' });
      return res.json({ ok: true, indexed: false, debug: debugLogs });
    }

    updateKb(kbId, { processing: true, index_status: 'indexing', index_progress: 0, last_error: '' });

    const updatedFiles = [...files];
    let indexed = false, completed = 0, totalKbCost = 0;
    const errors = [];
    const totalToProcess = pendingFiles.length;
    const premiumCandidates = [];

    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i];
      const fileType = getFileType(file);
      const sourceUrl = getSourceUrl(file);
      const fetchUrl = resolveFetchUrl(sourceUrl, req);
      if ((!sourceUrl && typeof file.inline_text !== 'string') || !fileType || !INDEXABLE_TYPES.includes(fileType)) continue;
      if (hasBuiltTree(file)) continue;

      try {
        logDebug(`[KB_DEBUG] Start processing file "${file.name}"...`);
        let text;

        if (MEDIA_FILE_TYPES.includes(fileType) && sourceUrl) {
          const mediaResult = await fetchSupadataTranscript(fetchUrl, logDebug);
          if (mediaResult && mediaResult.transcript.length > 0) {
            text = mediaResult.transcript;
            updatedFiles[i] = { ...updatedFiles[i], name: mediaResult.title || file.name, inline_text: text };
          } else {
            throw new Error(`Could not fetch transcript for ${sourceUrl}`);
          }
        } else if (fileType === 'web' && sourceUrl) {
          const webResult = await fetchSupadataWebScrape(fetchUrl, logDebug);
          if (webResult && webResult.content.length > 0) {
            text = webResult.content;
            updatedFiles[i] = { ...updatedFiles[i], name: webResult.title || file.name, inline_text: text };
          } else {
            throw new Error(`Could not scrape content from ${sourceUrl}`);
          }
        } else if (typeof file.inline_text === 'string' && file.inline_text.trim().length > 0) {
          text = file.inline_text;
        } else {
          const fileResp = await fetch(fetchUrl);
          if (!fileResp.ok) throw new Error(`HTTP ${fileResp.status} fetching ${file.name}`);

          const BINARY_TYPES = ['pdf','xmind','docx','xlsx','xls','pptx','ppt'];
          if (BINARY_TYPES.includes(fileType)) {
            const arrayBuf = await fileResp.arrayBuffer();
            if (fileType === 'pdf') text = await parsePdfFile(arrayBuf, logDebug);
            else if (fileType === 'xmind') text = await parseXMindFile(arrayBuf, logDebug);
            else if (fileType === 'docx') text = await parseDocxFile(arrayBuf, logDebug);
            else if (fileType === 'xlsx' || fileType === 'xls') text = await parseXlsxFile(arrayBuf, logDebug);
            else if (fileType === 'pptx' || fileType === 'ppt') text = await parsePptxFile(arrayBuf, logDebug);
            else text = '';
          } else {
            text = await fileResp.text();
          }
        }

        const sourceUrlForFingerprint = getSourceUrl(file);
        const fingerprint = buildFileFingerprint(file, sourceUrlForFingerprint, text);
        const sameFingerprint = !!(file.index_fingerprint && file.index_fingerprint === fingerprint);
        const hasTreeNow = hasBuiltTree(file);
        const qualityNow = file.index_quality || '';
        if (sameFingerprint && hasTreeNow && qualityNow === 'premium') {
          logDebug(`[KB_DEBUG] Skip unchanged premium file by fingerprint: "${file.name}"`);
          completed++;
          continue;
        }
        if (sameFingerprint && hasTreeNow && qualityNow === 'basic') {
          logDebug(`[KB_DEBUG] File unchanged but only basic index exists. Queue premium upgrade: "${file.name}"`);
          premiumCandidates.push({ fileIndex: i, fileName: file.name, text: (file.inline_text || text || ''), fingerprint });
          completed++;
          continue;
        }

        // FAST PHASE: basic index immediately to keep UX fast.
        const finalDoc = buildFallbackTree(text, file.name);
        const isPlainText = ['txt', 'md', 'csv'].includes(String(fileType || '').toLowerCase());
        const shouldSkipPremium = isPlainText && String(text || '').length < PREMIUM_MIN_CHARS_FOR_PLAIN_TEXT;
        if (!shouldSkipPremium) {
          premiumCandidates.push({ fileIndex: i, fileName: file.name, text, fingerprint });
        }

        const sourceGuide = buildSourceGuide(text, file.name, finalDoc);
        updatedFiles[i] = {
          ...updatedFiles[i],
          processed: true,
          index_tree: finalDoc,
          doc_description: finalDoc.doc_description || '',
          source_guide: sourceGuide,
          index_fingerprint: fingerprint,
          index_quality: 'basic',
          index_upgrade_pending: !!(KIMI_API_KEY && KIMI_API_KEY.trim() !== '' && !shouldSkipPremium),
        };
        indexed = true;
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`);
        // Do not mark file as processed on failure, otherwise UI reports false success.
        updatedFiles[i] = { ...file, processed: false, index_tree: null, doc_description: `Error: ${e.message}` };
      }

      completed++;
      const progress = Math.round((completed / totalToProcess) * 100);
      updateKb(kbId, {
        files: updatedFiles,
        processing: completed < totalToProcess,
        index_status: completed < totalToProcess ? 'indexing' : 'succeeded',
        index_progress: progress,
        last_error: errors.length > 0 ? errors.join('; ') : '',
      });
    }

    if (totalKbCost > 0) recordIndexingCost(kb.name || 'KB', totalKbCost);

    const finalFailed = errors.length > 0;
    updateKb(kbId, {
      files: updatedFiles,
      processing: false,
      index_status: finalFailed ? 'failed' : 'succeeded',
      index_progress: finalFailed ? 0 : 100,
      last_error: finalFailed ? errors.join('; ') : '',
    });
    // Fire-and-forget premium refinement in background.
    if (!finalFailed && premiumCandidates.length > 0) {
      setTimeout(() => {
        runPremiumEnhancement({ kbId, candidates: premiumCandidates }).catch((e) => {
          console.error('[PREMIUM] background run failed:', e?.message || e);
        });
      }, 100);
    }
    res.json({
      ok: !finalFailed,
      indexed,
      cost: totalKbCost,
      debug: debugLogs,
      mode: finalFailed ? 'failed' : 'basic_fast',
      premium_queued: !finalFailed && premiumCandidates.length > 0,
      error: finalFailed ? errors.join('; ') : undefined,
    });
  } catch (error) {
    console.error('indexKnowledgeBase fatal:', error.message);
    if (kbId) {
      try {
        debugLogs.push(JSON.stringify({ step: 'index_failed', error: error.message }));
        updateKb(kbId, { processing: false, index_status: 'failed', index_progress: 0, last_error: error.message, debug_logs: debugLogs });
      } catch {}
    }
    res.status(500).json({ error: error.message, debug: debugLogs });
  } finally {
    if (kbId) ACTIVE_KB_RUNS.delete(String(kbId));
  }
}
