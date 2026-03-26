import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import pdf from 'npm:pdf-parse/lib/pdf-parse.js';
import JSZip from 'npm:jszip@3.10.1';
import mammoth from 'npm:mammoth@1.8.0';
import * as XLSX from 'npm:xlsx@0.18.5';

// ─── KB indexing: always Kimi K2.5 (OpenRouter). No Gemini used here. ─────────
const KIMI_API_KEY =
  Deno.env.get("KIMI_API_KEY") ||
  Deno.env.get("OPENROUTER_API_KEY") ||
  Deno.env.get("KIMI_K2_5") ||
  Deno.env.get("KIMI_K2.5") ||
  Deno.env.get("kimi-k2.5") ||
  "";
const KIMI_MODEL = "moonshotai/kimi-k2.5";
const KIMI_URL = "https://openrouter.ai/api/v1/chat/completions";
const KIMI_INPUT_COST_PER_1M = 0.45;
const KIMI_OUTPUT_COST_PER_1M = 2.20;

const MAX_PARAGRAPHS_PER_CHUNK = 120;
const MAX_CHARS_PER_CHUNK = 50000;
const MAX_PARAGRAPH_LENGTH = 4000;

const INDEXABLE_TYPES = [
  "txt", "md", "csv", "json", "pdf",
  "js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "cpp", "c", "cs",
  "java", "php", "swift", "kt", "html", "css", "scss",
  "yaml", "yml", "xml", "sh", "bash", "sql", "toml", "ini", "env",
  "xmind", "docx", "xlsx", "xls", "pptx", "ppt",
  "youtube",
];

// ─── XMind parser: .xmind files are ZIP archives with content.json ────────────
async function parseXMindFile(arrayBuf: ArrayBuffer, logDebug: (msg: string) => void): Promise<string> {
  logDebug(`[XMIND] Loading ZIP archive...`);
  try {
    const zip = await JSZip.loadAsync(arrayBuf);

    // XMind 8+ format: content.json at root
    let contentFile = zip.file("content.json");
    // XMind Zen format: may also have metadata/content.json
    if (!contentFile) contentFile = zip.file("metadata/content.json");

    if (contentFile) {
      logDebug(`[XMIND] Found content.json, extracting text...`);
      const raw = await contentFile.async("string");
      const data = JSON.parse(raw);
      const lines: string[] = [];

      // content.json is an array of sheets
      const sheets = Array.isArray(data) ? data : [data];
      for (const sheet of sheets) {
        const rootTopic = sheet.rootTopic || sheet.root || sheet;
        if (rootTopic) {
          walkXMindTopic(rootTopic, 0, lines);
        }
      }

      const finalTxt = lines.join("\n");
      logDebug(`[XMIND] Extracted ${lines.length} lines of text (${finalTxt.length} chars)`);
      if (lines.length > 0) return finalTxt;
    }

    logDebug(`[XMIND] content.json not found, falling back to older formats...`);
    // Fallback: older XMind format with content.xml
    const xmlFile = zip.file("content.xml");
    if (xmlFile) {
      const xmlText = await xmlFile.async("string");
      // Extract all <title>...</title> tags from the XML
      const titles: string[] = [];
      const regex = /<title[^>]*>([\s\S]*?)<\/title>/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(xmlText)) !== null) {
        const t = m[1].replace(/<[^>]+>/g, "").trim();
        if (t) titles.push(t);
      }
      const finalTxt = titles.join("\n");
      logDebug(`[XMIND] Extracted ${titles.length} lines from XML fallback (${finalTxt.length} chars)`);
      if (titles.length > 0) return finalTxt;
    }

    logDebug(`[XMIND] content.xml not found, attempting heuristic scan of all JSON files...`);
    // Last resort: try to find ANY .json file in the ZIP
    const jsonFiles = Object.keys(zip.files).filter(n => n.endsWith(".json") && !zip.files[n].dir);
    for (const name of jsonFiles) {
      try {
        const raw = await zip.files[name].async("string");
        const data = JSON.parse(raw);
        const lines: string[] = [];
        walkXMindTopic(data, 0, lines);
        if (lines.length > 0) return lines.join("\n");
      } catch { /* try next */ }
    }

    logDebug(`[XMIND] Error: Could not extract readable text from archive.`);
    return "[XMind file: could not extract readable content]";
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logDebug(`[XMIND] Parsing failed: ${err}`);
    console.error("XMind parse error:", err);
    return `[XMind parse error: ${err}]`;
  }
}

function walkXMindTopic(topic: any, depth: number, lines: string[]): void {
  if (!topic) return;
  const indent = "  ".repeat(depth);
  const title = topic.title || topic.name || topic.text || "";
  if (title) {
    lines.push(`${indent}${title}`);
  }
  // XMind stores notes/labels
  if (topic.notes?.plain?.content) {
    lines.push(`${indent}  [Note: ${topic.notes.plain.content}]`);
  }
  if (topic.labels && Array.isArray(topic.labels)) {
    for (const label of topic.labels) {
      if (typeof label === "string" && label.trim()) {
        lines.push(`${indent}  [Label: ${label}]`);
      }
    }
  }
  // Recurse into children (various field names used by different XMind versions)
  const children =
    topic.children?.attached ||
    topic.children?.detached ||
    topic.children ||
    topic.topics ||
    topic.subTopics ||
    [];
  const childArray = Array.isArray(children) ? children : [];
  for (const child of childArray) {
    walkXMindTopic(child, depth + 1, lines);
  }
}

