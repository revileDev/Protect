// components/ModularScriptUploader.tsx
"use client";

import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { UploadCloud, FileCode, CheckCircle2, Copy, Check, AlertCircle } from "lucide-react";
import { LoaderConfigRecord, ScriptRecord } from "@/lib/store";

interface Props {
  loaderConfigs: LoaderConfigRecord[];
  onScriptCreated: (script: ScriptRecord) => void;
}

export default function ModularScriptUploader({ loaderConfigs, onScriptCreated }: Props) {
  const [filesMap, setFilesMap] = useState<Record<string, string>>({});
  const [scriptName, setScriptName] = useState("");
  const [scriptSlug, setScriptSlug] = useState("");
  const [entryFile, setEntryFile] = useState("");
  const [selectedLoaderConfig, setSelectedLoaderConfig] = useState(loaderConfigs[0]?.id || "");
  const [watermarkText, setWatermarkText] = useState("AERO PROTECT");
  const [useAuth, setUseAuth] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [createdLoadstring, setCreatedLoadstring] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFilesList = async (files: FileList | File[]) => {
    setError(null);
    const newFilesMap: Record<string, string> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;

      if (file.name.endsWith(".zip")) {
        try {
          const zip = await JSZip.loadAsync(file);
          for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && (relativePath.endsWith(".lua") || relativePath.endsWith(".luau") || relativePath.endsWith(".txt"))) {
              const content = await zipEntry.async("string");
              newFilesMap[relativePath] = content;
            }
          }
        } catch {
          setError("Failed to extract zip file. Please make sure it is a valid zip archive.");
        }
      } else if (file.name.endsWith(".lua") || file.name.endsWith(".luau") || file.name.endsWith(".txt")) {
        const text = await file.text();
        newFilesMap[relPath] = text;
      }
    }

    if (Object.keys(newFilesMap).length === 0) {
      setError("No .lua or .luau files were found in the selected folder/files.");
      return;
    }

    setFilesMap(newFilesMap);

    // Auto-detect script name from folder or first file
    const fileKeys = Object.keys(newFilesMap);
    if (!scriptName) {
      const firstPath = fileKeys[0];
      const rootFolder = firstPath.includes("/") ? firstPath.split("/")[0] : "My Modular Script";
      setScriptName(rootFolder);
      setScriptSlug(rootFolder.toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
    }

    // Auto-detect entry file if common names exist
    const defaultInit = fileKeys.find((k) => k.endsWith("init.lua") || k.endsWith("main.lua") || k === "init.lua") || fileKeys[0];
    setEntryFile(defaultInit);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesList(e.dataTransfer.files);
    }
  };

  const handleSaveScript = async () => {
    if (!scriptName.trim()) {
      setError("Please specify a name for this script.");
      return;
    }
    if (!entryFile) {
      setError("Please designate which file is the main init script.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scriptName,
          slug: scriptSlug || scriptName.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
          entry_file: entryFile,
          modules: filesMap,
          loader_config_id: selectedLoaderConfig,
          watermark_text: watermarkText,
          show_watermark: true,
          use_auth: useAuth,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save script");

      const host = window.location.host;
      const protocol = window.location.protocol;
      const loadstring = `loadstring(game:HttpGet("${protocol}//${host}/api/loader/${data.script.slug}"))()`;

      setCreatedLoadstring(loadstring);
      onScriptCreated(data.script);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error saving script";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const copyLoadstring = () => {
    if (!createdLoadstring) return;
    navigator.clipboard?.writeText(createdLoadstring);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileCount = Object.keys(filesMap).length;

  return (
    <div className="bg-[#12141d] border border-gray-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-blue-400" />
            Upload Modular Script Folder
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Drop your modular Lua folder. We will bundle your modules into an in-memory virtual filesystem so your code remains 100% protected.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Drop Zone */}
      {fileCount === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-700/80 hover:border-blue-500/60 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#0d0f16]/60 transition-all cursor-pointer group"
          onClick={() => folderInputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-105 group-hover:bg-blue-600/20 transition-all">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-gray-200">
            Drag & drop your script folder or ZIP archive here
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Supports multi-file projects, nested sub-modules, and packages
          </p>

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 border border-gray-700"
            >
              Select Folder
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 border border-gray-700"
            >
              Select Files / Zip
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            type="file"
            ref={folderInputRef}
            /* @ts-expect-error webkitdirectory is non-standard but supported */
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFilesList(e.target.files)}
          />
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".lua,.luau,.zip"
            className="hidden"
            onChange={(e) => e.target.files && handleFilesList(e.target.files)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Discovered files overview */}
          <div className="bg-[#0b0d14] border border-gray-800 rounded-lg p-3.5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-gray-300">
                Discovered Files ({fileCount} modules):
              </span>
              <button
                type="button"
                onClick={() => setFilesMap({})}
                className="text-xs text-rose-400 hover:underline"
              >
                Clear / Re-upload
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
              {Object.keys(filesMap).map((path) => (
                <div
                  key={path}
                  onClick={() => setEntryFile(path)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-all ${
                    entryFile === path
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold"
                      : "bg-gray-900/60 text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                  }`}
                >
                  <span className="truncate">{path}</span>
                  {entryFile === path && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-sans">
                      Main Init Script ★
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block text-gray-300 font-medium mb-1">Script Name</label>
              <input
                type="text"
                value={scriptName}
                onChange={(e) => {
                  setScriptName(e.target.value);
                  setScriptSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
                }}
                placeholder="e.g. Combat Master V3"
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1">
                Designated Main Init Script <span className="text-blue-400">*</span>
              </label>
              <select
                value={entryFile}
                onChange={(e) => setEntryFile(e.target.value)}
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 font-mono"
              >
                {Object.keys(filesMap).map((k) => (
                  <option key={k} value={k}>
                    {k} {k === entryFile ? "(Current Entry Point)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1">
                Attach Custom Auth Loader
              </label>
              <select
                value={selectedLoaderConfig}
                onChange={(e) => setSelectedLoaderConfig(e.target.value)}
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
              >
                {loaderConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.name} ({cfg.brand_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1">
                In-Game Watermark Brand Text
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g. AERO PROTECT"
                className="w-full bg-[#0d0f17] border border-gray-700/80 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Auth Gate Toggle Option */}
          <div className="p-3.5 rounded-xl border border-gray-800 bg-[#0d0f17] flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Require Auth Loader & License Key</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${useAuth ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-gray-800 text-gray-400"}`}>
                  {useAuth ? "Protected" : "Direct Run"}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {useAuth
                  ? "The Auth Loader loads first in-game. Your script's modules remain strictly stored on our backend and are ONLY pulled dynamically after successful license key verification."
                  : "Direct Mode: The script runs immediately in executor without showing an Auth Loader or asking for a key."}
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={useAuth}
                onChange={(e) => setUseAuth(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSaveScript}
            disabled={isUploading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {isUploading ? "Protecting & Saving..." : "Bundle Modules & Generate Protected Loadstring"}
          </button>
        </div>
      )}

      {/* Generated Loadstring Modal / Box */}
      {createdLoadstring && (
        <div className="mt-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Script Successfully Protected & Stored in Backend!
          </div>
          <p className="text-[11px] text-gray-300 mb-2">
            Here is your official loadstring. Give this to your users. It displays your custom Auth Loader and protects your modular code until verified:
          </p>
          <div className="flex items-center gap-2 bg-[#090b10] border border-gray-800 rounded-lg p-2.5 font-mono text-xs text-blue-300 overflow-x-auto">
            <span className="flex-1 truncate">{createdLoadstring}</span>
            <button
              type="button"
              onClick={copyLoadstring}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
