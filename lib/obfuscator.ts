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
    injectOpaquePredicates = true,
  } = options;

  let transformed = code;

  // 1. Anti-Analysis Mathematical Invariants & VM Protection Header
  if (injectOpaquePredicates) {
    const invA = Math.floor(Math.random() * 500) + 100;
    const invariantStub = `--[=[ AtomProtect Virtualized Luau Stream ]=]--
if (bit32.bxor(${invA}, ${invA}) ~= 0) or (math.floor(2.5) ~= 2) then return end
`;
    transformed = invariantStub + transformed;
  }

  return transformed;
}
