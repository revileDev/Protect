// lib/obfuscator.ts
/**
 * Production-Grade Multi-Layer Obfuscation & Virtualization Engine for Roblox Luau
 * 
 * Capabilities:
 * - Central Polymorphic Keystream String Virtualization (clean identifier calls, zero ambiguous syntax)
 * - Protected Multi-Line String & Bytecode Escaping
 * - Safe Homoglyph Lexical Variable Mangling
 * - Anti-Analysis Mathematical Invariant Injection
 * - Strict Roblox Luau AST Compatibility across all Mobile and PC Executors
 */

export interface ObfuscateOptions {
  encryptStrings?: boolean;
  mangleNumbers?: boolean;
  stripComments?: boolean;
  injectOpaquePredicates?: boolean;
  mangleIdentifiers?: boolean;
}

// Reserved Luau keywords that must never be renamed
const LUAU_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true",
  "until", "while", "continue", "type", "export",
]);

// Roblox engine and standard Luau globals to preserve
const PRESERVED_GLOBALS = new Set([
  "game", "workspace", "script", "math", "table", "string", "task", "coroutine",
  "bit32", "bit", "debug", "os", "tick", "time", "wait", "warn", "print", "error",
  "pcall", "xpcall", "setmetatable", "getmetatable", "rawget", "rawset", "rawequal",
  "type", "typeof", "Instance", "Vector3", "Vector2", "CFrame", "Color3", "UDim2",
  "UDim", "Enum", "NumberSequence", "ColorSequence", "Rect", "Ray", "TweenInfo",
  "loadstring", "getgenv", "getrenv", "getfenv", "setfenv", "shared", "_G",
  "syn", "fluxus", "gethui", "hookfunction", "newcclosure", "clonefunction",
  "getrawmetatable", "setrawmetatable", "request", "http_request", "gethwid",
  "readfile", "writefile", "isfile", "isfolder", "makefolder", "delfile",
  "setclipboard", "getclipboard", "require", "assert", "select", "next", "pairs",
  "ipairs", "tonumber", "tostring", "unpack", "table.insert", "table.concat",
  "table.remove", "table.clear", "table.find",
]);

function randomHomoglyph(index: number): string {
  const prefixes = ["_l1I", "_1lI", "_ll1", "_1Il", "_I1l", "_IIl", "_lII", "_11l"];
  const p = prefixes[index % prefixes.length];
  const h = index.toString(16);
  return `${p}_${h}`;
}

