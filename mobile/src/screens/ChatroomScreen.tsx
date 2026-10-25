// mobile/src/screens/ChatroomScreen.tsx
import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Mail,
  Send,
  Trash2,
  Shield,
  User,
  Sparkles,
  RefreshCw,
  Clock,
} from "lucide-react";
import { ApiService } from "../lib/api";

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

interface DmMessage {
  id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  sender_type: "user" | "dev";
  message: string;
  read: boolean;
  created_at: string;
}

export default function ChatroomScreen() {
  const [activeTab, setActiveTab] = useState<"dms" | "public">("dms");
  const [dms, setDms] = useState<DmMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Send message states
  const [publicInput, setPublicInput] = useState("");
  const [sendingPublic, setSendingPublic] = useState(false);

  // Selected DM thread
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [dmReplyInput, setDmReplyInput] = useState("");
  const [sendingDm, setSendingDm] = useState(false);

  const fetchData = async () => {
    try {
      const [msgData, dmData] = await Promise.all([
        ApiService.getChatMessages(60).catch(() => ({ messages: [] })),
        ApiService.getDms().catch(() => ({ messages: [] })),
      ]);

      if (msgData.messages) setMessages(msgData.messages);
      if (dmData.messages) setDms(dmData.messages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSendPublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicInput.trim()) return;
    setSendingPublic(true);
    try {
      await ApiService.postChatMessage(publicInput.trim(), true);
      setPublicInput("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to post chat message");
    } finally {
      setSendingPublic(false);
    }
  };

  const handleDeletePublic = async (id: string) => {
    try {
      await ApiService.deleteChatMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete message");
    }
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !dmReplyInput.trim()) return;
    setSendingDm(true);
    try {
      await ApiService.sendDm(selectedUser, dmReplyInput.trim());
      setDmReplyInput("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to send DM");
    } finally {
      setSendingDm(false);
    }
  };

  // Group DMs by user_id
  const userThreads = React.useMemo(() => {
    const map = new Map<string, { username: string; lastMessage: string; time: string; avatarUrl?: string; unread: boolean; msgs: DmMessage[] }>();
    for (const msg of dms) {
      if (!map.has(msg.user_id)) {
        map.set(msg.user_id, {
          username: msg.username || "Player " + msg.user_id,
          lastMessage: msg.message,
          time: msg.created_at,
          avatarUrl: msg.avatar_url,
          unread: !msg.read && msg.sender_type === "user",
          msgs: [msg],
        });
      } else {
        const item = map.get(msg.user_id)!;
        item.msgs.push(msg);
        if (!msg.read && msg.sender_type === "user") item.unread = true;
      }
    }
    return Array.from(map.entries()).map(([userId, data]) => ({ userId, ...data }));
  }, [dms]);

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Comms & Moderation
            </h2>
            <p className="text-[11px] text-zinc-400">
              Live In-Game Chat & Player DMs
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-[#0e1118] p-1 rounded-xl border border-zinc-800 text-xs">
        <button
          onClick={() => {
            setActiveTab("dms");
            setSelectedUser(null);
          }}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "dms"
              ? "bg-cyan-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Player DMs ({userThreads.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("public")}
          className={`flex-1 py-1.5 rounded-lg text-center font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "public"
              ? "bg-cyan-500 text-black font-bold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Public Chat ({messages.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="text-xs font-mono">Connecting to comms...</span>
        </div>
      ) : activeTab === "dms" ? (
        selectedUser ? (
          // Inside a single user conversation
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <button
                onClick={() => setSelectedUser(null)}
                className="text-xs font-mono text-cyan-400 hover:underline"
              >
                &larr; Back to all DMs
              </button>
              <span className="font-bold text-xs text-white">
                {userThreads.find((t) => t.userId === selectedUser)?.username}
              </span>
            </div>

            {/* Conversation Messages */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto p-1 overscroll-contain touch-pan-y scroll-container">
              {(userThreads.find((t) => t.userId === selectedUser)?.msgs || []).map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender_type === "dev" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs font-mono ${
                      m.sender_type === "dev"
                        ? "bg-cyan-500 text-black font-medium"
                        : "bg-[#0e1118] border border-zinc-800 text-zinc-200"
                    }`}
                  >
                    <p>{m.message}</p>
                  </div>
                  <span className="text-[9px] text-zinc-600 font-mono mt-0.5 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>

            {/* Reply Input */}
            <form onSubmit={handleSendDm} className="flex gap-2 pt-2 border-t border-zinc-800">
              <input
                type="text"
                value={dmReplyInput}
                onChange={(e) => setDmReplyInput(e.target.value)}
                placeholder="Reply directly to player..."
                className="flex-1 rounded-xl bg-[#0e1118] border border-zinc-800 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
              <button
                type="submit"
                disabled={sendingDm}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          // DMs List
          <div className="space-y-2.5">
            {userThreads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500 space-y-1">
                <Mail className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs font-semibold text-zinc-300">No Direct Messages</p>
                <p className="text-[11px]">When in-game players send support DMs, they appear here.</p>
              </div>
            ) : (
              userThreads.map((thread) => (
                <div
                  key={thread.userId}
                  onClick={() => setSelectedUser(thread.userId)}
                  className="rounded-2xl bg-[#0e1118] border border-zinc-800 p-3.5 space-y-1 hover:border-cyan-500/50 cursor-pointer active:scale-98 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span>{thread.username}</span>
                      {thread.unread && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      )}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(thread.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono truncate">
                    {thread.lastMessage}
                  </p>
                </div>
              ))
            )}
          </div>
        )
      ) : (
        // Public Chatroom Feed
        <div className="space-y-3">
          {/* Post Message as Dev */}
          <form onSubmit={handleSendPublic} className="flex gap-2">
            <input
              type="text"
              value={publicInput}
              onChange={(e) => setPublicInput(e.target.value)}
              placeholder="Send message to public chat as Admin..."
              className="flex-1 rounded-xl bg-[#0e1118] border border-zinc-800 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={sendingPublic}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Messages Feed */}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain touch-pan-y scroll-container">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
                <MessageSquare className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs">No chat messages yet.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl bg-[#0e1118] border border-zinc-800/80 p-2.5 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">
                        {m.display_name || m.username}
                      </span>
                      {m.is_dev && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-600/40 text-[9px] font-mono text-cyan-400 font-bold">
                          DEV
                        </span>
                      )}
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 font-mono mt-0.5 select-text">
                      {m.message}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeletePublic(m.id)}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
