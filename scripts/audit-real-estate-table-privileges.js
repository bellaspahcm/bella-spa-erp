/**
 * Audit real_estate_projects table privileges and RLS configuration
 * Purpose: Identify exact missing configuration causing E2E failure
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

async function auditTable(client, tableName) {
  console.log(`\n=== Auditing table: ${tableName} ===\n`);
  
  // 1. Check if table exists
  const { data: tableExists, error: tableError } = await client.rpc('exec_sql', {
    sql: `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}');`
  }).single();
  
  if (tableError) {
    console.log('⚠️  Cannot check table existence (need admin access)');
    console.log('   Assuming table exists based on migration files\n');
  } else {
    console.log(`✅ Table exists: ${tableName}\n`);
  }
  
  // 2. Check table privileges for 'anon' role
  console.log('📋 Checking table privileges...');
  const { data: privileges, error: privError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        grantee,
        privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = '${tableName}'
        AND grantee IN ('anon', 'authenticated', 'service_role')
      ORDER BY grantee, privilege_type;
    `
  });
  
  if (privError) {
    console.log('⚠️  Cannot query privileges directly\n');
  } else if (!privileges || privileges.length === 0) {
    console.log('❌ NO GRANTS found for anon/authenticated/service_role\n');
  } else {
    console.log('✅ Found privileges:');
    privileges.forEach(p => console.log(`   ${p.grantee}: ${p.privilege_type}`));
    console.log('');
  }
  
  // 3. Check RLS enabled
  console.log('🔒 Checking RLS status...');
  const { data: rlsStatus, error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        relrowsecurity as rls_enabled,
        relforcerowsecurity as rls_forced
      FROM pg_class
      WHERE relname = '${tableName}'
        AND relnamespace = 'public'::regnamespace;
    `
  }).single();
  
  if (rlsError) {
    console.log('⚠️  Cannot check RLS status\n');
  } else if (rlsStatus) {
    console.log(`   RLS Enabled: ${rlsStatus.rls_enabled}`);
    console.log(`   RLS Forced: ${rlsStatus.rls_forced}\n`);
  }
  
  // 4. Check RLS policies
  console.log('📜 Checking RLS policies...');
  const { data: policies, error: policyError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = '${tableName}'
      ORDER BY policyname;
    `
  });
  
  if (policyError) {
    console.log('⚠️  Cannot query policies\n');
  } else if (!policies || policies.length === 0) {
    console.log('❌ NO POLICIES found\n');
  } else {
    console.log(`✅ Found ${policies.length} policies:`);
    policies.forEach(p => {
      console.log(`   - ${p.policyname} (${p.cmd}, roles: ${p.roles.join(', ')})`);
      console.log(`     Permissive: ${p.permissive}`);
      if (p.qual) console.log(`     USING: ${p.qual}`);
      if (p.with_check) console.log(`     WITH CHECK: ${p.with_check}`);
      console.log('');
    });
  }
}

async function compareWithCanonicalPattern(client) {
  console.log('\n=== Comparing with Canonical Bella Pattern ===\n');
  
  // Check a known working table (e.g., bookings, customers)
  const canonicalTables = ['bookings', 'customers', 'packages'];
  
  for (const table of canonicalTables) {
    const { data: tableExists } = await client.rpc('exec_sql', {
      sql: `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}');`
    }).single();
    
    if (!tableExists || !tableExists.exists) continue;
    
    console.log(`\n📚 Canonical pattern from: ${table}`);
    
    // Check privileges
    const { data: privs } = await client.rpc('exec_sql', {
      sql: `
        SELECT grantee, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = '${table}'
          AND grantee IN ('anon', 'authenticated')
        ORDER BY grantee;
      `
    });
    
    if (privs && privs.length > 0) {
      console.log('   Privileges:');
      privs.forEach(p => console.log(`     ${p.grantee}: ${p.privilege_type}`));
    }
    
    // Check RLS
    const { data: rls } = await client.rpc('exec_sql', {
      sql: `
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = '${table}' AND relnamespace = 'public'::regnamespace;
      `
    }).single();
    
    if (rls) {
      console.log(`   RLS Enabled: ${rls.relrowsecurity}`);
    }
    
    // Count policies
    const { data: policies } = await client.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = '${table}';
      `
    }).single();
    
    if (policies) {
      console.log(`   Policies: ${policies.count}`);
    }
    
    break; // Only check first canonical table found
  }
}

async function main() {
  const envPath = resolve(process.cwd(), '.env');
  const envLocalPath = resolve(process.cwd(), '.env.local');
  
  const env = loadEnvFile(envPath);
  const envLocal = loadEnvFile(envLocalPath);
  
  const url = envLocal.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  
  if (!url || !key || key.startsWith('placeholder')) {
    console.error('❌ Missing valid credentials');
    process.exit(1);
  }
  
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  console.log('🔍 Bella Land E2E Failure — Database Configuration Audit\n');
  console.log('Purpose: Identify exact missing configuration for real_estate_projects table');
  console.log('Error: "permission denied for table real_estate_projects"');
  console.log('Hint from Postgres: "GRANT SELECT ON public.real_estate_projects TO anon;"\n');
  
  // Audit target table
  await auditTable(client, 'real_estate_projects');
  
  // Compare with canonical pattern
  await compareWithCanonicalPattern(client);
  
  console.log('\n=== Audit Complete ===\n');
  console.log('Next Steps:');
  console.log('1. Review audit output above');
  console.log('2. Compare real_estate_projects with canonical pattern');
  console.log('3. Identify EXACT missing configuration:');
  console.log('   - Missing GRANT privilege? → Add GRANT');
  console.log('   - RLS not enabled? → Enable RLS');
  console.log('   - Missing policy? → Add policy');
  console.log('4. Apply MINIMAL remediation');
  console.log('5. Rerun 2 failed E2E tests');
  console.log('6. Document what was fixed');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
