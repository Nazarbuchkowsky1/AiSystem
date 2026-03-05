import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Clock, Zap, Brain, Send, Square, Plus, Mic, Bot,
  Loader2, X, FileText, Code2, Image as ImageIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const MAX_FILES = 30;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const CODE_EXTS = ["js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs","java","php","swift","kt","html","css","scss","json","yaml","yml","xml","sh","bash","sql","md","txt","csv"];

function getFileType(file) {
  if (SUPPORTED_IMAGES.includes(file.type)) return "image";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (CODE_EXTS.includes(ext)) return "code";
  return "document";
}

export default function AgentWorkspace({ agent, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("instant");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [multiLine, setMultiLine] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const filesScrollRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadHistory();
  }, [agent]);

  useEffect(() => {
    if (filesScrollRef.current) {
      filesScrollRef.current.scrollLeft = filesScrollRef.current.scrollWidth;
    }
  }, [attachedFiles]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const sh = ta.scrollHeight;
    const maxH = 188;
    ta.style.height = Math.min(sh, maxH) + "px";
    ta.style.overflowY = sh > maxH ? "auto" : "hidden";
    if (input.length === 0) {
      setMultiLine(false);
    } else {
      const isNow = sh > (multiLine ? 40 : 45);
      if (isNow !== multiLine) setMultiLine(isNow);
    }
  }, [input]);

  const loadHistory = async () => {
    const convos = await base44.entities.Conversation.filter({ agent_id: String(agent.id) }, "-created_date", 20);
    setConversations(convos);
  };

  const loadConversation = async (convo) => {
    const msgs = await base44.entities.Message.filter({ conversation_id: String(convo.id) }, "created_date", 100);
    setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
    setShowHistory(false);
  };

  const addFilesFromList = (files) => {
    const arr = Array.from(files);
    const newFiles = [];
    for (const file of arr) {
      if (attachedFiles.length + newFiles.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_SIZE) continue;
      const type = getFileType(file);
      const preview = type === "image" ? URL.createObjectURL(file) : null;
      newFiles.push({ file, type, preview, id: Math.random().toString(36).slice(2) });
    }
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setAttachedFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter(x => x.id !== id);
    });
  };

  const handlePaste = (e) => {
    const imgs = Array.from(e.clipboardData?.items || [])
      .filter(i => i.kind === "file" && i.type.startsWith("image/"))
      .map(i => i.getAsFile());
    if (imgs.length) { e.preventDefault(); addFilesFromList(imgs); }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    const userMsg = input.trim();
    const filesToSend = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);
    setMultiLine(false);

    let displayContent = userMsg;
    if (filesToSend.length > 0) {
      const names = filesToSend.map(f => f.file.name).join(", ");
      displayContent = userMsg ? `${userMsg}\n\n📎 ${names}` : `📎 ${names}`;
    }

    const newMessages = [...messages, { role: "user", content: displayContent }];
    setMessages(newMessages);
    setIsLoading(true);

    const systemPrompt = agent.system_prompt || `You are ${agent.name}. ${agent.description || ""}. ${
      mode === "thinking" ? "Think deeply and provide thorough, detailed responses." : "Be concise and direct."
    }`;
    const prompt = `${systemPrompt}\n\nConversation:\n${newMessages.map(m => `${m.role}: ${m.content}`).join("\n")}\n\nassistant:`;

    abortControllerRef.current = new AbortController();

    const response = await base44.integrations.Core.InvokeLLM({ prompt });

    setMessages(prev => [...prev, { role: "assistant", content: response }]);
    setIsLoading(false);
    abortControllerRef.current = null;

    if (messages.length === 0) {
      const convo = await base44.entities.Conversation.create({
        agent_id: String(agent.id), agent_name: agent.name,
        title: (userMsg || "File upload").substring(0, 60), mode,
        message_count: 2, last_message_preview: response.substring(0, 100),
      });
      await base44.entities.Message.bulkCreate([
        { conversation_id: String(convo.id), role: "user", content: displayContent },
        { conversation_id: String(convo.id), role: "assistant", content: response },
      ]);
      loadHistory();
    }
  };

  const hasMessages = messages.length > 0;
  const hasContent = input.trim() || attachedFiles.length > 0;
  const isMultiMode = multiLine || attachedFiles.length > 0;

  const inputBarStyle = {
    background: inputFocused ? "#1e1e1e" : "#181818",
    border: `1px solid ${inputFocused ? "rgba(249,115,22,0.35)" : "#2a2a2a"}`,
    borderRadius: 24,
    boxShadow: inputFocused ? "0 0 0 3px rgba(249,115,22,0.08)" : "none",
    transition: "all 0.2s",
  };

  const renderFilesBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div ref={filesScrollRef} style={{ flex: 1, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
        {attachedFiles.map((af) => (
          <div key={af.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#242424", border: "1px solid #333", borderRadius: 10, padding: "4px 8px", flexShrink: 0, maxWidth: 140 }}>
            {af.type === "image" && af.preview
              ? <img src={af.preview} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
              : af.type === "code"
              ? <div style={{ width: 22, height: 22, borderRadius: 4, background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Code2 style={{ width: 12, height: 12, color: "#a855f7" }} /></div>
              : <div style={{ width: 22, height: 22, borderRadius: 4, background: "rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText style={{ width: 12, height: 12, color: "#3b82f6" }} /></div>
            }
            <span style={{ fontSize: 10, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 70 }}>{af.file.name}</span>
            <button onClick={() => removeFile(af.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 0, display: "flex" }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>{attachedFiles.length}/{MAX_FILES}</span>
    </div>
  );

  const renderInputBar = () => (
    <div style={{ ...inputBarStyle, position: "relative", width: hasMessages ? "100%" : 680, maxWidth: "100%" }}>
      {attachedFiles.length > 0 && renderFilesBar()}

      {!isMultiMode ? (
        /* Single-line row */
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 8px" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
            onMouseLeave={e => e.currentTarget.style.color = "#555"}
          >
            <Plus style={{ width: 16, height: 16 }} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onPaste={handlePaste}
            placeholder="Message agent..."
            rows={1}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none", resize: "none",
              fontSize: 15, lineHeight: "24px", color: "#f5f5f5", paddingTop: 16, paddingBottom: 8,
              overflowY: "hidden", fontFamily: "inherit",
            }}
          />
          <button style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}>
            <Mic style={{ width: 16, height: 16 }} />
          </button>
          {isLoading ? (
            <button onClick={stopGeneration} style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 4 }}>
              <Square style={{ width: 14, height: 14, color: "#fff" }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasContent}
              style={{
                width: 36, height: 36, borderRadius: 12, border: "none", cursor: hasContent ? "pointer" : "not-allowed",
                background: hasContent ? "#f97316" : "rgba(249,115,22,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", marginRight: 4,
                opacity: hasContent ? 1 : 0.5, transition: "all 0.2s",
              }}
            >
              <Send style={{ width: 14, height: 14, color: hasContent ? "#fff" : "#f97316" }} />
            </button>
          )}
        </div>
      ) : (
        /* Multi-line */
        <div style={{ display: "flex", flexDirection: "column" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onPaste={handlePaste}
            placeholder="Message agent..."
            rows={1}
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none", resize: "none",
              fontSize: 15, lineHeight: "24px", color: "#f5f5f5", paddingTop: 13, paddingBottom: 7,
              paddingLeft: 16, paddingRight: 16, overflowY: "hidden", fontFamily: "inherit",
            }}
          />
          {/* Action bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 8px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
              onMouseLeave={e => e.currentTarget.style.color = "#555"}
            >
              <Plus style={{ width: 16, height: 16 }} />
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}>
                <Mic style={{ width: 16, height: 16 }} />
              </button>
              {isLoading ? (
                <button onClick={stopGeneration} style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Square style={{ width: 14, height: 14, color: "#fff" }} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!hasContent}
                  style={{
                    width: 36, height: 36, borderRadius: 12, border: "none", cursor: hasContent ? "pointer" : "not-allowed",
                    background: hasContent ? "#f97316" : "rgba(249,115,22,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: hasContent ? 1 : 0.5, transition: "all 0.2s",
                  }}
                >
                  <Send style={{ width: 14, height: 14, color: hasContent ? "#fff" : "#f97316" }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        accept={[...SUPPORTED_IMAGES, "application/pdf", ".txt,.html,.css,.js,.ts,.jsx,.tsx,.py,.rb,.go,.rs,.cpp,.c,.cs,.java,.php,.swift,.kt,.md,.csv,.json,.xml,.sh,.sql,.yaml,.yml"].join(",")}
        onChange={e => { addFilesFromList(e.target.files); e.target.value = ""; }}
      />
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 6, borderRadius: 10, display: "flex", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f5f5f5"}
            onMouseLeave={e => e.currentTarget.style.color = "#555"}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{agent.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: 7, borderRadius: 10, background: showHistory ? "rgba(249,115,22,0.1)" : "none", border: "none", cursor: "pointer", color: showHistory ? "#f97316" : "#555", display: "flex", transition: "all 0.2s" }}
          >
            <Clock style={{ width: 15, height: 15 }} />
          </button>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a" }}>
            {[["instant", Zap, "Instant"], ["thinking", Brain, "Thinking"]].map(([val, Icon, label]) => (
              <button
                key={val}
                onClick={() => setMode(val)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, fontWeight: 500,
                  background: mode === val ? "rgba(249,115,22,0.15)" : "transparent",
                  color: mode === val ? "#f97316" : "#555",
                  border: "none", cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <Icon style={{ width: 11, height: 11 }} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div style={{ position: "absolute", right: 0, top: 56, width: 300, height: "calc(100% - 56px)", zIndex: 20, background: "#111", borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto" }}>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#f5f5f5", marginBottom: 12 }}>Chat History</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {conversations.map(c => (
                <button key={c.id} onClick={() => loadConversation(c)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 12, background: "none", border: "1px solid transparent", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.06)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
                  <p style={{ fontSize: 10, color: "#444", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_message_preview}</p>
                </button>
              ))}
              {conversations.length === 0 && <p style={{ fontSize: 11, color: "#444", textAlign: "center", padding: 20 }}>No history yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {!hasMessages ? (
          /* Welcome state — centered */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
            <div style={{ textAlign: "center", width: "100%", maxWidth: 680 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Bot style={{ width: 28, height: 28, color: "#f97316" }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", marginBottom: 8 }}>{agent.name}</h2>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 28, lineHeight: 1.6, maxWidth: 440, margin: "0 auto 28px" }}>{agent.description}</p>
              {renderInputBar()}
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "75%", borderRadius: 18, padding: "10px 16px",
                    background: msg.role === "user" ? "rgba(249,115,22,0.12)" : "#181818",
                    border: msg.role === "user" ? "1px solid rgba(249,115,22,0.2)" : "1px solid #2a2a2a",
                  }}>
                    {msg.role === "assistant" ? (
                      <ReactMarkdown className="text-sm prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p style={{ fontSize: 14, color: "#f5f5f5", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "#181818", border: "1px solid #2a2a2a", borderRadius: 18, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Loader2 style={{ width: 14, height: 14, color: "#f97316", animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: 12, color: "#555" }}>{mode === "thinking" ? "Thinking deeply..." : "Generating..."}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom input */}
            <div style={{ padding: "8px 24px 16px", flexShrink: 0 }}>
              {renderInputBar()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}