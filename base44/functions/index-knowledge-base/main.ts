import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import pdf from 'npm:pdf-parse@1.1.1';
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
  "youtube", "tiktok", "instagram", "twitter", "facebook", "media", "web",
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

// ─── Supadata API: transcript + metadata for YouTube, TikTok, Instagram, etc. ─

const SUPADATA_API_KEY = "sd_8ca36aab85b68983db4fcddfc3298d5d";
const SUPADATA_BASE = "https://api.supadata.ai/v1";
const MEDIA_FILE_TYPES = ["youtube", "tiktok", "instagram", "twitter", "facebook", "media"];

function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return "youtube";
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/(?:twitter\.com|x\.com)\//.test(u)) return "twitter";
  if (/facebook\.com|fb\.com|fb\.watch/.test(u)) return "facebook";
  return "media";
}

async function fetchSupadataTranscript(
  url: string,
  logDebug: (msg: string) => void
): Promise<{ title: string; transcript: string; platform: string } | null> {
  if (!SUPADATA_API_KEY) {
    logDebug(JSON.stringify({ step: "supadata_fatal", reason: "SUPADATA_API_KEY not configured" }));
    throw new Error("SUPADATA_API_KEY is not configured — cannot fetch media transcripts");
  }

  const t0 = Date.now();
  const platform = detectPlatformFromUrl(url);
  logDebug(JSON.stringify({ step: "supadata_start", url, platform }));

  let title = `${platform} video`;
  try {
    const metaRes = await fetch(`${SUPADATA_BASE}/metadata?url=${encodeURIComponent(url)}`, {
      headers: { "x-api-key": SUPADATA_API_KEY },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      title = meta.title || meta.description?.slice(0, 100) || title;
      logDebug(JSON.stringify({ step: "supadata_metadata_ok", title: title.slice(0, 80), platform: meta.platform, author: meta.author?.displayName }));
    } else {
      logDebug(JSON.stringify({ step: "supadata_metadata_fail", status: metaRes.status }));
    }
  } catch (e) {
    logDebug(JSON.stringify({ step: "supadata_metadata_error", error: e instanceof Error ? e.message : String(e) }));
  }

  try {
    const tUrl = `${SUPADATA_BASE}/transcript?url=${encodeURIComponent(url)}&text=true&mode=auto`;
    logDebug(JSON.stringify({ step: "supadata_transcript_call", tUrl }));
    const res = await fetch(tUrl, {
      headers: { "x-api-key": SUPADATA_API_KEY },
    });

    if (res.status === 202) {
      const { jobId } = await res.json();
      logDebug(JSON.stringify({ step: "supadata_transcript_async", jobId }));
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const pollRes = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, {
          headers: { "x-api-key": SUPADATA_API_KEY },
        });
        if (!pollRes.ok) {
          logDebug(JSON.stringify({ step: "supadata_poll_http_error", status: pollRes.status, ms: Date.now() - t0 }));
          return null;
        }
        const job = await pollRes.json();
        logDebug(JSON.stringify({ step: "supadata_poll", jobId, jobStatus: job.status, elapsed: Date.now() - t0 }));

        if (job.status === "completed") {
          const text = typeof job.content === "string" ? job.content : "";
          if (text.length > 0) {
            logDebug(JSON.stringify({ step: "supadata_transcript_ok", chars: text.length, ms: Date.now() - t0, source: "async" }));
            return { title, transcript: text, platform };
          }
          logDebug(JSON.stringify({ step: "supadata_completed_empty", ms: Date.now() - t0 }));
          return null;
        }
        if (job.status === "failed") {
          const errDetail = job.error?.message || job.error?.details || "unknown";
          logDebug(JSON.stringify({ step: "supadata_job_failed", error: errDetail, ms: Date.now() - t0 }));
          return null;
        }
      }
      logDebug(JSON.stringify({ step: "supadata_poll_timeout", jobId, ms: Date.now() - t0 }));
      return null;
    }

    if (!res.ok) {
      const body = await res.text();
      logDebug(JSON.stringify({ step: "supadata_transcript_error", status: res.status, body: body.slice(0, 200), ms: Date.now() - t0 }));
      return null;
    }

    const data = await res.json();
    const text = typeof data.content === "string" ? data.content : "";
    if (text.length > 0) {
      logDebug(JSON.stringify({ step: "supadata_transcript_ok", chars: text.length, ms: Date.now() - t0, source: "sync" }));
      return { title, transcript: text, platform };
    }
    logDebug(JSON.stringify({ step: "supadata_transcript_empty", ms: Date.now() - t0 }));
    return null;
  } catch (e) {
    logDebug(JSON.stringify({ step: "supadata_transcript_error", error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }));
    return null;
  }
}

