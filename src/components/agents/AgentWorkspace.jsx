import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Clock, Zap, Brain, Send, Square, Plus, Mic, Bot,
  Loader2, X, FileText, Code2, Check, Trash2, Copy
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
const INPUT_BAR_EMPTY_MAX_WIDTH = 680;   // empty state + input bar before first message
const CHAT_CONTENT_MAX_WIDTH = 1020;    // when dialogue started: messages + input bar (~1.5× empty width)

function getFileType(file) {
  if (SUPPORTED_IMAGES.includes(file.type)) return "image";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (CODE_EXTS.includes(ext)) return "code";
  return "document";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read audio blob"));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio blob"));
    reader.readAsDataURL(blob);
  });
}

const noSelect = { userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none" };

function markdownToPlainText(md) {
  if (!md || typeof md !== "string") return "";
  let s = md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/^```\w*\n?|```$/g, "").trim())
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

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
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("instant");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyPanelClosing, setHistoryPanelClosing] = useState(false);
  const [historyPanelOpening, setHistoryPanelOpening] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [deletingConvoIds, setDeletingConvoIds] = useState(new Set());
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [waveLevels, setWaveLevels] = useState([]);
  const [waveBarCount, setWaveBarCount] = useState(60);
  const [pendingTranscript, setPendingTranscript] = useState(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const copiedTimeoutRef = useRef(null);

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
  const lifetimeMessageCountRef = useRef(agent.message_count ?? 0);

  const [multiLine, setMultiLine] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { loadHistory(); }, [agent]);
  useEffect(() => { lifetimeMessageCountRef.current = agent.message_count ?? 0; }, [agent.id, agent.message_count]);

  // History panel: animate in from right when opening (start at 100%, then transition to 0)
  useEffect(() => {
    if (!showHistory || !historyPanelOpening) return;
    const id = setTimeout(() => setHistoryPanelOpening(false), 30);
    return () => clearTimeout(id);
  }, [showHistory, historyPanelOpening]);

  // History panel: wait for close animation then unmount
  useEffect(() => {
    if (!historyPanelClosing) return;
    const id = setTimeout(() => {
      setShowHistory(false);
      setHistoryPanelClosing(false);
    }, 300);
    return () => clearTimeout(id);
  }, [historyPanelClosing]);

  useEffect(() => () => { if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current); }, []);

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

  const waveStoppedRef = useRef(true);
  const waveTimerRef = useRef(null);

  const startWaveform = (stream) => {
    waveStoppedRef.current = false;
    const count = waveBarCountRef.current;
    waveLevelsRef.current = new Array(count).fill(0);
    setWaveLevels([...waveLevelsRef.current]);

    try {
      const ac = new AudioContext();
      audioContextRef.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;
      const src = ac.createMediaStreamSource(stream);
      src.connect(analyser);

      const freqBuf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (waveStoppedRef.current) return;
        analyser.getByteFrequencyData(freqBuf);
        let sum = 0;
        const bins = Math.min(64, freqBuf.length);
        for (let i = 0; i < bins; i++) sum += freqBuf[i];
        const avg = sum / bins / 255;
        const level = Math.min(1, Math.pow(avg, 0.5) * 1.3);
        const c = waveBarCountRef.current;
        const prev = waveLevelsRef.current;
        const next = prev.length >= c ? [...prev.slice(1), level] : [...prev, level];
        waveLevelsRef.current = next;
        setWaveLevels([...next]);
        waveTimerRef.current = setTimeout(tick, 50);
      };
      waveTimerRef.current = setTimeout(tick, 50);
    } catch (e) {
      startFallbackWaveform();
    }
  };

  const startFallbackWaveform = () => {
    waveStoppedRef.current = false;
    const count = waveBarCountRef.current;
    waveLevelsRef.current = new Array(count).fill(0);
    setWaveLevels([...waveLevelsRef.current]);

    const tick = () => {
      if (waveStoppedRef.current) return;
      const c = waveBarCountRef.current;
      const level = 0.05 + Math.random() * 0.08;
      const prev = waveLevelsRef.current;
      const next = prev.length >= c ? [...prev.slice(1), level] : [...prev, level];
      waveLevelsRef.current = next;
      setWaveLevels([...next]);
      waveTimerRef.current = setTimeout(tick, 80);
    };
    waveTimerRef.current = setTimeout(tick, 80);
  };

  const stopWaveform = () => {
    waveStoppedRef.current = true;
    if (waveTimerRef.current) {
      clearTimeout(waveTimerRef.current);
      waveTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
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
    cleanupAudio();
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
    setIsFinalizing(false);
    setIsRecording(false);
  };

  const confirmRecording = async () => {
    if (isFinalizing) return;

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      await new Promise(resolve => { mr.onstop = resolve; mr.stop(); });
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    stopWaveform();

    const chunks = [...recordedChunksRef.current];
    const mime = recordingMimeRef.current || "audio/webm";
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

    setIsRecording(false);

    if (!chunks.length) {
      setIsFinalizing(false);
      return;
    }

    const blob = new Blob(chunks, { type: mime });
    if (blob.size < 100) {
      setIsFinalizing(false);
      return;
    }

    setIsFinalizing(true);

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await base44.functions.invoke("transcribeAudio", {
        audio: audioBase64,
        mimeType: mime,
      });
      let text = (res?.data?.text || "").trim();
      if (text) {
        text = text.replace(/([.,!?;:])([^\s])/g, "$1 $2");
        text = text.replace(/\s+/g, " ").trim();
        text = text.charAt(0).toUpperCase() + text.slice(1);
        text = text.replace(/([.!?]\s+)([a-zа-яёіїєґ])/g, (_, p, c) => p + c.toUpperCase());
        setPendingTranscript(text);
      }
    } catch (e) {
      console.error("Transcription error:", e);
    } finally {
      setIsFinalizing(false);
    }
  };

  const loadHistory = async () => {
    const convos = await base44.entities.Conversation.filter({ agent_id: String(agent.id) }, "-created_date", 20);
    setConversations(convos);
  };

  const deleteConversation = (e, convo) => {
    e.stopPropagation();
    setDeletingConvoIds((prev) => new Set(prev).add(convo.id));
    const collapseMs = 380;
    setTimeout(async () => {
      try {
        await base44.entities.Conversation.delete(convo.id);
      } catch (_) {}
      setConversations((prev) => prev.filter((x) => x.id !== convo.id));
      if (currentConversationId === convo.id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      setDeletingConvoIds((prev) => {
        const next = new Set(prev);
        next.delete(convo.id);
        return next;
      });
    }, collapseMs);
  };

  const loadConversation = async (convo) => {
    const msgs = await base44.entities.Message.filter({ conversation_id: String(convo.id) }, "created_date", 3000);
    const list = Array.isArray(msgs) ? msgs : [];
    const chronological = list.map((m) => ({ role: m.role || "user", content: m.content || "", createdAt: m.created_date || m.created_at }));
    setMessages(chronological);
    setCurrentConversationId(convo.id);
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

    const now = new Date().toISOString();
    const newMessages = [...messages, { role: "user", content: displayContent, createdAt: now }];
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
    setMessages(prev => [...prev, { role: "assistant", content: response, createdAt: new Date().toISOString() }]);
    setIsLoading(false);
    abortControllerRef.current = null;

    if (messages.length === 0 && !currentConversationId) {
      const convo = await base44.entities.Conversation.create({
        agent_id: String(agent.id), agent_name: agent.name,
        title: (userMsg || "File upload").substring(0, 60), mode,
        message_count: 2, last_message_preview: response.substring(0, 100),
      });
      const cid = String(convo.id);
      await base44.entities.Message.create({ conversation_id: cid, role: "user", content: displayContent });
      await base44.entities.Message.create({ conversation_id: cid, role: "assistant", content: response });
      setCurrentConversationId(convo.id);
      const newCount = lifetimeMessageCountRef.current + 1;
      lifetimeMessageCountRef.current = newCount;
      await base44.entities.Agent.update(agent.id, { message_count: newCount });
      loadHistory();
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } else if (currentConversationId) {
      const cid = String(currentConversationId);
      await base44.entities.Message.create({ conversation_id: cid, role: "user", content: displayContent });
      await base44.entities.Message.create({ conversation_id: cid, role: "assistant", content: response });
      await base44.entities.Conversation.update(currentConversationId, {
        last_message_preview: response.substring(0, 100),
      });
      const newCount = lifetimeMessageCountRef.current + 1;
      lifetimeMessageCountRef.current = newCount;
      await base44.entities.Agent.update(agent.id, { message_count: newCount });
      loadHistory();
      queryClient.invalidateQueries({ queryKey: ["agents"] });
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
            <Trash2 style={{ width: 16, height: 16 }} />
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
            <Trash2 style={{ width: 16, height: 16 }} />
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
      style={{ flex: 1, height: 48, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: BAR_GAP + "px", overflow: "hidden", padding: "0 4px" }}
    >
      {waveLevels.slice(-waveBarCount).map((level, i, arr) => {
        const heightPct = Math.max(4, Math.round(level * 88));
        const t = arr.length <= 1 ? 1 : i / (arr.length - 1);
        const opacity = 0.3 + t * 0.7;
        return (
          <div key={i} style={{
            width: BAR_WIDTH,
            height: heightPct + "%",
            borderRadius: 2,
            background: level > 0.12 ? "#f97316" : "rgba(249,115,22,0.4)",
            opacity,
            transition: "height 60ms ease-out",
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

      {/* Voice mode — recording */}
      {isRecording && (
        <div style={{ display: "flex", alignItems: "center", padding: "8px 8px" }}>
          {renderWaveform()}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {renderRightButtons()}
          </div>
        </div>
      )}

      {/* Voice mode — finalizing (processing transcript) */}
      {!isRecording && isFinalizing && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 16px" }}>
          <Loader2 style={{ width: 16, height: 16, color: "#f97316", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: "#888" }}>Processing voice...</span>
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
                paddingTop: (multiLine || attachedFiles.length > 0) ? 13 : 10,
                paddingBottom: (multiLine || attachedFiles.length > 0) ? 7 : 10,
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 64, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
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
          <button onMouseDown={e => e.preventDefault()} onClick={() => {
            if (showHistory && !historyPanelClosing) {
              setHistoryPanelClosing(true);
            } else if (!showHistory) {
              setHistoryPanelClosing(false);
              setShowHistory(true);
              setHistoryPanelOpening(true);
            }
          }}
            style={{ padding: 7, borderRadius: 10, background: showHistory ? "rgba(249,115,22,0.1)" : "none", border: "none", cursor: "pointer", color: showHistory ? "#f97316" : "#555", display: "flex", transition: "all 0.2s" }}>
            <Clock style={{ width: 15, height: 15 }} />
          </button>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a", position: "relative" }}>
            {/* Sliding pill background */}
            <div style={{
              position: "absolute",
              left: mode === "instant" ? 0 : "50%",
              top: 0,
              bottom: 0,
              width: "50%",
              background: "rgba(249,115,22,0.15)",
              borderRadius: 9,
              transition: "left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 0,
            }} />
            {[["instant", Zap, "Instant"], ["thinking", Brain, "Thinking"]].map(([val, Icon, label]) => (
              <button key={val} onMouseDown={e => e.preventDefault()} onClick={() => setMode(val)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, fontWeight: 500,
                  background: "transparent",
                  color: mode === val ? "#f97316" : "#555", border: "none", cursor: "pointer", transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative", zIndex: 1, flex: 1 }}>
                <Icon style={{ width: 11, height: 11 }} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {(showHistory || historyPanelClosing) && (
        <div style={{
          position: "absolute", right: 0, top: 56, width: 300, height: "calc(100% - 56px)", zIndex: 20,
          background: "#111", borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", overflowX: "hidden",
          transform: historyPanelClosing ? "translateX(100%)" : (historyPanelOpening ? "translateX(100%)" : "translateX(0)"),
          opacity: historyPanelClosing ? 0 : 1,
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease-out",
        }}>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#f97316", marginBottom: 12 }}>Chat History</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {conversations.map((c) => {
                const isDeleting = deletingConvoIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    style={{
                      overflow: "hidden",
                      borderRadius: 12,
                      maxHeight: isDeleting ? 0 : 120,
                      opacity: isDeleting ? 0 : 1,
                      marginBottom: isDeleting ? 0 : 4,
                      transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease-out, margin 0.35s ease-out",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(249,115,22,0.06)",
                        border: "1px solid rgba(249,115,22,0.15)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (isDeleting) return;
                        e.currentTarget.style.background = "rgba(249,115,22,0.1)";
                        e.currentTarget.style.borderColor = "rgba(249,115,22,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(249,115,22,0.06)";
                        e.currentTarget.style.borderColor = "rgba(249,115,22,0.15)";
                      }}
                    >
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => loadConversation(c)}
                        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
                        <p style={{ fontSize: 10, color: "#444", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_message_preview}</p>
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => deleteConversation(e, c)}
                        disabled={isDeleting}
                        style={{ flexShrink: 0, padding: 6, borderRadius: 8, background: "none", border: "none", cursor: isDeleting ? "not-allowed" : "pointer", color: "#555", display: "flex", transition: "color 0.2s" }}
                        onMouseEnter={(e) => { if (!isDeleting) e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#555"; }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {conversations.length === 0 && <p style={{ fontSize: 11, color: "#444", textAlign: "center", padding: 20 }}>No history yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {!hasMessages ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", minHeight: 0 }}>
            <div style={{ textAlign: "center", width: "100%", maxWidth: INPUT_BAR_EMPTY_MAX_WIDTH, margin: "0 auto", flexShrink: 0 }}>
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
              <div style={{ maxWidth: CHAT_CONTENT_MAX_WIDTH, width: "100%", margin: "0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "100%" }}>
                {messages.map((msg, i) => {
                  const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
                  const isCopied = copiedMessageIndex === i;
                  const copyMessage = () => {
                    const plain = markdownToPlainText(msg.content || "");
                    navigator.clipboard.writeText(plain).then(() => {
                      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
                      setCopiedMessageIndex(i);
                      copiedTimeoutRef.current = setTimeout(() => {
                        setCopiedMessageIndex(null);
                        copiedTimeoutRef.current = null;
                      }, 1800);
                    }).catch(() => {});
                  };
                  const isUser = msg.role === "user";
                  return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "68%", width: "max-content", minWidth: 0, borderRadius: 18, padding: "10px 16px",
                      background: isUser ? "rgba(249,115,22,0.12)" : "#181818",
                      border: isUser ? "1px solid rgba(249,115,22,0.2)" : "1px solid #2a2a2a",
                      wordBreak: "break-word", overflowWrap: "break-word" }}>
                      {msg.role === "assistant" ? (
                        <ReactMarkdown className="chat-markdown">
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <p style={{ fontSize: 16, color: "#f5f5f5", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      {timeStr && <span style={{ fontSize: 12, color: "#555" }}>{timeStr}</span>}
                      <button type="button" onClick={copyMessage} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: isCopied ? "#f97316" : "#555", display: "flex" }} title={isCopied ? "Copied" : "Copy"}>
                        {isCopied ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
                      </button>
                    </div>
                  </div>
                  );
                })}
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
            </div>
            <div style={{ padding: "8px 24px 16px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: CHAT_CONTENT_MAX_WIDTH, margin: "0 auto" }}>{renderInputBar()}</div>
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
        .chat-markdown { font-size: 16px; line-height: 1.65; color: #e5e5e5; max-width: 100%; }
        .chat-markdown p { margin: 0 0 0.85em; }
        .chat-markdown p:last-child { margin-bottom: 0; }
        .chat-markdown h1 { font-size: 1.55em; font-weight: 700; color: #f5f5f5; margin: 1.25em 0 0.5em; line-height: 1.25; }
        .chat-markdown h1:first-child { margin-top: 0; }
        .chat-markdown h2 { font-size: 1.4em; font-weight: 700; color: #f5f5f5; margin: 1.2em 0 0.45em; line-height: 1.3; }
        .chat-markdown h2:first-child { margin-top: 0; }
        .chat-markdown h3 { font-size: 1.2em; font-weight: 600; color: #f5f5f5; margin: 1em 0 0.4em; line-height: 1.35; }
        .chat-markdown h3:first-child { margin-top: 0; }
        .chat-markdown ul, .chat-markdown ol { margin: 0.6em 0 0.9em; padding-left: 1.4em; }
        .chat-markdown li { margin: 0.35em 0; }
        .chat-markdown li p { margin: 0; }
        .chat-markdown strong { color: #f5f5f5; font-weight: 600; }
        .chat-markdown code { font-size: 0.9em; background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 4px; }
        .chat-markdown pre { margin: 0.9em 0; padding: 10px 12px; background: rgba(0,0,0,0.3); border-radius: 8px; overflow-x: auto; }
        .chat-markdown pre code { background: none; padding: 0; }
        .chat-markdown blockquote { margin: 0.85em 0; padding-left: 1em; border-left: 3px solid rgba(249,115,22,0.5); color: #b0b0b0; font-style: normal; }
      `}</style>
    </div>
  );
}