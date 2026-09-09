import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envTestPath = path.join(process.cwd(), '.env.test');
const envLocalPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260909000052_p42_daily_care_operations.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running 20260909000052_p42_daily_care_operations.sql...');
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error applying migration via exec_sql:', error.message);
    process.exit(1);
  }

  console.log('✅ P4.2 Migration applied successfully via exec_sql!');
}

run();
