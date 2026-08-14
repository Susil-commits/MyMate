import { useState, useRef, useEffect, useCallback } from "react";
import { HiChat, HiX, HiPaperAirplane, HiTrash, HiRefresh } from "react-icons/hi";
import api from "../api/axios";

// Quick-reply prompt suggestions focused on platform design & usage
const QUICK_REPLIES = [
  "How do I book a driver?",
  "What are surge pricing hours?",
  "How does KYC verification work?",
  "What safety features exist?",
  "What is MyMate's tech stack?",
];

// Helper to escape raw HTML characters to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Markdown renderer for bold, lists, code, headers, and linebreaks
function renderMarkdown(rawText) {
  if (!rawText) return "";

  // 1. First escape raw HTML
  let text = escapeHtml(rawText);

  // 2. Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code class="bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

  // 3. Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 4. Italic: *text* or _text_
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 5. Headings: ### Heading
  text = text.replace(/^###\s+(.+)$/gm, '<h4 class="font-bold text-sm text-gray-900 dark:text-white mt-2 mb-1">$1</h4>');

  // 6. Lists
  const lines = text.split("\n");
  const parsedLines = lines.map((line) => {
    const trimmed = line.trim();
    // Bullet list
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      return `<li class="ml-4 list-disc">${trimmed.replace(/^[-•*]\s+/, "")}</li>`;
    }
    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      return `<li class="ml-4 list-decimal">${trimmed.replace(/^\d+\.\s+/, "")}</li>`;
    }
    return trimmed ? `<p class="my-0.5">${line}</p>` : '<div class="h-1.5"></div>';
  });

  return parsedLines.join("\n");
}

// Chat typing indicator animation
function TypingDots() {
  return (
    <div className="flex justify-start items-center gap-1.5 py-1">
      <span className="text-base select-none">🤖</span>
      <div
        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl rounded-tl-none px-4 py-2.5 text-sm flex gap-1.5 items-center"
      >
        {[0, 0.2, 0.4].map((delay, i) => (
          <span
            key={i}
            className="inline-block w-2 h-2 rounded-full bg-blue-500"
            style={{
              animation: "chatBounce 1s infinite",
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AIChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "👋 Hello! I'm **MyMate AI**, your dedicated assistant for the MyMate driver platform.\n\nI can assist you with:\n- **Booking verified drivers** (Hourly, Daily, Outstation, Valet)\n- **Pricing & surge hours**\n- **Driver KYC & safety features**\n- **Platform architecture & design**\n\nHow can I help you today?",
    },
  ]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastFailedMsg, setLastFailedMsg] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Dispatch user message to AI backend
  const handleSend = useCallback(
    async (messageText) => {
      const text = (messageText ?? input).trim();
      if (!text || loading) return;

      setInput("");
      setLastFailedMsg(null);
      setHasInteracted(true);

      const userMsg = { role: "user", text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const { data } = await api.post("/ai/chat", {
          message: text,
          history, // pass sanitized history for multi-turn context
        });

        const botMsg = { role: "bot", text: data.response };
        setMessages((prev) => [...prev, botMsg]);
        setHistory(data.history ?? []);

        if (!isOpen) setUnreadCount((c) => c + 1);
      } catch (err) {
        console.error("AI Chatbot request error:", err);
        const serverError = err?.response?.data?.message;
        const fallbackNotice = serverError || "⚠️ I encountered a temporary connection issue. Please try asking again.";

        setMessages((prev) => [
          ...prev,
          { role: "bot", text: fallbackNotice, isError: true },
        ]);
        setLastFailedMsg(text);
      } finally {
        setLoading(false);
      }
    },
    [input, history, loading, isOpen]
  );

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleQuickReply = (text) => {
    handleSend(text);
  };

  const handleClear = () => {
    setMessages([
      {
        role: "bot",
        text: "👋 Conversation cleared! How can I assist you with MyMate today?",
      },
    ]);
    setHistory([]);
    setLastFailedMsg(null);
    setHasInteracted(false);
  };

  const handleRetry = () => {
    if (lastFailedMsg) {
      handleSend(lastFailedMsg);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style>{`
        @keyframes chatBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-slide-up { animation: chatSlideUp 0.22s ease-out forwards; }
        .chat-msg-prose p { margin: 0.2rem 0; line-height: 1.45; }
        .chat-msg-prose strong { font-weight: 600; color: inherit; }
        .chat-msg-prose ul, .chat-msg-prose ol { margin: 0.25rem 0; padding-left: 0.5rem; }
        .chat-msg-prose li { margin: 0.15rem 0; }
      `}</style>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* ── Chat Window ────────────────────────────────────────────────── */}
        {isOpen && (
          <div
            className="chat-slide-up w-80 md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden origin-bottom-right"
            style={{ height: "490px" }}
            role="dialog"
            aria-label="MyMate AI Platform Support Chat"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between text-white flex-shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl select-none">
                  🤖
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none flex items-center gap-1.5">
                    MyMate AI
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" title="Online" />
                  </h3>
                  <p className="text-[11px] text-blue-100 mt-0.5">Platform & Design Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Clear conversation */}
                <button
                  onClick={handleClear}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                  aria-label="Clear conversation"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                  aria-label="Close chat"
                >
                  <HiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/60 dark:bg-gray-800/40">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "bot" && (
                    <span className="mr-1.5 mt-1 text-base select-none flex-shrink-0">🤖</span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none shadow"
                        : msg.isError
                        ? "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 shadow-sm rounded-tl-none"
                        : "bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-100 shadow-sm rounded-tl-none"
                    }`}
                  >
                    {msg.role === "bot" ? (
                      <div
                        className="chat-msg-prose"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && <TypingDots />}

              {/* Retry button if last request failed */}
              {lastFailedMsg && !loading && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-full px-3 py-1 hover:bg-red-200 transition"
                  >
                    <HiRefresh className="w-3.5 h-3.5" /> Retry last question
                  </button>
                </div>
              )}

              {/* Quick-reply chips */}
              {!hasInteracted && !loading && (
                <div className="pt-2">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 font-semibold uppercase tracking-wider">
                    Suggested topics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr}
                        onClick={() => handleQuickReply(qr)}
                        className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-full px-3 py-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors text-left font-medium"
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleFormSubmit}
              className="px-3 py-2.5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-end gap-2 flex-shrink-0"
            >
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  id="ai-chatbot-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 500))}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about MyMate features, pricing, design…"
                  className="w-full pl-4 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:placeholder-gray-400 transition"
                  disabled={loading}
                  autoComplete="off"
                  maxLength={500}
                />
                {input.length > 400 && (
                  <span className="absolute right-3 bottom-1 text-[10px] text-gray-400">
                    {input.length}/500
                  </span>
                )}
              </div>
              <button
                type="submit"
                id="ai-chatbot-send"
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition shadow-md flex-shrink-0"
                aria-label="Send message"
              >
                <HiPaperAirplane className="w-4 h-4 rotate-90" />
              </button>
            </form>
          </div>
        )}

        {/* ── Toggle Floating Action Button ───────────────────────────────── */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Toggle MyMate AI Support"
          id="ai-chatbot-toggle"
          className="relative w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        >
          {isOpen ? <HiX className="w-6 h-6" /> : <HiChat className="w-6 h-6" />}
          {/* Unread badge */}
          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow animate-bounce">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
