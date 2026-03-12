import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import pdf from 'npm:pdf-parse/lib/pdf-parse.js';

// ─── KB indexing: Gemini 3.1 Flash-Lite configuration ─────────────────────────
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Gemini 3.1 Flash-Lite Preview pricing (USD per 1M tokens)
const GEMINI_INPUT_COST_PER_1M = 0.25;
const GEMINI_OUTPUT_COST_PER_1M = 1.50;


const MAX_PARAGRAPHS_PER_CHUNK = 80;
const MAX_CHARS_PER_CHUNK = 30000;

const MAX_PARAGRAPH_LENGTH = 4000;

const INDEXABLE_TYPES = [
  "txt", "md", "csv", "json", "pdf",
  "js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "cpp", "c", "cs",
  "java", "php", "swift", "kt", "html", "css", "scss",
  "yaml", "yml", "xml", "sh", "bash", "sql", "toml", "ini", "env",
];

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
  fileName: string
): Promise<{ doc: PageIndexDocument | null; cost: number }> {
  if (!GEMINI_API_KEY) {
    console.error("Missing Gemini API key (GEMINI_API_KEY)");
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
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout for stability

  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Gemini API ${resp.status}: ${errText}`);
    return { doc: null, cost: 0 };
  }

  const data = await resp.json();
  const um = data?.usageMetadata || data?.usage_metadata;
  let promptTokens = 0;
  let outputTokens = 0;
  if (um && typeof um === "object") {
    promptTokens = um.promptTokenCount ?? um.prompt_token_count ?? 0;
    outputTokens = um.candidatesTokenCount ?? um.candidates_token_count ?? 0;
  }

  let textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (promptTokens === 0 && outputTokens === 0 && textOut) {
    promptTokens = Math.max(100, Math.ceil(userPrompt.length / 4));
    outputTokens = Math.max(50, Math.ceil(textOut.length / 4));
  }
  const cost =
    (promptTokens / 1e6) * GEMINI_INPUT_COST_PER_1M +
    (outputTokens / 1e6) * GEMINI_OUTPUT_COST_PER_1M;

  if (!textOut) {
    console.error(`Gemini returned empty response`);
    return { doc: null, cost };
  }

  textOut = textOut.trim();
  if (textOut.startsWith("```")) {
    const match = textOut.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) textOut = match[1].trim();
  }

  try {
    const parsed = typeof textOut === "string" ? JSON.parse(textOut) : textOut;


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
      console.error("Gemini returned valid JSON but no recognizable tree structure");
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
    return { doc, cost };
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", e instanceof Error ? e.message : String(e));
    return { doc: null, cost };
  }
}

