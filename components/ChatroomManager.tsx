// components/ChatroomManager.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  ShieldAlert,
  Plus,
  RefreshCw,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Ban,
  Clock,
} from "lucide-react";

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  message: string;
  is_dev: boolean;
  created_at: string;
}

export default function ChatroomManager() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [blacklistWords, setBlacklistWords] = useState<string[]>([]);
  const [newWordInput, setNewWordInput] = useState("");
  const [devMessageInput, setDevMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Fetch initial messages and blacklist
  const fetchChatData = async () => {
    try {
      const [msgRes, blackRes] = await Promise.all([
        fetch("/api/chatroom/messages?limit=100"),
        fetch("/api/chatroom/blacklist"),
      ]);

      if (msgRes.ok) {
        const data = await msgRes.json();
        if (data.messages) {
          setMessages(data.messages);
          if (autoScrollRef.current && scrollRef.current) {
            setTimeout(() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }, 50);
          }
        }
      }

      if (blackRes.ok) {
        const data = await blackRes.json();
        if (data.words) {
          setBlacklistWords(data.words);
        }
      }
    } catch (err) {
      console.error("Error loading chat data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatData();
    const interval = setInterval(fetchChatData, 3500); // Polling every 3.5s
    return () => clearInterval(interval);
  }, []);

  // Send message as Dev
  const handleSendDevMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = devMessageInput.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/chatroom/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "0",
          username: "Dev [Admin]",
          displayName: "Developer",
          message: text,
          isDev: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setDevMessageInput("");
        setMessages((prev) => [...prev, data.message]);
        showNotification("Message broadcasted to in-game chatroom!");
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else {
        showNotification(data.error || "Failed to send message.");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error connecting to server.");
    } finally {
      setSending(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (id: string) => {
    try {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      const res = await fetch(`/api/chatroom/messages?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showNotification("Message removed from chatroom.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Blacklist Word
  const handleAddBlacklistWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const word = newWordInput.trim().toLowerCase();
    if (!word || addingWord) return;

    setAddingWord(true);
    try {
      const res = await fetch("/api/chatroom/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();
      if (data.success && data.words) {
        setBlacklistWords(data.words);
        setNewWordInput("");
        showNotification(`Word "${word}" added to filter. Messages purged.`);
        fetchChatData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingWord(false);
    }
  };

  // Delete Blacklist Word
  const handleDeleteBlacklistWord = async (word: string) => {
    try {
      setBlacklistWords((prev) => prev.filter((w) => w !== word));
      const res = await fetch(`/api/chatroom/blacklist?word=${encodeURIComponent(word)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showNotification(`Word "${word}" removed from filter.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notice */}
      {notice && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#12141d] border border-gray-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Global In-Game Chatroom
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync Active
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Real-time communication hub across all 700+ supported Roblox games. Chats sent here appear instantly inside player script hubs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchChatData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold border border-gray-700/60 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Live Chat Stream (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col h-[620px] bg-[#12141d] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Stream Header */}
          <div className="px-4 py-3 bg-[#0c0e15] border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Live Messages</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono">
                {messages.length} messages loaded
              </span>
            </div>
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Auto-updates every 3s
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollRef}
            className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-semibold text-gray-400">No messages in chatroom yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Send a broadcast below or launch your Roblox script to send the first message!
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isDev = m.is_dev;
                const uid = m.user_id && m.user_id !== "0" ? m.user_id : null;
                const profileUrl = uid ? `https://www.roblox.com/users/${uid}/profile` : null;

                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group ${
                      isDev
                        ? "bg-purple-950/25 border border-purple-800/40"
                        : "hover:bg-gray-800/30"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {isDev ? (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-purple-600/30">
                          👑
                        </div>
                      ) : (
                        <img
                          src={
                            uid
                              ? `https://www.roblox.com/headshot-thumbnail/image?userId=${uid}&width=48&height=48&format=png`
                              : "https://api.dicebear.com/7.x/bottts/svg?seed=" + m.username
                          }
                          alt={m.username}
                          className="w-9 h-9 rounded-full bg-[#181a24] border border-gray-700/60 object-cover"
                          onError={(e: any) => {
                            e.target.src = "https://api.dicebear.com/7.x/bottts/svg?seed=" + m.username;
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {profileUrl ? (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-white hover:text-purple-400 flex items-center gap-1 transition-colors"
                          >
                            <span>{m.username}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ) : (
                          <span className={`text-xs font-bold ${isDev ? "text-purple-300" : "text-white"}`}>
                            {m.username}
                          </span>
                        )}

                        {isDev && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500 text-white tracking-wider">
                            DEV
                          </span>
                        )}

                        <span className="text-[10px] text-gray-500 font-mono">
                          {formatTime(m.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-200 mt-1 break-words leading-relaxed">
                        {m.message}
                      </p>
                    </div>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(m.id)}
                      title="Delete this message"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Dev Message Input Bar */}
          <form
            onSubmit={handleSendDevMessage}
            className="p-3 bg-[#0c0e15] border-t border-gray-800 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={devMessageInput}
                onChange={(e) => setDevMessageInput(e.target.value)}
                placeholder="Broadcast a message as Developer [Admin]..."
                className="w-full bg-[#181a24] border border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={sending || !devMessageInput.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? "Sending..." : "Send as Dev 👑"}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Blacklist Word Filter (1/3 width) */}
        <div className="flex flex-col h-[620px] bg-[#12141d] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0c0e15] border-b border-gray-800">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Word Blacklist & Auto-Filter</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Messages containing these words are automatically deleted and never broadcasted to other players.
            </p>
          </div>

          {/* Add Word Form */}
          <form onSubmit={handleAddBlacklistWord} className="p-3 border-b border-gray-800 flex items-center gap-2">
            <input
              type="text"
              value={newWordInput}
              onChange={(e) => setNewWordInput(e.target.value)}
              placeholder="Add blacklisted word/phrase..."
              className="flex-1 bg-[#181a24] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={addingWord || !newWordInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 transition-all shrink-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Filtered Words Cloud */}
          <div className="flex-1 p-4 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
              <span>Active Blacklisted Words ({blacklistWords.length})</span>
            </div>

            {blacklistWords.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                <Ban className="w-8 h-8 mx-auto mb-2 opacity-25" />
                <p>No words currently blacklisted.</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Add terms above to block them instantly.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {blacklistWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlacklistWord(word)}
                      className="hover:text-white p-0.5 rounded transition-colors"
                      title="Remove from blacklist"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Explainer Box */}
          <div className="p-3 bg-[#0c0e15] border-t border-gray-800 text-[11px] text-gray-400 leading-relaxed">
            <p>
              💡 <strong>Instant Purge:</strong> Adding a word immediately scans and removes any existing messages containing it from the cloud database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
