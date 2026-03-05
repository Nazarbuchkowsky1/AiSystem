import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Clock, Zap, Brain, Send, Square, Plus, Mic, Bot,
  Loader2, X, FileText, Code2
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

const noSelect = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
};

export default function AgentWorkspace({ agent, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("instant");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [isMultiLineSt, setIsMultiLineSt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const filesScrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);

  const MAX_HEIGHT = 188;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { loadHistory(); }, [agent]);

  useEffect(() => {
    if (filesScrollRef.current) {
      filesScrollRef.current.scrollLeft = filesScrollRef.current.scrollWidth;
    }
  }, [attachedFiles]);

  // Auto-resize textarea — only runs when in single-line DOM mode to measure
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Save scroll pos
    ta.style.height = "auto";
    const sh = ta.scrollHeight;
    const clamped = Math.min(sh, MAX_HEIGHT);
    ta.style.height = clamped + "px";
    ta.style.overflowY = sh > MAX_HEIGHT ? "auto" : "hidden";
    // Determine multiline: threshold is ~44px (one line = 24px text + 13+7 padding)
    if (input.length === 0) {
      setIsMultiLineSt(false);
    } else {
      // Use 48px threshold (one line of text = ~44px including padding in single-line mode)
      const threshold = isMultiLineSt ? 40 : 48;
      setIsMultiLineSt(sh > threshold);
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

  // Voice recording
  const startRecording = async () => {
    if (isLoading || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setIsFinalizing(false);
    recordedChunksRef.current = [];
    mediaRecorderRef.current = null;
  };

  const confirmRecording = async () => {
    setIsFinalizing(true);
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      await new Promise(resolve => { mr.onstop = resolve; mr.stop(); });
    }
    const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsRecording(false);
    setIsFinalizing(false);
    recordedChunksRef.current = [];
    // Just append a placeholder since we have no transcription endpoint
    setInput(prev => (prev ? prev + " [voice message]" : "[voice message]"));
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setIsLoading(false);
  };

  const handleSend = async () => {
    const hasContent = input.trim() || attachedFiles.length > 0;
    if (!hasContent || isLoading) return;
    const userMsg = input.trim();
    const filesToSend = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);

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
  const hasContent = !!(input.trim() || attachedFiles.length > 0);
  const isMultiLine = input.length > 0 && textareaHeight > SINGLE_LINE_THRESHOLD;
  const showFilesBar = attachedFiles.length > 0;
  const isExpanded = isMultiLine || showFilesBar;

  // Input bar styles
  const barBg = inputFocused ? "#1e1e1e" : "#181818";
  const barBorder = inputFocused ? "rgba(249,115,22,0.4)" : "#2a2a2a";
  const barShadow = inputFocused ? "0 0 0 3px rgba(249,115,22,0.08)" : "none";

  const renderRightButtons = () => isRecording ? (
    isFinalizing ? (
      <Loader2 style={{ width: 16, height: 16, color: "#f97316", animation: "spin 1s linear infinite" }} />
    ) : (
      <>
        <button onMouseDown={e => e.preventDefault()} onClick={stopRecording}
          style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
        <button onMouseDown={e => e.preventDefault()} onClick={confirmRecording}
          style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send style={{ width: 14, height: 14, color: "#fff" }} />
        </button>
      </>
    )
  ) : (
    <>
      <button onMouseDown={e => e.preventDefault()} onClick={startRecording} disabled={isLoading}
        style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: isLoading ? "not-allowed" : "pointer", color: "#555", display: "flex", transition: "color 0.2s", opacity: isLoading ? 0.4 : 1 }}
        onMouseEnter={e => { if (!isLoading) e.currentTarget.style.color = "#f5f5f5"; }}
        onMouseLeave={e => e.currentTarget.style.color = "#555"}>
        <Mic style={{ width: 17, height: 17 }} />
      </button>
      {isLoading ? (
        <button onMouseDown={e => e.preventDefault()} onClick={stopGeneration}
          style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Square style={{ width: 14, height: 14, color: "#fff" }} />
        </button>
      ) : (
        <button onMouseDown={e => e.preventDefault()} onClick={handleSend} disabled={!hasContent}
          style={{ width: 36, height: 36, borderRadius: 12, border: "none", cursor: hasContent ? "pointer" : "not-allowed", background: hasContent ? "#f97316" : "rgba(249,115,22,0.15)", display: "flex", alignItems: "center", justifyContent: "center", opacity: hasContent ? 1 : 0.5, transition: "all 0.2s" }}>
          <Send style={{ width: 14, height: 14, color: hasContent ? "#fff" : "#f97316" }} />
        </button>
      )}
    </>
  );

  const renderInputBar = () => (
    <div
      style={{
        ...noSelect,
        background: barBg,
        border: `1px solid ${barBorder}`,
        borderRadius: 24,
        boxShadow: barShadow,
        transition: "border-color 0.2s, box-shadow 0.2s",
        overflow: "hidden",
      }}
    >
      {/* Files strip — seamlessly inside bar, no divider */}
      {showFilesBar && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 0" }}>
          <div
            ref={filesScrollRef}
            style={{ flex: 1, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {attachedFiles.map((af) => (
              <div
                key={af.id}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#262626", border: "1px solid #333", borderRadius: 10,
                  padding: "5px 8px", flexShrink: 0, maxWidth: 150,
                }}
              >
                {af.type === "image" && af.preview
                  ? <img src={af.preview} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                  : af.type === "code"
                  ? <div style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Code2 style={{ width: 13, height: 13, color: "#a855f7" }} />
                    </div>
                  : <div style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText style={{ width: 13, height: 13, color: "#3b82f6" }} />
                    </div>
                }
                <span style={{ fontSize: 11, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 72 }}>{af.file.name}</span>
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); removeFile(af.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#666", padding: "2px", display: "flex", borderRadius: 4,
                    flexShrink: 0, transition: "color 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#f97316"; e.currentTarget.style.transform = "scale(1.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#666"; e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#444", flexShrink: 0, paddingRight: 4 }}>{attachedFiles.length}/{MAX_FILES}</span>
        </div>
      )}

      {isExpanded ? (
        /* Multi-line / files mode: flex-col */
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Textarea full width */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onPaste={handlePaste}
            placeholder="Message agent..."
            rows={1}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "transparent", border: "none", outline: "none", resize: "none",
              fontSize: 15, lineHeight: "24px", color: "#f5f5f5", fontFamily: "inherit",
              padding: "12px 16px 4px",
              overflowY: "hidden", maxHeight: MAX_HEIGHT,
            }}
          />
          {/* Action bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 8px" }}>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
              onMouseLeave={e => e.currentTarget.style.color = "#555"}
            >
              <Plus style={{ width: 17, height: 17 }} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {renderRightButtons()}
            </div>
          </div>
        </div>
      ) : (
        /* Single-line mode: flex-row */
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 8px" }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", flexShrink: 0, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
            onMouseLeave={e => e.currentTarget.style.color = "#555"}
          >
            <Plus style={{ width: 17, height: 17 }} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onPaste={handlePaste}
            placeholder="Message agent..."
            rows={1}
            style={{
              flex: 1, minWidth: 0,
              background: "transparent", border: "none", outline: "none", resize: "none",
              fontSize: 15, lineHeight: "24px", color: "#f5f5f5", fontFamily: "inherit",
              padding: "16px 8px 8px",
              overflowY: "hidden",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {renderRightButtons()}
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
    <div style={{ ...noSelect, height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a", position: "relative", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onMouseDown={e => e.preventDefault()}
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
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: 7, borderRadius: 10, background: showHistory ? "rgba(249,115,22,0.1)" : "none", border: "none", cursor: "pointer", color: showHistory ? "#f97316" : "#555", display: "flex", transition: "all 0.2s" }}
          >
            <Clock style={{ width: 15, height: 15 }} />
          </button>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a" }}>
            {[["instant", Zap, "Instant"], ["thinking", Brain, "Thinking"]].map(([val, Icon, label]) => (
              <button
                key={val}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setMode(val)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                  fontSize: 11, fontWeight: 500,
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
                <button
                  key={c.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => loadConversation(c)}
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 12, background: "none", border: "1px solid transparent", cursor: "pointer", transition: "all 0.2s" }}
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

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!hasMessages ? (
          /* Welcome */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
            <div style={{ textAlign: "center", width: "100%", maxWidth: 680 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
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
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "100%" }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "75%", minWidth: 0, borderRadius: 18, padding: "10px 16px",
                      background: msg.role === "user" ? "rgba(249,115,22,0.12)" : "#181818",
                      border: msg.role === "user" ? "1px solid rgba(249,115,22,0.2)" : "1px solid #2a2a2a",
                      wordBreak: "break-word", overflowWrap: "break-word",
                    }}>
                      {msg.role === "assistant" ? (
                        <ReactMarkdown className="text-sm prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <p style={{ fontSize: 14, color: "#f5f5f5", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
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
            </div>

            {/* Bottom input */}
            <div style={{ padding: "8px 24px 16px", flexShrink: 0 }}>
              {renderInputBar()}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::placeholder { color: #555; }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}