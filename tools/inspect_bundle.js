const { createClient } = require('@supabase/supabase-js');
const url = 'https://ikreiagzqwzzihnfhooy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmVpYWd6cXd6emlobmZob295Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk4OTc1NiwiZXhwIjoyMTA3NTY1NzU2fQ.qh0wpTzB_4wcVgRlVgw5t5j5peavSGJTf7ZjuYKYF0Q';
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('scripts').select('*').eq('slug', 'atomware-hub');
  if (error || !data.length) {
    console.error('Fetch error:', error);
    return;
  }
  const s = data[0];
  console.log('Script name:', s.name);
  console.log('use_auth:', s.use_auth);
  console.log('entry_file:', s.entry_file);
  console.log('Modules:');
  for (const [k, v] of Object.entries(s.modules || {})) {
    console.log(` - ${k}: ${v.length} bytes, ${v.split('\n').length} lines`);
  }
}
main();
