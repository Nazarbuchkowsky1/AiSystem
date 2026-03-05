import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-pro";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, agent, mode } = await req.json();

    // Build system prompt
    let systemParts = [];

    // Base identity
    const agentName = agent.name || "AI Assistant";
    const agentDesc = agent.description || "";
    systemParts.push(`You are "${agentName}". ${agentDesc}`);

    // User-defined system instructions
    if (agent.system_instructions) {
      systemParts.push(`\n## Your Instructions:\n${agent.system_instructions}`);
    }

    // Knowledge base context
    let kbContext = "";
    if (agent.knowledge_base_ids && agent.knowledge_base_ids.length > 0) {
      try {
        for (const kbId of agent.knowledge_base_ids) {
          const kbList = await base44.asServiceRole.entities.KnowledgeBase.filter({ id: kbId });
          if (kbList && kbList.length > 0) {
            const kb = kbList[0];
            if (kb.files && kb.files.length > 0) {
              kbContext += `\n\n### Knowledge Base: "${kb.name}"${kb.description ? ` — ${kb.description}` : ""}\nFiles available: ${kb.files.map(f => f.name).join(", ")}`;
              
              // Try to fetch content of text-based files for context
              for (const file of kb.files) {
                if (file.url && ["txt", "md", "csv", "json"].includes(file.type)) {
                  try {
                    const resp = await fetch(file.url);
                    if (resp.ok) {
                      const text = await resp.text();
                      // Limit per file to avoid token overflow
                      const trimmed = text.substring(0, 8000);
                      kbContext += `\n\n--- File: ${file.name} ---\n${trimmed}${text.length > 8000 ? "\n[...truncated]" : ""}`;
                    }
                  } catch (e) {
                    // skip file if can't fetch
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("KB fetch error:", e.message);
      }
    }

    if (kbContext) {
      systemParts.push(`\n## Knowledge Base Context\nYou have access to knowledge bases. ALWAYS prioritize information from these knowledge bases when answering. Only search the web or use general knowledge if the knowledge base does not contain the answer.\n${kbContext}`);
    }

    // Tools context
    const enabledTools = (agent.tools || []).filter(t => t.enabled);
    if (enabledTools.length > 0) {
      const toolDescriptions = {
        script_runner: "Execute custom scripts and automations. When a user asks to run a script or automate something, acknowledge this capability.",
        web_scraper: "Extract data from websites and APIs. When a user asks to scrape a website or extract web data, acknowledge this capability and describe how you would approach it.",
        data_processor: "Transform and analyze datasets. When a user asks to process, transform, or analyze data, acknowledge this capability.",
        code_generator: "Generate code snippets and templates. When a user asks for code, use this capability to generate high-quality code.",
        local_ai_bridge: "Connect to local AI models and services. When a user asks about local AI models, acknowledge this capability.",
        system_utility: "System maintenance and monitoring tools. When a user asks about system status or maintenance, acknowledge this capability.",
      };

      let toolsText = enabledTools.map(t => {
        const desc = toolDescriptions[t.name] || `Tool: ${t.name}`;
        return `- **${t.name}**: ${desc}`;
      }).join("\n");

      systemParts.push(`\n## Your Tools\nYou have the following tools enabled by the user. When a user's request matches a tool's capability, acknowledge that you can use it and describe your approach. Never say you cannot do something if you have a relevant tool.\n${toolsText}`);
    }

    // Web search capability
    systemParts.push(`\n## Web Access\nYou have access to the internet. If the user asks for current information and it's not in your knowledge base, you can search the web. ${kbContext ? "But always prioritize knowledge base content first." : ""}`);

    // Mode
    if (mode === "thinking") {
      systemParts.push("\n## Response Mode: Deep Thinking\nProvide thorough, detailed, well-structured responses. Think step by step.");
    } else {
      systemParts.push("\n## Response Mode: Instant\nBe concise, direct, and helpful.");
    }

    const systemInstruction = systemParts.join("\n");

    // Build Gemini request
    const geminiContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const geminiBody = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: geminiContents,
      generationConfig: {
        temperature: mode === "thinking" ? 0.7 : 0.9,
        maxOutputTokens: mode === "thinking" ? 8192 : 4096,
      }
    };

    const geminiResp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini API error:", errText);
      return Response.json({ error: "Gemini API error", details: errText }, { status: 500 });
    }

    const geminiData = await geminiResp.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";

    return Response.json({ response: responseText });
  } catch (error) {
    console.error("agentChat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});