#!/usr/bin/env tsx
/**
 * Check RLS policies on re_customers table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking RLS policies on re_customers table\n');

  // Check if policies exist
  const { data: policies, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 're_customers');

  if (error) {
    console.log('❌ Error checking policies:', error.message);
    return;
  }

  if (!policies || policies.length === 0) {
    console.log('⚠️  NO POLICIES FOUND on re_customers table');
    console.log('   RLS is enabled but no policies defined');
    console.log('   This will BLOCK all authenticated access!');
    return;
  }

  console.log(`✅ Found ${policies.length} policy/policies:\n`);
  policies.forEach((policy: any) => {
    console.log(`Policy: ${policy.policyname}`);
    console.log(`  Command: ${policy.cmd}`);
    console.log(`  Roles: ${policy.roles}`);
    console.log(`  USING: ${policy.qual || 'N/A'}`);
    console.log(`  WITH CHECK: ${policy.with_check || 'N/A'}`);
    console.log();
  });
}

main().catch(console.error);
