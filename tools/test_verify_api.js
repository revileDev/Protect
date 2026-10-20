const https = require('https');
const crypto = require('crypto');

// RC4 decryption (matching client)
function decryptRC4(hex, key) {
  const bytes = Buffer.from(hex, 'hex');
  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  // Drop first 1024 bytes
  let i = 0;
  j = 0;
  for (let d = 0; d < 1024; d++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = [];
  for (let x = 0; x < bytes.length; x++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    out.push(bytes[x] ^ s[(s[i] + s[j]) % 256]);
  }
  return Buffer.from(out).toString('utf8');
}

const reqBody = JSON.stringify({
  slug: "atomware-hub",
  key: "ATOM-XR74-M9MQ-YCQA",
  hwid: "test_hwid_123456",
  roblox_username: "pryes123",
  roblox_user_id: 1234567,
  place_id: "0",
  timestamp: Math.floor(Date.now() / 1000),
  client_nonce: "nc_" + Date.now() + "_" + Math.floor(Math.random() * 1000000),
  tamper_flags: []
});

const req = https.request('https://atomprotect.vercel.app/api/auth/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Roblox/WinInet'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    const json = JSON.parse(data);
    if (!json.success) {
      console.error('Verify failed:', json);
      return;
    }
    console.log('Success! session_token:', json.session_token);
    console.log('nonce:', json.nonce);
    
    // Decrypt
    const secretKey = json.session_token + "_ATOM-XR74-M9MQ-YCQA_" + json.nonce;
    const decrypted = decryptRC4(json.encrypted_payload, secretKey);
    console.log('Decrypted length:', decrypted.length);
    require('fs').writeFileSync('server_decrypted.lua', decrypted, 'utf8');

    // Let's inspect line 1562
    const lines = decrypted.split('\n');
    console.log('Total decrypted lines:', lines.length);
    for (let i = 1555; i <= 1570; i++) {
      console.log(i + ': ' + lines[i - 1]);
    }
  });
});

req.write(reqBody);
req.end();
