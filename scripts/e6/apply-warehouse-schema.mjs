// E6 Warehouse Schema Migration Applier
// Apply warehouse schema to Supabase

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
  
  try {
    const sql = readFileSync('migrations/logistics/20260821_warehouse_schema.sql', 'utf8');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing...`);
      
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: stmt + ';'
      });
      
      if (error) {
        console.error('❌ Error:', error.message);
        throw error;
      }
    }
    
    console.log('\n✅ Migration applied successfully');
    console.log('📊 Tables created:');
    console.log('   - logistics_warehouse_skus');
    console.log('   - logistics_warehouse_bins');
    console.log('   - logistics_warehouse_receipts');
    console.log('   - logistics_warehouse_receipt_line_items');
    console.log('   - logistics_warehouse_inventory_on_hand');
    console.log('   - logistics_warehouse_movements');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applySchemaMigration();
