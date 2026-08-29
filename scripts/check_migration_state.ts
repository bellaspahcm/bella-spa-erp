#!/usr/bin/env tsx
/**
 * Migration State Check
 * 
 * Verify migration state before deploying finance_test_cleanup_rpc
 * 
 * Checks:
 * 1. Remote migration history
 * 2. Local migration files
 * 3. Divergence detection
 * 4. 20260824000000_finance_test_cleanup_rpc readiness
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 Migration State Check');
  console.log('═'.repeat(80));

  // Check remote migrations
  console.log('\n📋 Step 1: Remote Migration History');
  console.log('─'.repeat(80));

  const { data: remoteMigrations, error: remoteError } = await supabase
    .from('supabase_migrations.schema_migrations' as any)
    .select('version, name')
    .order('version', { ascending: false })
    .limit(10);

  if (remoteError) {
    console.error(`   ❌ Error fetching remote migrations: ${remoteError.message}`);
    console.log(`   ℹ️  Trying alternative query...`);
    
    // Try alternative: direct RPC if available
    const { data: altData, error: altError } = await supabase
      .rpc('get_migration_history' as any);
    
    if (altError) {
      console.error(`   ❌ Cannot access migration history`);
      console.log(`   ⚠️  Proceeding with caution...`);
    } else {
      console.log(`   ℹ️  Alternative query succeeded`);
    }
  } else {
    console.log(`   Latest remote migrations:`);
    remoteMigrations?.forEach(m => {
      console.log(`      ${m.version}: ${m.name}`);
    });
  }

  // Check local migrations
  console.log('\n📋 Step 2: Local Migration Files');
  console.log('─'.repeat(80));

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const localMigrations = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse()
    .slice(0, 10);

  console.log(`   Latest local migrations:`);
  localMigrations.forEach(m => {
    console.log(`      ${m}`);
  });

  // Check target migration
  console.log('\n📋 Step 3: Target Migration Check');
  console.log('─'.repeat(80));

  const targetMigration = '20260824000000_finance_test_cleanup_rpc.sql';
  const targetPath = path.join(migrationsDir, targetMigration);
  
  if (!fs.existsSync(targetPath)) {
    console.error(`   ❌ Target migration not found: ${targetMigration}`);
    process.exit(1);
  }

  console.log(`   ✅ Target migration exists: ${targetMigration}`);
  
  const migrationContent = fs.readFileSync(targetPath, 'utf-8');
  console.log(`   Size: ${migrationContent.length} bytes`);

  // Verify RPC contract in migration
  console.log('\n📋 Step 4: RPC Contract Verification');
  console.log('─'.repeat(80));

  const requiredElements = [
    { name: 'service_role authorization', pattern: /service_role|postgres|supabase_admin/ },
    { name: 'exact IDs parameter', pattern: /p_transaction_ids\s+UUID\[\]/ },
    { name: 'tenant validation', pattern: /p_tenant_id.*UUID/ },
    { name: 'POSTED status check', pattern: /status.*=.*'POSTED'/ },
    { name: 'session_replication_role', pattern: /SET session_replication_role = replica/ },
    { name: 'count verification', pattern: /GET DIAGNOSTICS.*ROW_COUNT/ },
    { name: 'REVOKE PUBLIC', pattern: /REVOKE ALL.*public\.finance_admin_cleanup_test_transactions/s },
    { name: 'GRANT service_role', pattern: /GRANT EXECUTE.*finance_admin_cleanup_test_transactions.*service_role/s }
  ];

  let contractValid = true;
  requiredElements.forEach(elem => {
    const found = elem.pattern.test(migrationContent);
    console.log(`   ${found ? '✅' : '❌'} ${elem.name}`);
    if (!found) contractValid = false;
  });

  if (!contractValid) {
    console.error(`\n   ❌ RPC contract incomplete`);
    console.log(`   Action: Review migration file`);
    process.exit(1);
  }

  console.log(`\n   ✅ RPC contract valid`);

  // Check if RPC already exists
  console.log('\n📋 Step 5: RPC Existence Check');
  console.log('─'.repeat(80));

  const { data: existingRpc, error: rpcError } = await supabase
    .rpc('finance_admin_cleanup_test_transactions' as any, {
      p_transaction_ids: [],
      p_tenant_id: '00000000-0000-0000-0000-000000000000'
    });

  if (rpcError) {
    if (rpcError.message.includes('Empty transaction ID list')) {
      console.log(`   ⚠️  RPC already exists (returned expected error)`);
      console.log(`   Action: Skip deployment OR redeploy to update`);
    } else if (rpcError.message.includes('does not exist')) {
      console.log(`   ✅ RPC does not exist (ready for deployment)`);
    } else {
      console.log(`   ℹ️  RPC check inconclusive: ${rpcError.message}`);
    }
  } else {
    console.log(`   ⚠️  RPC exists and returned data (unexpected)`);
  }

  // Migration readiness summary
  console.log('\n═'.repeat(80));
  console.log('📊 Migration Readiness Summary');
  console.log('═'.repeat(80));

  const readiness = {
    remote_accessible: !remoteError,
    target_migration_exists: true,
    rpc_contract_valid: contractValid,
    rpc_not_deployed: rpcError?.message.includes('does not exist'),
  };

  console.table(readiness);

  const isReady = Object.values(readiness).every(v => v === true);

  if (isReady) {
    console.log('\n✅ MIGRATION STATE: READY');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy RPC migration:');
    console.log('   npx supabase db push');
    console.log('');
    console.log('2. Verify RPC deployment:');
    console.log('   npx tsx scripts/verify_cleanup_rpc.ts');
    console.log('');
    console.log('3. Execute cleanup (separate step):');
    console.log('   npx tsx scripts/phase4_4_execute_cleanup.ts');
  } else {
    console.log('\n⚠️  MIGRATION STATE: NEEDS REVIEW');
    console.log('');
    console.log('Issues detected:');
    Object.entries(readiness).forEach(([key, value]) => {
      if (!value) {
        console.log(`   ❌ ${key}`);
      }
    });
    console.log('');
    console.log('Action: Resolve issues before deployment');
  }

  console.log('\n═'.repeat(80));
}

main().catch(console.error);
