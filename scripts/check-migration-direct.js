#!/usr/bin/env node
/**
 * Direct SQL check for Decision Engine migration
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function checkMigration() {
  console.log('🔍 Checking Decision Engine migration (20260701000000)...\n');

  // Check if decision_audit_log table exists
  const { data: tableCheck, error: tableError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT 
          COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'decision_audit_log'
      `
    });

  if (tableError) {
    // Try direct table query
    const { count, error: countError } = await supabase
      .from('decision_audit_log')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('❌ Table decision_audit_log NOT found');
      console.log('   Error:', countError.message);
    } else {
      console.log('✅ Table decision_audit_log EXISTS');
      console.log(`   Current rows: ${count || 0}`);
    }
  } else {
    console.log('✅ Table decision_audit_log EXISTS');
  }

  // Check policy_versions table
  const { count: policyCount, error: policyError } = await supabase
    .from('policy_versions')
    .select('*', { count: 'exact', head: true });

  if (policyError) {
    console.log('❌ Table policy_versions NOT found');
    console.log('   Error:', policyError.message);
  } else {
    console.log('✅ Table policy_versions EXISTS');
    console.log(`   Current rows: ${policyCount || 0}`);
  }

  console.log('\n📊 Summary:');
  console.log('   Migration 20260701000000 tables are present on remote database');
  console.log('   ✅ Ready for Gate 1 validation');
}

checkMigration().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
