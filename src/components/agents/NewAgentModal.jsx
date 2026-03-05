import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, Loader2, Bot, Zap, Brain, Sparkles, Cpu, Settings } from "lucide-react";

const AVAILABLE_TOOLS = [
  { name: "web_search", label: "Web Search" },
  { name: "file_upload", label: "File Upload" },
  { name: "data_analysis", label: "Data Analysis" },
  { name: "code_execution", label: "Code Execution" },
  { name: "email", label: "Email" },
];

export default function NewAgentModal({ onClose, onCreate, knowledgeBases = [] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [selectedTools, setSelectedTools] = useState([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState("");
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [selectedIcon, setSelectedIcon] = useState("Bot");
  const [isCreating, setIsCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const ICON_OPTIONS = [
    { name: "Bot", icon: Bot },
    { name: "Zap", icon: Zap },
    { name: "Brain", icon: Brain },
    { name: "Sparkles", icon: Sparkles },
    { name: "Cpu", icon: Cpu },
    { name: "Settings", icon: Settings },
  ];

  const handleIconChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      const preview = URL.createObjectURL(file);
      setIconPreview(preview);
    }
  };

  const analyzeAndSuggest = async () => {
    if (!name.trim()) return;
    setIsAnalyzing(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this agent description, suggest: 1) Best tools for "${name}" (from: web_search, file_upload, data_analysis, code_execution, email) 2) A suggested icon name from lucide-react. Return as JSON: {tools: [], iconName: ""}. Agent: ${description || name}`,
        response_json_schema: {
          type: "object",
          properties: {
            tools: { type: "array", items: { type: "string" } },
            iconName: { type: "string" }
          }
        }
      });
      
      if (response.tools) {
        setSelectedTools(response.tools.filter(t => AVAILABLE_TOOLS.find(at => at.name === t)));
      }
      if (response.iconName && !iconFile) {
        // Will use this as fallback icon_name when creating
      }
    } catch (e) {
      console.error("Suggestion failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      let iconUrl = null;
      if (iconFile) {
        const uploadRes = await base44.integrations.Core.UploadFile({ file: iconFile });
        iconUrl = uploadRes.file_url;
      }

      const agentData = {
        name: name.trim(),
        description: description.trim(),
        system_instructions: systemInstructions.trim(),
        icon_url: iconUrl,
        icon_name: selectedIcon,
        tools: selectedTools.map(t => ({ name: t, enabled: true })),
        knowledge_base_ids: selectedKnowledgeBase ? [selectedKnowledgeBase] : [],
        status: "active"
      };

      await onCreate(agentData);
      reset();
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setName("");
    setDescription("");
    setSystemInstructions("");
    setSelectedTools([]);
    setSelectedKnowledgeBase("");
    setIconFile(null);
    setIconPreview(null);
    setSelectedIcon("Bot");
    onClose();
  };

  const toggleTool = (toolName) => {
    setSelectedTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div style={{
        background: "#181818", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 25px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>Create New Agent</h2>
          <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic Info */}
          <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>Basic Info</p>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Content Writer"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                  border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box",
                  outline: "none"
                }}
                onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
                onBlur={e => e.target.style.borderColor = "#2a2a2a"}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", display: "block", marginBottom: 6 }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                rows={2}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                  border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box",
                  outline: "none", fontFamily: "inherit", resize: "none"
                }}
                onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
                onBlur={e => e.target.style.borderColor = "#2a2a2a"}
              />
            </div>
          </div>

          {/* System Instructions */}
          <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>System Instructions</p>
            <textarea
              value={systemInstructions}
              onChange={e => setSystemInstructions(e.target.value)}
              placeholder="Define the agent's behavior, constraints, and guidelines..."
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box",
                outline: "none", fontFamily: "inherit", resize: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
              onBlur={e => e.target.style.borderColor = "#2a2a2a"}
            />
          </div>

          {/* Icon Selection */}
          <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>Icon</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {ICON_OPTIONS.map(({ name: iconName, icon: IconComponent }) => (
                <button key={iconName} onClick={() => setSelectedIcon(iconName)} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 52, height: 52, borderRadius: 10,
                  background: selectedIcon === iconName ? "rgba(249,115,22,0.15)" : "#0f0f0f",
                  border: `1px solid ${selectedIcon === iconName ? "rgba(249,115,22,0.4)" : "#2a2a2a"}`,
                  cursor: "pointer", transition: "all 0.2s", color: selectedIcon === iconName ? "#f97316" : "#555"
                }} title={iconName}>
                  <IconComponent style={{ width: 24, height: 24 }} />
                </button>
              ))}
            </div>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: 16, borderRadius: 10, background: "#0f0f0f", border: "2px dashed #2a2a2a",
              cursor: "pointer", transition: "all 0.2s"
            }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}>
              {iconPreview ? (
                <>
                  <img src={iconPreview} alt="preview" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                  <span style={{ fontSize: 12, color: "#f5f5f5" }}>Custom icon uploaded</span>
                </>
              ) : (
                <>
                  <Upload style={{ width: 16, height: 16, color: "#555" }} />
                  <span style={{ fontSize: 12, color: "#555" }}>Or upload custom icon</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleIconChange}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {/* Tools Access */}
          <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>Tool Access</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {AVAILABLE_TOOLS.map(tool => (
                <label key={tool.name} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10,
                  background: selectedTools.includes(tool.name) ? "rgba(249,115,22,0.15)" : "#0f0f0f",
                  border: `1px solid ${selectedTools.includes(tool.name) ? "rgba(249,115,22,0.4)" : "#2a2a2a"}`,
                  cursor: "pointer", transition: "all 0.2s"
                }}>
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12, color: "#f5f5f5" }}>{tool.label}</span>
                </label>
              ))}
            </div>
            <button onClick={analyzeAndSuggest} disabled={!name.trim() || isAnalyzing} style={{
              marginTop: 10, padding: "6px 12px", borderRadius: 8, background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.2)", color: "#f97316", fontSize: 11, fontWeight: 500,
              cursor: isAnalyzing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
              {isAnalyzing ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : null}
              {isAnalyzing ? "Analyzing..." : "AI Suggest Tools"}
            </button>
          </div>

          {/* Knowledge Base */}
          <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>Knowledge Base (Optional)</p>
            <select
              value={selectedKnowledgeBase}
              onChange={e => setSelectedKnowledgeBase(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10, background: "#0f0f0f",
                border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, boxSizing: "border-box",
                outline: "none", cursor: "pointer"
              }}
            >
              <option value="">None</option>
              {knowledgeBases.map(kb => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
            {knowledgeBases.length === 0 && (
              <p style={{ fontSize: 10, color: "#444", marginTop: 6 }}>Create a knowledge base first to connect it</p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || isCreating} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "#f97316",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || isCreating ? "not-allowed" : "pointer", opacity: !name.trim() || isCreating ? 0.5 : 1,
              transition: "all 0.2s"
            }}>
              {isCreating ? "Creating..." : "Create Agent"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}