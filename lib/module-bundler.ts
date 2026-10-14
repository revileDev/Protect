// lib/module-bundler.ts
// Secure Virtual File System and Module Bundler for Lua scripts

export interface ModuleBundle {
  entryFile: string;
  files: Record<string, string>; // { "init.lua": "...", "modules/combat.lua": "..." }
}

/**
 * Packs multiple Lua files into a self-contained runtime bundle with an in-memory virtual `require` environment.
 * The entry point script executes automatically with access to all virtual modules.
 */
export function bundleModularScript(bundle: ModuleBundle): string {
  const { entryFile, files } = bundle;
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

  for (const [filePath, content] of Object.entries(files)) {
    if (filePath === entryFile || filePath === cleanEntry) continue;

    // Normalize path keys (support both "modules/combat", "modules/combat.lua", and basenames)
    const cleanKey = filePath.replace(/\\/g, "/");
    const keyWithoutExt = cleanKey.replace(/\.lua$/i, "");
    const baseName = cleanKey.split("/").pop() || cleanKey;
    const baseNameWithoutExt = baseName.replace(/\.lua$/i, "");

    // Escape Lua string or wrap as function
    const escapedContent = `function()
-- [[ Module: ${cleanKey} ]]
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

  return `--[[
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
    local normalized = tostring(moduleName):gsub("\\\\", "/")
    if __VFS_CACHE[normalized] then
        return __VFS_CACHE[normalized]
    end

    local loader = __VFS_MODULES[normalized] or __VFS_MODULES[normalized .. ".lua"]
    if loader then
        local result = loader()
        __VFS_CACHE[normalized] = result
        return result
    end

    -- Fallback to standard require if not in virtual bundle
    if original_require then
        return original_require(moduleName)
    end
    error("[AeroVFS] Module not found in virtual registry: " .. tostring(moduleName))
end

-- Inject __vfs_require into environment
local env = getfenv and getfenv() or _G
env.require = __vfs_require

-- =======================================================
-- ENTRY SCRIPT EXECUTION (${entryFile})
-- =======================================================
do
${entryContent}
end
`;
}
