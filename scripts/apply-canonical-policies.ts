#!/usr/bin/env tsx
/**
 * Apply canonical RLS policies from migrations
 * Source: 20260806030000_healthcare_kernel_schema.sql
 *         20260807000000_create_hc_appointments.sql
 */

import { createClient } from '@supabase/supabase-js';

// Read env vars directly (workaround for dotenv issue)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyCanonicalPolicies() {
  console.log('🔧 Applying canonical RLS policies...\n');

  // Canonical policy 1: hc_prescriptions
  console.log('1. hc_prescriptions policy...');
  const policy1 = `
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_prescriptions' AND policyname = 'tenant_isolation_hc_prescriptions') THEN
        CREATE POLICY tenant_isolation_hc_prescriptions 
          ON public.hc_prescriptions 
          FOR ALL 
          USING (tenant_id = public.get_auth_tenant_id());
      END IF;
    END $$;
  `;

  const { error: error1 } = await supabase.rpc('exec_sql', { sql: policy1 });
  if (error1) {
    console.error('   ❌ Error:', error1.message);
    process.exit(1);
  }
  console.log('   ✅ Applied\n');

  // Canonical policy 2: hc_appointments
  console.log('2. hc_appointments policy...');
  const policy2 = `
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_appointments' AND policyname = 'tenant_isolation_hc_appointments') THEN
        CREATE POLICY tenant_isolation_hc_appointments 
          ON public.hc_appointments
          FOR ALL 
          USING (tenant_id = public.get_auth_tenant_id());
      END IF;
    END $$;
  `;

  const { error: error2 } = await supabase.rpc('exec_sql', { sql: policy2 });
  if (error2) {
    console.error('   ❌ Error:', error2.message);
    process.exit(1);
  }
  console.log('   ✅ Applied\n');

  // Verify
  console.log('📋 Verification:');
  const verify = `
    SELECT 
      c.relname AS table_name,
      p.polname AS policy_name,
      CASE p.polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END AS command
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE c.relname IN ('hc_prescriptions', 'hc_appointments')
    ORDER BY c.relname, p.polname
  `;

  const { data: policies, error: verifyError } = await supabase.rpc('exec_sql', { sql: verify });
  if (verifyError) {
    console.error('❌ Verification error:', verifyError);
    process.exit(1);
  }

  if (policies && policies.length > 0) {
    for (const row of policies) {
      console.log(`  ✅ ${row.table_name}.${row.policy_name} [${row.command}]`);
    }
  } else {
    console.log('  ⚠️  No policies found (check exec_sql permissions)');
  }

  console.log('\n✅ Canonical policies applied');
  console.log('\nNext: Rerun T1');
  console.log('  $env:USE_DIRECT_ADAPTER="true"');
  console.log('  npx tsx test/phase4b3/t1-happy-path.ts');
}

applyCanonicalPolicies();
