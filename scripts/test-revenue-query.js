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

const tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';
const startDate = '2026-06-02';
const endDate = '2026-07-03';

console.log('Testing revenue query:');
console.log(`  Tenant: ${tenantId}`);
console.log(`  Period: ${startDate} → ${endDate}\n`);

const { data, error } = await supabase
  .from('revenue')
  .select('amount, status, revenue_type, received_date, payment_method')
  .eq('tenant_id', tenantId)
  .gte('received_date', startDate)
  .lte('received_date', endDate);

if (error) {
  console.error('❌ Query error:', error);
} else {
  console.log(`✅ Found ${data.length} revenue records\n`);
  
  const confirmed = data.filter(r => r.status === 'confirmed');
  console.log(`Confirmed: ${confirmed.length} records`);
  
  const total = confirmed.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  console.log(`Total revenue: ${total.toLocaleString('vi-VN')} VND\n`);
  
  console.log('Records:');
  data.forEach(r => {
    console.log(`  ${r.received_date} | ${r.status.padEnd(10)} | ${String(r.amount).padStart(10)} | ${r.revenue_type}`);
  });
}
