#!/usr/bin/env node
/**
 * Check Decision Engine migration status on remote database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkMigrationStatus() {
  console.log('🔍 Checking migration status on remote database...\n');

  // 1. Check if migration 20260701000000 is applied
  const { data: migrations, error: migError } = await supabase
    .from('supabase_migrations')
    .select('*')
    .eq('version', '20260701000000')
    .limit(1);

  if (migError) {
    console.error('❌ Failed to query supabase_migrations:', migError.message);
  } else if (migrations && migrations.length > 0) {
    console.log('✅ Migration 20260701000000_decision_engine_audit_log.sql is APPLIED');
    console.log('   Applied at:', migrations[0].inserted_at);
  } else {
    console.log('❌ Migration 20260701000000 is NOT applied yet');
  }

  console.log('');

  // 2. Check if decision_audit_log table exists
  const { data: auditTable, error: auditError } = await supabase
    .from('decision_audit_log')
    .select('id')
    .limit(1);

  if (auditError) {
    if (auditError.code === '42P01') {
      console.log('❌ Table decision_audit_log does NOT exist');
    } else {
      console.log('✅ Table decision_audit_log exists (query returned error but table exists)');
    }
  } else {
    console.log('✅ Table decision_audit_log exists');
    console.log(`   Current rows: ${auditTable ? auditTable.length : 0}`);
  }

  console.log('');

  // 3. Check if policy_versions table exists
  const { data: policyTable, error: policyError } = await supabase
    .from('policy_versions')
    .select('id')
    .limit(1);

  if (policyError) {
    if (policyError.code === '42P01') {
      console.log('❌ Table policy_versions does NOT exist');
    } else {
      console.log('✅ Table policy_versions exists (query returned error but table exists)');
    }
  } else {
    console.log('✅ Table policy_versions exists');
    console.log(`   Current rows: ${policyTable ? policyTable.length : 0}`);
  }

  console.log('');

  // 4. Check RPC functions
  const rpcFunctions = [
    'get_decisions_by_trace',
    'get_decision_history_for_entity',
    'get_policy_version',
  ];

  console.log('📦 Checking RPC functions:');
  for (const funcName of rpcFunctions) {
    const { data, error } = await supabase.rpc(funcName, {
      p_trace_id: 'test-trace-id-check-only',
    }).limit(0);

    if (error) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log(`   ❌ ${funcName} does NOT exist`);
      } else {
        console.log(`   ✅ ${funcName} exists (error: ${error.message})`);
      }
    } else {
      console.log(`   ✅ ${funcName} exists`);
    }
  }

  console.log('\n✅ Migration status check complete!');
}

checkMigrationStatus().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