/** Build PageIndex for large docs by chunking; small docs go to buildPageIndexForText once. */
async function buildPageIndexWithChunking(
  text: string,
  fileName: string
): Promise<{ doc: PageIndexDocument | null; cost: number }> {
  const paragraphs = smartSplitText(text || "");
  if (paragraphs.length === 0) return { doc: null, cost: 0 };

  const totalChars = paragraphs.join("").length;
  const useChunking = paragraphs.length > MAX_PARAGRAPHS_PER_CHUNK || totalChars > MAX_CHARS_PER_CHUNK;

  if (!useChunking) {
    return buildPageIndexForText(text, fileName);
  }

  const chunks = splitParagraphsIntoChunks(paragraphs);
  const mergedNodes: PageIndexNode[] = [];
  let docTitle = fileName;
  let docDescription = "";
  let totalCost = 0;

  for (const { start, end } of chunks) {
    const chunkParagraphs = paragraphs.slice(start, end);
    const chunkText = chunkParagraphs.join("\n\n");
    const chunkResult = await buildPageIndexForText(chunkText, fileName);
    totalCost += chunkResult.cost;
    const chunkDoc = chunkResult.doc;

    if (!chunkDoc?.root?.nodes?.length) {
      throw new Error(`Failed to generate indexing tree for chunk ${start}-${end}`);
    } else {
      docTitle = chunkDoc.doc_title;
      if (chunkDoc.doc_description) docDescription = chunkDoc.doc_description;
      for (const node of chunkDoc.root.nodes) {
        addParagraphOffsetToNode(node, start);
        mergedNodes.push(node);
      }
    }
  }

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

/** No fallback tree needed; we prefer to fail and show error so user can retry than have a broken index. */


// ─── Deno serve ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let kbId: string | null = null;
  let base44: any = null;
  const debugLogs: string[] = [];
  const logDebug = (msg: string) => {
    console.log(msg);
    debugLogs.push(msg);
  };

  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
      console.error("indexKnowledgeBase: GEMINI_API_KEY secret is missing or empty");
      return Response.json(
        { error: "Indexing requires GEMINI_API_KEY or GOOGLE_AI_API_KEY secret" },
        { status: 500 }
      );
    }

    const body = await req.json();
    kbId = body.kbId;
    if (!kbId || typeof kbId !== "string") {
      return Response.json({ error: "kbId is required" }, { status: 400 });
    }

    const kbList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
    if (!kbList?.length) {
      return Response.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    let kb = kbList[0];
    let files = kb.files || [];

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
      logDebug(`[KB] No indexable files to process now.`);
      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        processing: false,
        index_status: "succeeded",
        index_progress: 100,
        last_error: "",
      });
      return Response.json({ ok: true, indexed: false, debug: debugLogs });
    }

    logDebug(`[KB] Starting processing loop for ${indexableFiles.length} files...`);
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
        continue;
      }
      if (file.processed && file.index_tree?.root && Array.isArray(file.index_tree?.paragraphs) && file.index_tree.paragraphs.length > 0) {
        logDebug(`[KB] Skipping already processed file: ${file.name}`);
        completed += 1;
        continue;
      }

      try {
        logDebug(`[KB] Indexing file: "${file.name}" (Type: ${fileType})`);
        let text: string;
        if (typeof file.inline_text === "string" && file.inline_text.trim().length > 0) {
          text = file.inline_text;
          logDebug(`[KB] Using inline text (${text.length} chars)`);
        } else {
          logDebug(`[KB] Fetching URL: ${file.url}`);
          const fileResp = await fetch(file.url);
          if (!fileResp.ok) throw new Error(`HTTP ${fileResp.status} fetching ${file.name}`);

          if (fileType === "pdf") {
            const arrayBuf = await fileResp.arrayBuffer();
            const pdfData = await pdf(Buffer.from(arrayBuf));
            text = pdfData.text || "";
          } else {
            text = await fileResp.text();
          }
          logDebug(`[KB] Fetched ${text.length} characters`);
        }

        const indexResult = await buildPageIndexWithChunking(text, file.name);
        const finalDoc = indexResult.doc;
        if (!finalDoc) throw new Error("Indexing result is null");

        totalKbCost += indexResult.cost;
        logDebug(`[KB] Indexing successful for "${file.name}". Cost: $${indexResult.cost.toFixed(6)}`);

        updatedFiles[i] = {
          ...file,
          processed: true,
          index_tree: finalDoc,
          doc_description: finalDoc.doc_description || "",
        };
        indexed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`File "${file.name}" indexing error: ${msg}`);
        logDebug(`[KB] Error indexing "${file.name}": ${msg}`);
        errors.push(`${file.name}: ${msg}`);

        updatedFiles[i] = {
            ...file,
            processed: true,
            index_tree: null,
            doc_description: `Error during indexing: ${msg}`,
          };
        indexed = true;
      }

      completed += 1;
      const progress = Math.round((completed / indexableFiles.length) * 100);
      logDebug(`[KB] Progress: ${progress}% (${completed}/${indexableFiles.length})`);

      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        files: updatedFiles,
        processing: completed < indexableFiles.length,
        index_status: completed < indexableFiles.length ? "indexing" : "succeeded",
        index_progress: progress,
        last_error: errors.length > 0 ? errors.join("; ") : "",
      });
    }

    if (totalKbCost > 0) {
      logDebug(`[KB] Total indexing cost: $${totalKbCost.toFixed(6)}`);
      await recordIndexingCost(base44, kb.name || "KB", totalKbCost);
    }

    return Response.json({ ok: true, indexed, cost: totalKbCost, debug: debugLogs, v: "2.0" });


  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("indexKnowledgeBase fatal error:", msg);

    if (base44 && kbId) {
      try {
        await base44.asServiceRole.entities.KnowledgeBase.update(kbId, {
          processing: false,
          index_status: "failed",
          index_progress: 0,
          last_error: msg,
        });
      } catch {
        console.error("Failed to update KB error state");
      }
    }

    return Response.json({ error: msg, debug: debugLogs }, { status: 500 });
  }
});