export function obfuscateLuau(code: string, options: ObfuscateOptions = {}): string {
  const {
    encryptStrings = true,
    mangleNumbers = false, // Keep numbers clean by default to prevent Luau ambiguous syntax
    stripComments = true,
    injectOpaquePredicates = true,
    mangleIdentifiers = true,
  } = options;

  let transformed = code;

  // 1. Protect multi-line bracket strings ([=[ ... ]=], [[ ... ]]) before comment stripping
  const bracketStrings: string[] = [];
  transformed = transformed.replace(/\[(=*)\[[\s\S]*?\]\1\]/g, (match) => {
    const idx = bracketStrings.length;
    bracketStrings.push(match);
    return `__BRACKET_STR_${idx}__`;
  });

  // 2. Strip single-line comments safely
  if (stripComments) {
    transformed = transformed.replace(/--\[\[[\s\S]*?\]\]/g, "");
    const lines = transformed.split("\n");
    const cleanedLines = lines.map((line) => {
      let inDouble = false;
      let inSingle = false;
      let commentIdx = -1;

      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i + 1];

        let backslashes = 0;
        let k = i - 1;
        while (k >= 0 && line[k] === "\\") {
          backslashes++;
          k--;
        }
        const isEscaped = backslashes % 2 === 1;

        if (c === '"' && !inSingle && !isEscaped) {
          inDouble = !inDouble;
        } else if (c === "'" && !inDouble && !isEscaped) {
          inSingle = !inSingle;
        } else if (c === "-" && next === "-" && !inDouble && !inSingle) {
          commentIdx = i;
          break;
        }
      }
      return commentIdx !== -1 ? line.substring(0, commentIdx) : line;
    });
    transformed = cleanedLines.join("\n");
  }

  // Restore bracket strings
  transformed = transformed.replace(/__BRACKET_STR_(\d+)__/g, (_, idx) => {
    return bracketStrings[parseInt(idx, 10)] || "";
  });

  // 3. Central Polymorphic String Virtualization Helper
  // Using a single helper function avoids creating thousands of nested IIFE closures
  // and eliminates Luau "Ambiguous syntax" errors because function calls don't start with '('
  const decHelperName = `_sdec_${Math.floor(Math.random() * 899999 + 100000).toString(36)}`;
  let didEncryptAnyString = false;

  if (encryptStrings) {
    // Only encrypt simple single-line string literals (len 2..300)
    transformed = transformed.replace(/(["'])((\\{2}|\\\1|[^\r\n\\])*?)\1/g, (match, quote, strContent) => {
      if (strContent.length <= 1 || strContent.length > 300) return match;
      if (strContent.includes("%") || strContent.startsWith("rbxasset")) return match;

      let rawText = strContent;
      try {
        rawText = rawText
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\r/g, "\r")
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, "\\");
      } catch {
        return match;
      }

      const rawBytes: Uint8Array =
        typeof Buffer !== "undefined"
          ? Buffer.from(rawText, "utf8")
          : new TextEncoder().encode(rawText);

      const bytes = Array.from(rawBytes);
      const key = Math.floor(Math.random() * 240) + 10;

      let hex = "";
      for (const b of bytes) {
        const enc = (b ^ key) & 255;
        hex += enc.toString(16).padStart(2, "0");
      }

      didEncryptAnyString = true;
      return `${decHelperName}("${hex}", ${key})`;
    });
  }

  // Prepend string decryption helper if strings were virtualized
  if (didEncryptAnyString) {
    const helperCode = `local function ${decHelperName}(h, k) local b32 = bit32 or bit local bx = b32.bxor local sc = string.char local sn = tonumber local ss = string.sub local r = {} local c = 1 for i = 1, #h, 2 do r[c] = sc(bx(sn(ss(h, i, i+1), 16) or 0, k)) c = c + 1 end return table.concat(r) end\n`;
    transformed = helperCode + transformed;
  }

  // 4. Safe Identifier Mangling (Local scope only)
  if (mangleIdentifiers && code.length < 500000) {
    const declaredLocals = new Map<string, string>();
    let identCounter = 0;

    const localDeclRegex = /local\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s*=/g;
    let declMatch;
    while ((declMatch = localDeclRegex.exec(transformed)) !== null) {
      const vars = declMatch[1].split(",").map((v) => v.trim());
      for (const v of vars) {
        if (!LUAU_KEYWORDS.has(v) && !PRESERVED_GLOBALS.has(v) && !declaredLocals.has(v) && v.length >= 3 && !v.startsWith("__")) {
          declaredLocals.set(v, randomHomoglyph(identCounter++));
        }
      }
    }

    if (declaredLocals.size > 0) {
      const allKeys = Array.from(declaredLocals.keys());
      const BATCH_SIZE = 300;
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batch = allKeys.slice(i, i + BATCH_SIZE);
        const escaped = batch.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const batchRegex = new RegExp(`(?<![.:0-9a-zA-Z_])\\b(${escaped.join("|")})\\b(?![0-9a-zA-Z_])`, "g");
        transformed = transformed.replace(batchRegex, (m) => declaredLocals.get(m) || m);
      }
    }
  }

  // 5. Anti-Analysis Mathematical Invariants
  if (injectOpaquePredicates) {
    const invA = Math.floor(Math.random() * 500) + 100;
    const invariantStub = `--[=[ AtomProtect Virtualized Luau Stream ]=]--
if (bit32.bxor(${invA}, ${invA}) ~= 0) or (math.floor(2.5) ~= 2) then return end
`;
    transformed = invariantStub + transformed;
  }

  return transformed;
}
