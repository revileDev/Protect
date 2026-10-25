// mobile/src/components/BottomNav.tsx
import React from "react";
import { Users, Terminal, Key, ShieldCheck, MessageSquare, BarChart3 } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export type NavTab = "players" | "scripts" | "keys" | "checkpoints" | "chat" | "analytics";

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCount?: number;
  onlineCount?: number;
}

export default function BottomNav({
  currentTab,
  onTabChange,
  unreadCount = 0,
  onlineCount = 0,
}: BottomNavProps) {
  const triggerHaptic = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Haptics not available in pure browser preview
    }
  };

  const tabs: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: string;
  }> = [
    {
      id: "players",
      label: "Command",
      icon: Users,
      badge: onlineCount > 0 ? onlineCount : undefined,
      badgeColor: "bg-emerald-500",
    },
    {
      id: "scripts",
      label: "Vault",
      icon: Terminal,
    },
    {
      id: "keys",
      label: "Keys",
      icon: Key,
    },
    {
      id: "checkpoints",
      label: "Gateway",
      icon: ShieldCheck,
    },
    {
      id: "chat",
      label: "Comms",
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : undefined,
      badgeColor: "bg-cyan-500",
    },
    {
      id: "analytics",
      label: "Stats",
      icon: BarChart3,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0e14]/95 backdrop-blur-md border-t border-zinc-800/80 px-2 py-1 safe-bottom flex items-center justify-around">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => {
              triggerHaptic();
              onTabChange(tab.id);
            }}
            className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
              isActive
                ? "text-cyan-400 bg-cyan-950/40"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              {tab.badge !== undefined && (
                <span
                  className={`absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] rounded-full text-[9px] font-mono font-bold text-black flex items-center justify-center shadow-sm ${
                    tab.badgeColor || "bg-cyan-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight font-medium ${isActive ? "text-cyan-300 font-semibold" : ""}`}>
              {tab.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
