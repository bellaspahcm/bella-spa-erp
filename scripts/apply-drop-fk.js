require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🚀 Applying FK drop migration...\n');
  
  const sql = `
-- Drop FK constraint
ALTER TABLE public.hc_encounters
  DROP CONSTRAINT IF EXISTS hc_encounters_care_journey_id_fkey;

-- Update comment
COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide. NULLABLE since 2026-08-12. FK removed 2026-08-12.';
  `;
  
  try {
    // Execute directly via raw query
    const { data, error } = await client.rpc('exec_sql', { sql });
    
    if (error) {
      console.log('❌ exec_sql not available, trying direct execution...\n');
      
      // Try direct execution (Service Role Key should allow this)
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ sql }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      console.log('✅ Migration applied via direct API call!');
    } else {
      console.log('✅ Migration applied via RPC!');
      console.log('Result:', data);
    }
    
    // Verify FK dropped
    const { data: constraints } = await client
      .rpc('exec_sql', { 
        sql: `SELECT constraint_name FROM information_schema.table_constraints 
              WHERE table_name = 'hc_encounters' 
              AND constraint_name = 'hc_encounters_care_journey_id_fkey'`
      });
    
    console.log('\n🔍 Verification:');
    console.log('FK constraint exists:', constraints?.length > 0 ? '❌ YES (FAILED)' : '✅ NO (SUCCESS)');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
    console.log('\n⚠️  Manual application required.');
    console.log('\nSQL to run in Supabase SQL Editor:');
    console.log('========================================');
    console.log(sql);
    console.log('========================================');
  }
}

applyMigration();
