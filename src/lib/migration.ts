import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function runMigration() {
  console.log('Running migration: adding ktv_commission to bookings...');
  
  const { error } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ktv_commission INTEGER DEFAULT 150000;'
  });

  if (error) {
    console.error('Migration failed:', error);
    // If RPC fails (likely because execute_sql doesn't exist), try direct SQL if we have service role
    // But usually we don't have it in the env yet.
  } else {
    console.log('Migration successful!');
  }
}

runMigration();