// ─── DOCX parser: uses mammoth to extract raw text ────────────────────────────
async function parseDocxFile(arrayBuf: ArrayBuffer, logDebug: (msg: string) => void): Promise<string> {
  logDebug(`[DOCX] Starting mammoth extraction...`);
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuf) });
    logDebug(`[DOCX] Extraction complete. Length: ${result.value?.length || 0} chars`);
    return result.value || "";
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logDebug(`[DOCX] Extraction failed: ${err}`);
    console.error("DOCX parse error:", err);
    return `[DOCX parse error: ${err}]`;
  }
}

// ─── XLSX/XLS parser: converts each sheet to CSV-like text ────────────────────
async function parseXlsxFile(arrayBuf: ArrayBuffer, logDebug: (msg: string) => void): Promise<string> {
  logDebug(`[XLSX] Loading workbook into SheetJS...`);
  try {
    const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
    logDebug(`[XLSX] Found ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(", ")}`);
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      logDebug(`[XLSX] Processing sheet: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      parts.push(`## Sheet: ${sheetName}`);
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) parts.push(csv.trim());
    }
    const finalTxt = parts.join("\n\n") || "";
    logDebug(`[XLSX] Extraction complete. Length: ${finalTxt.length} chars`);
    return finalTxt;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logDebug(`[XLSX] Parsing failed: ${err}`);
    console.error("XLSX parse error:", err);
    return `[XLSX parse error: ${err}]`;
  }
}

// ─── PPTX parser: extracts text from slide XML files inside the ZIP ───────────
async function parsePptxFile(arrayBuf: ArrayBuffer, logDebug: (msg: string) => void): Promise<string> {
  logDebug(`[PPTX] Loading ZIP archive...`);
  try {
    const zip = await JSZip.loadAsync(arrayBuf);
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)/i)?.[1] || "0");
        const nb = parseInt(b.match(/slide(\d+)/i)?.[1] || "0");
        return na - nb;
      });

    logDebug(`[PPTX] Found ${slideFiles.length} slide(s)`);

    if (slideFiles.length === 0) {
      logDebug(`[PPTX] No slides found in archive`);
      return "[PPTX file: no slides found]";
    }

    const parts: string[] = [];
    for (const slidePath of slideFiles) {
      const slideNum = slidePath.match(/slide(\d+)/i)?.[1] || "?";
      logDebug(`[PPTX] Extracting text from Slide ${slideNum}...`);
      const xml = await zip.files[slidePath].async("string");
      // Extract all <a:t>...</a:t> text runs from the slide XML
      const texts: string[] = [];
      const regex = /<a:t>([\s\S]*?)<\/a:t>/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(xml)) !== null) {
        const t = m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        if (t) texts.push(t);
      }
      if (texts.length > 0) {
        parts.push(`## Slide ${slideNum}\n${texts.join(" ")}`);
      }
    }
    const finalTxt = parts.join("\n\n") || "[PPTX file: no text content found]";
    logDebug(`[PPTX] Parsing complete. Length: ${finalTxt.length} chars`);
    return finalTxt;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logDebug(`[PPTX] Parsing failed: ${err}`);
    console.error("PPTX parse error:", err);
    return `[PPTX parse error: ${err}]`;
  }
}

// ─── Hardened PDF parser with proper error handling ────────────────────────────
async function parsePdfFile(arrayBuf: ArrayBuffer, logDebug: (msg: string) => void): Promise<string> {
  logDebug(`[PDF] Init pdf-parse library...`);
  try {
    const pdfData = await pdf(Buffer.from(arrayBuf));
    logDebug(`[PDF] Extraction successful. Length: ${pdfData.text?.length || 0} chars`);
    return pdfData.text || "";
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logDebug(`[PDF] Fatal error parsing pdf: ${err}`);
    console.error("PDF parse error:", err);
    // Return partial info instead of crashing
    return `[PDF parse error: ${err}. The file may be corrupted, password-protected, or use unsupported PDF features.]`;
  }
}

function getFileType(f: { type?: string; name?: string }): string {
  const t = (f.type || "").toLowerCase().trim();
  if (t && INDEXABLE_TYPES.includes(t)) return t;
  const ext = (f.name || "").split(".").pop()?.toLowerCase() || "";
  return INDEXABLE_TYPES.includes(ext) ? ext : "";
}

async function recordIndexingCost(base44: any, kbName: string, dollars: number): Promise<void> {
  if (dollars <= 0) return;
  try {
    await base44.asServiceRole.entities.Message.create({
      conversation_id: "__kb_indexing__",
      role: "assistant",
      content: `Knowledge Base indexing: ${kbName}`,
      cost: Math.round(dollars * 1e8) / 1e8,
    });
  } catch (e) {
    console.error("KB cost record error:", e);
  }
}

