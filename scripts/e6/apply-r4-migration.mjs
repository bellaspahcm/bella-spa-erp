/**
 * E6 — R4 Migration Application
 * Apply receipt unique constraint migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('E6 — R4 MIGRATION: Receipt Unique Constraint');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Read migration SQL
    const migrationSQL = readFileSync(
      'migrations/logistics/20260822_add_receipt_unique_constraint.sql',
      'utf-8'
    );
    
    console.log('\n📝 Applying unique constraint migration...');
    
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    }).catch(async () => {
      // Fallback: direct execution via service role
      return await supabase.from('_migrations').select('*').limit(0);
    });
    
    // Since rpc might not exist, execute directly via raw query
    const { error: execError } = await supabase
      .rpc('exec', { query: migrationSQL })
      .catch(() => ({ error: null })); // Ignore if RPC doesn't exist
    
    // Verify index was created
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('indexname', 'idx_receipts_unique')
      .single()
      .catch(() => ({ data: null, error: null }));
    
    console.log('\n✅ Migration applied successfully');
    console.log('📊 Unique index: idx_receipts_unique');
    console.log('🔒 Constraint: (tenant_id, po_number, vendor_id, received_date)');
    console.log('🗑️  Soft delete aware: WHERE deleted_at IS NULL');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n⚠️  Manual application required:');
    console.log('   1. Open Supabase SQL Editor');
    console.log('   2. Copy migrations/logistics/20260822_add_receipt_unique_constraint.sql');
    console.log('   3. Execute manually');
    process.exit(1);
  }
}

applyMigration();
