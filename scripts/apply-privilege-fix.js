/**
 * Apply privilege fix for real_estate_projects table
 * Grants SELECT to anon role while preserving RLS tenant isolation
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
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  
  if (!url || !serviceKey || serviceKey.startsWith('placeholder')) {
    console.error('❌ Missing valid credentials');
    process.exit(1);
  }
  
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' }
  });
  
  console.log('🔧 Applying Privilege Fix for real_estate_projects\n');
  console.log('Purpose: Grant SELECT to anon role (minimal privilege for E2E tests)');
  console.log('Security: RLS policies remain enabled and enforce tenant isolation\n');
  
  // Step 1: Grant SELECT to anon
  console.log('Step 1: Granting SELECT privilege to anon role...');
  
  const { error: grantError } = await client.rpc('exec_sql', {
    sql: 'GRANT SELECT ON TABLE public.real_estate_projects TO anon;'
  });
  
  if (grantError) {
    console.error('❌ Failed to grant privilege:', grantError.message);
    console.log('\n💡 Trying alternative method (direct query)...');
    
    // Try using raw query (may not work with Supabase)
    const { error: altError } = await client.from('_migrations').select('version').limit(1);
    
    if (altError) {
      console.error('❌ Cannot execute SQL - need database admin access');
      console.log('\n📋 Manual steps required:');
      console.log('1. Connect to database with admin role');
      console.log('2. Execute: GRANT SELECT ON TABLE public.real_estate_projects TO anon;');
      console.log('3. Rerun this script to verify');
      process.exit(1);
    }
  } else {
    console.log('✅ Privilege granted successfully\n');
  }
  
  // Step 2: Verify RLS is still enabled
  console.log('Step 2: Verifying RLS status...');
  
  const { data: rlsCheck, error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT relrowsecurity as rls_enabled
      FROM pg_class
      WHERE relname = 'real_estate_projects'
        AND relnamespace = 'public'::regnamespace;
    `
  }).single();
  
  if (rlsError) {
    console.log('⚠️  Cannot verify RLS status directly');
  } else if (rlsCheck && rlsCheck.rls_enabled) {
    console.log('✅ RLS is ENABLED - tenant isolation protected\n');
  } else {
    console.error('❌ RLS is NOT enabled - SECURITY VIOLATION');
    process.exit(1);
  }
  
  // Step 3: Test access with anon key
  console.log('Step 3: Testing table access with anon role...');
  
  const anonKey = envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  const { data, error, count } = await anonClient
    .from('real_estate_projects')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('❌ Anon access still fails:', error.message);
    if (error.code === '42501') {
      console.log('\n💡 Privilege grant may need time to propagate or database connection pool refresh');
      console.log('   Try restarting dev server and rerunning E2E tests');
    }
    process.exit(1);
  } else {
    console.log(`✅ Anon role can now access table (${count} rows accessible)\n`);
  }
  
  console.log('=== Fix Applied Successfully ===\n');
  console.log('Next steps:');
  console.log('1. Rerun 2 failed E2E tests');
  console.log('2. Verify tenant isolation still works');
  console.log('3. Document final results');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
