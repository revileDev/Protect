const { createClient } = require('@supabase/supabase-js');
const fengari = require('fengari');
const lua = fengari.lua;
const lauxlib = fengari.lauxlib;
const lualib = fengari.lualib;

const url = 'https://ikreiagzqwzzihnfhooy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmVpYWd6cXd6emlobmZob295Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk4OTc1NiwiZXhwIjoyMTA3NTY1NzU2fQ.qh0wpTzB_4wcVgRlVgw5t5j5peavSGJTf7ZjuYKYF0Q';
const supabase = createClient(url, key);

const { bundleModularScript } = require('../lib/module-bundler');

async function main() {
  const { data } = await supabase.from('scripts').select('*').eq('slug', 'atomware-hub');
  const s = data[0];
  const bundle = bundleModularScript({
    entryFile: s.entry_file || "init.lua",
    files: s.modules || {},
    obfuscate: false
  });

  const lines = bundle.split('\n');
  console.log('Bundle lines count:', lines.length);

  // Check line 1562
  console.log('--- Lines 1555 - 1570 of bundle ---');
  for (let i = 1555; i <= 1570; i++) {
    console.log(i + ': ' + lines[i - 1]);
  }
}
main().catch(console.error);
