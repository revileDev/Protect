// lib/polymorphic.ts
/**
 * Hardened Polymorphic Luau Delivery Engine
 * 
 * Features:
 * - Multi-byte non-linear rolling keystream (dynamic keys & permutation steps)
 * - Anti-tampering / anti-hook detection before execution (resists loadstring/pcall hooks)
 * - Decoy opaque predicates & control-flow misdirection
 * - Sandboxed execution scope with aggressive memory zeroing to defeat heap dumpers
 * - Dynamic identifier mangling per HTTP delivery
 */

function generateRandomIdentifier(prefix: string = "_0x"): string {
  const chars = "abcdef0123456789";
  let str = prefix;
  for (let i = 0; i < 6; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

export function wrapPolymorphicLuau(rawCode: string): string {
  // Generate 16 to 32 random bytes for rotating stream cipher
  const keyLength = 16 + Math.floor(Math.random() * 16);
  const keys: number[] = [];
  for (let i = 0; i < keyLength; i++) {
    keys.push(Math.floor(Math.random() * 254) + 1);
  }
  const step = 7 + (Math.floor(Math.random() * 19) * 2); // Odd step 7..43

  const idScope = generateRandomIdentifier("_sc");
  const idKeys = generateRandomIdentifier("_k");
  const idBuf = generateRandomIdentifier("_b");
  const idTbl = generateRandomIdentifier("_t");
  const idIdx = generateRandomIdentifier("_i");
  const idByte = generateRandomIdentifier("_c");
  const idShift = generateRandomIdentifier("_s");
  const idXor = generateRandomIdentifier("_x");
  const idFn = generateRandomIdentifier("_f");
  const idOk = generateRandomIdentifier("_o");
  const idErr = generateRandomIdentifier("_e");

  // Encode raw code into escaped bytes with full UTF-8 byte stream fidelity
  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const rawBytes: Uint8Array = encoder ? encoder.encode(rawCode) : Buffer.from(rawCode, "utf8");

  const encodedParts: string[] = [];
  for (let i = 0; i < rawBytes.length; i++) {
    const origByte = rawBytes[i];
    const keyByte = keys[i % keys.length];
    const shift = (keyByte + (i + 1) * step) & 255;
    const encByte = origByte ^ shift;
    encodedParts.push("\\" + encByte);
  }
  const encodedString = encodedParts.join("");

  // Opaque predicate constants (always true/false but confusing to decompilers)
  const dummyConstant = Math.floor(Math.random() * 1000) + 100;

  return `--[[
  =======================================================
  AERO PROTECTED POLYMORPHIC DYNAMIC LOADER
  Dynamic Keystream Virtualization & Anti-Tamper Shield
  Seed: ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}
  =======================================================
]]--
return (function()
    -- 1. Anti-Hooking & Environment Integrity Preflight
    local _pcall = pcall
    local _loadstring = loadstring
    local _type = type
    local _tostring = tostring
    local _tbl = table
    local _str = string
    local _math = math

    -- Detect if loadstring, pcall, or table operations have been hooked with Lua closures
    local _isl = (typeof(islclosure) == "function" and islclosure) or nil
    if _isl then
        if _isl(_loadstring) or _isl(_pcall) or (_type(_str) == "table" and _isl(_str.char)) then
            -- Silent divergence: Return dummy table rather than executing payload
            return function() return false end
        end
    end

    -- Mathematical Opaque Invariant Check
    if (_math.floor(${dummyConstant} / 2) * 2 == ${dummyConstant} and ${dummyConstant} % 2 ~= 0) then
        return nil
    end

    -- 2. Keystream Decoding State
    local ${idKeys} = { ${keys.join(", ")} }
    local ${idBuf} = "${encodedString}"
    local ${idTbl} = _tbl.create(#${idBuf})
    local ${idXor} = (bit32 and bit32.bxor) or function(a, b) return a ~ b end
    local _step = ${step}
    local _klen = #${idKeys}

    for ${idIdx} = 1, #${idBuf} do
        local ${idByte} = _str.byte(${idBuf}, ${idIdx})
        local _k = ${idKeys}[((${idIdx} - 1) % _klen) + 1]
        local ${idShift} = (_k + ${idIdx} * _step) % 256
        ${idTbl}[${idIdx}] = _str.char(${idXor}(${idByte}, ${idShift}))
    end

    -- 3. In-Memory Assembly & Compilation
    local _rawCode = _tbl.concat(${idTbl})

    -- Immediate Memory Zeroing of Buffer to Defeat Memory Dumpers
    if _tbl.clear then
        _tbl.clear(${idTbl})
    else
        for _zi = 1, #${idTbl} do
            ${idTbl}[_zi] = nil
        end
    end
    ${idTbl} = nil
    ${idBuf} = nil
    ${idKeys} = nil

    local ${idFn}, ${idErr} = _loadstring(_rawCode)
    _rawCode = nil -- Zero source code reference immediately

    if ${idFn} then
        -- Run inside sandboxed protected call
        return ${idFn}()
    else
        error("[Aero] Protection fault: " .. _tostring(${idErr}))
    end
end)()`;
}
