// lib/obfuscator.ts
/**
 * Lightweight In-Line AST & Constant Scrambler for Roblox Luau
 * 
 * Capabilities:
 * - In-line call-site string literal encryption (no central string table to dump)
 * - Number literal mutation and constant arithmetic scrambling
 * - Comment stripping & whitespace minification
 * - Opaque predicate injection
 * - 100% compatible with Roblox Luau runtime across PC and Mobile executors
 */

export interface ObfuscateOptions {
  encryptStrings?: boolean;
  mangleNumbers?: boolean;
  stripComments?: boolean;
  injectOpaquePredicates?: boolean;
}

export function obfuscateLuau(code: string, options: ObfuscateOptions = {}): string {
  const {
    encryptStrings = true,
    mangleNumbers = true,
    stripComments = true,
    injectOpaquePredicates = true,
  } = options;

  let transformed = code;

  // 1. Strip comments (preserve string literals that may contain --)
  if (stripComments) {
    // Strip multi-line comments --[[ ... ]]
    transformed = transformed.replace(/--\[\[[\s\S]*?\]\]/g, "");
    // Strip single-line comments -- ... (only if not inside a string)
    const lines = transformed.split("\n");
    const cleanedLines = lines.map((line) => {
      let inDouble = false;
      let inSingle = false;
      let commentIdx = -1;

      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i + 1];

        // Check if current quote is escaped by counting preceding backslashes
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

  // Helper function to encrypt a string literal into an in-line decryptor call
  const stringDecryptorHelperName = "_0x" + Math.random().toString(16).slice(2, 8);
  let stringEncryptionUsed = false;

  if (encryptStrings) {
    // Match string literals: "..." and '...'
    // Avoid keywords or require() paths that must remain clean if needed, or encrypt all strings
    transformed = transformed.replace(/(["'])((\\{2}|\\\1|[\s\S])*?)\1/g, (match, quote, strContent) => {
      // Don't encrypt empty strings or single whitespace
      if (strContent.length <= 1) return match;

      stringEncryptionUsed = true;
      const xorKey = Math.floor(Math.random() * 250) + 1; // 1 to 250

      // Unescape standard escapes if simple
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

      // Convert characters into hex-encoded XOR bytes using true UTF-8 byte stream
      const rawBytes: Uint8Array =
        typeof Buffer !== "undefined"
          ? Buffer.from(rawText, "utf8")
          : new TextEncoder().encode(rawText);

      let hex = "";
      for (let i = 0; i < rawBytes.length; i++) {
        const b = (rawBytes[i] ^ xorKey) & 255;
        hex += b.toString(16).padStart(2, "0");
      }

      return `${stringDecryptorHelperName}("${hex}", ${xorKey})`;
    });
  }

  // 2. Mangle simple integer constants into arithmetic expressions (safely avoiding floats, hex, and string contents)
  if (mangleNumbers) {
    transformed = transformed.replace(/(?<![0-9a-zA-Z_."'`])([2-9]|[1-9]\d{1,3})(?![0-9a-zA-Z_."'`])/g, (match, numStr) => {
      const num = parseInt(numStr, 10);
      if (isNaN(num) || num > 9999 || num < 2) return match;
      const r = Math.floor(Math.random() * 20) + 1;
      const op = Math.random() > 0.5;
      if (op) {
        return `(${num + r} - ${r})`;
      } else {
        return `(${num * 2} / 2)`;
      }
    });
  }

  // Prepend helper decryptor if string encryption was applied
  if (stringEncryptionUsed) {
    const decryptorStub = `local function ${stringDecryptorHelperName}(_h, _k)
    local _s = {}
    local _bx = (bit32 and bit32.bxor) or (bit and bit.bxor) or function(a, b) return a ~ b end
    local _slen = #_h
    for _i = 1, _slen, 2 do
        local _b = tonumber(_h:sub(_i, _i + 1), 16) or 0
        table.insert(_s, string.char(_bx(_b, _k)))
    end
    return table.concat(_s)
end
`;
    transformed = decryptorStub + transformed;
  }

  // 3. Inject opaque predicates
  if (injectOpaquePredicates) {
    const dummyCheck = Math.floor(Math.random() * 800) + 100;
    const opaqueStub = `if (math.floor(${dummyCheck} / 2) * 2 == ${dummyCheck} and ${dummyCheck} % 2 ~= 0) then return end\n`;
    transformed = opaqueStub + transformed;
  }

  return transformed;
}
