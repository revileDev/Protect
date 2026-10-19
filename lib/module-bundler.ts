// lib/module-bundler.ts
// Secure Virtual File System and Dynamic Modular Streaming Engine for Luau scripts
import { obfuscateLuau } from "@/lib/obfuscator";

export interface ModuleBundle {
  entryFile: string;
  files: Record<string, string>;
  dynamicStreaming?: boolean;
  slug?: string;
  sessionToken?: string;
  baseUrl?: string;
  key?: string;
  obfuscate?: boolean;
}

/**
 * Packs multiple Lua files into a self-contained runtime bundle with an in-memory virtual `require` environment.
 * Supports Zero-Knowledge Dynamic Streaming (fetching modules just-in-time over authenticated sessions).
 */
export function bundleModularScript(bundle: ModuleBundle): string {
  const {
    entryFile,
    files,
    dynamicStreaming = false,
    slug = "",
    sessionToken = "",
    baseUrl = "",
    key = "",
    obfuscate = true,
  } = bundle;

  // Normalize entry file lookup
  const cleanEntry = entryFile.replace(/\\/g, "/");
  const entryBase = cleanEntry.split("/").pop() || cleanEntry;
  const entryContent =
    files[entryFile] ||
    files[cleanEntry] ||
    files[entryBase] ||
    files["init.lua"] ||
    files["main.lua"] ||
    Object.values(files)[0] ||
    "";

  // Prepare modules table
  const moduleEntries: string[] = [];
  const registeredKeys = new Set<string>();

  // Always embed all non-entry modules directly into the in-memory virtual file system
  for (const [filePath, content] of Object.entries(files)) {
    if (filePath === entryFile || filePath === cleanEntry) continue;

    const cleanKey = filePath.replace(/\\/g, "/");
    const keyWithoutExt = cleanKey.replace(/\.lua$/i, "");
    const baseName = cleanKey.split("/").pop() || cleanKey;
    const baseNameWithoutExt = baseName.replace(/\.lua$/i, "");

    const escapedContent = `function()
${content}
end`;

    const registerKey = (k: string) => {
      if (!registeredKeys.has(k)) {
        registeredKeys.add(k);
        moduleEntries.push(`    ["${k}"] = ${escapedContent}`);
      }
    };

    registerKey(cleanKey);
    if (keyWithoutExt !== cleanKey) registerKey(keyWithoutExt);
    if (baseName !== cleanKey) registerKey(baseName);
    if (baseNameWithoutExt !== keyWithoutExt && baseNameWithoutExt !== baseName) registerKey(baseNameWithoutExt);
  }

  const modulesTable = moduleEntries.join(",\n");

  const streamingRequireLogic = dynamicStreaming && slug && sessionToken
    ? `
    -- Dynamic Just-In-Time Module Streamer
    local _streamBase = "${baseUrl}/api/loader/${slug}/"
    local _sessionToken = "${sessionToken}"
    local _licenseKey = "${encodeURIComponent(key)}"
    local _http = (syn and syn.request) or (http and http.request) or http_request or (fluxus and fluxus.request) or request
    
    if _http then
        local _cleanMod = normalized:gsub("%.lua$", "")
        local _targetUrl = _streamBase .. _cleanMod .. ".lua?session=" .. _sessionToken .. "&key=" .. _licenseKey
        local _res = _http({
            Url = _targetUrl,
            Method = "GET",
            Headers = { ["User-Agent"] = "Roblox/WinInet" }
        })
        if _res and _res.StatusCode == 200 and _res.Body and not _res.Body:find("Error:") then
            local _fn, _err = loadstring(_res.Body)
            if _fn then
                local _dynResult = _fn()
                if _dynResult == nil then _dynResult = true end
                __VFS_CACHE[normalized] = _dynResult
                return _dynResult
            end
        end
    end`
    : "";

  const assembledBundle = `--[[
  =======================================================
  AERO SECURE VIRTUAL MODULE RUNTIME
  Protected In-Memory Virtual File System
  =======================================================
]]--
local __VFS_MODULES = {
${modulesTable}
}

local __VFS_CACHE = {}

-- Virtual require hook
local original_require = require
local function __vfs_require(moduleName)
    local normalized = tostring(moduleName):gsub(string.char(92), "/")
    if __VFS_CACHE[normalized] then
        return __VFS_CACHE[normalized]
    end

    local loader = __VFS_MODULES[normalized] or __VFS_MODULES[normalized .. ".lua"]
    if loader then
        local result = loader()
        if result == nil then result = true end
        __VFS_CACHE[normalized] = result
        return result
    end
${streamingRequireLogic}
    -- Fallback to standard require for non-string (e.g. Instance/asset ID)
    if original_require and type(moduleName) ~= "string" then
        return original_require(moduleName)
    end
    error("[AeroVFS] Module not found in virtual registry: " .. tostring(moduleName))
end

-- Inject __vfs_require into environment
local env = getfenv and getfenv() or _G
env.require = __vfs_require
local require = __vfs_require

-- =======================================================
-- ENTRY SCRIPT EXECUTION (${entryFile})
-- =======================================================
do
${entryContent}
end
`;

  if (obfuscate) {
    try {
      return obfuscateLuau(assembledBundle);
    } catch {
      return assembledBundle;
    }
  }

  return assembledBundle;
}