type PageIndexNode = {
  title: string;
  node_id: string;
  start_index: number;
  end_index: number;
  summary?: string;
  nodes?: PageIndexNode[];
};

type PageIndexDocument = {
  doc_title: string;
  doc_description: string;
  root: PageIndexNode;
  paragraphs: string[];
};

const SYSTEM_PROMPT = `You are a document indexing engine that builds hierarchical tree structures from documents — like an intelligent table of contents optimized for retrieval.

You will receive the FULL document text with each paragraph tagged as <paragraph_N>.

Your job: analyze the document's natural logical structure and output a JSON object with a hierarchical tree that reflects how a human expert would navigate this document.

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
- Output ONLY valid JSON. No markdown fences, no explanation text.
- "start_index" / "end_index" are 0-based paragraph indices matching the <paragraph_N> tags.
- Use sequential node_ids: "0000", "0001", "0002", etc. (depth-first order).
- Build a HIERARCHICAL tree reflecting the document's actual structure (sections, subsections, sub-subsections).
- A parent's range must encompass all its children's ranges.
- Every paragraph in the document must be covered by at least one node's range.
- Keep summaries to 1-2 sentences — they should help a retrieval system decide whether this section contains the answer to a query.
- Extract titles from the document's actual headings where possible. If a section has no clear heading, create a descriptive title.
- Create as many levels of nesting as the document naturally has — don't flatten a deep structure, don't artificially nest a flat one.`;

