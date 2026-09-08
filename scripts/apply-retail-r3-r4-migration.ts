/**
 * Apply Retail R3+R4 Migration
 * Manually executes migration SQL on remote Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'placeholder-supabase-service-role-key') {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  return error === null || (error && !error.message.includes('does not exist'));
}

async function applyMigration() {
  console.log('🔍 Checking if R3+R4 tables already exist...');
  
  const variantsExist = await checkTableExists('retail_product_variants');
  const batchesExist = await checkTableExists('retail_product_batches');
  
  if (variantsExist && batchesExist) {
    console.log('✅ R3+R4 tables already exist!');
    console.log('   - retail_product_variants (R3) ✓');
    console.log('   - retail_product_batches (R4) ✓');
    console.log('');
    console.log('Migration already applied. Skipping.');
    return;
  }
  
  console.log('❌ R3+R4 tables NOT found. Need manual SQL execution.');
  console.log('');
  console.log('BLOCKER: Cannot execute raw SQL via Supabase client.');
  console.log('');
  console.log('Options:');
  console.log('1. Use Supabase Dashboard SQL Editor:');
  console.log('   - Go to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new');
  console.log('   - Copy/paste: supabase/migrations/20260906000001_retail_r3_r4_extensions.sql');
  console.log('   - Execute');
  console.log('');
  console.log('2. Use psql CLI (if credentials available)');
  console.log('');
  console.log('3. Use supabase db push (requires fixing migration conflicts first)');
  
  process.exit(1);
}

applyMigration();
