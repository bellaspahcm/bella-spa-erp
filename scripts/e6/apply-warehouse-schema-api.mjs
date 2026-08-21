// E6 Warehouse Schema Migration Applier
// Apply via Supabase Management API (SQL query endpoint)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchemaMigration() {
  console.log('🚀 E6: Applying Warehouse Schema Migration...');
  console.log('📦 Database:', supabaseUrl);
  console.log('🔧 Method: Direct SQL via Supabase client\n');
  
  try {
    const sql = readFileSync('migrations/logistics/20260821_warehouse_schema.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...\n');
    
    // Execute SQL directly - Supabase client handles this internally
    const { data, error } = await supabase.rpc('query', { query_text: sql });
    
    if (error) {
      // If RPC doesn't work, try alternative: create tables one by one
      console.log('⚠️  RPC not available, trying alternative method...\n');
      
      // Parse and execute CREATE TABLE statements individually
      const createTableStatements = sql.match(/CREATE TABLE[^;]+;/gi) || [];
      const alterStatements = sql.match(/ALTER TABLE[^;]+;/gi) || [];
      const createIndexStatements = sql.match(/CREATE INDEX[^;]+;/gi) || [];
      const createPolicyStatements = sql.match(/CREATE POLICY[^;]+;/gi) || [];
      const createTriggerStatements = sql.match(/CREATE TRIGGER[^;]+;/gi) || [];
      
      console.log(`Found ${createTableStatements.length} tables to create`);
      
      // For now, provide manual instructions
      throw new Error('Automatic migration failed. Please apply manually via Supabase SQL Editor.');
    }
    
    console.log('✅ Migration applied successfully\n');
    console.log('📊 Tables created:');
    console.log('   - logistics_warehouse_skus');
    console.log('   - logistics_warehouse_bins');
    console.log('   - logistics_warehouse_receipts');
    console.log('   - logistics_warehouse_receipt_line_items');
    console.log('   - logistics_warehouse_inventory_on_hand');
    console.log('   - logistics_warehouse_movements');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📋 MANUAL MIGRATION INSTRUCTIONS:');
    console.log('1. Go to https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/editor');
    console.log('2. Click "New Query"');
    console.log('3. Copy content from: migrations/logistics/20260821_warehouse_schema.sql');
    console.log('4. Paste into SQL Editor');
    console.log('5. Click "Run" (or Ctrl+Enter)');
    console.log('6. Verify tables created in Table Editor\n');
    process.exit(1);
  }
}

applySchemaMigration();