function smartSplitText(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n");

  let paragraphs = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 3 || paragraphs.some((p) => p.length > MAX_PARAGRAPH_LENGTH * 2)) {
    paragraphs = normalized.split(/\n/).filter((p) => p.trim().length > 0);
  }

  const result: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= MAX_PARAGRAPH_LENGTH) {
      result.push(p);
    } else {
      const sentences = p.split(/(?<=[.!?])\s+/);
      let buf = "";
      for (const s of sentences) {
        if (buf.length + s.length + 1 > MAX_PARAGRAPH_LENGTH && buf.length > 0) {
          result.push(buf);
          buf = s;
        } else {
          buf = buf ? buf + " " + s : s;
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

function splitParagraphsIntoChunks(paragraphs: string[]): { start: number; end: number }[] {
  const chunks: { start: number; end: number }[] = [];
  let start = 0;
  while (start < paragraphs.length) {
    let charCount = 0;
    let count = 0;
    let end = start;
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

function addParagraphOffsetToNode(node: PageIndexNode, offset: number): void {
  node.start_index += offset;
  node.end_index += offset;
  if (node.nodes && node.nodes.length > 0) {
    for (const child of node.nodes) addParagraphOffsetToNode(child, offset);
  }
}

async function buildPageIndexForText(
  text: string,
  fileName: string,
  logDebug: (msg: string) => void
): Promise<{ doc: PageIndexDocument | null; cost: number }> {
  logDebug(`[AI] Checking API requirements for "${fileName}"...`);
  if (!KIMI_API_KEY) {
    const err = "No Kimi API key configured";
    logDebug(`[AI] Error: ${err}`);
    console.error(err);
    return { doc: null, cost: 0 };
  }

  if (!text || text.trim().length === 0) {
    return { doc: null, cost: 0 };
  }

  const paragraphs = smartSplitText(text);

  if (paragraphs.length === 0) return { doc: null, cost: 0 };

  const taggedText = paragraphs
    .map((p, i) => `<paragraph_${i}>\n${p}\n</paragraph_${i}>`)
    .join("\n\n");

  const userPrompt = `Document name: ${fileName}\nTotal paragraphs: ${paragraphs.length}\n\n${taggedText}`;

  const body = {
    model: KIMI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 16384,
    response_format: { type: "json_object" },
  };

  logDebug(`[AI] Calling OpenRouter Kimi API... (Prompt chars: ${userPrompt.length})`);
  const startTime = Date.now();
  const resp = await fetch(KIMI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const errMsg = `Kimi API error ${resp.status}: ${errText}`;
    logDebug(`[AI] Request failed: ${errMsg}`);
    console.error(errMsg);
    return { doc: null, cost: 0 };
  }

  const durationStr = ((Date.now() - startTime) / 1000).toFixed(1);
  logDebug(`[AI] Received API response in ${durationStr}s`);

  const data = await resp.json();

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

  const finishReason = data?.choices?.[0]?.finish_reason;
  let textOut: string | undefined = data?.choices?.[0]?.message?.content;

  if (promptTokens === 0 && outputTokens === 0) {
    promptTokens = Math.max(100, Math.ceil(userPrompt.length / 4));
    outputTokens = textOut ? Math.max(50, Math.ceil(textOut.length / 4)) : 50;
  }
  logDebug(`[AI] Tokens: Input=${promptTokens}, Output=${outputTokens}`);
  const cost =
    (promptTokens / 1e6) * KIMI_INPUT_COST_PER_1M +
    (outputTokens / 1e6) * KIMI_OUTPUT_COST_PER_1M;

  if (!textOut) {
    logDebug(`[AI] Error: Empty response (finishReason: ${finishReason || "unknown"})`);
    console.error(`Kimi returned empty response (finishReason: ${finishReason || "unknown"})`);
    return { doc: null, cost };
  }

  textOut = textOut.trim();
  if (textOut.startsWith("```")) {
    const match = textOut.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) textOut = match[1].trim();
  }

  try {
    const parsed = JSON.parse(textOut);

    let structure: PageIndexNode[] | null = null;
    let docTitle = fileName;
    let docDescription = "";

    if (parsed.structure && Array.isArray(parsed.structure)) {
      structure = parsed.structure;
      docTitle = parsed.doc_title || fileName;
      docDescription = parsed.doc_description || "";
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
      structure = parsed;
    } else if (parsed.root) {
      structure = parsed.root.nodes || [parsed.root];
      docTitle = parsed.doc_title || fileName;
      docDescription = parsed.doc_description || "";
    }

    if (!structure || structure.length === 0) {
      console.error("Kimi returned valid JSON but no recognizable tree structure");
      return { doc: null, cost };
    }

    renumberNodes(structure);

    const doc: PageIndexDocument = {
      doc_title: docTitle,
      doc_description: docDescription,
      paragraphs,
      root: {
        title: docTitle,
        node_id: "root",
        start_index: 0,
        end_index: paragraphs.length - 1,
        summary: docDescription,
        nodes: structure,
      },
    };
    logDebug(`[AI] Successfully mapped tree with ${structure.length} top-level nodes for "${fileName}". (Cost: $${cost.toFixed(4)})`);
    return { doc, cost };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logDebug(`[AI] Failed to parse generated tree: ${err}`);
    console.error("Failed to parse Kimi JSON:", err);
    return { doc: null, cost };
  }
}

/** Build PageIndex for large docs by chunking; small docs go to buildPageIndexForText once. */
async function buildPageIndexWithChunking(
  text: string,
  fileName: string,
  logDebug: (msg: string) => void
): Promise<{ doc: PageIndexDocument | null; cost: number }> {
  logDebug(`[Chunker] Splitting document "${fileName}" into paragraphs...`);
  const paragraphs = smartSplitText(text || "");
  if (paragraphs.length === 0) {
    logDebug(`[Chunker] Empty document, nothing to process.`);
    return { doc: null, cost: 0 };
  }

  const totalChars = paragraphs.join("").length;
  const useChunking = paragraphs.length > MAX_PARAGRAPHS_PER_CHUNK || totalChars > MAX_CHARS_PER_CHUNK;

  if (!useChunking) {
    logDebug(`[Chunker] Document small enough (Ch: ${totalChars}, P: ${paragraphs.length}), processing directly.`);
    return buildPageIndexForText(text, fileName, logDebug);
  }

  logDebug(`[Chunker] Document is large (Ch: ${totalChars}, P: ${paragraphs.length}). Chunking required.`);
  const chunks = splitParagraphsIntoChunks(paragraphs);
  logDebug(`[Chunker] Split into ${chunks.length} manageable parts.`);
  const mergedNodes: PageIndexNode[] = [];
  let docTitle = fileName;
  let docDescription = "";
  let totalCost = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const { start, end } = chunks[idx];
    logDebug(`[Chunker] Processing part ${idx + 1}/${chunks.length} [paragraphs ${start}..${end - 1}]...`);
    const chunkParagraphs = paragraphs.slice(start, end);
    const chunkText = chunkParagraphs.join("\n\n");
    const chunkResult = await buildPageIndexForText(chunkText, `${fileName} (Part ${idx + 1})`, logDebug);
    totalCost += chunkResult.cost;
    const chunkDoc = chunkResult.doc;
    if (!chunkDoc?.root?.nodes?.length) {
      logDebug(`[Chunker] WARNING: AI returned invalid tree for part ${idx + 1}, using fallback flat index.`);
      const fallback = buildFallbackTree(chunkText, fileName);
      for (const node of fallback.root.nodes || []) {
        addParagraphOffsetToNode(node, start);
        mergedNodes.push(node);
      }
      if (!docDescription && fallback.doc_description) docDescription = fallback.doc_description;
    } else {
      logDebug(`[Chunker] Part ${idx + 1} indexed successfully.`);
      docTitle = chunkDoc.doc_title;
      if (chunkDoc.doc_description) docDescription = chunkDoc.doc_description;
      for (const node of chunkDoc.root.nodes) {
        addParagraphOffsetToNode(node, start);
        mergedNodes.push(node);
      }
    }
  }

  logDebug(`[Chunker] All parts processed, merging nodes into single unified tree...`);
  renumberNodes(mergedNodes);

  const doc: PageIndexDocument = {
    doc_title: docTitle,
    doc_description: docDescription || fileName,
    paragraphs,
    root: {
      title: docTitle,
      node_id: "root",
      start_index: 0,
      end_index: paragraphs.length - 1,
      summary: docDescription || docTitle,
      nodes: mergedNodes,
    },
  };
  return { doc, cost: totalCost };
}

function renumberNodes(nodes: PageIndexNode[]) {
  let counter = 0;
  function walk(list: PageIndexNode[]) {
    for (const node of list) {
      node.node_id = String(counter).padStart(4, "0");
      counter++;
      if (node.nodes && node.nodes.length > 0) {
        walk(node.nodes);
      }
    }
  }
  walk(nodes);
}

function buildFallbackTree(text: string, fileName: string, logDebug?: (msg: string) => void): PageIndexDocument {
  if (logDebug) logDebug(`[Fallback] Building basic flat index for "${fileName}"...`);
  const paragraphs = smartSplitText(text || "");

  if (paragraphs.length === 0) {
    if (logDebug) logDebug(`[Fallback] Document is empty.`);
    return {
      doc_title: fileName,
      doc_description: fileName,
      paragraphs: [],
      root: {
        title: fileName,
        node_id: "0000",
        start_index: 0,
        end_index: 0,
        summary: fileName,
        nodes: [],
      },
    };
  }

  const summary = paragraphs.slice(0, 10).join(" ").trim().slice(0, 500);
  const sectionCount = Math.min(5, paragraphs.length);
  const sectionSize = Math.max(1, Math.ceil(paragraphs.length / sectionCount));
  const sections: PageIndexNode[] = [];

  if (logDebug) logDebug(`[Fallback] Creating ${sectionCount} generic sections...`);
  for (let i = 0; i < paragraphs.length; i += sectionSize) {
    const end = Math.min(i + sectionSize - 1, paragraphs.length - 1);
    const sectionSummary = paragraphs.slice(i, end + 1).join(" ").trim().slice(0, 300);
    sections.push({
      title: `Section ${sections.length + 1}`,
      node_id: String(sections.length + 1).padStart(4, "0"),
      start_index: i,
      end_index: end,
      summary: sectionSummary,
      nodes: [],
    });
  }

  if (logDebug) logDebug(`[Fallback] Generated flat index with ${paragraphs.length} paragraphs in ${sections.length} sections.`);
  return {
    doc_title: fileName,
    doc_description: summary,
    paragraphs,
    root: {
      title: fileName,
      node_id: "0000",
      start_index: 0,
      end_index: paragraphs.length - 1,
      summary: summary || fileName,
      nodes: sections,
    },
  };
}

// ─── YouTube transcript fetching ──────────────────────────────────────────────

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]+)/,
  /(?:youtu\.be\/)([\w-]+)/,
  /(?:youtube\.com\/embed\/)([\w-]+)/,
  /(?:youtube\.com\/shorts\/)([\w-]+)/,
];

