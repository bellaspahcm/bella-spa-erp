/**
 * Audit real_estate_projects table by attempting direct query
 * Compare with known working tables
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

async function testTableAccess(client, tableName, role) {
  console.log(`\n  Testing ${tableName} with ${role} role...`);
  
  const { data, error, count } = await client
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.log(`    ❌ ERROR: ${error.code} - ${error.message}`);
    if (error.hint) console.log(`    💡 HINT: ${error.hint}`);
    return { accessible: false, error: error.code };
  } else {
    console.log(`    ✅ ACCESSIBLE (${count} rows)`);
    return { accessible: true, count };
  }
}

async function main() {
  const envPath = resolve(process.cwd(), '.env');
  const envLocalPath = resolve(process.cwd(), '.env.local');
  
  const env = loadEnvFile(envPath);
  const envLocal = loadEnvFile(envLocalPath);
  
  const url = envLocal.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  
  if (!url || !anonKey || !serviceKey || serviceKey.startsWith('placeholder')) {
    console.error('❌ Missing valid credentials');
    process.exit(1);
  }
  
  console.log('🔍 Bella Land E2E Failure — Direct Table Access Audit\n');
  console.log('Purpose: Test actual table accessibility with different roles');
  console.log('Error context: E2E tests fail with "permission denied for table real_estate_projects"\n');
  
  // Create clients with different keys
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  // Test tables
  const testTables = [
    { name: 'bookings', description: 'Canonical Bella table (known working)' },
    { name: 'customers', description: 'Canonical Bella table (known working)' },
    { name: 'real_estate_projects', description: 'Target table (E2E failure)' },
    { name: 'real_estate_project_apartments', description: 'Related Real Estate table' },
    { name: 'real_estate_contracts', description: 'Related Real Estate table' },
  ];
  
  console.log('=== Testing with ANON key (E2E auth context) ===');
  const anonResults = {};
  for (const table of testTables) {
    console.log(`\n📋 ${table.name} — ${table.description}`);
    anonResults[table.name] = await testTableAccess(anonClient, table.name, 'anon');
  }
  
  console.log('\n\n=== Testing with SERVICE ROLE key (admin context) ===');
  const serviceResults = {};
  for (const table of testTables) {
    console.log(`\n📋 ${table.name}`);
    serviceResults[table.name] = await testTableAccess(serviceClient, table.name, 'service_role');
  }
  
  // Analysis
  console.log('\n\n=== Analysis ===\n');
  
  const canonicalAccessible = anonResults['bookings']?.accessible || anonResults['customers']?.accessible;
  const targetAccessible = anonResults['real_estate_projects']?.accessible;
  
  if (canonicalAccessible && !targetAccessible) {
    console.log('🔍 FINDING: Canonical Bella tables ARE accessible with anon key');
    console.log('🔍 FINDING: real_estate_projects is NOT accessible with anon key');
    console.log('');
    console.log('📊 Comparison:');
    console.log(`   bookings (anon):               ${anonResults['bookings']?.accessible ? '✅ YES' : '❌ NO'}`);
    console.log(`   customers (anon):              ${anonResults['customers']?.accessible ? '✅ YES' : '❌ NO'}`);
    console.log(`   real_estate_projects (anon):   ${anonResults['real_estate_projects']?.accessible ? '✅ YES' : '❌ NO'}`);
    console.log('');
    console.log(`   real_estate_projects (service): ${serviceResults['real_estate_projects']?.accessible ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    if (serviceResults['real_estate_projects']?.accessible) {
      console.log('✅ Table exists and is accessible to service_role');
      console.log('❌ Table is NOT accessible to anon role');
      console.log('');
      console.log('🎯 ROOT CAUSE: Missing table privilege configuration for anon role');
      console.log('');
      console.log('🔧 REMEDIATION NEEDED:');
      console.log('   1. Check if canonical pattern uses:');
      console.log('      - GRANT SELECT/INSERT/UPDATE/DELETE to specific role(s)');
      console.log('      - RLS policies with tenant_id isolation');
      console.log('   2. Apply same pattern to real_estate_projects');
      console.log('   3. Verify other real_estate_* tables have same config');
    } else {
      console.log('⚠️  Table not accessible even with service_role - may not exist or severe config issue');
    }
  } else if (!canonicalAccessible) {
    console.log('⚠️  WARNING: Canonical tables also not accessible - may indicate auth/tenant setup issue');
  } else {
    console.log('✅ All tested tables accessible - unexpected (E2E should not fail)');
  }
  
  console.log('\n=== Next Steps ===\n');
  console.log('1. Check migration files for real_estate_projects table definition');
  console.log('2. Look for GRANT statements in migrations');
  console.log('3. Look for RLS policy definitions in migrations');
  console.log('4. Compare with canonical Bella pattern (bookings/customers)');
  console.log('5. Add missing configuration');
  console.log('6. Rerun E2E tests');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
