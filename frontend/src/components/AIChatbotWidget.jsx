import { useState, useRef, useEffect, useCallback } from "react";
import { HiChat, HiX, HiPaperAirplane, HiTrash } from "react-icons/hi";
import api from "../api/axios";

// ── Suggested quick-reply chips shown on first open ──────────────────────────
const QUICK_REPLIES = [
  "How do I book a driver?",
  "What are surge pricing hours?",
  "How do I cancel a booking?",
  "How does KYC verification work?",
  "What payment methods are accepted?",
];

// ── Minimal markdown renderer (bold + bullet lists) ───────────────────────────
function renderMarkdown(text) {
  // Bold: **text**
  const withBold = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Bullet points: lines starting with - or •
  const lines = withBold.split("\n");
  const rendered = lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        return `<li>${trimmed.slice(2)}</li>`;
      }
      return trimmed ? `<span>${line}</span>` : "<br/>";
    })
    .join("\n");

  // Wrap consecutive <li> items in a <ul>
  return rendered
    .replace(/((<li>.*?<\/li>\n?)+)/gs, "<ul>$1</ul>")
    .replace(/<\/li>\n<li>/g, "</li><li>");
}

// ── Typing indicator dots ─────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex justify-start">
      <div
        className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-none px-4 py-2 text-sm flex gap-1"
        style={{ background: "var(--chat-bot-bg, #fff)" }}
      >
        {[0, 0.2, 0.4].map((delay, i) => (
          <span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"
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

// ─────────────────────────────────────────────────────────────────────────────

export default function AIChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "👋 Hello! I'm **MyMate AI**. I can help you book a driver, understand pricing, or navigate the app.\n\nWhat can I do for you today?",
    },
  ]);
  // history mirrors messages but in the Gemini role format (user/model)
  // stored separately so we pass it to the backend without UI metadata
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
      // Auto-focus input when chat opens
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // ── Send a message (user text or quick-reply chip) ──────────────────────────
  const handleSend = useCallback(
    async (messageText) => {
      const text = (messageText ?? input).trim();
      if (!text || loading) return;

      setInput("");
      setHasInteracted(true);

      const userMsg = { role: "user", text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const { data } = await api.post("/ai/chat", {
          message: text,
          history, // pass conversation history for multi-turn context
        });

        const botMsg = { role: "bot", text: data.response };
        setMessages((prev) => [...prev, botMsg]);
        setHistory(data.history ?? []); // backend returns updated history

        if (!isOpen) setUnreadCount((c) => c + 1);
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: "⚠️ I encountered an error. Please try again." },
        ]);
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
        text: "Conversation cleared! How can I help you?",
      },
    ]);
    setHistory([]);
    setHasInteracted(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Keyframe styles injected once */}
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
        .chat-msg-prose ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .chat-msg-prose li { margin: 0.1rem 0; }
        .chat-msg-prose br { display: block; margin: 0.2rem 0; content: ""; }
      `}</style>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* ── Chat Window ────────────────────────────────────────────────── */}
        {isOpen && (
          <div
            className="chat-slide-up w-80 md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden origin-bottom-right"
            style={{ height: "480px" }}
            role="dialog"
            aria-label="MyMate AI Support Chat"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl select-none">
                  🤖
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none">MyMate AI</h3>
                  <p className="text-xs text-blue-100 mt-0.5">Powered by Gemini · Always online</p>
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

            {/* Messages */}
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
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none shadow"
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

              {/* Quick-reply chips — shown until user first interacts */}
              {!hasInteracted && !loading && (
                <div className="pt-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium">
                    Suggested questions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr}
                        onClick={() => handleQuickReply(qr)}
                        className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-full px-3 py-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
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
                  placeholder="Ask me anything…"
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

        {/* ── Toggle Button ─────────────────────────────────────────────────── */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Toggle AI Chatbot"
          id="ai-chatbot-toggle"
          className="relative w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        >
          {isOpen ? <HiX className="w-6 h-6" /> : <HiChat className="w-6 h-6" />}
          {/* Unread badge */}
          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
