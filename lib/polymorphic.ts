// lib/polymorphic.ts
/**
 * Wraps raw Luau code into a dynamically randomized polymorphic byte-stream loader.
 * Every time this function is called, it generates:
 * - A unique one-time byte XOR key (1 to 254)
 * - Randomized variable identifiers
 * - Dynamic byte stream encoding
 * This ensures that every HTTP download has a completely unique byte hash,
 * defeating static signature scanners, memory pattern dumpers, and web scrapers.
 */
export function wrapPolymorphicLuau(rawCode: string): string {
  const xorKey = Math.floor(Math.random() * 253) + 1; // 1 to 254
  const randPrefix = "_" + Math.random().toString(36).substring(2, 7);

  const keyVar = `${randPrefix}_k`;
  const bufVar = `${randPrefix}_b`;
  const tableVar = `${randPrefix}_t`;
  const idxVar = `${randPrefix}_i`;
  const fnVar = `${randPrefix}_f`;
  const errVar = `${randPrefix}_e`;

  // Encode raw code with XOR key into escaped decimal byte format
  const encodedParts: string[] = [];
  for (let i = 0; i < rawCode.length; i++) {
    const originalByte = rawCode.charCodeAt(i) & 0xff;
    const xorByte = (originalByte ^ xorKey) & 0xff;
    encodedParts.push("\\" + xorByte);
  }
  const encodedString = encodedParts.join("");

  return `--[[
  =======================================================
  AERO AUTH POLYMORPHIC DYNAMIC SECURE DELIVERY
  Seed: ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}
  Tamper-Resistant Ephemeral XOR Byte Stream
  =======================================================
]]--
local ${keyVar} = ${xorKey}
local ${bufVar} = "${encodedString}"
local ${tableVar} = table.create(#${bufVar})
local _bxor = bit32 and bit32.bxor or function(a, b) return a ~ b end

for ${idxVar} = 1, #${bufVar} do
    local _byte = string.byte(${bufVar}, ${idxVar})
    ${tableVar}[${idxVar}] = string.char(_bxor(_byte, ${keyVar}))
end

local ${fnVar}, ${errVar} = loadstring(table.concat(${tableVar}))
if ${fnVar} then
    return ${fnVar}()
else
    error("[AeroAuth] Polymorphic runtime failure: " .. tostring(${errVar}))
end`;
}
