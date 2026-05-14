import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('Running migration: adding preferred_time to bookings and assigned_time to session_logs...');
  
  const queries = [
    'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_time TEXT;',
    'ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS assigned_time TEXT;'
  ];

  for (const query of queries) {
    const { error } = await supabase.rpc('execute_sql', { sql: query });
    if (error) {
      console.error(`Migration query failed: ${query}`, error);
    } else {
      console.log(`Migration query successful: ${query}`);
    }
  }
}

runMigration();