function extractYouTubeVideoId(url: string): string | null {
  for (const p of YT_PATTERNS) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function fetchYouTubeTranscriptForIndexing(url: string, logDebug: (msg: string) => void): Promise<{ title: string; transcript: string } | null> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    logDebug(JSON.stringify({ step: "yt_extract_id_failed", url, error: "no video ID found" }));
    return null;
  }

  logDebug(JSON.stringify({ step: "yt_start", videoId, url }));
  const t0 = Date.now();
  const RAPIDAPI_KEY = "6ef971ddbamsh4130c4842bf63f0p184c8cjsn3f5385bf53c6";

  // ── Method 1: RapidAPI ──
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const apiUrl = `https://youtube-transcripts.p.rapidapi.com/youtube/transcript?url=${encodeURIComponent(videoUrl)}&chunkSize=500&text=false&lang=en`;
    logDebug(JSON.stringify({ step: "yt_rapidapi_call", videoId, apiUrl }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "x-rapidapi-host": "youtube-transcripts.p.rapidapi.com",
        "x-rapidapi-key": RAPIDAPI_KEY,
        "Content-Type": "application/json",
      },
    });
    clearTimeout(timer);

    logDebug(JSON.stringify({ step: "yt_rapidapi_response", status: res.status, ok: res.ok, ms: Date.now() - t0 }));

    if (res.ok) {
      const raw = await res.text();
      logDebug(JSON.stringify({ step: "yt_rapidapi_body", bodyLength: raw.length, preview: raw.slice(0, 200) }));
      let json: any;
      try { json = JSON.parse(raw); } catch { json = null; }
      if (json) {
        const segments = Array.isArray(json) ? json : (json?.content || json?.transcript || json?.data || []);
        if (Array.isArray(segments) && segments.length > 0) {
          const text = segments.map((s: any) => s.text || s.snippet || "").filter(Boolean).join(" ").trim();
          if (text.length > 50) {
            logDebug(JSON.stringify({ step: "yt_rapidapi_ok", chars: text.length, ms: Date.now() - t0 }));
            return { title: json?.title || `YouTube: ${videoId}`, transcript: text };
          }
          logDebug(JSON.stringify({ step: "yt_rapidapi_short", textLength: text.length }));
        } else {
          logDebug(JSON.stringify({ step: "yt_rapidapi_no_segments", jsonKeys: Object.keys(json || {}) }));
        }
      }
    }
  } catch (e) {
    logDebug(JSON.stringify({ step: "yt_rapidapi_error", error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }));
  }

  // ── Method 2: TubeText ──
  try {
    const apiUrl = `https://tubetext.vercel.app/youtube/transcript?video_id=${videoId}`;
    logDebug(JSON.stringify({ step: "yt_tubetext_call", apiUrl }));
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 10000);
    const apiRes = await fetch(apiUrl, { signal: controller2.signal, headers: { "User-Agent": "LumenAgents/1.0" } });
    clearTimeout(timer2);
    logDebug(JSON.stringify({ step: "yt_tubetext_response", status: apiRes.status, ms: Date.now() - t0 }));
    if (apiRes.ok) {
      const json: any = await apiRes.json();
      const fullText = json?.success && json.data && typeof json.data.full_text === "string" ? json.data.full_text.trim() : "";
      if (fullText.length > 50) {
        logDebug(JSON.stringify({ step: "yt_tubetext_ok", chars: fullText.length, ms: Date.now() - t0 }));
        return { title: json.data.details?.title || `YouTube: ${videoId}`, transcript: fullText };
      }
      logDebug(JSON.stringify({ step: "yt_tubetext_empty", textLength: fullText.length }));
    }
  } catch (e) {
    logDebug(JSON.stringify({ step: "yt_tubetext_error", error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }));
  }

  // ── Method 3: HTML scraping ──
  try {
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    logDebug(JSON.stringify({ step: "yt_html_call", pageUrl }));
    const controller3 = new AbortController();
    const timer3 = setTimeout(() => controller3.abort(), 12000);
    const res = await fetch(pageUrl, {
      signal: controller3.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" },
    });
    clearTimeout(timer3);
    const html = await res.text();
    logDebug(JSON.stringify({ step: "yt_html_fetched", htmlLength: html.length, ms: Date.now() - t0 }));
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : `YouTube: ${videoId}`;
    const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
    if (captionMatch) {
      const tracks = JSON.parse(captionMatch[1]);
      logDebug(JSON.stringify({ step: "yt_html_tracks", trackCount: tracks.length }));
      if (tracks.length > 0) {
        const controller4 = new AbortController();
        const timer4 = setTimeout(() => controller4.abort(), 8000);
        const captionRes = await fetch(tracks[0].baseUrl, { signal: controller4.signal });
        clearTimeout(timer4);
        const captionXml = await captionRes.text();
        const texts: string[] = [];
        const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
        let m2: RegExpExecArray | null;
        while ((m2 = regex.exec(captionXml)) !== null) {
          const cleaned = m2[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
          if (cleaned) texts.push(cleaned);
        }
        const fullText = texts.join(" ");
        if (fullText.length > 50) {
          logDebug(JSON.stringify({ step: "yt_html_ok", chars: fullText.length, ms: Date.now() - t0 }));
          return { title, transcript: fullText };
        }
        logDebug(JSON.stringify({ step: "yt_html_short", textLength: fullText.length }));
      }
    } else {
      logDebug(JSON.stringify({ step: "yt_html_no_captions", ms: Date.now() - t0 }));
    }
  } catch (e) {
    logDebug(JSON.stringify({ step: "yt_html_error", error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }));
  }

  logDebug(JSON.stringify({ step: "yt_all_failed", videoId, totalMs: Date.now() - t0 }));
  return null;
}

