/**
 * Check hc_clinical_orders table columns on remote Supabase
 * 
 * USAGE:
 *   node scripts/check-hc-clinical-orders-columns.js
 */

require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  console.log('🔍 Checking hc_clinical_orders columns...\n');

  try {
    // Query information_schema to get actual columns
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'hc_clinical_orders')
      .order('ordinal_position');

    if (error) {
      // information_schema may not be exposed via PostgREST
      // Fallback: Query table directly with all expected columns
      console.log('ℹ️  information_schema not accessible, trying direct query...\n');
      
      const { data: testData, error: testError } = await supabase
        .from('hc_clinical_orders')
        .select(`
          id,
          tenant_id,
          encounter_id,
          patient_party_id,
          order_type,
          order_status,
          priority,
          ordered_by,
          ordered_at,
          approved_by,
          approved_at,
          discontinued_by,
          discontinued_at,
          discontinue_reason,
          cds_check_id,
          cds_check_status,
          order_details,
          notes,
          request_id,
          version,
          created_at,
          updated_at
        `)
        .limit(1);

      if (testError) {
        console.error('❌ Failed to query table:', testError.message);
        console.error('');
        console.error('This likely means:');
        console.error('1. Migration 20260808000006 was NOT applied');
        console.error('2. OR migration 20260812030000 was NOT applied');
        console.error('3. OR table columns have different names');
        console.error('');
        console.error('🔧 Action required: Check Supabase Studio SQL Editor');
        console.error('   Run: \\d hc_clinical_orders');
        process.exit(1);
      }

      console.log('✅ All expected columns accessible via Supabase client');
      console.log('✅ Test query succeeded (no schema cache errors)');
      console.log('');
      if (testData && testData.length > 0) {
        console.log('📋 Sample row columns:', Object.keys(testData[0]));
      } else {
        console.log('ℹ️  Table exists but is empty (no rows yet)');
      }
      return;
    }

    if (!data || data.length === 0) {
      console.error('❌ Table hc_clinical_orders does not exist');
      process.exit(1);
    }

    console.log(`✅ Found ${data.length} columns:\n`);
    data.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`   ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}`);
    });

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

checkColumns();
