/**
 * E6 — R4 Direct Migration
 * Apply unique index directly via SQL query
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
});

async function applyConstraint() {
  console.log('📝 Creating unique index...');
  
  // Create unique index
  const sql = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_unique
    ON logistics_warehouse_receipts (tenant_id, po_number, vendor_id, received_date)
    WHERE deleted_at IS NULL;
  `;
  
  // Execute via raw SQL (bypassing RPC)
  // For Supabase, we'll try postgREST query
  try {
    // Method 1: Try via direct SQL if available
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    
    console.log('✅ Index creation attempted');
    console.log('⚠️  Verification needed - check via test');
    
  } catch (error) {
    console.log('⚠️  Direct SQL execution not available');
    console.log('📋 Manual steps required:');
    console.log('1. Open Supabase SQL Editor');
    console.log('2. Execute:');
    console.log(sql);
  }
}

applyConstraint();
