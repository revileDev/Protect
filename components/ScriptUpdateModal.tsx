// components/ScriptUpdateModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FileCode,
  UploadCloud,
  Edit3,
  Copy,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  Star,
  CheckCircle2,
  RotateCcw,
  ClipboardPaste,
} from "lucide-react";
import { ScriptRecord } from "@/lib/store";

interface Props {
  script: ScriptRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onScriptUpdated: (updatedScript: ScriptRecord) => void;
}

export default function ScriptUpdateModal({
  script,
  isOpen,
  onClose,
  onScriptUpdated,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [modulesMap, setModulesMap] = useState<Record<string, string>>({});
  const [originalMap, setOriginalMap] = useState<Record<string, string>>({});
  const [entryFile, setEntryFile] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"upload" | "editor">("upload");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedLoadstring, setCopiedLoadstring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize when script changes or modal opens
  useEffect(() => {
    if (script && isOpen) {
      const mods = { ...(script.modules || {}) };
      setModulesMap(mods);
      setOriginalMap(mods);
      setEntryFile(script.entry_file || Object.keys(mods)[0] || "init.lua");

      const fileKeys = Object.keys(mods);
      if (fileKeys.length > 0) {
        // Prefer entry file or first file
        const defaultChoice = mods[script.entry_file] !== undefined ? script.entry_file : fileKeys[0];
        setSelectedFile(defaultChoice);
      } else {
        setSelectedFile("");
      }

      setUploadedFileName(null);
      setSaveSuccess(null);
      setError(null);
      setIsAddingFile(false);
      setNewFileNameInput("");
    }
  }, [script, isOpen]);

  if (!isOpen || !script) return null;

  const currentContent = selectedFile ? modulesMap[selectedFile] || "" : "";
  const originalContent = selectedFile ? originalMap[selectedFile] || "" : "";
  const isCurrentFileModified = currentContent !== originalContent;

  const fileKeys = Object.keys(modulesMap);

  const getLoadstring = () => {
    if (typeof window === "undefined") return "";
    return `loadstring(game:HttpGet("${window.location.protocol}//${window.location.host}/api/loader/${script.slug}"))()`;
  };

  const handleCopyLoadstring = () => {
    const ls = getLoadstring();
    navigator.clipboard?.writeText(ls);
    setCopiedLoadstring(true);
    setTimeout(() => setCopiedLoadstring(false), 2000);
  };

  const handleFileContentChange = (newVal: string) => {
    if (!selectedFile) return;
    setModulesMap((prev) => ({
      ...prev,
      [selectedFile]: newVal,
    }));
    setSaveSuccess(null);
    setError(null);
  };

  // Upload replacement file
  const handleUploadedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedFile) return;

    const file = files[0];
    try {
      const text = await file.text();
      handleFileContentChange(text);
      setUploadedFileName(file.name);
      setSaveSuccess(`Loaded replacement from "${file.name}" into ${selectedFile}. Review and click "Save & Deploy Update" below.`);
    } catch {
      setError("Failed to read file from disk.");
    }

    if (e.target) e.target.value = "";
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleFileContentChange(text);
        setSaveSuccess(`Pasted ${text.length} characters from clipboard.`);
      }
    } catch {
      setError("Clipboard access denied. Please paste directly into the editor.");
    }
  };

  // Revert changes
  const handleRevert = () => {
    if (!selectedFile) return;
    handleFileContentChange(originalContent);
    setUploadedFileName(null);
    setSaveSuccess(null);
  };

  // Add a new file
  const handleAddNewFile = () => {
    const trimmed = newFileNameInput.trim();
    if (!trimmed) {
      setError("Please provide a valid file name (e.g. custom.lua)");
      return;
    }
    const finalName = trimmed.endsWith(".lua") || trimmed.endsWith(".luau") ? trimmed : `${trimmed}.lua`;

    if (modulesMap[finalName] !== undefined) {
      setError(`File "${finalName}" already exists in this script.`);
      return;
    }

    setModulesMap((prev) => ({
      ...prev,
      [finalName]: `-- [[ ${finalName} ]]\n\nlocal module = {}\n\nreturn module\n`,
    }));
    setSelectedFile(finalName);
    setIsAddingFile(false);
    setNewFileNameInput("");
    setError(null);
  };

  // Delete a file
  const handleDeleteFile = (fileName: string) => {
    if (fileKeys.length <= 1) {
      setError("Cannot delete the only file in the script.");
      return;
    }
    if (!confirm(`Are you sure you want to remove "${fileName}" from this script?`)) return;

    const updated = { ...modulesMap };
    delete updated[fileName];
    setModulesMap(updated);

    // If deleting the currently selected file, switch to another
    if (selectedFile === fileName) {
      const remaining = Object.keys(updated);
      setSelectedFile(remaining[0] || "");
    }

    // If deleting entry file, fallback
    if (entryFile === fileName) {
      setEntryFile(Object.keys(updated)[0] || "init.lua");
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedFile && fileKeys.length === 0) {
      setError("Script must contain at least one file.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/scripts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: script.id,
          slug: script.slug,
          entry_file: entryFile,
          modules: modulesMap,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update script");

      setOriginalMap({ ...modulesMap });
      setUploadedFileName(null);
      setSaveSuccess(`Script updated successfully! Loadstring remains unchanged and active.`);
      onScriptUpdated(data.script);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving updates";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const lineCount = currentContent.split("\n").length;
  const byteSize = new Blob([currentContent]).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f1118] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800/80 bg-[#141722]/60 flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="truncate">Update Script: {script.name}</span>
              </h2>
              <span className="text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-md">
                /{script.slug}
              </span>
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Lock className="w-3 h-3" /> Loadstring Locked
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Update files or replace code without resetting the loadstring. Changes apply immediately to all executors.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loadstring info bar */}
        <div className="px-4 py-2.5 bg-[#090b10] border-b border-gray-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-gray-400 shrink-0 font-medium">Loadstring:</span>
            <code className="text-[11px] font-mono text-blue-300 bg-gray-900/90 border border-gray-800 px-2 py-1 rounded truncate select-all">
              {getLoadstring()}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyLoadstring}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-medium shrink-0 transition-colors"
          >
            {copiedLoadstring ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
            {copiedLoadstring ? "Copied" : "Copy Loadstring"}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Choose which file you are updating */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-[10px] text-white flex items-center justify-center font-bold">
                  1
                </span>
                Choose Which File to Update:
              </label>

              <button
                type="button"
                onClick={() => setIsAddingFile(!isAddingFile)}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New File
              </button>
            </div>

            {/* Add New File Sub-form */}
            {isAddingFile && (
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. modules/teleport.lua"
                  value={newFileNameInput}
                  onChange={(e) => setNewFileNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNewFile()}
                  className="flex-1 bg-[#0b0d14] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddNewFile}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingFile(false)}
                  className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* File Selector Dropdown & File Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={selectedFile}
                  onChange={(e) => {
                    setSelectedFile(e.target.value);
                    setUploadedFileName(null);
                    setSaveSuccess(null);
                    setError(null);
                  }}
                  className="w-full bg-[#141722] border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {fileKeys.map((f) => (
                    <option key={f} value={f}>
                      {f} {f === entryFile ? "(Entry Point)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Set as Entry / Delete Buttons */}
              <div className="flex items-center gap-2">
                {selectedFile !== entryFile ? (
                  <button
                    type="button"
                    onClick={() => setEntryFile(selectedFile)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700 transition-colors"
                    title="Set this file as the script entry point"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    Set as Entry
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    Main Entry File
                  </span>
                )}

                {fileKeys.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(selectedFile)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                    title="Delete this file from script"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* File List Fast-Switcher Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {fileKeys.map((f) => {
                const isSelected = f === selectedFile;
                const isEntry = f === entryFile;
                const isModified = (modulesMap[f] || "") !== (originalMap[f] || "");

                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setSelectedFile(f);
                      setUploadedFileName(null);
                      setSaveSuccess(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "bg-[#141722] hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-800"
                    }`}
                  >
                    <span>{f.split("/").pop()}</span>
                    {isEntry && <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1 py-0.2 rounded font-sans">entry</span>}
                    {isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Choose what to update it with */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-[10px] text-white flex items-center justify-center font-bold">
                  2
                </span>
                Choose What to Update It With:
              </label>

              {/* Mode Tabs */}
              <div className="flex items-center gap-1 bg-[#141722] p-1 rounded-lg border border-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeTab === "upload"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload Replacement File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("editor")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeTab === "editor"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit / Paste Code
                </button>
              </div>
            </div>

            {/* TAB 1: Upload Replacement File */}
            {activeTab === "upload" && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700/80 hover:border-blue-500/80 bg-[#141722]/60 hover:bg-blue-500/5 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".lua,.luau,.txt"
                    onChange={handleUploadedFile}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-transform group-hover:scale-105">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      Click to choose replacement file for <span className="text-blue-400 font-mono">{selectedFile}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Accepts <code className="text-gray-400">.lua</code>, <code className="text-gray-400">.luau</code>, or <code className="text-gray-400">.txt</code> from your computer.
                    </p>
                  </div>
                </div>

                {uploadedFileName && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate">
                        Loaded replacement from: <strong>{uploadedFileName}</strong> ({lineCount} lines, {(byteSize / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("editor")}
                      className="text-xs font-semibold text-blue-400 hover:underline shrink-0 ml-2"
                    >
                      View in Editor →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Edit / Paste Code Directly */}
            <div className={activeTab === "editor" ? "space-y-2" : "hidden"}>
              {/* Toolbar */}
              <div className="flex items-center justify-between text-xs text-gray-400 pb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-300">{selectedFile}</span>
                  <span>•</span>
                  <span>{lineCount} lines</span>
                  <span>•</span>
                  <span>{(byteSize / 1024).toFixed(1)} KB</span>
                  {isCurrentFileModified && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                      Unsaved Changes
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-medium transition-colors"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    Paste Clipboard
                  </button>
                  {isCurrentFileModified && (
                    <button
                      type="button"
                      onClick={handleRevert}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-medium transition-colors"
                      title="Revert to original file content"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert
                    </button>
                  )}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative border border-gray-800 rounded-xl overflow-hidden bg-[#0a0c12]">
                <textarea
                  value={currentContent}
                  onChange={(e) => handleFileContentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      e.preventDefault();
                      const start = e.currentTarget.selectionStart;
                      const end = e.currentTarget.selectionEnd;
                      const value = e.currentTarget.value;
                      const updated = value.substring(0, start) + "    " + value.substring(end);
                      handleFileContentChange(updated);
                      setTimeout(() => {
                        if (e.currentTarget) {
                          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 4;
                        }
                      }, 0);
                    }
                  }}
                  placeholder="Paste or write your Lua code here..."
                  rows={14}
                  className="w-full bg-transparent p-4 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none resize-y leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-800 bg-[#141722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Loadstring URL is locked and will <strong>not</strong> change: <code className="text-gray-300 font-mono">/api/loader/{script.slug}</code>
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving Updates...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save & Deploy Update
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
