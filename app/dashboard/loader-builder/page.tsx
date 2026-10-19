// app/dashboard/loader-builder/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import RobloxLoaderPreview, {
  LayoutElementId,
  ElementPosition,
  LayoutPositions,
  DEFAULT_LAYOUT_POSITIONS,
} from "@/components/RobloxLoaderPreview";
import type { LoaderConfigRecord, ScriptRecord } from "@/lib/store";
import {
  Sliders,
  Save,
  Check,
  AlertCircle,
  Bell,
  RotateCcw,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  Layers,
  Maximize2,
  ListOrdered,
  Type,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export default function LoaderBuilderPage() {
  const [configs, setConfigs] = useState<LoaderConfigRecord[]>([]);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form State
  const [configId, setConfigId] = useState<string>("");
  const [name, setName] = useState("Dark Theme (Default)");
  const [brandName, setBrandName] = useState("AtomProtect");
  const [title, setTitle] = useState("Key System");
  const [customSubtitle, setCustomSubtitle] = useState("Enter your license key below");
  const [keyPlaceholder, setKeyPlaceholder] = useState("Paste your license key here...");
  const [verifyButtonText, setVerifyButtonText] = useState("VERIFY KEY");
  const [claimButtonText, setClaimButtonText] = useState("CLAIM YOUR KEY (COPY LINK)");
  const [showDiscordButton, setShowDiscordButton] = useState(false);
  const [discordButtonText, setDiscordButtonText] = useState("JOIN DISCORD");
  const [discordInviteUrl, setDiscordInviteUrl] = useState("https://discord.gg/yourserver");
  const [showWatermark, setShowWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState("AtomProtect");

  // Custom Status Messages
  const [statusVerifying, setStatusVerifying] = useState("Checking license key...");
  const [statusVerified, setStatusVerified] = useState("Access Granted! Loading script...");
  const [statusExpired, setStatusExpired] = useState("License key expired or invalid.");
  const [statusError, setStatusError] = useState("Verification failed. Check network or key.");

  // Colors & Geometry
  const [accentColor, setAccentColor] = useState("#00a2ff");
  const [backgroundColor, setBackgroundColor] = useState("#16161e");
  const [cardColor, setCardColor] = useState("#21222e");
  const [textColor, setTextColor] = useState("#ffffff");
  const [subtextColor, setSubtextColor] = useState("#9ca3af");
  const [cornerRadius, setCornerRadius] = useState(10);
  const [frameWidth, setFrameWidth] = useState(360);
  const [frameHeight, setFrameHeight] = useState(250);
  const [fontFace, setFontFace] = useState("GothamMedium");

  // Layout Positions State (Figma drag & drop)
  const [layoutPositions, setLayoutPositions] = useState<LayoutPositions>(DEFAULT_LAYOUT_POSITIONS);
  const [selectedElementId, setSelectedElementId] = useState<LayoutElementId | null>("keyBox");

  // Webhook State
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testWebhookStatus, setTestWebhookStatus] = useState<"success" | "error" | null>(null);

  const handleTestWebhook = async () => {
    const url = webhookUrl.trim();
    if (!url || !url.startsWith("https://discord.com/api/webhooks/")) {
      setValidationError("Please enter a valid Discord webhook URL before testing.");
      return;
    }
    setTestingWebhook(true);
    setTestWebhookStatus(null);
    setValidationError(null);
    try {
      const res = await fetch("/api/loader-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_webhook",
          webhook_url: url,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestWebhookStatus("success");
      } else {
        setTestWebhookStatus("error");
        setValidationError(data.error || "Discord rejected the webhook.");
      }
    } catch (err: unknown) {
      setTestWebhookStatus("error");
      setValidationError(err instanceof Error ? err.message : "Failed to connect to Discord.");
    } finally {
      setTestingWebhook(false);
      setTimeout(() => setTestWebhookStatus(null), 5000);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchScripts();
  }, []);

  const fetchConfigs = async (targetId?: string) => {
    try {
      const res = await fetch("/api/loader-configs");
      const data = await res.json();
      if (data.configs && data.configs.length > 0) {
        setConfigs(data.configs);
        if (targetId) {
          const found = data.configs.find((c: LoaderConfigRecord) => c.id === targetId);
          if (found) loadConfig(found);
        } else if (!configId) {
          loadConfig(data.configs[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/scripts");
      const data = await res.json();
      if (data.scripts) {
        setScripts(data.scripts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadConfig = (cfg: LoaderConfigRecord) => {
    setConfigId(cfg.id);
    setName(cfg.name);
    setBrandName(cfg.brand_name);
    setTitle(cfg.title);
    setCustomSubtitle(cfg.custom_subtitle);
    setKeyPlaceholder(cfg.key_placeholder || "Paste your license key here...");
    setVerifyButtonText(cfg.verify_button_text || "VERIFY KEY");
    setClaimButtonText(cfg.claim_button_text || "CLAIM YOUR KEY (COPY LINK)");
    setShowDiscordButton(Boolean(cfg.show_discord_button));
    setDiscordButtonText(cfg.discord_button_text || "JOIN DISCORD");
    setDiscordInviteUrl(cfg.discord_invite_url || "https://discord.gg/yourserver");
    setShowWatermark(cfg.show_watermark !== false);
    setWatermarkText(cfg.watermark_text || "AtomProtect");
    setStatusVerifying(cfg.status_verifying || "Checking license key...");
    setStatusVerified(cfg.status_verified || "Access Granted! Loading script...");
    setStatusExpired(cfg.status_expired || "License key expired or invalid.");
    setStatusError(cfg.status_error || "Verification failed. Check network or key.");

    setAccentColor(cfg.accent_color);
    setBackgroundColor(cfg.background_color);
    setCardColor(cfg.card_color);
    setTextColor(cfg.text_color);
    setSubtextColor(cfg.subtext_color);
    setCornerRadius(cfg.corner_radius);
    setFrameWidth(cfg.frame_width);
    setFrameHeight(cfg.frame_height);
    setFontFace(cfg.font_face);
    setWebhookEnabled(Boolean(cfg.webhook_enabled));
    setWebhookUrl(cfg.webhook_url || "");

    if (cfg.layout_positions && Object.keys(cfg.layout_positions).length > 0) {
      setLayoutPositions({
        ...DEFAULT_LAYOUT_POSITIONS,
        ...cfg.layout_positions,
      } as LayoutPositions);
    } else {
      setLayoutPositions(DEFAULT_LAYOUT_POSITIONS);
    }

    const boundScript = scripts.find((s) => s.loader_config_id === cfg.id);
    setSelectedScriptId(boundScript ? boundScript.id : "all");

    setValidationError(null);
  };

  const applyColorTheme = (theme: { accent: string; bg: string; card: string }) => {
    setAccentColor(theme.accent);
    setBackgroundColor(theme.bg);
    setCardColor(theme.card);
  };

  const handlePositionChange = (elementId: LayoutElementId, pos: ElementPosition) => {
    setLayoutPositions((prev) => ({
      ...prev,
      [elementId]: pos,
    }));
  };

  const handleCenterElement = () => {
    if (!selectedElementId) return;
    const current = layoutPositions[selectedElementId];
    const elemWidth = current.w || frameWidth - 30;
    const centeredX = Math.max(0, Math.round((frameWidth - elemWidth) / 2));
    handlePositionChange(selectedElementId, {
      ...current,
      x: centeredX,
    });
  };

  const handleAlignLeft = () => {
    if (!selectedElementId) return;
    const current = layoutPositions[selectedElementId];
    handlePositionChange(selectedElementId, {
      ...current,
      x: 15,
    });
  };

  const handleFullWidth = () => {
    if (!selectedElementId) return;
    const current = layoutPositions[selectedElementId];
    handlePositionChange(selectedElementId, {
      ...current,
      x: 15,
      w: Math.max(160, frameWidth - 30),
    });
  };

  const handleAutoDistribute = () => {
    const visibleElements: LayoutElementId[] = showDiscordButton
      ? ["subtitle", "keyBox", "verifyBtn", "claimBtn", "discordBtn"]
      : ["subtitle", "keyBox", "verifyBtn", "claimBtn"];

    const topY = 50;
    const bottomMargin = 14;
    const availableH = frameHeight - topY - bottomMargin;

    const heights: Record<LayoutElementId, number> = {
      subtitle: layoutPositions.subtitle?.h || 20,
      keyBox: layoutPositions.keyBox?.h || 40,
      verifyBtn: layoutPositions.verifyBtn?.h || 38,
      claimBtn: layoutPositions.claimBtn?.h || 34,
      discordBtn: layoutPositions.discordBtn?.h || 30,
    };

    const totalElemH = visibleElements.reduce((acc, id) => acc + heights[id], 0);
    const remainingSpace = Math.max(0, availableH - totalElemH);
    const gap = visibleElements.length > 1 ? Math.floor(remainingSpace / (visibleElements.length - 1)) : 8;

    let curY = topY;
    const updated = { ...layoutPositions };
    for (const id of visibleElements) {
      updated[id] = {
        ...updated[id],
        y: curY,
      };
      curY += heights[id] + gap;
    }
    setLayoutPositions(updated);
  };

  const handleResetLayout = () => {
    const defaultW = Math.max(160, frameWidth - 30);
    setLayoutPositions({
      subtitle: { x: 15, y: 52, w: defaultW, h: 20 },
      keyBox: { x: 15, y: 78, w: defaultW, h: 40 },
      verifyBtn: { x: 15, y: 132, w: defaultW, h: 38 },
      claimBtn: { x: 15, y: 178, w: defaultW, h: 34 },
      discordBtn: { x: 15, y: 218, w: defaultW, h: 30 },
    });
  };

  const handleSave = async () => {
    setValidationError(null);

    if (webhookEnabled) {
      if (!webhookUrl.trim() || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        setValidationError(
          "You enabled Discord Webhook Logging, so you must enter a valid Discord webhook URL to save."
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/loader-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: configId || undefined,
          name,
          brand_name: brandName,
          title,
          custom_subtitle: customSubtitle,
          key_placeholder: keyPlaceholder,
          verify_button_text: verifyButtonText,
          claim_button_text: claimButtonText,
          show_discord_button: showDiscordButton,
          discord_button_text: discordButtonText,
          discord_invite_url: discordInviteUrl,
          show_watermark: showWatermark,
          watermark_text: watermarkText,
          status_verifying: statusVerifying,
          status_verified: statusVerified,
          status_expired: statusExpired,
          status_error: statusError,
          accent_color: accentColor,
          background_color: backgroundColor,
          card_color: cardColor,
          text_color: textColor,
          subtext_color: subtextColor,
          corner_radius: cornerRadius,
          frame_width: frameWidth,
          frame_height: frameHeight,
          font_face: fontFace,
          webhook_enabled: webhookEnabled,
          webhook_url: webhookUrl.trim(),
          layout_positions: layoutPositions,
        }),
      });

      const data = await res.json();
      if (data.config) {
        // Always link scripts so execution webhooks and loader styles apply
        if (selectedScriptId && selectedScriptId !== "all") {
          const targetScript = scripts.find((s) => s.id === selectedScriptId);
          if (targetScript) {
            await fetch("/api/scripts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...targetScript,
                loader_config_id: data.config.id,
              }),
            });
          }
        } else {
          // Link all scripts that do not have a custom loader config or when "all" is selected
          for (const s of scripts) {
            if (!s.loader_config_id || s.loader_config_id === data.config.id || selectedScriptId === "all") {
              await fetch("/api/scripts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...s,
                  loader_config_id: data.config.id,
                }),
              });
            }
          }
        }

        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        await fetchConfigs(data.config.id);
      }
    } catch (err) {
      console.error("Error saving config", err);
      setValidationError("Failed to save loader configuration.");
    } finally {
      setSaving(false);
    }
  };

  const currentPreviewConfig: Partial<LoaderConfigRecord> = {
    brand_name: brandName,
    title,
    custom_subtitle: customSubtitle,
    key_placeholder: keyPlaceholder,
    verify_button_text: verifyButtonText,
    claim_button_text: claimButtonText,
    show_discord_button: showDiscordButton,
    discord_button_text: discordButtonText,
    discord_invite_url: discordInviteUrl,
    show_watermark: showWatermark,
    watermark_text: watermarkText,
    accent_color: accentColor,
    background_color: backgroundColor,
    card_color: cardColor,
    text_color: textColor,
    subtext_color: subtextColor,
    corner_radius: cornerRadius,
    frame_width: frameWidth,
    frame_height: frameHeight,
    font_face: fontFace,
    layout_positions: layoutPositions,
  };

  const selectedPos = selectedElementId ? layoutPositions[selectedElementId] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-purple-400" />
            Build your Auth Loader
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            100% No-Code Roblox ScreenGui Builder: move boxes, customize texts, adjust dimensions, and generate error-free Luau.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved & Attached</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Loader Style"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Controls Panel */}
        <div className="lg:col-span-5 bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl space-y-5">
          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Saved Presets
            </label>
            <div className="flex items-center gap-2">
              <select
                value={configId}
                onChange={(e) => {
                  const found = configs.find((c) => c.id === e.target.value);
                  if (found) loadConfig(found);
                }}
                className="flex-1 bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setConfigId("");
                  setName("Custom Theme (Copy)");
                }}
                className="px-3 py-2 text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 whitespace-nowrap"
              >
                New Preset
              </button>
            </div>
          </div>

          {/* Quick Palette Themes */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Quick Theme Palettes
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  applyColorTheme({ accent: "#00a2ff", bg: "#16161e", card: "#21222e" })
                }
                className="p-2 rounded-lg border border-gray-700 bg-[#16161e] text-[11px] font-semibold text-white flex flex-col items-center gap-1 hover:border-blue-500 transition-colors"
              >
                <div className="w-4 h-4 rounded-full bg-[#00a2ff]"></div>
                <span>Cyan</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  applyColorTheme({ accent: "#a855f7", bg: "#13111c", card: "#1e1b2e" })
                }
                className="p-2 rounded-lg border border-gray-700 bg-[#13111c] text-[11px] font-semibold text-white flex flex-col items-center gap-1 hover:border-purple-500 transition-colors"
              >
                <div className="w-4 h-4 rounded-full bg-[#a855f7]"></div>
                <span>Neon Purple</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  applyColorTheme({ accent: "#10b981", bg: "#0d1612", card: "#13231c" })
                }
                className="p-2 rounded-lg border border-gray-700 bg-[#0d1612] text-[11px] font-semibold text-white flex flex-col items-center gap-1 hover:border-emerald-500 transition-colors"
              >
                <div className="w-4 h-4 rounded-full bg-[#10b981]"></div>
                <span>Emerald</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  applyColorTheme({ accent: "#f43f5e", bg: "#190e11", card: "#281419" })
                }
                className="p-2 rounded-lg border border-gray-700 bg-[#190e11] text-[11px] font-semibold text-white flex flex-col items-center gap-1 hover:border-rose-500 transition-colors"
              >
                <div className="w-4 h-4 rounded-full bg-[#f43f5e]"></div>
                <span>Crimson</span>
              </button>
            </div>
          </div>

          {/* Texts & Button Labels Customizer */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-blue-400" />
              <span>Titles & Button Labels</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Window Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Subtitle / Prompt</label>
              <input
                type="text"
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Key Box Placeholder</label>
                <input
                  type="text"
                  value={keyPlaceholder}
                  onChange={(e) => setKeyPlaceholder(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Verify Button Text</label>
                <input
                  type="text"
                  value={verifyButtonText}
                  onChange={(e) => setVerifyButtonText(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Claim Button Text</label>
              <input
                type="text"
                value={claimButtonText}
                onChange={(e) => setClaimButtonText(e.target.value)}
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            {/* Custom Status Messages */}
            <div className="pt-2 border-t border-gray-800 space-y-2.5">
              <span className="text-[11px] font-bold text-gray-300 block">Verification Status Strings</span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Verifying Message</label>
                  <input
                    type="text"
                    value={statusVerifying}
                    onChange={(e) => setStatusVerifying(e.target.value)}
                    placeholder="Checking license key..."
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Success / Verified</label>
                  <input
                    type="text"
                    value={statusVerified}
                    onChange={(e) => setStatusVerified(e.target.value)}
                    placeholder="Access Granted! Loading script..."
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Expired Key</label>
                  <input
                    type="text"
                    value={statusExpired}
                    onChange={(e) => setStatusExpired(e.target.value)}
                    placeholder="License key expired or invalid."
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Network / Error</label>
                  <input
                    type="text"
                    value={statusError}
                    onChange={(e) => setStatusError(e.target.value)}
                    placeholder="Verification failed. Check network or key."
                    className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Optional Discord Button Feature */}
          <div className="p-3.5 rounded-xl border border-gray-800 bg-[#0d0f17] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-gray-200">Discord Community Button</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDiscordButton}
                  onChange={(e) => setShowDiscordButton(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Adds an optional community button directly on the loader for users to join your Discord server.
            </p>
            {showDiscordButton && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Discord Button Text</label>
                  <input
                    type="text"
                    value={discordButtonText}
                    onChange={(e) => setDiscordButtonText(e.target.value)}
                    className="w-full bg-[#12141e] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Discord Invite URL</label>
                  <input
                    type="url"
                    value={discordInviteUrl}
                    onChange={(e) => setDiscordInviteUrl(e.target.value)}
                    placeholder="https://discord.gg/..."
                    className="w-full bg-[#12141e] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Watermark Runtime Customization */}
          <div className="p-3.5 rounded-xl border border-gray-800 bg-[#0d0f17] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-gray-200">In-Game Top Watermark</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWatermark}
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            {showWatermark && (
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Watermark Title</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full bg-[#12141e] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                />
              </div>
            )}
          </div>

          {/* Webhook Execution Logging Section */}
          <div className="p-3.5 rounded-xl border border-gray-800 bg-[#0d0f17] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-gray-200">Execution Webhook Log</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Dispatches execution telemetry (User, IP, ISP, OS, Executor, Key last 4, Pass/Fail) to your Discord channel.
            </p>
            {webhookEnabled && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-medium text-gray-300">
                  Discord Webhook URL <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="flex-1 bg-[#12141e] border border-purple-500/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-400 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={testingWebhook || !webhookUrl}
                    onClick={handleTestWebhook}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-[11px] font-semibold transition-all disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                  >
                    {testingWebhook ? (
                      <span>Sending...</span>
                    ) : testWebhookStatus === "success" ? (
                      <span className="text-emerald-400">✓ Sent!</span>
                    ) : (
                      <span>Test Webhook</span>
                    )}
                  </button>
                </div>
                {testWebhookStatus === "success" && (
                  <p className="text-[10px] text-emerald-400 font-medium">
                    ✓ Test notification sent! Check your Discord channel.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Color Adjustments */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Colors</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Accent</label>
                <div className="flex items-center gap-1.5 bg-[#0d0f17] p-1.5 rounded-lg border border-gray-800">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] text-gray-300 truncate">{accentColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Background</label>
                <div className="flex items-center gap-1.5 bg-[#0d0f17] p-1.5 rounded-lg border border-gray-800">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] text-gray-300 truncate">{backgroundColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Card Box</label>
                <div className="flex items-center gap-1.5 bg-[#0d0f17] p-1.5 rounded-lg border border-gray-800">
                  <input
                    type="color"
                    value={cardColor}
                    onChange={(e) => setCardColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] text-gray-300 truncate">{cardColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sizing & Geometry */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Dimensions</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Radius</span>
                  <span className="font-mono text-gray-200">{cornerRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={cornerRadius}
                  onChange={(e) => setCornerRadius(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Width</span>
                  <span className="font-mono text-gray-200">{frameWidth}px</span>
                </div>
                <input
                  type="range"
                  min="280"
                  max="440"
                  value={frameWidth}
                  onChange={(e) => setFrameWidth(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Height</span>
                  <span className="font-mono text-gray-200">{frameHeight}px</span>
                </div>
                <input
                  type="range"
                  min="220"
                  max="380"
                  value={frameHeight}
                  onChange={(e) => setFrameHeight(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Script Assignment Option */}
          <div className="pt-2 border-t border-gray-800">
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Apply to Script
            </label>
            <select
              value={selectedScriptId}
              onChange={(e) => setSelectedScriptId(e.target.value)}
              className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            >
              <option value="all">Apply to All Scripts (Default)</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (/{s.slug})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              Binds this custom loader style and Discord execution webhook to the selected script(s).
            </p>
          </div>
        </div>

        {/* Live Preview & Figma Canvas Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Roblox UI Simulation & Canvas
            </h2>
            <span className="text-[11px] text-gray-500 font-mono">
              Figma Drag, Resize & Align
            </span>
          </div>

          <RobloxLoaderPreview
            config={currentPreviewConfig}
            layoutPositions={layoutPositions}
            onPositionChange={handlePositionChange}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
          />

          {/* Figma Element Inspector & Alignment Controls */}
          <div className="p-4 rounded-xl bg-[#12141d] border border-gray-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Element Layout Inspector</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/30 rounded-md border border-indigo-500/40 transition-colors"
                  title="Evenly distribute vertical spacing of elements"
                >
                  <ListOrdered className="w-3 h-3" />
                  <span>Auto-Distribute</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 rounded-md border border-gray-700/80 transition-colors"
                  title="Reset layout positions to default"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>

            {/* Element Layer Selector Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  { id: "subtitle", label: "Subtitle" },
                  { id: "keyBox", label: "Key Input" },
                  { id: "verifyBtn", label: "Verify Btn" },
                  { id: "claimBtn", label: "Claim Btn" },
                  ...(showDiscordButton ? [{ id: "discordBtn", label: "Discord Btn" }] : []),
                ] as const
              ).map((elem) => {
                const isActive = selectedElementId === elem.id;
                return (
                  <button
                    key={elem.id}
                    type="button"
                    onClick={() => setSelectedElementId(elem.id as LayoutElementId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                      isActive
                        ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm"
                        : "bg-[#0d0f17] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
                    }`}
                  >
                    {elem.label}
                  </button>
                );
              })}
            </div>

            {/* Selected Element Position & Dimensions Controls */}
            {selectedElementId && selectedPos && (
              <div className="pt-2 border-t border-gray-800/80 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="flex items-center justify-between bg-[#0d0f17] px-3 py-1.5 rounded-lg border border-gray-800">
                    <span className="text-gray-500 font-mono text-[11px]">X</span>
                    <input
                      type="number"
                      value={selectedPos.x}
                      onChange={(e) =>
                        handlePositionChange(selectedElementId, {
                          ...selectedPos,
                          x: Number(e.target.value),
                        })
                      }
                      className="w-14 bg-transparent text-white font-mono text-xs text-right outline-none"
                    />
                    <span className="text-[10px] text-gray-500 ml-1">px</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#0d0f17] px-3 py-1.5 rounded-lg border border-gray-800">
                    <span className="text-gray-500 font-mono text-[11px]">Y</span>
                    <input
                      type="number"
                      value={selectedPos.y}
                      onChange={(e) =>
                        handlePositionChange(selectedElementId, {
                          ...selectedPos,
                          y: Number(e.target.value),
                        })
                      }
                      className="w-14 bg-transparent text-white font-mono text-xs text-right outline-none"
                    />
                    <span className="text-[10px] text-gray-500 ml-1">px</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#0d0f17] px-3 py-1.5 rounded-lg border border-gray-800">
                    <span className="text-gray-500 font-mono text-[11px]">W</span>
                    <input
                      type="number"
                      value={selectedPos.w || frameWidth - 30}
                      onChange={(e) =>
                        handlePositionChange(selectedElementId, {
                          ...selectedPos,
                          w: Number(e.target.value),
                        })
                      }
                      className="w-14 bg-transparent text-white font-mono text-xs text-right outline-none"
                    />
                    <span className="text-[10px] text-gray-500 ml-1">px</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#0d0f17] px-3 py-1.5 rounded-lg border border-gray-800">
                    <span className="text-gray-500 font-mono text-[11px]">H</span>
                    <input
                      type="number"
                      value={selectedPos.h || (selectedElementId === "keyBox" ? 40 : 34)}
                      onChange={(e) =>
                        handlePositionChange(selectedElementId, {
                          ...selectedPos,
                          h: Number(e.target.value),
                        })
                      }
                      className="w-14 bg-transparent text-white font-mono text-xs text-right outline-none"
                    />
                    <span className="text-[10px] text-gray-500 ml-1">px</span>
                  </div>
                </div>

                {/* Quick Alignment Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCenterElement}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181a24] hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 text-xs transition-colors"
                  >
                    <AlignHorizontalJustifyCenter className="w-3.5 h-3.5 text-blue-400" />
                    <span>Center Horizontally</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAlignLeft}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181a24] hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 text-xs transition-colors"
                  >
                    <AlignLeft className="w-3.5 h-3.5 text-purple-400" />
                    <span>Left Margin (15px)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFullWidth}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181a24] hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 text-xs transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Width</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
