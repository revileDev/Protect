// mobile/src/App.tsx
import React, { useState, useEffect } from "react";
import { ApiService } from "./lib/api";
import TopHeader from "./components/TopHeader";
import BottomNav, { NavTab } from "./components/BottomNav";
import ServerConfigModal from "./components/ServerConfigModal";
import LoginScreen from "./screens/LoginScreen";
import PlayersScreen from "./screens/PlayersScreen";
import ScriptsScreen from "./screens/ScriptsScreen";
import KeysScreen from "./screens/KeysScreen";
import CheckpointsScreen from "./screens/CheckpointsScreen";
import ChatroomScreen from "./screens/ChatroomScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>("players");
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const checkAuth = async () => {
    await ApiService.init();
    const isAuthed = await ApiService.isAuthenticated();
    setAuthed(isAuthed);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await ApiService.logout();
    setAuthed(false);
  };

  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center text-zinc-500 font-mono text-xs">
        <span className="inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mr-2" />
        <span>Initializing Commander...</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={() => setAuthed(true)}
          onOpenServerConfig={() => setServerModalOpen(true)}
        />
        <ServerConfigModal
          isOpen={serverModalOpen}
          onClose={() => setServerModalOpen(false)}
          onSaved={() => checkAuth()}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col font-sans">
      <TopHeader
        onRefresh={() => setRefreshKey((k) => k + 1)}
        onLogout={handleLogout}
        onOpenServerConfig={() => setServerModalOpen(true)}
      />

      <main className="flex-1 overflow-y-auto" key={refreshKey}>
        {currentTab === "players" && <PlayersScreen />}
        {currentTab === "scripts" && <ScriptsScreen />}
        {currentTab === "keys" && <KeysScreen />}
        {currentTab === "checkpoints" && <CheckpointsScreen />}
        {currentTab === "chat" && <ChatroomScreen />}
        {currentTab === "analytics" && <AnalyticsScreen />}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
      />

      <ServerConfigModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
