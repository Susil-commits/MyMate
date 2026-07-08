import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { HiChat, HiPaperAirplane, HiArrowLeft } from "react-icons/hi";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import toast from "react-hot-toast";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function MessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const myModel = role === "user" ? "User" : "Driver";

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadedId, setLoadedId] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchConversations = async () => {
      try {
        const { data } = await api.get("/messages/conversations");
        if (active) setConversations(data.conversations);
      } catch {
        // ignore polling errors
      } finally {
        if (active) setLoadingList(false);
      }
    };
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/messages/${conversationId}`);
        if (!active) return;
        setMessages(data.messages);
        setLoadedId(conversationId);
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
        );
      } catch {
        // silently fail polling errors (Render cold starts)
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post("/messages", { conversationId, text: text.trim() });
      setMessages((prev) => [...prev, data.message]);
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId
            ? {
                ...c,
                lastMessage: data.message.text,
                lastMessageAt: data.message.createdAt,
                lastSenderModel: myModel,
                unreadCount: 0,
              }
            : c
        )
      );
      setText("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const otherParty = (conv) => (role === "driver" ? conv.user : conv.driver);
  const activeConv = conversations.find((c) => c._id === conversationId);
  const showChatMobile = !!conversationId;
  const chatLoading = !!conversationId && loadedId !== conversationId;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">
          <span className="gradient-text">Messages</span>
        </h1>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] bg-white rounded-2xl border border-gray-100 overflow-hidden h-[calc(100vh-11rem)] shadow-sm">
        {/* Conversation list */}
        <aside
          className={`${showChatMobile ? "hidden md:flex" : "flex"} flex-col border-r border-gray-100`}
        >
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="skeleton h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-24 rounded" />
                      <div className="skeleton h-3 w-40 rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <HiChat className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No conversations yet.</p>
                {role === "user" && (
                  <Link to="/drivers" className="mt-2 inline-block text-blue-600 hover:text-blue-700 font-semibold text-sm">
                    Find a driver to message
                  </Link>
                )}
              </div>
            ) : (
              conversations.map((conv) => {
                const party = otherParty(conv);
                const isActive = conv._id === conversationId;
                return (
                  <button
                    key={conv._id}
                    onClick={() => navigate(`/messages/${conv._id}`)}
                    className={`w-full flex items-center gap-3 p-4 border-b border-gray-50 text-left transition-colors ${
                      isActive ? "bg-blue-50/60" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {party?.name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 truncate text-sm">
                          {party?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-gray-500 truncate">
                          {conv.lastSenderModel === myModel && "You: "}
                          {conv.lastMessage || "No messages yet"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 min-w-[20px] text-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <section className={`${showChatMobile ? "flex" : "hidden md:flex"} flex-col min-w-0`}>
          {!conversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <HiChat className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Select a conversation</p>
              <p className="text-gray-400 text-sm mt-1">Choose a chat from the list to start messaging.</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 p-4 border-b border-gray-100">
                <button
                  onClick={() => navigate("/messages")}
                  className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Back to conversations"
                >
                  <HiArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {otherParty(activeConv || {})?.name?.charAt(0) || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">
                    {otherParty(activeConv || {})?.name || "Conversation"}
                  </p>
                  {activeConv?.driver?.locality && role === "user" && (
                    <p className="text-xs text-gray-500 truncate">{activeConv.driver.locality}</p>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                {chatLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderModel === myModel;
                    return (
                      <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                            mine
                              ? "bg-blue-600 text-white rounded-br-sm"
                              : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 p-4 border-t border-gray-100 bg-white">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                  aria-label="Send message"
                >
                  <HiPaperAirplane className="w-5 h-5" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
