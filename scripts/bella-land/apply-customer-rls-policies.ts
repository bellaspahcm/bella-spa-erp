#!/usr/bin/env tsx
/**
 * Apply RLS policies to re_customers table
 * 
 * This script applies the policies defined in:
 * supabase/migrations/20260911010000_add_re_customers_rls_policies.sql
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql: string, description: string) {
  console.log(`\n${description}...`);
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.log(`❌ FAILED: ${error.message}`);
    return false;
  }
  
  console.log(`✅ SUCCESS`);
  return true;
}

async function main() {
  console.log('🔧 Applying RLS Policies to re_customers');
  console.log('═'.repeat(70));

  // Enable RLS (should already be enabled, but ensure it)
  await executeSQL(
    'ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;',
    'Enable RLS on re_customers'
  );

  // Drop existing policies (if any)
  await executeSQL(
    'DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;',
    'Drop existing read policy'
  );

  await executeSQL(
    'DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;',
    'Drop existing write policy'
  );

  // Create READ policy
  const readPolicy = `
    CREATE POLICY "re_customers_tenant_read"
      ON re_customers
      FOR SELECT
      TO authenticated
      USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
      );
  `;

  const readSuccess = await executeSQL(readPolicy, 'Create READ policy');

  // Create WRITE policy
  const writePolicy = `
    CREATE POLICY "re_customers_tenant_write"
      ON re_customers
      FOR ALL
      TO authenticated
      USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
      )
      WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
      );
  `;

  const writeSuccess = await executeSQL(writePolicy, 'Create WRITE policy');

  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));

  if (readSuccess && writeSuccess) {
    console.log('✅ ALL POLICIES APPLIED SUCCESSFULLY');
    console.log('\nYou can now run: npx tsx scripts/bella-land/test-customer-authenticated-security.ts');
    process.exit(0);
  } else {
    console.log('❌ SOME POLICIES FAILED TO APPLY');
    console.log('Check the errors above for details');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ UNEXPECTED ERROR:');
  console.error(err);
  process.exit(1);
});
