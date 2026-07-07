/**
 * Run Configuration System Migrations
 * 
 * This script:
 * 1. Connects to Supabase
 * 2. Checks if tenant_payroll_config table exists
 * 3. Runs SQL migrations if needed
 * 4. Inserts default configs for all tenants
 * 5. Verifies results
 * 
 * Usage:
 * ```bash
 * npm run config:migrate
 * ```
 * 
 * Or with TypeScript:
 * ```bash
 * npx ts-node scripts/run-config-migrations.ts
 * ```
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('');
  console.error('Make sure .env.local contains:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJxxx...');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function tableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  return !error || error.code !== '42P01'; // 42P01 = table does not exist
}

async function runMigrationFile(filePath: string): Promise<void> {
  console.log(`\n📄 Reading migration: ${path.basename(filePath)}`);
  
  const sql = fs.readFileSync(filePath, 'utf-8');
  
  console.log(`   Size: ${(sql.length / 1024).toFixed(1)} KB`);
  console.log(`   Running...`);
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw new Error(error.message);
  }
  
  console.log(`   ✅ Migration completed`);
}

async function getTenantCount(): Promise<number> {
  const { count, error } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  return count || 0;
}

async function getConfigCount(): Promise<{ total: number; byProvider: Record<string, number> }> {
  const { data, error } = await supabase
    .from('tenant_payroll_config')
    .select('provider_key');
  
  if (error) throw error;
  
  const byProvider: Record<string, number> = {};
  data?.forEach((row) => {
    byProvider[row.provider_key] = (byProvider[row.provider_key] || 0) + 1;
  });
  
  return {
    total: data?.length || 0,
    byProvider
  };
}

// =====================================================
// MAIN MIGRATION PROCESS
// =====================================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  BELLA PAYROLL CONFIGURATION SYSTEM MIGRATION        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // =====================================================
    // STEP 1: Check connection
    // =====================================================
    console.log('🔌 Step 1: Checking Supabase connection...');
    
    const { data: testData, error: testError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('   ❌ Connection failed:', testError.message);
      process.exit(1);
    }
    
    console.log('   ✅ Connection successful');
    
    // =====================================================
    // STEP 2: Check if table exists
    // =====================================================
    console.log('\n📊 Step 2: Checking if tenant_payroll_config table exists...');
    
    const exists = await tableExists('tenant_payroll_config');
    
    if (exists) {
      console.log('   ✅ Table already exists');
      console.log('   ℹ️  Skipping schema creation (safe to re-run)');
    } else {
      console.log('   ⚠️  Table does not exist');
      console.log('   📝 Will create schema...');
      
      // Run schema migration
      const schemaPath = path.join(process.cwd(), 'supabase', 'migrations', '20260622_create_tenant_payroll_config.sql');
      
      if (!fs.existsSync(schemaPath)) {
        console.error(`   ❌ Migration file not found: ${schemaPath}`);
        process.exit(1);
      }
      
      await runMigrationFile(schemaPath);
    }
    
    // =====================================================
    // STEP 3: Get tenant count
    // =====================================================
    console.log('\n👥 Step 3: Counting tenants...');
    
    const tenantCount = await getTenantCount();
    console.log(`   📊 Found ${tenantCount} tenant(s)`);
    
    if (tenantCount === 0) {
      console.log('   ⚠️  No tenants found. Skipping config insertion.');
      console.log('   ℹ️  Create tenants first, then re-run this script.');
      return;
    }
    
    // =====================================================
    // STEP 4: Insert default configs
    // =====================================================
    console.log('\n⚙️  Step 4: Inserting default configs...');
    
    const configPath = path.join(process.cwd(), 'supabase', 'migrations', '20260622_insert_default_payroll_configs.sql');
    
    if (!fs.existsSync(configPath)) {
      console.error(`   ❌ Migration file not found: ${configPath}`);
      process.exit(1);
    }
    
    await runMigrationFile(configPath);
    
    // =====================================================
    // STEP 5: Verify results
    // =====================================================
    console.log('\n✅ Step 5: Verifying results...');
    
    const { total, byProvider } = await getConfigCount();
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  MIGRATION RESULTS                                   ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Tenants: ${tenantCount}`);
    console.log(`   Total configs: ${total}`);
    console.log(`   Expected: ${tenantCount * 5} (5 providers × ${tenantCount} tenants)`);
    console.log('');
    console.log('   Config breakdown by provider:');
    
    const providers = ['commission', 'kpi', 'attendance', 'rating', 'bonus'];
    providers.forEach((provider) => {
      const count = byProvider[provider] || 0;
      const status = count === tenantCount ? '✅' : '⚠️';
      console.log(`     ${status} ${provider.padEnd(12)} : ${count}/${tenantCount}`);
    });
    
    console.log('');
    
    if (total >= tenantCount * 5) {
      console.log('╔══════════════════════════════════════════════════════╗');
      console.log('║  ✅ MIGRATION SUCCESSFUL                             ║');
      console.log('╚══════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Build Settings UI for admin to manage configs');
      console.log('  2. Refactor providers to use PayrollConfigService');
      console.log('  3. Test with different tenant configs');
    } else {
      console.log('╔══════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  MIGRATION INCOMPLETE                            ║');
      console.log('╚══════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Some configs may be missing. Check logs above.');
    }
    
  } catch (error) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════╗');
    console.error('║  ❌ MIGRATION FAILED                                 ║');
    console.error('╚══════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error:', error);
    console.error('');
    process.exit(1);
  }
}

// =====================================================
// RUN
// =====================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