async function fetchSupadataWebScrape(
  url: string,
  logDebug: (msg: string) => void
): Promise<{ title: string; content: string } | null> {
  if (!SUPADATA_API_KEY) {
    logDebug(JSON.stringify({ step: "supadata_web_fatal", reason: "SUPADATA_API_KEY not configured" }));
    throw new Error("SUPADATA_API_KEY is not configured — cannot scrape web content");
  }
  try {
    const scrapeUrl = `${SUPADATA_BASE}/web/scrape?url=${encodeURIComponent(url)}`;
    logDebug(JSON.stringify({ step: "supadata_web_scrape_call", url }));
    const res = await fetch(scrapeUrl, {
      headers: { "x-api-key": SUPADATA_API_KEY },
    });
    if (!res.ok) {
      const body = await res.text();
      logDebug(JSON.stringify({ step: "supadata_web_scrape_error", status: res.status, body: body.slice(0, 200) }));
      return null;
    }
    const data = await res.json();
    const content = data.content || "";
    const title = data.name || data.description || url;
    logDebug(JSON.stringify({ step: "supadata_web_scrape_ok", chars: content.length, title: (title || "").slice(0, 80) }));
    return { title, content };
  } catch (e) {
    logDebug(JSON.stringify({ step: "supadata_web_scrape_error", error: e instanceof Error ? e.message : String(e) }));
    return null;
  }
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
    const user = await base44.auth.me().catch(() => null);
    if (user) {
      debugLogs.push(JSON.stringify({ step: "auth_ok", user: user.email || "unknown", _t: Date.now() }));
    } else {
      // Allow KB indexing from public app flows where invoke() has no user context.
      debugLogs.push(JSON.stringify({ step: "auth_missing_continue_service_role", _t: Date.now() }));
    }

    if (!KIMI_API_KEY || KIMI_API_KEY.trim() === "") {
      console.warn("indexKnowledgeBase: KIMI_API_KEY not set — LLM-based indexing unavailable, but light indexing (text extraction, YouTube) will still work");
      debugLogs.push(JSON.stringify({ step: "warn_no_kimi_key", _t: Date.now() }));
    }

    const body = await req.json();
    kbId = body.kbId;
    const expectedFileCount = Number(body.expectedFileCount || 0);
    const expectedPendingCount = Number(body.expectedPendingCount || 0);
    const filesSnapshot = Array.isArray(body.filesSnapshot) ? body.filesSnapshot : null;
    debugLogs.push(JSON.stringify({
      step: "got_kbId",
      kbId,
      expectedFileCount,
      expectedPendingCount,
      filesSnapshotCount: filesSnapshot?.length || 0,
      _t: Date.now()
    }));
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

    const hasBuiltTree = (f: any) =>
      !!(f.index_tree?.root && Array.isArray(f.index_tree?.paragraphs) && f.index_tree.paragraphs.length > 0);

    const isIndexableFile = (f: any) => {
      const type = getFileType(f);
      const isIndexable = (f.url || typeof f.inline_text === "string") && type && INDEXABLE_TYPES.includes(type);
      logDebug(`[KB_DEBUG] File check: name="${f.name}", type="${f.type}", derivedType="${type}", hasUrl=${!!f.url}, typeof inline_text="${typeof f.inline_text}", processed=${f.processed}, isIndexable=${isIndexable}`);
      return isIndexable;
    };

    const countPendingFiles = (list: any[]) =>
      list.filter((f: any) => isIndexableFile(f) && !hasBuiltTree(f)).length;

    if (filesSnapshot && filesSnapshot.length > 0) {
      const snapshotPendingCount = countPendingFiles(filesSnapshot);
      const dbPendingCount = countPendingFiles(files);
      const shouldUseSnapshot =
        filesSnapshot.length > files.length ||
        snapshotPendingCount > dbPendingCount ||
        (expectedFileCount > 0 && filesSnapshot.length >= expectedFileCount) ||
        (expectedPendingCount > 0 && snapshotPendingCount >= expectedPendingCount);

      if (shouldUseSnapshot) {
        files = filesSnapshot;
        logDebug(`[KB_DEBUG] Using client filesSnapshot as source of truth: dbFiles=${kb.files?.length || 0}, snapshotFiles=${filesSnapshot.length}, dbPending=${dbPendingCount}, snapshotPending=${snapshotPendingCount}`);
      }
    }

    let indexableFiles = files.filter(isIndexableFile);
    let pendingFiles = indexableFiles.filter((f: any) => !hasBuiltTree(f));

    let syncAttempt = 0;
    while (
      syncAttempt < 6 &&
      (
        (expectedFileCount > 0 && files.length < expectedFileCount) ||
        (expectedPendingCount > 0 && pendingFiles.length < expectedPendingCount)
      )
    ) {
      syncAttempt += 1;
      logDebug(`[KB_DEBUG] Waiting for fresh KB state (attempt ${syncAttempt}/6): files=${files.length}/${expectedFileCount}, pending=${pendingFiles.length}/${expectedPendingCount}`);
      await new Promise(r => setTimeout(r, 1200));
      const retryList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
      if (retryList?.length) {
        kb = retryList[0];
        files = kb.files || [];
        indexableFiles = files.filter(isIndexableFile);
        pendingFiles = indexableFiles.filter((f: any) => !hasBuiltTree(f));
      }
    }

    logDebug(`[KB_DEBUG] kbId=${kbId}, total files=${files.length}, indexableFiles=${indexableFiles.length}, pendingFiles=${pendingFiles.length}`);

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

    if (pendingFiles.length === 0) {
      logStepStructured("index_skip", {
        kbId,
        reason: "no_pending_files",
        totalFiles: files.length,
        indexableFiles: indexableFiles.length,
      });
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
      pendingCount: pendingFiles.length,
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

    const totalToProcess = pendingFiles.length;

    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i];
      const fileType = getFileType(file);
      
      if ((!file.url && typeof file.inline_text !== "string") || !fileType || !INDEXABLE_TYPES.includes(fileType)) {
        logDebug(`[KB_DEBUG] Skipping file "${file.name}" because it lacks url/inline_text or has invalid fileType=${fileType}`);
        continue;
      }
      if (hasBuiltTree(file)) {
        logDebug(`[KB_DEBUG] Skipping file "${file.name}" because it is already processed.`);
        continue;
      }

      try {
        logStepStructured("file_start", { fileName: file.name, fileIndex: i, fileType, totalFiles: updatedFiles.length });
        logDebug(`[KB_DEBUG] Start processing file "${file.name}"...`);
        let text: string;

        if (MEDIA_FILE_TYPES.includes(fileType) && file.url) {
          logDebug(`[KB_DEBUG] Media source (${fileType}) detected, fetching transcript for "${file.url}"...`);
          const mediaResult = await fetchSupadataTranscript(file.url, logDebug);
          if (mediaResult && mediaResult.transcript.length > 0) {
            text = mediaResult.transcript;
            const newName = mediaResult.title || file.name;
            updatedFiles[i] = { ...updatedFiles[i], name: newName, inline_text: text };
            logStepStructured("file_fetched", { fileName: newName, source: `supadata_${mediaResult.platform}`, textLength: text.length });
          } else {
            throw new Error(`Could not fetch transcript for ${file.url} via Supadata`);
          }
        } else if (fileType === "web" && file.url) {
          logDebug(`[KB_DEBUG] Web source detected, scraping "${file.url}"...`);
          const webResult = await fetchSupadataWebScrape(file.url, logDebug);
          if (webResult && webResult.content.length > 0) {
            text = webResult.content;
            const newName = webResult.title || file.name;
            updatedFiles[i] = { ...updatedFiles[i], name: newName, inline_text: text };
            logStepStructured("file_fetched", { fileName: newName, source: "supadata_web", textLength: text.length });
          } else {
            throw new Error(`Could not scrape content from ${file.url} via Supadata`);
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
      const progress = Math.round((completed / totalToProcess) * 100);
      logStepStructured("progress", { completed, total: totalToProcess, progress, indexing: completed < totalToProcess });

      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        files: updatedFiles,
        processing: completed < totalToProcess,
        index_status: completed < totalToProcess ? "indexing" : "succeeded",
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
      completed: totalToProcess,
      cost: totalKbCost,
      status: "succeeded",
      errors: errors.length > 0 ? errors : undefined,
    });
    await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
      files: updatedFiles,
      processing: false,
      index_status: "succeeded",
      index_progress: 100,
      last_error: errors.length > 0 ? errors.join("; ") : "",
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
