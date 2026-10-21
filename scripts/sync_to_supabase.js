const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('Connecting to Supabase:', supabaseUrl);

  const { data: scripts, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('slug', 'rivals');

  if (error) {
    console.error('Error fetching rivals script:', error);
    process.exit(1);
  }

  if (!scripts || scripts.length === 0) {
    console.error('No script found with slug "rivals"');
    process.exit(1);
  }

  const script = scripts[0];
  console.log(`Found script: "${script.name}" (ID: ${script.id})`);
  console.log('Current entry file:', script.entry_file);
  console.log('Current modules count:', Object.keys(script.modules || {}).length);

  // Read local files
  const rivalsDir = path.join(__dirname, 'rivals');
  const initCode = fs.readFileSync(path.join(rivalsDir, 'init.lua'), 'utf8');
  const featuresCode = fs.readFileSync(path.join(rivalsDir, 'features.lua'), 'utf8');
  const mobileLiteUiCode = fs.readFileSync(path.join(rivalsDir, 'mobile_lite_ui.lua'), 'utf8');
  const mobileUiCode = fs.existsSync(path.join(rivalsDir, 'mobile_ui.lua'))
    ? fs.readFileSync(path.join(rivalsDir, 'mobile_ui.lua'), 'utf8')
    : null;
  const mainUiCode = fs.existsSync(path.join(rivalsDir, 'main_ui.lua'))
    ? fs.readFileSync(path.join(rivalsDir, 'main_ui.lua'), 'utf8')
    : null;
  const featuresLiteCode = fs.readFileSync(path.join(rivalsDir, 'features_lite.lua'), 'utf8');

  const updatedModules = Object.assign({}, script.modules || {}, {
    'init.lua': initCode,
    'rivals/init.lua': initCode,
    'features.lua': featuresCode,
    'rivals/features.lua': featuresCode,
    'mobile_lite_ui.lua': mobileLiteUiCode,
    'rivals/mobile_lite_ui.lua': mobileLiteUiCode,
    'features_lite.lua': featuresLiteCode,
    'rivals/features_lite.lua': featuresLiteCode,
  });

  if (mainUiCode) {
    updatedModules['main_ui.lua'] = mainUiCode;
    updatedModules['rivals/main_ui.lua'] = mainUiCode;
  }
  if (mobileUiCode) {
    updatedModules['mobile_ui.lua'] = mobileUiCode;
    updatedModules['rivals/mobile_ui.lua'] = mobileUiCode;
  }

  console.log('Updating script with universal features.lua (lines:', featuresCode.split(/\r?\n/).length, ')');

  const { error: updateError } = await supabase
    .from('scripts')
    .update({
      modules: updatedModules,
      updated_at: new Date().toISOString(),
    })
    .eq('id', script.id);

  if (updateError) {
    console.error('Failed to update script modules in Supabase:', updateError);
    process.exit(1);
  }

  console.log('Successfully synced all Rivals modules to Supabase database!');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
