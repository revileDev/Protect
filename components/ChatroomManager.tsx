"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  ShieldAlert,
  Clock,
  RefreshCw,
  Plus,
  Ban,
  CheckCircle2,
  ExternalLink,
  Layers,
  Timer,
  FileText,
  X,
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

  // Chat cooldown state
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(5);
  const [customCooldownInput, setCustomCooldownInput] = useState<string>("5");
  const [savingCooldown, setSavingCooldown] = useState(false);

  // Bulk add blacklist state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkWordsInput, setBulkWordsInput] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chatroom/messages?limit=100");
      if (res.ok) {
        const data = await res.json();
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
        if (typeof data.cooldown_seconds === "number") {
          setCooldownSeconds(data.cooldown_seconds);
          setCustomCooldownInput(String(data.cooldown_seconds));
        }
      }
    } catch (err) {
      console.error("Error loading chat messages:", err);
    }
  };

  // Fetch blacklist words independently
  const fetchBlacklist = async () => {
    try {
      const res = await fetch("/api/chatroom/blacklist");
      if (res.ok) {
        const data = await res.json();
        if (data.words) {
          setBlacklistWords(data.words);
        }
      }
    } catch (err) {
      console.error("Error loading blacklist:", err);
    }
  };

  // Fetch chatroom cooldown settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/chatroom/settings");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.cooldown_seconds === "number") {
          setCooldownSeconds(data.cooldown_seconds);
          setCustomCooldownInput(String(data.cooldown_seconds));
        }
      }
    } catch (err) {
      console.error("Error loading chatroom settings:", err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchMessages(), fetchBlacklist(), fetchSettings()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(fetchMessages, 3500); // Poll ONLY messages every 3.5s
    return () => clearInterval(interval);
  }, []);

  // Save Cooldown setting
  const handleSaveCooldown = async (newVal: number) => {
    const clamped = Math.max(0, Math.min(300, Math.floor(newVal || 0)));
    setSavingCooldown(true);
    try {
      const res = await fetch("/api/chatroom/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cooldown_seconds: clamped }),
      });
      const data = await res.json();
      if (data.success) {
        setCooldownSeconds(clamped);
        setCustomCooldownInput(String(clamped));
        showNotification(
          clamped === 0
            ? "Chat cooldown disabled (0s)."
            : `Chat cooldown set to ${clamped} seconds.`
        );
      } else {
        showNotification(data.error || "Failed to save cooldown.");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error saving cooldown.");
    } finally {
      setSavingCooldown(false);
    }
  };

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
          username: "👑 Admin / Dev",
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

  // Add Blacklist Word (single or comma-separated)
  const handleAddBlacklistWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newWordInput.trim();
    if (!raw || addingWord) return;

    const parsed = Array.from(
      new Set(
        raw
          .split(/[\r\n,]+/)
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (!parsed.length) return;

    // Optimistic UI update
    setBlacklistWords((prev) => Array.from(new Set([...parsed, ...prev])));
    setNewWordInput("");
    setAddingWord(true);

    try {
      const res = await fetch("/api/chatroom/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: parsed }),
      });
      const data = await res.json();
      if (data.success && data.words) {
        setBlacklistWords(data.words);
        showNotification(
          parsed.length === 1
            ? `Word "${parsed[0]}" added to filter. Messages purged.`
            : `Added ${parsed.length} words to filter. Messages purged.`
        );
        fetchMessages();
      } else {
        fetchBlacklist();
        showNotification(data.error || "Failed to add word.");
      }
    } catch (err) {
      console.error(err);
      fetchBlacklist();
      showNotification("Error connecting to server.");
    } finally {
      setAddingWord(false);
    }
  };

  // Bulk Import Blacklist Words
  const handleBulkAddWords = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Array.from(
      new Set(
        bulkWordsInput
          .split(/[\r\n,]+/)
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (!parsed.length) {
      showNotification("Please enter at least one word to add.");
      return;
    }

    setBulkAdding(true);
    try {
      const res = await fetch("/api/chatroom/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: parsed }),
      });
      const data = await res.json();
      if (data.success && data.words) {
        setBlacklistWords(data.words);
        setBulkWordsInput("");
        setShowBulkModal(false);
        showNotification(`Bulk added ${parsed.length} words to filter. Matching messages purged.`);
        fetchMessages();
      } else {
        showNotification(data.error || "Failed to bulk add words.");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error connecting to server.");
    } finally {
      setBulkAdding(false);
    }
  };

  // Delete Blacklist Word
  const handleDeleteBlacklistWord = async (word: string) => {
    const cleaned = word.trim().toLowerCase();
    // Optimistic UI update
    setBlacklistWords((prev) => prev.filter((w) => w.toLowerCase() !== cleaned));

    try {
      const res = await fetch(`/api/chatroom/blacklist?word=${encodeURIComponent(cleaned)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success && data.words) {
        setBlacklistWords(data.words);
        showNotification(`Word "${cleaned}" removed from filter.`);
      } else {
        fetchBlacklist();
        showNotification(data.error || "Failed to remove word.");
      }
    } catch (err) {
      console.error(err);
      fetchBlacklist();
      showNotification("Error removing word.");
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
          onClick={refreshAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold border border-gray-700/60 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Cooldown Settings Strip */}
      <div className="p-3.5 bg-[#12141d] border border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Chat Cooldown Rate Limit</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {cooldownSeconds === 0 ? "Off (0s)" : `${cooldownSeconds}s active`}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Prevents script users from spamming messages faster than this cooldown.
            </p>
          </div>
        </div>

        {/* Quick Cooldown Buttons & Custom Input */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[0, 5, 10, 15, 30, 60].map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={savingCooldown}
              onClick={() => handleSaveCooldown(sec)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                cooldownSeconds === sec
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60"
              }`}
            >
              {sec === 0 ? "Off" : `${sec}s`}
            </button>
          ))}

          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-gray-800">
            <input
              type="number"
              min="0"
              max="300"
              value={customCooldownInput}
              onChange={(e) => setCustomCooldownInput(e.target.value)}
              placeholder="Sec"
              className="w-16 bg-[#181a24] border border-gray-700/80 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              disabled={savingCooldown || !customCooldownInput}
              onClick={() => handleSaveCooldown(Number(customCooldownInput))}
              className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 border border-gray-700/60 transition-colors"
            >
              Set
            </button>
          </div>
        </div>
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
              <Clock className="w-3 h-3" /> Auto-updates every 3.5s
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
                              ? `/api/roblox/avatar?userId=${uid}`
                              : `/api/roblox/avatar?username=${encodeURIComponent(m.username)}`
                          }
                          alt={m.username}
                          className="w-9 h-9 rounded-full bg-[#181a24] border border-gray-700/60 object-cover"
                          onError={(e: any) => {
                            e.target.src = `/api/roblox/avatar?username=${encodeURIComponent(m.username)}`;
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
                            <span>{m.display_name || m.username}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                          </a>
                        ) : (
                          <span className="text-xs font-bold text-white">
                            {isDev ? "👑 Admin / Dev" : (m.display_name || m.username)}
                          </span>
                        )}

                        {isDev && (
                          <span className="px-1.5 py-0.2 rounded-md bg-purple-600 text-white font-bold text-[9px] tracking-wide">
                            DEV
                          </span>
                        )}

                        <span className="text-[10px] text-gray-500 font-mono">
                          @{m.username}
                        </span>

                        <span className="text-[10px] text-gray-500 ml-auto font-mono">
                          {formatTime(m.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-200 mt-1 break-words leading-relaxed select-text">
                        {m.message}
                      </p>
                    </div>

                    {/* Delete Action Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 transition-all shrink-0"
                      title="Delete message from chatroom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Broadcast Message Input Form */}
          <form
            onSubmit={handleSendDevMessage}
            className="p-3 bg-[#0c0e15] border-t border-gray-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={devMessageInput}
              onChange={(e) => setDevMessageInput(e.target.value)}
              placeholder="Send an official developer broadcast to all active in-game players..."
              className="flex-1 bg-[#181a24] border border-gray-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-all"
            />
            <button
              type="submit"
              disabled={sending || !devMessageInput.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? "Sending..." : "Send as Dev 👑"}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Blacklist Word Filter (1/3 width) */}
        <div className="flex flex-col h-[620px] bg-[#12141d] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0c0e15] border-b border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Word Blacklist & Auto-Filter</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Prohibited words are automatically purged from all chats.
              </p>
            </div>

            {/* Bulk Add Trigger Button */}
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-all shrink-0"
              title="Bulk import blacklist words"
            >
              <FileText className="w-3 h-3" />
              <span>Bulk Add</span>
            </button>
          </div>

          {/* Add Word Form */}
          <form onSubmit={handleAddBlacklistWord} className="p-3 border-b border-gray-800 flex items-center gap-2">
            <input
              type="text"
              value={newWordInput}
              onChange={(e) => setNewWordInput(e.target.value)}
              placeholder="Word or comma-separated list (e.g. scam, hack)..."
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
          <div className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
              <span>Active Blacklisted Words ({blacklistWords.length})</span>
            </div>

            {blacklistWords.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                <Ban className="w-8 h-8 mx-auto mb-2 opacity-25" />
                <p>No words currently blacklisted.</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Add terms above or use Bulk Add.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {blacklistWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium group"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlacklistWord(word)}
                      className="hover:text-white p-0.5 rounded transition-colors text-rose-400 group-hover:text-white"
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
              💡 <strong>Instant Purge:</strong> Adding a word scans and permanently cleanses all existing messages containing it from Supabase and active clients.
            </p>
          </div>
        </div>
      </div>

      {/* Bulk Add Blacklist Words Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#12141d] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#0c0e15] border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Bulk Add Blacklist Words</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkAddWords} className="p-4 space-y-3">
              <p className="text-xs text-gray-400">
                Paste or type multiple words/phrases below separated by <strong>commas</strong> or <strong>new lines</strong>.
              </p>

              <textarea
                rows={7}
                value={bulkWordsInput}
                onChange={(e) => setBulkWordsInput(e.target.value)}
                placeholder={"scam\nhack\nexploit\nword1, word2, word3"}
                className="w-full bg-[#181a24] border border-gray-700/80 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-rose-500 font-mono resize-none"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-gray-400 font-mono">
                  {
                    bulkWordsInput
                      .split(/[\r\n,]+/)
                      .filter((w) => w.trim().length > 0).length
                  }{" "}
                  words detected
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkAdding || !bulkWordsInput.trim()}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{bulkAdding ? "Importing..." : "Add All Words"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
