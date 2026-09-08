/**
 * Verify privilege grant was successful
 */

const { createClient } = require('@supabase/supabase-js');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  
  const text = readFileSync(filePath, 'utf8');
  const vars = {};
  
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    
    const key = match[1];
    const rawValue = match[2].trim();
    const value = (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) ? rawValue.slice(1, -1) : rawValue;
    
    vars[key] = value;
  }
  
  return vars;
}

async function main() {
  const envPath = resolve(process.cwd(), '.env');
  const envLocalPath = resolve(process.cwd(), '.env.local');
  
  const env = loadEnvFile(envPath);
  const envLocal = loadEnvFile(envLocalPath);
  
  const url = envLocal.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url || !anonKey) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }
  
  console.log('🔍 Verifying real_estate_projects table access with anon role...\n');
  
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  const { data, error, count } = await anonClient
    .from('real_estate_projects')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('❌ Anon access FAILED:', error.message);
    console.error('   Code:', error.code);
    console.log('\n💡 Migration may need connection pool refresh');
    console.log('   Try restarting dev server');
    process.exit(1);
  } else {
    console.log(`✅ Anon role can now access table`);
    console.log(`✅ ${count} rows accessible (with RLS filtering)\n`);
    console.log('Migration verified successfully!');
    console.log('\nNext: Rerun E2E tests');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
