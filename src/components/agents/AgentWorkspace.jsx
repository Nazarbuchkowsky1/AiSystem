import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Clock, Zap, Brain, Send, Square, Plus, Mic, Bot, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AgentWorkspace({ agent, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("instant");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadHistory();
  }, [agent]);

  const loadHistory = async () => {
    const convos = await base44.entities.Conversation.filter({ agent_id: String(agent.id) }, "-created_date", 20);
    setConversations(convos);
  };

  const loadConversation = async (convo) => {
    const msgs = await base44.entities.Message.filter({ conversation_id: String(convo.id) }, "created_date", 100);
    setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
    setShowHistory(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    const systemPrompt = agent.system_prompt || `You are ${agent.name}. ${agent.description || ""}. ${
      mode === "thinking" ? "Think deeply and provide thorough, detailed responses." : "Be concise and direct."
    }`;

    const prompt = `${systemPrompt}\n\nConversation:\n${newMessages.map(m => `${m.role}: ${m.content}`).join("\n")}\n\nassistant:`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });

    setMessages([...newMessages, { role: "assistant", content: response }]);
    setIsLoading(false);

    // Save conversation
    let convoId;
    if (messages.length === 0) {
      const convo = await base44.entities.Conversation.create({
        agent_id: String(agent.id),
        agent_name: agent.name,
        title: userMsg.substring(0, 60),
        mode,
        message_count: 2,
        last_message_preview: response.substring(0, 100),
      });
      convoId = convo.id;
    }
    // Save messages in background
    if (convoId) {
      await base44.entities.Message.bulkCreate([
        { conversation_id: String(convoId), role: "user", content: userMsg },
        { conversation_id: String(convoId), role: "assistant", content: response },
      ]);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 transition">
            <ArrowLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{agent.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-lg hover:bg-white/5 transition"
            style={{ color: "var(--text-muted)" }}
          >
            <Clock className="w-4 h-4" />
          </button>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-subtle)" }}>
            <button
              onClick={() => setMode("instant")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition"
              style={{
                background: mode === "instant" ? "var(--accent-dim)" : "transparent",
                color: mode === "instant" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Zap className="w-3 h-3" /> Instant
            </button>
            <button
              onClick={() => setMode("thinking")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition"
              style={{
                background: mode === "thinking" ? "var(--accent-dim)" : "transparent",
                color: mode === "thinking" ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Brain className="w-3 h-3" /> Thinking
            </button>
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="absolute right-0 top-14 w-80 h-[calc(100%-56px)] z-20 border-l overflow-auto" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}>
          <div className="p-4">
            <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Chat History</h3>
            <div className="space-y-2">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c)}
                  className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition"
                >
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.title}</p>
                  <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{c.last_message_preview}</p>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No history yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!hasMessages ? (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--accent-dim)" }}
              >
                <Bot className="w-7 h-7" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{agent.name}</h2>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>{agent.description}</p>
              {/* Input Bar - Centered */}
              <div className="flex items-center gap-2 p-2 rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
                <button className="p-2 rounded-xl hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
                  <Plus className="w-4 h-4" />
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Message agent..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <button className="p-2 rounded-xl hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl transition"
                  style={{
                    background: input.trim() ? "var(--accent)" : "var(--accent-dim)",
                    color: input.trim() ? "#fff" : "var(--text-muted)",
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "" : ""}`}
                    style={{
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.1))"
                        : "var(--bg-card)",
                      border: msg.role === "user" ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown className="text-sm prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="glass-panel px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {mode === "thinking" ? "Thinking deeply..." : "Generating..."}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar - Bottom */}
            <div className="px-6 pb-4 pt-2">
              <div className="flex items-center gap-2 p-2 rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
                <button className="p-2 rounded-xl hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
                  <Plus className="w-4 h-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Message agent..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <button className="p-2 rounded-xl hover:bg-white/5 transition" style={{ color: "var(--text-muted)" }}>
                  <Mic className="w-4 h-4" />
                </button>
                {isLoading ? (
                  <button
                    onClick={() => setIsLoading(false)}
                    className="p-2 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="p-2 rounded-xl transition"
                    style={{
                      background: input.trim() ? "var(--accent)" : "var(--accent-dim)",
                      color: input.trim() ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}