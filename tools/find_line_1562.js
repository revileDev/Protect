const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = 'https://ikreiagzqwzzihnfhooy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmVpYWd6cXd6emlobmZob295Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk4OTc1NiwiZXhwIjoyMTA3NTY1NzU2fQ.qh0wpTzB_4wcVgRlVgw5t5j5peavSGJTf7ZjuYKYF0Q';
const supabase = createClient(url, key);

async function main() {
  const { data } = await supabase.from('scripts').select('*').eq('slug', 'atomware-hub');
  const s = data[0];
  const files = s.modules || {};
  const entryFile = s.entry_file || "init.lua";

  const cleanEntry = entryFile.replace(/\\/g, "/");
  const entryBase = cleanEntry.split("/").pop() || cleanEntry;
  const entryContent =
    files[entryFile] ||
    files[cleanEntry] ||
    files[entryBase] ||
    "";

  const moduleEntries = [];
  const registeredKeys = new Set();

  for (const [filePath, content] of Object.entries(files)) {
    if (filePath === entryFile || filePath === cleanEntry) continue;

    const cleanKey = filePath.replace(/\\/g, "/");
    const keyWithoutExt = cleanKey.replace(/\.lua$/i, "");
    const baseName = cleanKey.split("/").pop() || cleanKey;
    const baseNameWithoutExt = baseName.replace(/\.lua$/i, "");

    const escapedContent = `function()\n${content}\nend`;

    const registerKey = (k) => {
      if (!registeredKeys.has(k)) {
        registeredKeys.add(k);
        moduleEntries.push(`    ["${k}"] = ${escapedContent}`);
      }
    };

    registerKey(cleanKey);
    if (keyWithoutExt !== cleanKey) registerKey(keyWithoutExt);
    if (baseName !== cleanKey) registerKey(baseName);
    if (baseNameWithoutExt !== keyWithoutExt && baseNameWithoutExt !== baseName) registerKey(baseNameWithoutExt);
  }

  const modulesTable = moduleEntries.join(",\n");
  const assembled = `--[[ ATOMPROTECT VFS ]]--\nlocal __VFS_MODULES = {\n${modulesTable}\n}\nlocal __VFS_CACHE = {}\nlocal original_require = require\nlocal function __vfs_require(m)\n  return m\nend\nlocal require = __vfs_require\ndo\n${entryContent}\nend\n`;

  fs.writeFileSync('assembled_debug.lua', assembled, 'utf8');
  const lines = assembled.split('\n');
  console.log('Total assembled lines:', lines.length);
  for (let i = 1555; i <= 1570; i++) {
    console.log(i + ': ' + lines[i - 1]);
  }
}
main();
