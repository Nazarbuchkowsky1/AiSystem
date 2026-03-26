import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  X,
  Upload,
  Loader2,
  Bot,
  Zap,
  Brain,
  Sparkles,
  Cpu,
  Settings,
  Palette,
  Rocket,
  Trash2,
} from "lucide-react";
import TOOLS_LIST from "../shared/toolsList";
import { logStep } from "@/lib/clientLogger";

const BUILTIN_TOOL_NAMES = ["media_scraper"];
const AVAILABLE_TOOLS = TOOLS_LIST
  .filter(t => !BUILTIN_TOOL_NAMES.includes(t.name))
  .map(t => ({ name: t.name, label: t.label }));

export default function NewAgentModal({ onClose, onCreate, onUpdate, onDelete, editAgent = null }) {
  const isEditing = !!editAgent;
  const [name, setName] = useState(editAgent?.name || "");
  const [description, setDescription] = useState(editAgent?.description || "");
  const [systemInstructions, setSystemInstructions] = useState(editAgent?.system_instructions || editAgent?.system_prompt || "");
  const [selectedTools, setSelectedTools] = useState(editAgent?.tools?.map(t => t.name) || []);
  const [selectedModel, setSelectedModel] = useState(editAgent?.model === "gemini" ? "gemini" : "kimi");
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(editAgent?.icon_url || null);
  const [selectedIcon, setSelectedIcon] = useState(editAgent?.icon_url ? null : (editAgent?.icon_name || editAgent?.icon || "Bot"));
  const [isCreating, setIsCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showToolsAsRows, setShowToolsAsRows] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mounted, setMounted] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Sync form state when editAgent changes (e.g. opening edit again after save — list refetch must return model)
  React.useEffect(() => {
    if (!editAgent) return;
    setName(editAgent.name || "");
    setDescription(editAgent.description || "");
    setSystemInstructions(editAgent.system_instructions || editAgent.system_prompt || "");
    setSelectedTools(editAgent.tools?.map(t => t.name) || []);
    const model = editAgent.model ?? editAgent.chat_model ?? "kimi";
    setSelectedModel(model === "gemini" ? "gemini" : "kimi");
    setIconPreview(editAgent.icon_url || null);
    setSelectedIcon(editAgent.icon_url ? null : (editAgent.icon_name || editAgent.icon || "Bot"));
  }, [editAgent?.id, editAgent?.model, editAgent?.name, editAgent?.description, editAgent?.system_instructions, editAgent?.tools, editAgent?.icon_url, editAgent?.icon_name, editAgent?.icon]);

  React.useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => onClose(), 280);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  const handleClose = () => {
    if (isCreating || closing) return;
    setClosing(true);
  };

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Hide mobile header when modal is open
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("modal-open", { detail: true }));
    return () => window.dispatchEvent(new CustomEvent("modal-open", { detail: false }));
  }, []);

  const ICON_OPTIONS = [
    { name: "Bot", icon: Bot },
    { name: "Zap", icon: Zap },
    { name: "Brain", icon: Brain },
    { name: "Sparkles", icon: Sparkles },
    { name: "Cpu", icon: Cpu },
    { name: "Settings", icon: Settings },
    { name: "Palette", icon: Palette },
    { name: "Rocket", icon: Rocket },
  ];

  const handleIconChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      const preview = URL.createObjectURL(file);
      setIconPreview(preview);
      setSelectedIcon(null);
    }
  };

  const analyzeAndSuggest = async () => {
    if (!name.trim()) return;
    logStep("AgentModal", "analyzeAndSuggest: start");
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
      logStep("AgentModal", "analyzeAndSuggest: done");
    } catch (e) {
      console.error("Suggestion failed:", e);
      logStep("AgentModal", "analyzeAndSuggest: error", String(e?.message || e));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    logStep("AgentModal", isEditing ? "Agent.update: start" : "Agent.create: start", name.trim());
    setIsCreating(true);
    try {
      let iconUrl = isEditing ? editAgent.icon_url : null;
      if (iconFile) {
        logStep("AgentModal", "UploadFile: icon");
        const uploadRes = await base44.integrations.Core.UploadFile({ file: iconFile });
        iconUrl = uploadRes.file_url;
      }

      const agentData = {
        name: name.trim(),
        description: description.trim(),
        system_instructions: systemInstructions.trim(),
        system_prompt: systemInstructions.trim(),
        icon_url: iconUrl,
        icon_name: selectedIcon,
        icon: selectedIcon,
        tools: [...new Set([...selectedTools, ...BUILTIN_TOOL_NAMES])].map(t => ({ name: t, enabled: true })),
        model: selectedModel,
        knowledge_base_ids: isEditing ? (editAgent.knowledge_base_ids || []) : [],
        status: isEditing ? editAgent.status : "active"
      };

      if (isEditing) {
        await onUpdate(editAgent.id, agentData);
        logStep("AgentModal", "Agent.update: done", editAgent.id);
      } else {
        await onCreate(agentData);
        logStep("AgentModal", "Agent.create: done");
      }
      reset();
    } catch (e) {
      logStep("AgentModal", isEditing ? "Agent.update: error" : "Agent.create: error", String(e?.message || e));
      throw e;
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setName("");
    setDescription("");
    setSystemInstructions("");
    setSelectedTools([]);
    setSelectedModel("kimi");
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

  const show = mounted && !closing;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)",
      opacity: show ? 1 : 0,
      transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
    }} onClick={handleClose}>
      <div style={{
        background: isMobile ? "#0a0a0a" : "#181818",
        border: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: isMobile ? 0 : 16,
        padding: 24, width: "100%",
        maxWidth: isMobile ? "100%" : 600,
        height: isMobile ? "100%" : "auto",
        maxHeight: isMobile ? "100%" : "90vh",
        overflow: "auto",
        boxShadow: isMobile ? "none" : "0 20px 25px rgba(0,0,0,0.5)",
        msOverflowStyle: "none", scrollbarWidth: "none",
        opacity: show ? 1 : 0,
        transform: show ? "scale(1)" : "scale(0.96)",
        transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>{isEditing ? "Edit Agent" : "Create New Agent"}</h2>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", display: "flex", padding: 4, borderRadius: 6, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Agent Name */}
          <div>
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

          {/* Description */}
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
                outline: "none", fontFamily: "inherit", resize: "none",
                overflow: "auto", scrollbarWidth: "none", msOverflowStyle: "none"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.4)"}
              onBlur={e => e.target.style.borderColor = "#2a2a2a"}
            />
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
                outline: "none", fontFamily: "inherit", resize: "none",
                overflow: "auto", msOverflowStyle: "none", scrollbarWidth: "none"
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
                <button key={iconName} onClick={() => { setSelectedIcon(iconName); setIconPreview(null); setIconFile(null); }} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 52, height: 52, borderRadius: 10,
                  background: selectedIcon === iconName ? "rgba(249,115,22,0.15)" : "#0f0f0f",
                  border: `1px solid ${selectedIcon === iconName ? "rgba(249,115,22,0.4)" : "#2a2a2a"}`,
                  cursor: "pointer", transition: "all 0.2s", color: selectedIcon === iconName ? "#f97316" : "#555",
                  padding: 0
                }} title={iconName}>
                  <IconComponent style={{ width: 24, height: 24 }} />
                </button>
              ))}
            </div>
            <label style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 16px", borderRadius: 10,
              background: iconPreview ? "rgba(249,115,22,0.15)" : "#0f0f0f",
              border: `2px dashed ${iconPreview ? "rgba(249,115,22,0.4)" : "#2a2a2a"}`,
              cursor: "pointer", transition: "all 0.2s"
            }} onMouseEnter={e => { if (!iconPreview) e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"; }}
              onMouseLeave={e => { if (!iconPreview) e.currentTarget.style.borderColor = "#2a2a2a"; }}>
              {iconPreview ? (
                <>
                  <img src={iconPreview} alt="preview" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                  <span style={{ fontSize: 12, color: "#f5f5f5", flex: 1 }}>Custom icon uploaded</span>
                  <button onClick={(e) => { e.preventDefault(); setIconPreview(null); setIconFile(null); setSelectedIcon("Bot"); }} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", transition: "all 0.2s",
                    color: "#ef4444", flexShrink: 0
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
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

          {/* Model */}
          <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 12 }}>Model</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { id: "kimi", label: "Kimi (K2.5)" },
                { id: "gemini", label: "Gemini (3.1 Flash-Lite)" },
              ].map(opt => {
                const isSelected = selectedModel === opt.id;
                return (
                  <button key={opt.id} type="button" onClick={() => setSelectedModel(opt.id)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20,
                    background: isSelected ? "#f97316" : "#0f0f0f",
                    border: `1px solid ${isSelected ? "#f97316" : "#2a2a2a"}`,
                    cursor: "pointer", transition: "all 0.2s", fontSize: 12, fontWeight: 500,
                    color: isSelected ? "#fff" : "#f5f5f5",
                    whiteSpace: "nowrap"
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: isSelected ? "#fff" : "#f97316",
                      flexShrink: 0
                    }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tools Access — only shown if there are non-built-in tools */}
          {AVAILABLE_TOOLS.length > 0 && (
           <div style={{ paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
             <p style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 12 }}>Tools Access</p>
             <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
               {AVAILABLE_TOOLS.map(tool => (
                 <button key={tool.name} onClick={() => toggleTool(tool.name)} style={{
                   display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20,
                   background: selectedTools.includes(tool.name) ? "#f97316" : "#0f0f0f",
                   border: `1px solid ${selectedTools.includes(tool.name) ? "#f97316" : "#2a2a2a"}`,
                   cursor: "pointer", transition: "all 0.2s", fontSize: 12, fontWeight: 500,
                   color: selectedTools.includes(tool.name) ? "#fff" : "#f5f5f5",
                   whiteSpace: "nowrap"
                 }}>
                   <div style={{
                     width: 6, height: 6, borderRadius: "50%", 
                     background: selectedTools.includes(tool.name) ? "#fff" : "#f97316",
                     flexShrink: 0
                   }} />
                   {tool.label}
                 </button>
               ))}
             </div>
           </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "transparent",
              border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 14, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim() || isCreating} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", fontSize: 14, fontWeight: 500,
              cursor: !name.trim() || isCreating ? "not-allowed" : "pointer", opacity: !name.trim() || isCreating ? 0.5 : 1,
              transition: "all 0.2s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}>
              {isCreating ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Agent")}
            </button>
          </div>

          {isEditing && !showDeleteConfirm && (
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              width: "100%", padding: "10px 16px", borderRadius: 10,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444", fontSize: 14, fontWeight: 500, cursor: "pointer",
              transition: "all 0.2s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
              Delete Agent
            </button>
          )}

          {isEditing && showDeleteConfirm && (
            <div style={{
              padding: 14, borderRadius: 10, background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)", display: "flex", flexDirection: "column", gap: 10
            }}>
              <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 500, textAlign: "center" }}>
                Are you sure you want to delete this agent?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{
                  flex: 1, padding: "8px 14px", borderRadius: 8, background: "transparent",
                  border: "1px solid #2a2a2a", color: "#f5f5f5", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.2s"
                }}>
                  Cancel
                </button>
                <button onClick={() => { onDelete(editAgent.id); onClose(); }} style={{
                  flex: 1, padding: "8px 14px", borderRadius: 8, background: "#ef4444",
                  border: "none", color: "#fff", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.2s"
                }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        [style*="maxHeight: 90vh"] {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        [style*="maxHeight: 90vh"]::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>
    </div>
  );
}