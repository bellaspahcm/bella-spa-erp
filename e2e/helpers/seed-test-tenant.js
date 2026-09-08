/**
 * Seed "Bella Spa Headquarter" tenant for E2E tests
 * Run: node e2e/helpers/seed-test-tenant.js
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
  // Load env from both files - URL from .env.local, KEY from .env
  const envPath = resolve(process.cwd(), '.env');
  const envLocalPath = resolve(process.cwd(), '.env.local');
  
  const env = loadEnvFile(envPath);
  const envLocal = loadEnvFile(envLocalPath);
  
  const url = envLocal.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || 
               process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  
  if (key === 'placeholder-supabase-service-role-key' || key === 'placeholder-supabase-secret-key') {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is still a placeholder - need real key');
    process.exit(1);
  }
  
  console.log('🔍 Checking for Bella Spa Headquarter tenant...');
  
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  // Check if tenant exists
  const { data: existing, error: checkError } = await client
    .from('tenants')
    .select('id, name, status')
    .eq('name', 'Bella Spa Headquarter')
    .maybeSingle();
  
  if (existing) {
    console.log('✅ Tenant already exists:', existing.name);
    console.log('   ID:', existing.id);
    console.log('   Status:', existing.status);
    return;
  }
  
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('❌ Error checking tenant:', checkError.message);
    process.exit(1);
  }
  
  // Create tenant
  console.log('📝 Creating Bella Spa Headquarter tenant...');
  
  const { data: created, error: createError } = await client
    .from('tenants')
    .insert({ 
      name: 'Bella Spa Headquarter', 
      status: 'active' 
    })
    .select()
    .single();
  
  if (createError) {
    console.error('❌ Error creating tenant:', createError.message);
    process.exit(1);
  }
  
  console.log('✅ Tenant created successfully');
  console.log('   ID:', created.id);
  console.log('   Name:', created.name);
  console.log('   Status:', created.status);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
