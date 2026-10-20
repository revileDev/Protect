const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = 'https://ikreiagzqwzzihnfhooy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmVpYWd6cXd6emlobmZob295Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk4OTc1NiwiZXhwIjoyMTA3NTY1NzU2fQ.qh0wpTzB_4wcVgRlVgw5t5j5peavSGJTf7ZjuYKYF0Q';
const supabase = createClient(url, key);

async function main() {
  const { data } = await supabase.from('scripts').select('*').eq('slug', 'atomware-hub');
  const s = data[0];
  console.log('Script fetched. Generating raw bundle...');

  // Let's import bundleModularScript using tsx or sucrase
  const { transform } = require('sucrase');
  const bundlerTs = fs.readFileSync('lib/module-bundler.ts', 'utf8');
  const bundlerJs = transform(bundlerTs, { transforms: ['typescript', 'imports'] }).code;
  
  const obfTs = fs.readFileSync('lib/obfuscator.ts', 'utf8');
  const obfJs = transform(obfTs, { transforms: ['typescript', 'imports'] }).code;

  // Evaluate modules
  const moduleExports = {};
  const obfModule = { exports: {} };
  new Function('exports', 'module', obfJs)(obfModule.exports, obfModule);

  const bundlerModule = { exports: {} };
  new Function('exports', 'module', 'require', bundlerJs)(bundlerModule.exports, bundlerModule, (id) => {
    if (id === '@/lib/obfuscator') return obfModule.exports;
    return require(id);
  });

  const payload = bundlerModule.exports.bundleModularScript({
    entryFile: s.entry_file || "init.lua",
    files: s.modules || {},
    dynamicStreaming: true,
    slug: s.slug,
    sessionToken: "session_test",
    baseUrl: "https://atomprotect.vercel.app",
    key: "THEBESTFIXED",
    obfuscate: true,
  });

  fs.writeFileSync('reproduced_payload.lua', payload, 'utf8');
  console.log('Reproduced payload written (length: ' + payload.length + ' bytes)');
  const lines = payload.split('\n');
  console.log('Total lines:', lines.length);
  for (let i = 1555; i <= 1570; i++) {
    console.log(i + ': ' + lines[i - 1]);
  }
}
main().catch(console.error);
