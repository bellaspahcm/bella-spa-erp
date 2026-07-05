#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkTable() {
  console.log('🔍 Checking if leave_requests table exists...\n');

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        query: `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'leave_requests'
          ) as table_exists;
        `
      }),
    }
  );

  if (response.ok) {
    const result = await response.json();
    console.log('Result:', result);
  } else {
    console.log('❌ RPC not available');
    console.log('\n📝 Please run this SQL in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(80));
    console.log(`
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'leave_requests'
) as table_exists;

-- If false, create table:
-- (Copy from supabase/migrations/20260705000000_temp_leave_requests_for_gate1.sql)
    `);
    console.log('='.repeat(80));
  }
}

checkTable().catch(console.error);
