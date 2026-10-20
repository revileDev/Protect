// lib/obfuscator.ts
/**
 * Production-Grade Multi-Layer Obfuscation & Virtualization Engine for Roblox Luau
 * 
 * Capabilities:
 * - In-Line Multi-Layer Polymorphic String Virtualization (zero central decryptor helpers)
 * - Integer Constant Mutation & Bitwise Scrambling
 * - Lexical Local & Parameter Identifier Mangling (Homoglyphs)
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
    mangleNumbers = true,
    stripComments = true,
    injectOpaquePredicates = true,
    mangleIdentifiers = true,
  } = options;

  let transformed = code;

  // 1. Strip comments while safely preserving string contents
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

  // 2. In-Line Multi-Layer Polymorphic String Virtualization (No central decryptor helper)
  if (encryptStrings) {
    transformed = transformed.replace(/(["'])((\\{2}|\\\1|[\s\S])*?)\1/g, (match, quote, strContent) => {
      if (strContent.length <= 1) return match;

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
        // fallback
      }

      const rawBytes: Uint8Array =
        typeof Buffer !== "undefined"
          ? Buffer.from(rawText, "utf8")
          : new TextEncoder().encode(rawText);

      const bytes = Array.from(rawBytes);
      const algo = Math.floor(Math.random() * 3);
      const key = Math.floor(Math.random() * 240) + 10;
      const offset = Math.floor(Math.random() * 25) + 5;

      if (algo === 0) {
        // Type A: In-line Byte array with Additive Offset + XOR Mask
        const masked = bytes.map((b) => (b ^ key) + offset);
        return `(function() local _b={${masked.join(",")}} local _r={} for _i=1,#_b do _r[_i]=string.char(bit32.bxor(_b[_i]-${offset},${key})) end return table.concat(_r) end)()`;
      } else if (algo === 1) {
        // Type B: In-line Hex stream with nibble extraction + XOR Mask
        let hex = "";
        for (const b of bytes) {
          const enc = (b ^ key) & 255;
          hex += enc.toString(16).padStart(2, "0");
        }
        return `(function() local _h="${hex}" local _r={} local _c=1 for _i=1,#_h,2 do _r[_c]=string.char(bit32.bxor(tonumber(_h:sub(_i,_i+1),16) or 0,${key})) _c=_c+1 end return table.concat(_r) end)()`;
      } else {
        // Type C: In-line Bitwise Byte Array
        const masked = bytes.map((b) => b ^ key);
        return `(function() local _b={${masked.join(",")}} local _r={} for _i=1,#_b do _r[_i]=string.char(bit32.bxor(_b[_i],${key})) end return table.concat(_r) end)()`;
      }
    });
  }

  // 3. Integer Constant Arithmetic Scrambling
  if (mangleNumbers) {
    transformed = transformed.replace(/(?<![0-9a-zA-Z_."'`])([2-9]|[1-9]\d{1,3})(?![0-9a-zA-Z_."'`])/g, (match, numStr) => {
      const num = parseInt(numStr, 10);
      if (isNaN(num) || num > 9999 || num < 2) return match;
      const r = Math.floor(Math.random() * 15) + 1;
      const choice = Math.floor(Math.random() * 3);
      if (choice === 0) {
        return `(${num + r} - ${r})`;
      } else if (choice === 1) {
        return `(bit32.bxor(${num ^ r}, ${r}))`;
      } else {
        return `(${num * 2} / 2)`;
      }
    });
  }

  // 4. Lexical Local & Parameter Identifier Mangling (Homoglyphs)
  if (mangleIdentifiers) {
    const declaredLocals = new Map<string, string>();
    let identCounter = 0;

    // A. Match local declarations: "local var1, var2"
    const localDeclRegex = /local\s+(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
    let declMatch;
    while ((declMatch = localDeclRegex.exec(transformed)) !== null) {
      const vars = declMatch[1].split(",").map((v) => v.trim());
      for (const v of vars) {
        if (!LUAU_KEYWORDS.has(v) && !PRESERVED_GLOBALS.has(v) && !declaredLocals.has(v) && v.length >= 2) {
          declaredLocals.set(v, randomHomoglyph(identCounter++));
        }
      }
    }

    // B. Match function parameter declarations: "function(param1, param2)"
    const paramRegex = /function\s*(?:[a-zA-Z0-9_]*\s*)?\(([^)]*)\)/g;
    let pMatch;
    while ((pMatch = paramRegex.exec(transformed)) !== null) {
      const params = pMatch[1].split(",").map((p) => p.trim());
      for (const p of params) {
        if (p && !LUAU_KEYWORDS.has(p) && !PRESERVED_GLOBALS.has(p) && !declaredLocals.has(p) && p.length >= 2) {
          declaredLocals.set(p, randomHomoglyph(identCounter++));
        }
      }
    }

    // C. Substitute declared local variables, strictly ensuring not preceded by . or : (properties / methods)
    declaredLocals.forEach((mangled, orig) => {
      const tokenRegex = new RegExp(`(?<![.:0-9a-zA-Z_])\\b${orig}\\b(?![0-9a-zA-Z_])`, "g");
      transformed = transformed.replace(tokenRegex, mangled);
    });
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
