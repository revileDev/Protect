// components/RobloxLoaderPreview.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { LoaderConfigRecord } from "@/lib/store";
import {
  Check,
  Copy,
  Move,
  Play,
  RotateCcw,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  ExternalLink,
} from "lucide-react";

export type LayoutElementId = "subtitle" | "keyBox" | "verifyBtn" | "claimBtn" | "discordBtn";

export interface ElementPosition {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export type LayoutPositions = Record<LayoutElementId, ElementPosition>;

export const DEFAULT_LAYOUT_POSITIONS: LayoutPositions = {
  subtitle: { x: 15, y: 52, w: 330, h: 20 },
  keyBox: { x: 15, y: 78, w: 330, h: 40 },
  verifyBtn: { x: 15, y: 132, w: 330, h: 38 },
  claimBtn: { x: 15, y: 178, w: 330, h: 34 },
  discordBtn: { x: 15, y: 218, w: 330, h: 30 },
};

interface Props {
  config: Partial<LoaderConfigRecord>;
  claimUrl?: string;
  watermarkText?: string;
  showWatermark?: boolean;
  layoutPositions?: Partial<LayoutPositions>;
  onPositionChange?: (elementId: LayoutElementId, pos: ElementPosition) => void;
  selectedElementId?: LayoutElementId | null;
  onSelectElement?: (elementId: LayoutElementId | null) => void;
}

export default function RobloxLoaderPreview({
  config,
  claimUrl = "http://localhost:3000/claim",
  watermarkText = "AtomProtect",
  showWatermark = true,
  layoutPositions,
  onPositionChange,
  selectedElementId: externalSelectedElement,
  onSelectElement: externalSetSelectedElement,
}: Props) {
  const [mode, setMode] = useState<"design" | "interactive">("design");
  const [internalSelected, setInternalSelected] = useState<LayoutElementId | null>("keyBox");
  const [testKey, setTestKey] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [copied, setCopied] = useState(false);
  const [discordCopied, setDiscordCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // References for drag & resize calculation
  const frameRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    elementId: LayoutElementId;
    startX: number;
    startY: number;
    initialElemX: number;
    initialElemY: number;
  } | null>(null);

  const resizeStartRef = useRef<{
    elementId: LayoutElementId;
    startX: number;
    startY: number;
    initialW: number;
    initialH: number;
  } | null>(null);

  const selectedElement = externalSelectedElement !== undefined ? externalSelectedElement : internalSelected;
  const setSelectedElement = (id: LayoutElementId | null) => {
    if (externalSetSelectedElement) {
      externalSetSelectedElement(id);
    } else {
      setInternalSelected(id);
    }
  };

  const bg = config.background_color || "#16161e";
  const card = config.card_color || "#21222e";
  const accent = config.accent_color || "#00a2ff";
  const text = config.text_color || "#ffffff";
  const subtext = config.subtext_color || "#9ca3af";
  const radius = config.corner_radius ?? 10;
  const width = Math.min(Math.max(config.frame_width || 360, 260), 480);
  const height = Math.min(Math.max(config.frame_height || 250, 200), 400);

  const defaultItemW = Math.max(160, width - 30);
  const showDiscord = Boolean(config.show_discord_button);

  // Resolved layout positions
  const positions: LayoutPositions = {
    subtitle: {
      ...DEFAULT_LAYOUT_POSITIONS.subtitle,
      w: defaultItemW,
      ...(config.layout_positions?.subtitle || layoutPositions?.subtitle),
    },
    keyBox: {
      ...DEFAULT_LAYOUT_POSITIONS.keyBox,
      w: defaultItemW,
      ...(config.layout_positions?.keyBox || layoutPositions?.keyBox),
    },
    verifyBtn: {
      ...DEFAULT_LAYOUT_POSITIONS.verifyBtn,
      w: defaultItemW,
      ...(config.layout_positions?.verifyBtn || layoutPositions?.verifyBtn),
    },
    claimBtn: {
      ...DEFAULT_LAYOUT_POSITIONS.claimBtn,
      w: defaultItemW,
      ...(config.layout_positions?.claimBtn || layoutPositions?.claimBtn),
    },
    discordBtn: {
      ...DEFAULT_LAYOUT_POSITIONS.discordBtn,
      w: defaultItemW,
      ...(config.layout_positions?.discordBtn || layoutPositions?.discordBtn),
    },
  };

  // Keyboard Nudge (Arrow keys)
  useEffect(() => {
    if (mode !== "design" || !selectedElement) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentPos = positions[selectedElement];
      if (!currentPos) return;

      const step = e.shiftKey ? 10 : 1;
      let newX = currentPos.x;
      let newY = currentPos.y;

      const elemW = currentPos.w || defaultItemW;
      const elemH = currentPos.h || 30;

      if (e.key === "ArrowLeft") {
        newX = Math.max(0, currentPos.x - step);
      } else if (e.key === "ArrowRight") {
        newX = Math.min(width - elemW, currentPos.x + step);
      } else if (e.key === "ArrowUp") {
        newY = Math.max(44, currentPos.y - step);
      } else if (e.key === "ArrowDown") {
        newY = Math.min(height - elemH, currentPos.y + step);
      } else {
        return;
      }

      e.preventDefault();
      onPositionChange?.(selectedElement, {
        ...currentPos,
        x: newX,
        y: newY,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, selectedElement, positions, width, height, defaultItemW, onPositionChange]);

  // Drag start handler (Moving element)
  const handleMouseDownOnElement = (
    e: React.MouseEvent<HTMLDivElement>,
    elementId: LayoutElementId
  ) => {
    if (mode !== "design") return;
    e.stopPropagation();
    setSelectedElement(elementId);

    const currentPos = positions[elementId];
    dragStartRef.current = {
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      initialElemX: currentPos.x,
      initialElemY: currentPos.y,
    };
    setIsDragging(true);
  };

  // Resize start handler (Resizing element width/height)
  const handleMouseDownOnResize = (
    e: React.MouseEvent<HTMLDivElement>,
    elementId: LayoutElementId
  ) => {
    if (mode !== "design") return;
    e.stopPropagation();
    setSelectedElement(elementId);

    const currentPos = positions[elementId];
    resizeStartRef.current = {
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      initialW: currentPos.w || defaultItemW,
      initialH: currentPos.h || (elementId === "keyBox" ? 40 : 34),
    };
    setIsResizing(true);
  };

  // Drag move & end handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { elementId, startX, startY, initialElemX, initialElemY } = dragStartRef.current;
      const currentPos = positions[elementId];
      const elemWidth = currentPos.w || defaultItemW;
      const elemHeight = currentPos.h || 35;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let nextX = initialElemX + deltaX;
      let nextY = initialElemY + deltaY;

      // Constrain within Frame
      const minX = 0;
      const maxX = Math.max(0, width - elemWidth);
      const minY = 44; // Below header
      const maxY = Math.max(minY, height - elemHeight);

      nextX = Math.max(minX, Math.min(maxX, nextX));
      nextY = Math.max(minY, Math.min(maxY, nextY));

      // Smart Snap to center X (within 4px)
      const centerX = Math.round((width - elemWidth) / 2);
      if (Math.abs(nextX - centerX) <= 4) {
        nextX = centerX;
      }

      // Smart Snap to 15px left margin
      if (Math.abs(nextX - 15) <= 4) {
        nextX = 15;
      }

      onPositionChange?.(elementId, {
        ...currentPos,
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, width, height, defaultItemW, positions, onPositionChange]);

  // Resize move & end handlers
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const { elementId, startX, startY, initialW, initialH } = resizeStartRef.current;
      const currentPos = positions[elementId];

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let nextW = Math.max(80, initialW + deltaX);
      let nextH = Math.max(18, initialH + deltaY);

      // Constrain within frame bounds
      const maxW = Math.max(80, width - currentPos.x);
      const maxH = Math.max(18, height - currentPos.y);

      nextW = Math.min(maxW, nextW);
      nextH = Math.min(maxH, nextH);

      onPositionChange?.(elementId, {
        ...currentPos,
        w: Math.round(nextW),
        h: Math.round(nextH),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, width, height, positions, onPositionChange]);

  const handleTestVerify = () => {
    if (!testKey.trim()) {
      setFeedback({ message: "Please enter your key.", type: "error" });
      return;
    }
    setFeedback({ message: "Verifying key with server...", type: "info" });
    setTimeout(() => {
      setFeedback({ message: "✓ Authentication successful! Starting script...", type: "success" });
    }, 700);
  };

  const handleCopyClaim = () => {
    navigator.clipboard?.writeText(claimUrl);
    setCopied(true);
    setFeedback({ message: "Claim URL copied to clipboard!", type: "success" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDiscord = () => {
    const invite = config.discord_invite_url || "https://discord.gg/";
    navigator.clipboard?.writeText(invite);
    setDiscordCopied(true);
    setFeedback({ message: "Discord invite copied to clipboard!", type: "success" });
    setTimeout(() => setDiscordCopied(false), 2000);
  };

  const elementNames: Record<LayoutElementId, string> = {
    subtitle: "Subtitle Label",
    keyBox: "Key Input Box",
    verifyBtn: "Verify Button",
    claimBtn: "Claim Button",
    discordBtn: "Discord Button",
  };

  return (
    <div className="relative w-full aspect-[16/10] min-h-[460px] max-h-[580px] rounded-xl overflow-hidden border border-gray-800 bg-[#07090e] shadow-2xl flex flex-col select-none">
      {/* Top Bar with Mode Switcher & ScreenGui status */}
      <div className="h-10 w-full bg-[#111218]/95 border-b border-gray-800/80 flex items-center justify-between px-3 z-20">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gray-700/80 flex items-center justify-center text-[10px] font-black text-gray-200">
            R
          </div>
          <span className="text-xs font-semibold text-gray-300">Roblox ScreenGui</span>
        </div>

        {/* Figma Mode vs Interactive Simulator */}
        <div className="flex items-center bg-[#181a24] p-0.5 rounded-lg border border-gray-700/60">
          <button
            type="button"
            onClick={() => setMode("design")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              mode === "design"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Move className="w-3 h-3" />
            <span>Figma Canvas</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("interactive");
              setSelectedElement(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              mode === "interactive"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Play className="w-3 h-3" />
            <span>Test Loader</span>
          </button>
        </div>

        {/* Watermark preview */}
        {showWatermark && (
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium border shadow-sm"
            style={{
              backgroundColor: card,
              borderColor: `${accent}40`,
              color: text,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{config.watermark_text || config.brand_name || watermarkText} | 60 FPS | 18ms | Online: 14</span>
          </div>
        )}
      </div>

      {/* Viewport Backdrop with subtle Figma grid */}
      <div
        className="relative flex-1 flex items-center justify-center p-4 bg-gradient-to-b from-[#0b0f19] via-[#0d1222] to-[#080b12] overflow-hidden"
        onClick={() => {
          if (mode === "design") setSelectedElement(null);
        }}
      >
        {/* Floating countdown preview badge */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#141624]/90 border border-blue-500/50 text-blue-300 shadow-xl backdrop-blur-sm pointer-events-none select-none">
          <span>⏳ 23:59:45</span>
        </div>
        {/* Figma Grid Pattern */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              mode === "design"
                ? "radial-gradient(#3b82f6 1px, transparent 1px), radial-gradient(#6b7280 1px, transparent 1px)"
                : "linear-gradient(to right, #4a5568 1px, transparent 1px), linear-gradient(to bottom, #4a5568 1px, transparent 1px)",
            backgroundSize: mode === "design" ? "20px 20px" : "32px 32px",
          }}
        />

        {/* The Live Roblox Auth Loader Frame */}
        <div
          ref={frameRef}
          className="relative transition-shadow duration-200 shadow-2xl border"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            backgroundColor: bg,
            borderRadius: `${radius}px`,
            borderColor: `${accent}60`,
            boxShadow: `0 20px 40px -15px ${accent}25, 0 0 30px rgba(0,0,0,0.85)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div
            className="absolute top-0 left-0 right-0 h-11 px-3.5 flex items-center justify-between border-b select-none"
            style={{
              backgroundColor: card,
              borderTopLeftRadius: `${radius}px`,
              borderTopRightRadius: `${radius}px`,
              borderColor: `${accent}25`,
            }}
          >
            <div className="flex items-center gap-2 truncate">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span
                className="text-xs font-bold tracking-wide truncate"
                style={{ color: text }}
              >
                {config.brand_name || "AERO AUTH"}{" "}
                <span className="opacity-60 font-normal">| {config.title || "Key System"}</span>
              </span>
            </div>

            <button
              type="button"
              className="text-xs font-bold text-red-400/80 hover:text-red-400 px-1.5 py-0.5 rounded transition-colors"
              title="Simulated Close"
            >
              ✕
            </button>
          </div>

          {/* Subtitle Element */}
          <div
            onMouseDown={(e) => handleMouseDownOnElement(e, "subtitle")}
            className={`absolute transition-all duration-75 ${
              mode === "design"
                ? "cursor-move hover:outline hover:outline-1 hover:outline-blue-400/60"
                : ""
            } ${
              selectedElement === "subtitle" && mode === "design"
                ? "ring-2 ring-blue-500 rounded bg-blue-500/10 z-30"
                : "z-10"
            }`}
            style={{
              left: `${positions.subtitle.x}px`,
              top: `${positions.subtitle.y}px`,
              width: `${positions.subtitle.w || defaultItemW}px`,
              height: `${positions.subtitle.h || 20}px`,
            }}
          >
            {selectedElement === "subtitle" && mode === "design" && (
              <>
                <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-blue-600 text-[10px] font-mono text-white rounded flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap">
                  <span>Subtitle</span>
                  <span className="opacity-75">
                    ({positions.subtitle.x}, {positions.subtitle.y})
                  </span>
                </div>
                <div
                  onMouseDown={(e) => handleMouseDownOnResize(e, "subtitle")}
                  className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-sm cursor-se-resize shadow"
                  title="Drag to resize width and height"
                />
              </>
            )}
            <p
              className="text-[11px] font-medium leading-tight truncate pointer-events-none"
              style={{ color: subtext }}
            >
              {config.custom_subtitle || "Enter your license key below"}
            </p>
          </div>

          {/* Key Input Box Element */}
          <div
            onMouseDown={(e) => handleMouseDownOnElement(e, "keyBox")}
            className={`absolute transition-all duration-75 ${
              mode === "design"
                ? "cursor-move hover:outline hover:outline-1 hover:outline-blue-400/60"
                : ""
            } ${
              selectedElement === "keyBox" && mode === "design"
                ? "ring-2 ring-blue-500 rounded-md bg-blue-500/10 z-30"
                : "z-10"
            }`}
            style={{
              left: `${positions.keyBox.x}px`,
              top: `${positions.keyBox.y}px`,
              width: `${positions.keyBox.w || defaultItemW}px`,
              height: `${positions.keyBox.h || 40}px`,
            }}
          >
            {selectedElement === "keyBox" && mode === "design" && (
              <>
                <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-blue-600 text-[10px] font-mono text-white rounded flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap">
                  <span>Key Input</span>
                  <span className="opacity-75">
                    ({positions.keyBox.x}, {positions.keyBox.y})
                  </span>
                </div>
                <div
                  onMouseDown={(e) => handleMouseDownOnResize(e, "keyBox")}
                  className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-sm cursor-se-resize shadow"
                  title="Drag to resize width and height"
                />
              </>
            )}
            <div
              className="w-full h-full rounded-md border p-1 transition-all flex items-center gap-1.5"
              style={{
                backgroundColor: card,
                borderColor: `${subtext}30`,
              }}
            >
              <input
                type="text"
                disabled={mode === "design"}
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                placeholder={config.key_placeholder || "Paste your license key here..."}
                className={`flex-1 bg-transparent px-2.5 py-1 text-xs outline-none ${
                  mode === "design" ? "pointer-events-none select-none" : ""
                }`}
                style={{ color: text }}
              />
              <button
                type="button"
                disabled={mode === "design"}
                onClick={() => setTestKey("ATOM-DEV-7788-9900")}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all shrink-0 ${
                  mode === "design"
                    ? "opacity-50 pointer-events-none bg-blue-600/20 text-blue-300"
                    : "bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-sm"
                }`}
                title="Simulate pasting key"
              >
                Paste
              </button>
            </div>
          </div>

          {/* Verify Button Element */}
          <div
            onMouseDown={(e) => handleMouseDownOnElement(e, "verifyBtn")}
            className={`absolute transition-all duration-75 ${
              mode === "design"
                ? "cursor-move hover:outline hover:outline-1 hover:outline-blue-400/60"
                : ""
            } ${
              selectedElement === "verifyBtn" && mode === "design"
                ? "ring-2 ring-blue-500 rounded-md bg-blue-500/10 z-30"
                : "z-10"
            }`}
            style={{
              left: `${positions.verifyBtn.x}px`,
              top: `${positions.verifyBtn.y}px`,
              width: `${positions.verifyBtn.w || defaultItemW}px`,
              height: `${positions.verifyBtn.h || 38}px`,
            }}
          >
            {selectedElement === "verifyBtn" && mode === "design" && (
              <>
                <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-blue-600 text-[10px] font-mono text-white rounded flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap">
                  <span>Verify Button</span>
                  <span className="opacity-75">
                    ({positions.verifyBtn.x}, {positions.verifyBtn.y})
                  </span>
                </div>
                <div
                  onMouseDown={(e) => handleMouseDownOnResize(e, "verifyBtn")}
                  className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-sm cursor-se-resize shadow"
                  title="Drag to resize width and height"
                />
              </>
            )}
            <button
              type="button"
              disabled={mode === "design"}
              onClick={handleTestVerify}
              className={`w-full h-full py-1.5 px-3 text-xs font-bold text-white rounded-md shadow-md flex items-center justify-center gap-1.5 ${
                mode === "design"
                  ? "pointer-events-none select-none"
                  : "active:scale-[0.98] transition-transform"
              }`}
              style={{
                backgroundColor: accent,
                borderRadius: `${Math.max(4, radius - 4)}px`,
              }}
            >
              {config.verify_button_text || "VERIFY KEY"}
            </button>
          </div>

          {/* Claim Key Button Element */}
          <div
            onMouseDown={(e) => handleMouseDownOnElement(e, "claimBtn")}
            className={`absolute transition-all duration-75 ${
              mode === "design"
                ? "cursor-move hover:outline hover:outline-1 hover:outline-blue-400/60"
                : ""
            } ${
              selectedElement === "claimBtn" && mode === "design"
                ? "ring-2 ring-blue-500 rounded-md bg-blue-500/10 z-30"
                : "z-10"
            }`}
            style={{
              left: `${positions.claimBtn.x}px`,
              top: `${positions.claimBtn.y}px`,
              width: `${positions.claimBtn.w || defaultItemW}px`,
              height: `${positions.claimBtn.h || 34}px`,
            }}
          >
            {selectedElement === "claimBtn" && mode === "design" && (
              <>
                <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-blue-600 text-[10px] font-mono text-white rounded flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap">
                  <span>Claim Button</span>
                  <span className="opacity-75">
                    ({positions.claimBtn.x}, {positions.claimBtn.y})
                  </span>
                </div>
                <div
                  onMouseDown={(e) => handleMouseDownOnResize(e, "claimBtn")}
                  className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-sm cursor-se-resize shadow"
                  title="Drag to resize width and height"
                />
              </>
            )}
            <button
              type="button"
              disabled={mode === "design"}
              onClick={handleCopyClaim}
              className={`w-full h-full py-1 px-3 text-[11px] font-semibold rounded-md border flex items-center justify-center gap-1.5 ${
                mode === "design"
                  ? "pointer-events-none select-none"
                  : "active:scale-[0.98] transition-transform"
              }`}
              style={{
                backgroundColor: card,
                borderColor: `${accent}40`,
                color: accent,
                borderRadius: `${Math.max(4, radius - 4)}px`,
              }}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>COPIED TO CLIPBOARD</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{config.claim_button_text || "CLAIM YOUR KEY (COPY LINK)"}</span>
                </>
              )}
            </button>
          </div>

          {/* Optional Discord Button Element */}
          {showDiscord && (
            <div
              onMouseDown={(e) => handleMouseDownOnElement(e, "discordBtn")}
              className={`absolute transition-all duration-75 ${
                mode === "design"
                  ? "cursor-move hover:outline hover:outline-1 hover:outline-blue-400/60"
                  : ""
              } ${
                selectedElement === "discordBtn" && mode === "design"
                  ? "ring-2 ring-blue-500 rounded-md bg-blue-500/10 z-30"
                  : "z-10"
              }`}
              style={{
                left: `${positions.discordBtn.x}px`,
                top: `${positions.discordBtn.y}px`,
                width: `${positions.discordBtn.w || defaultItemW}px`,
                height: `${positions.discordBtn.h || 30}px`,
              }}
            >
              {selectedElement === "discordBtn" && mode === "design" && (
                <>
                  <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-blue-600 text-[10px] font-mono text-white rounded flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap">
                    <span>Discord Button</span>
                    <span className="opacity-75">
                      ({positions.discordBtn.x}, {positions.discordBtn.y})
                    </span>
                  </div>
                  <div
                    onMouseDown={(e) => handleMouseDownOnResize(e, "discordBtn")}
                    className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-sm cursor-se-resize shadow"
                    title="Drag to resize width and height"
                  />
                </>
              )}
              <button
                type="button"
                disabled={mode === "design"}
                onClick={handleCopyDiscord}
                className={`w-full h-full py-1 px-3 text-[11px] font-semibold rounded-md border flex items-center justify-center gap-1.5 ${
                  mode === "design"
                    ? "pointer-events-none select-none"
                    : "active:scale-[0.98] transition-transform"
                }`}
                style={{
                  backgroundColor: card,
                  borderColor: "#7289da60",
                  color: "#7289da",
                  borderRadius: `${Math.max(4, radius - 4)}px`,
                }}
              >
                {discordCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>COPIED DISCORD LINK</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3 h-3" />
                    <span>{config.discord_button_text || "JOIN DISCORD"}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Feedback message (interactive mode) */}
          {feedback && mode === "interactive" && (
            <div
              className={`absolute left-4 right-4 bottom-2 text-[10px] text-center font-medium ${
                feedback.type === "success"
                  ? "text-emerald-400"
                  : feedback.type === "error"
                  ? "text-rose-400"
                  : "text-amber-400"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-8 px-4 bg-[#0e1017] border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-2">
          {mode === "design" ? (
            <>
              <Move className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {selectedElement
                  ? `Selected: ${elementNames[selectedElement]} (X: ${positions[selectedElement].x}px, Y: ${positions[selectedElement].y}px, W: ${positions[selectedElement].w || defaultItemW}px, H: ${positions[selectedElement].h || 30}px) • Drag box or resize corner`
                  : "Click any box to select, drag to reposition, or drag bottom-right corner to resize."}
              </span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Interactive Simulator: Test key entry, verify feedback, and copy claim link</span>
            </>
          )}
        </div>

        {mode === "design" && selectedElement && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-gray-300">
            <span className="bg-gray-800/80 px-2 py-0.5 rounded">
              X: {positions[selectedElement].x}
            </span>
            <span className="bg-gray-800/80 px-2 py-0.5 rounded">
              Y: {positions[selectedElement].y}
            </span>
            <span className="bg-gray-800/80 px-2 py-0.5 rounded">
              W: {positions[selectedElement].w || defaultItemW}
            </span>
            <span className="bg-gray-800/80 px-2 py-0.5 rounded">
              H: {positions[selectedElement].h || 30}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