// ─── Deno serve ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let kbId: string | null = null;
  let base44: any = null;
  const debugLogs: string[] = [];
  const logDebug = (msg: string) => {
    console.log(msg);
    debugLogs.push(msg);
    if (base44 && kbId) {
      base44.asServiceRole.entities.KnowledgeBase.update(kbId, {
        debug_logs: [...debugLogs]
      }).catch(() => {});
    }
  };
  /** Emit a structured step as JSON for System Status (client shows full payload). */
  const logStepStructured = (step: string, data: Record<string, unknown>) => {
    const entry = JSON.stringify({ step, _t: Date.now(), ...data });
    debugLogs.push(entry);
    console.log(entry);
    if (base44 && kbId) {
      base44.asServiceRole.entities.KnowledgeBase.update(kbId, {
        debug_logs: [...debugLogs]
      }).catch(() => {});
    }
  };

  try {
    debugLogs.push(JSON.stringify({ step: "function_invoked", _t: Date.now(), v: "1.3" }));
    console.log("[indexKnowledgeBase] function invoked v1.3");

    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      debugLogs.push(JSON.stringify({ step: "auth_failed", _t: Date.now() }));
      return Response.json({ error: "Unauthorized", debug: debugLogs }, { status: 401 });
    }
    debugLogs.push(JSON.stringify({ step: "auth_ok", user: user.email || "unknown", _t: Date.now() }));

    if (!KIMI_API_KEY || KIMI_API_KEY.trim() === "") {
      console.warn("indexKnowledgeBase: KIMI_API_KEY not set — LLM-based indexing unavailable, but light indexing (text extraction, YouTube) will still work");
      debugLogs.push(JSON.stringify({ step: "warn_no_kimi_key", _t: Date.now() }));
    }

    const body = await req.json();
    kbId = body.kbId;
    debugLogs.push(JSON.stringify({ step: "got_kbId", kbId, _t: Date.now() }));
    if (!kbId || typeof kbId !== "string") {
      return Response.json({ error: "kbId is required", debug: debugLogs }, { status: 400 });
    }

    // Flush initial logs to KB so the frontend can see the function is running
    await base44.asServiceRole.entities.KnowledgeBase.update(kbId, { debug_logs: [...debugLogs] }).catch(() => {});

    const kbList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
    if (!kbList?.length) {
      return Response.json({ error: "Knowledge base not found", debug: debugLogs }, { status: 404 });
    }

    let kb = kbList[0];
    let files = kb.files || [];
    debugLogs.push(JSON.stringify({ step: "kb_loaded", kbId, kbName: kb.name, totalFiles: files.length, fileDetails: files.map((f: any) => ({ name: f.name, type: f.type, url: f.url?.slice(0, 80), processed: f.processed, hasInlineText: typeof f.inline_text === "string" })), _t: Date.now() }));
    await base44.asServiceRole.entities.KnowledgeBase.update(kbId, { debug_logs: [...debugLogs] }).catch(() => {});

    let indexableFiles = files.filter((f: any) => {
      const type = getFileType(f);
      const isIndexable = (f.url || typeof f.inline_text === "string") && type && INDEXABLE_TYPES.includes(type);
      logDebug(`[KB_DEBUG] File check: name="${f.name}", type="${f.type}", derivedType="${type}", hasUrl=${!!f.url}, typeof inline_text="${typeof f.inline_text}", processed=${f.processed}, isIndexable=${isIndexable}`);
      return isIndexable;
    });

    // Retry once if no indexable files found (might be DB lag)
    if (indexableFiles.length === 0) {
      logDebug(`[KB_DEBUG] No indexable files found initially. Waiting 1.5s for DB sync...`);
      await new Promise(r => setTimeout(r, 1500));
      const retryList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
      if (retryList?.length) {
        kb = retryList[0];
        files = kb.files || [];
        indexableFiles = files.filter((f: any) => {
          const type = getFileType(f);
          const isIndexable = (f.url || typeof f.inline_text === "string") && type && INDEXABLE_TYPES.includes(type);
          logDebug(`[KB_DEBUG] Retry File check: name="${f.name}", type="${f.type}", derivedType="${type}", hasUrl=${!!f.url}, typeof inline_text="${typeof f.inline_text}", processed=${f.processed}, isIndexable=${isIndexable}`);
          return isIndexable;
        });
      }
    }

    logDebug(`[KB_DEBUG] kbId=${kbId}, total files=${files.length}, indexableFiles=${indexableFiles.length}`);

    if (indexableFiles.length === 0) {
      logStepStructured("index_skip", { kbId, reason: "no_indexable_files", totalFiles: files.length });
      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        processing: false,
        index_status: "succeeded",
        index_progress: 100,
        last_error: "",
      });
      return Response.json({ ok: true, indexed: false, debug: debugLogs });
    }

    logStepStructured("index_start", {
      kbId,
      kbName: kb.name,
      totalFiles: files.length,
      indexableCount: indexableFiles.length,
      status: "indexing",
    });
    await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
      processing: true,
      index_status: "indexing",
      index_progress: 0,
      last_error: "",
    });

    const updatedFiles = [...files];
    let indexed = false;
    let completed = 0;
    const errors: string[] = [];
    let totalKbCost = 0;

    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i];
      const fileType = getFileType(file);
      
      if ((!file.url && typeof file.inline_text !== "string") || !fileType || !INDEXABLE_TYPES.includes(fileType)) {
        logDebug(`[KB_DEBUG] Skipping file "${file.name}" because it lacks url/inline_text or has invalid fileType=${fileType}`);
        continue;
      }
      if (file.processed && file.index_tree?.root && Array.isArray(file.index_tree?.paragraphs) && file.index_tree.paragraphs.length > 0) {
        logDebug(`[KB_DEBUG] Skipping file "${file.name}" because it is already processed.`);
        completed += 1;
        continue;
      }

      try {
        logStepStructured("file_start", { fileName: file.name, fileIndex: i, fileType, totalFiles: updatedFiles.length });
        logDebug(`[KB_DEBUG] Start processing file "${file.name}"...`);
        let text: string;

        if (fileType === "youtube" && file.url) {
          logDebug(`[KB_DEBUG] YouTube source detected, fetching transcript for "${file.url}"...`);
          const ytResult = await fetchYouTubeTranscriptForIndexing(file.url, logDebug);
          if (ytResult && ytResult.transcript.length > 0) {
            text = ytResult.transcript;
            updatedFiles[i] = { ...updatedFiles[i], name: ytResult.title || file.name, inline_text: text };
            logStepStructured("file_fetched", { fileName: file.name, source: "youtube_transcript", textLength: text.length });
          } else {
            throw new Error(`Could not fetch YouTube transcript for ${file.url}`);
          }
        } else if (typeof file.inline_text === "string" && file.inline_text.trim().length > 0) {
          logDebug(`[KB_DEBUG] Using inline_text for "${file.name}" (${file.inline_text.length} chars)`);
          text = file.inline_text;
          logStepStructured("file_fetched", { fileName: file.name, source: "inline_text", textLength: text?.length });
        } else {
          logDebug(`[KB_DEBUG] Fetching URL for "${file.name}": ${file.url}`);
          const fileResp = await fetch(file.url);
          if (!fileResp.ok) {
            throw new Error(`HTTP ${fileResp.status} fetching ${file.name}`);
          }

          const BINARY_TYPES = ["pdf", "xmind", "docx", "xlsx", "xls", "pptx", "ppt"];
          if (BINARY_TYPES.includes(fileType)) {
            const arrayBuf = await fileResp.arrayBuffer();

            if (fileType === "pdf") {
              text = await parsePdfFile(arrayBuf, logDebug);
            } else if (fileType === "xmind") {
              text = await parseXMindFile(arrayBuf, logDebug);
            } else if (fileType === "docx") {
              text = await parseDocxFile(arrayBuf, logDebug);
            } else if (fileType === "xlsx" || fileType === "xls") {
              text = await parseXlsxFile(arrayBuf, logDebug);
            } else if (fileType === "pptx" || fileType === "ppt") {
              text = await parsePptxFile(arrayBuf, logDebug);
            } else {
              text = "";
            }
          } else {
            text = await fileResp.text();
          }
          logStepStructured("file_fetched", { fileName: file.name, source: "url", textLength: text?.length, ok: true });
        }

        let finalDoc: PageIndexDocument;
        if (KIMI_API_KEY && KIMI_API_KEY.trim() !== "") {
          logDebug(`[AI] LLM-powered indexing enabled for "${file.name}"...`);
          const aiResult = await buildPageIndexWithChunking(text, file.name, logDebug);
          totalKbCost += aiResult.cost;
          if (aiResult.doc) {
            finalDoc = aiResult.doc;
            logStepStructured("file_ai_indexed", {
              fileName: file.name,
              topNodes: aiResult.doc.root?.nodes?.length ?? 0,
              paragraphs: aiResult.doc.paragraphs?.length ?? 0,
              cost: aiResult.cost,
            });
          } else {
            logDebug(`[AI] LLM indexing failed for "${file.name}", falling back to light indexing.`);
            finalDoc = buildFallbackTree(text, file.name, logDebug);
          }
        } else {
          finalDoc = buildFallbackTree(text, file.name, logDebug);
        }

        const paragraphsCount = finalDoc?.paragraphs?.length ?? 0;
        const topLevelNodes = (finalDoc?.root?.nodes?.length) ?? 0;
        const usedAI = KIMI_API_KEY && KIMI_API_KEY.trim() !== "" && finalDoc.doc_description !== file.name;
        logStepStructured("file_indexed", {
          fileName: file.name,
          processed: true,
          paragraphs: paragraphsCount,
          topLevelNodes,
          cost: usedAI ? totalKbCost : 0,
          mode: usedAI ? "ai_hierarchical" : "light_extraction",
        });
        logDebug(`[KB_DEBUG] Finished parsing & indexing "${file.name}". Saving to DB...`);
        updatedFiles[i] = {
          ...updatedFiles[i],
          processed: true,
          index_tree: finalDoc,
          doc_description: finalDoc.doc_description || "",
        };
        indexed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`File "${file.name}" indexing error: ${msg}`);
        errors.push(`${file.name}: ${msg}`);
        logStepStructured("file_error", { fileName: file.name, error: msg, processed: false });

        updatedFiles[i] = {
          ...file,
          processed: true,
          index_tree: buildFallbackTree("", file.name),
          doc_description: `Error during indexing: ${msg}`,
        };
        indexed = true;
      }

      completed += 1;
      const progress = Math.round((completed / indexableFiles.length) * 100);
      logStepStructured("progress", { completed, total: indexableFiles.length, progress, indexing: completed < indexableFiles.length });

      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        files: updatedFiles,
        processing: completed < indexableFiles.length,
        index_status: completed < indexableFiles.length ? "indexing" : "succeeded",
        index_progress: progress,
        last_error: errors.length > 0 ? errors.join("; ") : "",
      });
    }

    if (totalKbCost > 0) {
      await recordIndexingCost(base44, kb.name || "KB", totalKbCost);
    }

    logStepStructured("index_done", {
      kbId,
      indexed,
      completed: indexableFiles.length,
      cost: totalKbCost,
      status: "succeeded",
      errors: errors.length > 0 ? errors : undefined,
    });
    return Response.json({ ok: true, indexed, cost: totalKbCost, debug: debugLogs, v: "1.2" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("indexKnowledgeBase fatal error:", msg);
    if (base44 && kbId) {
      try {
        debugLogs.push(JSON.stringify({ step: "index_failed", error: msg, status: "failed", _t: Date.now() }));
        await base44.asServiceRole.entities.KnowledgeBase.update(kbId, {
          processing: false,
          index_status: "failed",
          index_progress: 0,
          last_error: msg,
          debug_logs: [...debugLogs],
        });
      } catch {
        console.error("Failed to update KB error state");
      }
    }
    return Response.json({ error: msg, debug: debugLogs }, { status: 500 });
  }
});
