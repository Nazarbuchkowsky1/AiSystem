import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Clock, Zap, Brain, Send, Square, Plus, Mic, Bot,
  Loader2, X, FileText, Code2, Check
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const MAX_FILES = 30;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const CODE_EXTS = ["js","ts","jsx","tsx","py","rb","go","rs","cpp","c","cs","java","php","swift","kt","html","css","scss","json","yaml","yml","xml","sh","bash","sql","md","txt","csv"];
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const WAVE_UNIT = BAR_WIDTH + BAR_GAP;
const SINGLE_LINE_TEXTAREA_HEIGHT = 44;
const MAX_VISIBLE_TEXTAREA_HEIGHT = 188;

function getFileType(file) {
  if (SUPPORTED_IMAGES.includes(file.type)) return "image";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (CODE_EXTS.includes(ext)) return "code";
  return "document";
}

const noSelect = { userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none" };

// Segmented spinner component for finalizing state
function SegmentedSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360;
        const rad = (angle - 90) * (Math.PI / 180);
        const x1 = 8 + 4.5 * Math.cos(rad);
        const y1 = 8 + 4.5 * Math.sin(rad);
        const x2 = 8 + 7 * Math.cos(rad);
        const y2 = 8 + 7 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ opacity: 0.15 + (i / 8) * 0.85, animation: `segfade 0.8s ${-(i / 8) * 0.8}s linear infinite` }}
          />
        );
      })}
    </svg>
  );
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
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [waveLevels, setWaveLevels] = useState([]);
  const [waveBarCount, setWaveBarCount] = useState(60);
  const [pendingTranscript, setPendingTranscript] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const filesScrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const waveContainerRef = useRef(null);
  const waveBarCountRef = useRef(60);
  const waveLevelsRef = useRef([]);
  const recordingMimeRef = useRef("");

  const [multiLine, setMultiLine] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { loadHistory(); }, [agent]);

  useEffect(() => {
    if (filesScrollRef.current) {
      filesScrollRef.current.scrollLeft = filesScrollRef.current.scrollWidth;
    }
  }, [attachedFiles]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";
    void textarea.offsetHeight;

    const realScrollHeight = textarea.scrollHeight;
    const newHeight = Math.max(
      SINGLE_LINE_TEXTAREA_HEIGHT,
      Math.min(realScrollHeight, MAX_VISIBLE_TEXTAREA_HEIGHT),
    );

    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = realScrollHeight > MAX_VISIBLE_TEXTAREA_HEIGHT ? "auto" : "hidden";

    const isNowMultiLine = realScrollHeight > (multiLine ? 40 : 45);

    if (input.length === 0) {
      if (multiLine) setMultiLine(false);
    } else if (isNowMultiLine !== multiLine) {
      setMultiLine(isNowMultiLine);
    }
  }, [input, isRecording, attachedFiles.length, multiLine]);

  // ResizeObserver for wave container
  useEffect(() => {
    const el = waveContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width || 200;
      const count = Math.max(50, Math.floor(w / WAVE_UNIT));
      waveBarCountRef.current = count;
      setWaveBarCount(count);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isRecording]);

  // Post-recording: insert transcript into textarea
  useEffect(() => {
    if (pendingTranscript !== null && !isRecording && !isFinalizing) {
      setInput(prev => prev ? prev + " " + pendingTranscript : pendingTranscript);
      setPendingTranscript(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [pendingTranscript, isRecording, isFinalizing]);

  // Keyboard shortcuts during recording
  useEffect(() => {
    if (!isRecording && !isFinalizing) return;
    const handler = (e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirmRecording(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelRecording(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isRecording, isFinalizing]);

  const startWaveform = (stream) => {
    try {
      const ac = new AudioContext();
      audioContextRef.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const src = ac.createMediaStreamSource(stream);
      src.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.min(1, rms * 6);
        const count = waveBarCountRef.current;
        waveLevelsRef.current = [...waveLevelsRef.current.slice(-(count - 1)), level];
        setWaveLevels([...waveLevelsRef.current]);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (e) {
      // fallback: animate baseline
      startFallbackWaveform();
    }
  };

  const startFallbackWaveform = () => {
    const tick = () => {
      const count = waveBarCountRef.current;
      const level = 0.05 + Math.random() * 0.08;
      waveLevelsRef.current = [...waveLevelsRef.current.slice(-(count - 1)), level];
      setWaveLevels([...waveLevelsRef.current]);
      animFrameRef.current = setTimeout(() => { animFrameRef.current = requestAnimationFrame(tick); }, 50);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const stopWaveform = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (analyserRef.current) { analyserRef.current = null; }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    waveLevelsRef.current = [];
    setWaveLevels([]);
  };

  const cleanupAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    stopWaveform();
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  };

  const startRecording = async () => {
    if (isLoading || isRecording || isFinalizing) return;
    recordedChunksRef.current = [];
    recordingMimeRef.current = "";
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      recordingMimeRef.current = mimeType || "audio/webm";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.start(250);
      startWaveform(stream);
    } catch (err) {
      console.error("Mic error:", err);
      startFallbackWaveform();
    }
  };

  const cancelRecording = () => {
    setIsFinalizing(false);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
  };

  const confirmRecording = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      await new Promise(resolve => { mr.onstop = resolve; mr.stop(); });
    }
    setIsRecording(false);
    const chunks = recordedChunksRef.current;
    const mime = recordingMimeRef.current || "audio/webm";

    if (!chunks.length) {
      cleanupAudio();
      setIsFinalizing(false);
      return;
    }

    const blob = new Blob(chunks, { type: mime });
    if (blob.size < 100) {
      cleanupAudio();
      setIsFinalizing(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json();
      let text = (data.text || "").trim();
      if (text) {
        // Normalize spacing after punctuation
        text = text.replace(/([.,!?;:])([^\s])/g, "$1 $2");
        text = text.replace(/\s+/g, " ").trim();
        // Capitalize first letter
        text = text.charAt(0).toUpperCase() + text.slice(1);
        // Capitalize after sentence boundaries
        text = text.replace(/([.!?]\s+)([a-zа-яёіїєґ])/g, (_, p, c) => p + c.toUpperCase());
        setPendingTranscript(text);
      }
    } catch (e) {
      console.error("Transcription error:", e);
      // fallback: insert placeholder
      setInput(prev => prev ? prev + " [voice message]" : "[voice message]");
      setTimeout(() => textareaRef.current?.focus(), 0);
    } finally {
      cleanupAudio();
      setIsFinalizing(false);
    }
  };

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

    abortControllerRef.current = new AbortController();
    const res = await base44.functions.invoke("agentChat", {
      messages: newMessages,
      agent: {
        name: agent.name,
        description: agent.description || "",
        system_instructions: agent.system_instructions || agent.system_prompt || "",
        knowledge_base_ids: agent.knowledge_base_ids || [],
        tools: agent.tools || [],
      },
      mode,
    });
    const response = res.data?.response || "Error generating response.";
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
  const showFilesBar = attachedFiles.length > 0;
  const inVoiceMode = isRecording || isFinalizing;

  const barBg = inputFocused ? "#1e1e1e" : "#181818";
  const barBorder = inputFocused ? "rgba(249,115,22,0.4)" : inVoiceMode ? "rgba(249,115,22,0.5)" : "#2a2a2a";
  const barShadow = inputFocused || inVoiceMode ? "0 0 0 3px rgba(249,115,22,0.08)" : "none";

  // Right-side buttons
  const renderRightButtons = () => {
    if (isFinalizing) {
      return (
        <>
          <button onMouseDown={e => e.preventDefault()} onClick={cancelRecording}
            style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
          <button disabled
            style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", border: "none", cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SegmentedSpinner />
          </button>
        </>
      );
    }
    if (isRecording) {
      return (
        <>
          <button onMouseDown={e => e.preventDefault()} onClick={cancelRecording}
            style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
          <button onMouseDown={e => e.preventDefault()} onClick={confirmRecording}
            style={{ width: 36, height: 36, borderRadius: 12, background: "#f97316", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check style={{ width: 15, height: 15, color: "#fff" }} />
          </button>
        </>
      );
    }
    // Normal mode
    return (
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
  };

  const renderWaveform = () => (
    <div
      ref={waveContainerRef}
      style={{ flex: 1, height: 48, display: "flex", alignItems: "center", gap: BAR_GAP + "px", overflow: "hidden", padding: "0 4px" }}
    >
      {Array.from({ length: waveBarCount }).map((_, i) => {
        const level = waveLevels[i] ?? 0;
        const heightPct = Math.max(4, Math.round(level * 88));
        const isFresh = i > waveBarCount * 0.6;
        const opacity = 0.35 + (i / waveBarCount) * 0.65;
        return (
          <div key={i} style={{
            width: BAR_WIDTH,
            height: heightPct + "%",
            borderRadius: 2,
            background: level > 0.15 ? "#f97316" : "rgba(249,115,22,0.4)",
            opacity,
            transition: "height 0.05s linear",
            flexShrink: 0,
          }} />
        );
      })}
    </div>
  );

  const renderInputBar = () => {
    return (
    <div style={{
      ...noSelect,
      background: barBg,
      border: `1px solid ${barBorder}`,
      borderRadius: 20,
      boxShadow: barShadow,
      transition: "border-color 0.2s, box-shadow 0.2s",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Files strip */}
      {showFilesBar && !inVoiceMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 0" }}>
          <div ref={filesScrollRef} style={{ flex: 1, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {attachedFiles.map((af) => (
              <div key={af.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#262626", border: "1px solid #333", borderRadius: 10, padding: "5px 8px", flexShrink: 0, maxWidth: 150 }}>
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
                <button onMouseDown={e => e.preventDefault()} onClick={(e) => { e.stopPropagation(); removeFile(af.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: "2px", display: "flex", borderRadius: 4, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
                  onMouseLeave={e => e.currentTarget.style.color = "#666"}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#444", flexShrink: 0, paddingRight: 4 }}>{attachedFiles.length}/{MAX_FILES}</span>
        </div>
      )}

      {/* Voice mode */}
      {inVoiceMode && (
        <div style={{ display: "flex", alignItems: "center", padding: "8px 8px" }}>
          {renderWaveform()}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {renderRightButtons()}
          </div>
        </div>
      )}

      {/* Text input row */}
      {!inVoiceMode && (
        <div style={{ display: "flex", flexDirection: multiLine || attachedFiles.length > 0 ? "column" : "row", alignItems: multiLine || attachedFiles.length > 0 ? "stretch" : "center", height: multiLine || attachedFiles.length > 0 ? undefined : 56, padding: multiLine || attachedFiles.length > 0 ? undefined : "0 8px" }}>

          {/* Single-line: attach left of textarea */}
          {!multiLine && attachedFiles.length === 0 && (
            <button onMouseDown={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
              style={{ padding: "0 4px 0 2px", background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
              onMouseLeave={e => e.currentTarget.style.color = "#555"}>
              <Plus style={{ width: 17, height: 17 }} />
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0, width: (multiLine || attachedFiles.length > 0) ? "100%" : undefined, paddingTop: (multiLine || attachedFiles.length > 0) ? 2 : 0 }}>
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
              disabled={isLoading}
              style={{
                display: "block",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: 16,
                lineHeight: "24px",
                color: "#f5f5f5",
                fontFamily: "inherit",
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: (multiLine || attachedFiles.length > 0) ? 16 : 8,
                paddingRight: (multiLine || attachedFiles.length > 0) ? 16 : 8,
                overflowX: "hidden",
                overflowWrap: "break-word",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            />
          </div>

          {/* Single-line: mic + send right of textarea */}
          {!multiLine && attachedFiles.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {renderRightButtons()}
            </div>
          )}

          {/* Multi-line: action bar below textarea */}
          {(multiLine || attachedFiles.length > 0) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 12px 10px 12px" }}>
              <button onMouseDown={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
                style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
                onMouseLeave={e => e.currentTarget.style.color = "#555"}>
                <Plus style={{ width: 17, height: 17 }} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {renderRightButtons()}
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
        accept={[...SUPPORTED_IMAGES, "application/pdf", ".txt,.html,.css,.js,.ts,.jsx,.tsx,.py,.rb,.go,.rs,.cpp,.c,.cs,.java,.php,.swift,.kt,.md,.csv,.json,.xml,.sh,.sql,.yaml,.yml"].join(",")}
        onChange={e => { addFilesFromList(e.target.files); e.target.value = ""; }} />
    </div>
  );
  };

  return (
    <div style={{ ...noSelect, height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a", position: "relative", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onMouseDown={e => e.preventDefault()} onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 6, borderRadius: 10, display: "flex", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f5f5f5"}
            onMouseLeave={e => e.currentTarget.style.color = "#555"}>
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5" }}>{agent.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onMouseDown={e => e.preventDefault()} onClick={() => setShowHistory(!showHistory)}
            style={{ padding: 7, borderRadius: 10, background: showHistory ? "rgba(249,115,22,0.1)" : "none", border: "none", cursor: "pointer", color: showHistory ? "#f97316" : "#555", display: "flex", transition: "all 0.2s" }}>
            <Clock style={{ width: 15, height: 15 }} />
          </button>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a" }}>
            {[["instant", Zap, "Instant"], ["thinking", Brain, "Thinking"]].map(([val, Icon, label]) => (
              <button key={val} onMouseDown={e => e.preventDefault()} onClick={() => setMode(val)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, fontWeight: 500,
                  background: mode === val ? "rgba(249,115,22,0.15)" : "transparent",
                  color: mode === val ? "#f97316" : "#555", border: "none", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
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
                <button key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => loadConversation(c)}
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 12, background: "none", border: "1px solid transparent", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.06)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent"; }}>
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
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "100%" }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "75%", minWidth: 0, borderRadius: 18, padding: "10px 16px",
                      background: msg.role === "user" ? "rgba(249,115,22,0.12)" : "#181818",
                      border: msg.role === "user" ? "1px solid rgba(249,115,22,0.2)" : "1px solid #2a2a2a",
                      wordBreak: "break-word", overflowWrap: "break-word" }}>
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
            <div style={{ padding: "8px 24px 16px", flexShrink: 0 }}>
              <div style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
                {renderInputBar()}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes segfade { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
        textarea::placeholder { color: #555 !important; }
        textarea::-webkit-scrollbar { display: none; }
        .files-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}