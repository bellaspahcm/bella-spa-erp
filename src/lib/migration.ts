import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import {
  getSupabasePublicKey,
  SUPABASE_PUBLIC_KEY_ENV_LABEL,
} from '@/lib/supabase-public-env';

const supabaseUrl = getSupabaseAdminUrl();
const supabaseKey = getSupabaseAdminKey() || getSupabasePublicKey();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY/${SUPABASE_PUBLIC_KEY_ENV_LABEL}).`,
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
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
