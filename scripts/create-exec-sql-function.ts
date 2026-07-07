/**
 * Create exec_sql helper function in Supabase
 * This is required for the config migration script to work
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

async function main() {
  console.log('Creating exec_sql helper function...');
  
  const sql = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
`;

  // Use direct SQL execution via Supabase REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ sql_query: sql }),
  });

  if (response.status === 404) {
    // Function doesn't exist yet, use psql or SQL editor
    console.log('⚠️  exec_sql function does not exist. Creating via SQL...');
    console.log('');
    console.log('Please run this SQL in Supabase Dashboard SQL Editor:');
    console.log('');
    console.log(sql);
    console.log('');
    console.log('Then re-run: npm run config:migrate');
    process.exit(1);
  }

  if (!response.ok) {
    console.error('❌ Failed:', await response.text());
    process.exit(1);
  }

  console.log('✅ exec_sql function created successfully');
}

main().catch(console.error);
