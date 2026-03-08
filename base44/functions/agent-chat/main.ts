import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { DEFAULT_AGENT_SYSTEM_PROMPT } from './defaultSystemPrompt.ts';

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
  if (collected.size === 0) return "";

  const sorted = Array.from(collected).sort((a, b) => a - b);
  return sorted.map(i => paragraphs[i]).join("\n\n");
}

const GEMINI_INPUT_COST_PER_1M = 0.075;
const GEMINI_OUTPUT_COST_PER_1M = 0.30;

async function callGemini(
  systemText: string,
  contents: any[],
  opts: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<{ text: string; usage?: { promptTokens: number; outputTokens: number } }> {
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
    promptTokens = um.promptTokenCount ?? um.prompt_token_count ?? um.inputTokenCount ?? 0;
    outputTokens = um.candidatesTokenCount ?? um.candidates_token_count ?? um.outputTokenCount ?? um.output_token_count ?? 0;
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

    const { messages, agent, mode } = await req.json();

    const systemParts: string[] = [];
    const agentName = agent.name || "AI Assistant";
    const agentDesc = agent.description || "";
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
      } catch (e) {
        console.error("KB fetch error:", e instanceof Error ? e.message : String(e));
      }
    }

    // ─── PageIndex 2-step retrieval ───────────────────────────────────
    let retrievedContext = "";

    if (indexedFiles.length > 0) {
      const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

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
- Prefer leaf nodes or specific subsections over broad parent sections.
- If the question is very broad, select more sections. If specific, select fewer.
- If no section seems relevant, return empty selections: []
- Output ONLY valid JSON.`;

      const routingContents = [
        { role: "user", parts: [{ text: `Question: ${lastUserMessage}\n\nDocument indexes:\n${treeOverview}` }] },
      ];

      let routingSucceeded = false;

      try {
        const { text: routingRaw } = await callGemini(routingSystem, routingContents, {
          temperature: 0.1,
          maxOutputTokens: 2048,
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
          }
        }
      } catch (e) {
        console.error("Routing step error:", e instanceof Error ? e.message : String(e));
      }

      // Fallback: if routing failed or returned nothing, provide tree summaries as context
      if (!routingSucceeded) {
        retrievedContext = indexedFiles
          .map(f => `--- Document structure: ${f.name} ---\n${f.tree}`)
          .join("\n\n");
      }
    }

    // Unindexed files: fetch raw content as fallback
    for (const file of unindexedFiles) {
      try {
        const resp = await fetch(file.url);
        if (resp.ok) {
          const text = await resp.text();
          const trimmed = text.substring(0, 6000);
          retrievedContext += `\n\n--- File (unindexed): ${file.name} ---\n${trimmed}${text.length > 6000 ? "\n[...truncated]" : ""}`;
        }
      } catch { /* skip */ }
    }

    if (retrievedContext) {
      systemParts.push(`\n## Retrieved Knowledge Base Content
The following content was retrieved from your knowledge bases using reasoning-based document navigation (PageIndex). These are the specific sections identified as most relevant to the user's question.

ALWAYS use this retrieved content to answer. If the content doesn't fully answer the question, say what you found and what's missing.
${retrievedContext}`);
    }

    const enabledTools = (agent.tools || []).filter((t: any) => t.enabled);
    if (enabledTools.length > 0) {
      const toolDescriptions: Record<string, string> = {
        script_runner: "Execute custom scripts and automations.",
        web_scraper: "Extract data from websites and APIs.",
        data_processor: "Transform and analyze datasets.",
        code_generator: "Generate code snippets and templates.",
        local_ai_bridge: "Connect to local AI models and services.",
        system_utility: "System maintenance and monitoring tools.",
      };

      const toolsText = enabledTools.map((t: any) => {
        const desc = toolDescriptions[t.name] || `Tool: ${t.name}`;
        return `- **${t.name}**: ${desc}`;
      }).join("\n");

      systemParts.push(`\n## Your Tools\n${toolsText}`);
    }

    systemParts.push(`\n## Web Access\nYou have access to the internet. ${retrievedContext ? "Prioritize knowledge base content first." : ""}`);

    if (mode === "thinking") {
      systemParts.push("\n## Response Mode: Deep Thinking\nProvide thorough, detailed, well-structured responses. Think step by step.");
    } else {
      systemParts.push("\n## Response Mode: Instant\nBe concise, direct, and helpful.");
    }

    const systemInstruction = systemParts.join("\n");

    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await callGemini(systemInstruction, geminiContents, {
      temperature: mode === "thinking" ? 0.7 : 0.9,
      maxOutputTokens: mode === "thinking" ? 8192 : 4096,
    });
    let responseText = res.text;

    let totalPromptTokens = res.usage?.promptTokens ?? 0;
    let totalOutputTokens = res.usage?.outputTokens ?? 0;

    if (responseText && !hasStructure(responseText)) {
      const retrySystem = systemInstruction + "\n\n[REVIEWER] Your reply was a dense block without structure. Regenerate: use ## and ### headings, blank lines between paragraphs and sections, and bullet or numbered lists. No wall of text.";
      const retryRes = await callGemini(retrySystem, geminiContents, {
        temperature: mode === "thinking" ? 0.6 : 0.8,
        maxOutputTokens: mode === "thinking" ? 8192 : 4096,
      });
      responseText = retryRes.text;
      totalPromptTokens += retryRes.usage?.promptTokens ?? 0;
      totalOutputTokens += retryRes.usage?.outputTokens ?? 0;
    }

    const cost =
      (totalPromptTokens / 1e6) * GEMINI_INPUT_COST_PER_1M +
      (totalOutputTokens / 1e6) * GEMINI_OUTPUT_COST_PER_1M;

    return Response.json({
      response: responseText || "I couldn't generate a response. Please try again.",
      cost: Math.round(cost * 1e8) / 1e8,
    });
  } catch (error: any) {
    console.error("agentChat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
