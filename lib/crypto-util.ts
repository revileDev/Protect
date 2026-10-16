// lib/crypto-util.ts
// Pure JS SHA-256 and HMAC-SHA256 for universal Edge & Node runtime support without Node module warnings

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(ascii: string): Uint8Array {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  for (let i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    const wordIndex = i >> 2;
    words[wordIndex] = (words[wordIndex] || 0) | ((code & 0xff) << ((3 - (i % 4)) * 8));
  }

  const endWordIndex = asciiBitLength >> 5;
  words[endWordIndex] = (words[endWordIndex] || 0) | (0x80 << ((3 - ((ascii.length) % 4)) * 8));
  words[(((asciiBitLength + 64) >>> 9) << 4) + 15] = asciiBitLength;

  // Initial hash values (first 32 bits of fractional parts of square roots of first 8 primes 2..19)
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  // Round constants (first 32 bits of fractional parts of cube roots of first 64 primes 2..311)
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const w = new Array(64);

  for (let i = 0; i < words.length; i += 16) {
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] || 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }

      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const hashWords = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; i++) {
    result[i * 4] = (hashWords[i] >>> 24) & 0xff;
    result[i * 4 + 1] = (hashWords[i] >>> 16) & 0xff;
    result[i * 4 + 2] = (hashWords[i] >>> 8) & 0xff;
    result[i * 4 + 3] = hashWords[i] & 0xff;
  }
  return result;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

/**
 * Universal synchronous HMAC-SHA256 that runs identically in Node, Edge, and browser.
 */
export function hmacSha256(key: string, message: string): string {
  const blockSize = 64;
  let keyBytes: Uint8Array;

  if (key.length > blockSize) {
    keyBytes = sha256Bytes(key);
  } else {
    keyBytes = new Uint8Array(blockSize);
    for (let i = 0; i < key.length; i++) {
      keyBytes[i] = key.charCodeAt(i);
    }
  }

  const oPad = new Uint8Array(blockSize);
  const iPad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    const k = i < keyBytes.length ? keyBytes[i] : 0;
    oPad[i] = k ^ 0x5c;
    iPad[i] = k ^ 0x36;
  }

  const inner = sha256Bytes(bytesToBinaryString(iPad) + message);
  const outer = sha256Bytes(bytesToBinaryString(oPad) + bytesToBinaryString(inner));

  return bytesToHex(outer);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
