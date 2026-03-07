import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import pdf from 'npm:pdf-parse/lib/pdf-parse.js';

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const INDEXABLE_TYPES = [
  "txt", "md", "csv", "json", "pdf",
  "js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "cpp", "c", "cs",
  "java", "php", "swift", "kt", "html", "css", "scss",
  "yaml", "yml", "xml", "sh", "bash", "sql", "toml", "ini", "env",
];

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

async function buildPageIndexForText(
  text: string,
  fileName: string
): Promise<PageIndexDocument | null> {
  if (!GEMINI_API_KEY) {
    console.error("No Gemini API key configured");
    return null;
  }

  if (!text || text.trim().length === 0) {
    return null;
  }

  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) return null;

  const taggedText = paragraphs
    .map((p, i) => `<paragraph_${i}>\n${p}\n</paragraph_${i}>`)
    .join("\n\n");

  const userPrompt = `Document name: ${fileName}\nTotal paragraphs: ${paragraphs.length}\n\n${taggedText}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  };

  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Gemini API ${resp.status}: ${errText}`);
    return null;
  }

  const data = await resp.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  let textOut: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOut) {
    console.error(`Gemini returned empty response (finishReason: ${finishReason || "unknown"})`);
    return null;
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
      console.error("Gemini returned valid JSON but no recognizable tree structure");
      return null;
    }

    renumberNodes(structure);

    return {
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
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", e instanceof Error ? e.message : String(e));
    return null;
  }
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

function buildFallbackTree(text: string, fileName: string): PageIndexDocument {
  const normalized = (text || "").replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) {
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

// ─── Deno serve ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let kbId: string | null = null;
  let base44: any = null;

  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

    const kb = kbList[0];
    const files = kb.files || [];
    const indexableFiles = files.filter((f: any) => f.url && INDEXABLE_TYPES.includes(f.type));

    if (indexableFiles.length === 0) {
      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        processing: false,
        index_status: "succeeded",
        index_progress: 100,
        last_error: "",
      });
      return Response.json({ ok: true, indexed: false });
    }

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

    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i];
      if (!file.url || !INDEXABLE_TYPES.includes(file.type)) continue;
      if (file.processed && file.index_tree?.root && Array.isArray(file.index_tree?.paragraphs) && file.index_tree.paragraphs.length > 0) {
        completed += 1;
        continue;
      }

      try {
        const fileResp = await fetch(file.url);
        if (!fileResp.ok) {
          throw new Error(`HTTP ${fileResp.status} fetching ${file.name}`);
        }

        let text: string;
        if (file.type === "pdf") {
          const arrayBuf = await fileResp.arrayBuffer();
          const pdfData = await pdf(Buffer.from(arrayBuf));
          text = pdfData.text || "";
        } else {
          text = await fileResp.text();
        }

        const indexDoc = await buildPageIndexForText(text, file.name);
        const finalDoc = indexDoc || buildFallbackTree(text, file.name);

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
        errors.push(`${file.name}: ${msg}`);

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

      await base44.asServiceRole.entities.KnowledgeBase.update(kb.id, {
        files: updatedFiles,
        processing: completed < indexableFiles.length,
        index_status: completed < indexableFiles.length ? "indexing" : "succeeded",
        index_progress: progress,
        last_error: errors.length > 0 ? errors.join("; ") : "",
      });
    }

    return Response.json({ ok: true, indexed });
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

    return Response.json({ error: msg }, { status: 500 });
  }
});
