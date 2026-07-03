import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('revenue')
  .select('received_date, amount, status')
  .eq('tenant_id', '0e66365b-42b0-420e-acca-f7d7692e125e')
  .eq('status', 'confirmed')
  .order('received_date', { ascending: false });

if (error) {
  console.error('Error:', error);
} else {
  console.log('Revenue dates:');
  data.forEach(r => console.log(`  ${r.received_date}: ${r.amount.toLocaleString()} VND`));
  console.log(`\nToday: ${new Date().toISOString().split('T')[0]}`);
  console.log(`30 days ago: ${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}`);
}
