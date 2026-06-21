import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n=== REVENUE TABLE - June 2026 ===\n');

  const { data } = await supabase
    .from('revenue')
    .select(`
      *,
      booking:bookings (
        booking_number
      )
    `)
    .gte('received_date', '2026-06-01')
    .lt('received_date', '2026-07-01')
    .eq('status', 'confirmed')
    .order('received_date');

  // Filter out demo
  const real = data?.filter((r: any) => {
    return !r.booking?.booking_number?.includes('DEMO');
  }) || [];

  console.log(`Found ${real.length} confirmed revenue records (excluding demo):\n`);

  let total = 0;

  real.forEach((r: any, idx: number) => {
    const amount = Number(r.amount || 0);
    total += amount;
    console.log(`${idx + 1}. ${r.received_date} - ${r.revenue_type}`);
    console.log(`   Booking: ${r.booking?.booking_number || 'N/A'}`);
    console.log(`   Amount: ${amount.toLocaleString('vi-VN')}đ`);
    console.log(`   Method: ${r.payment_method}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`TOTAL REVENUE (from revenue table): ${total.toLocaleString('vi-VN')}đ`);
  console.log(`Expected: 9.499.500đ`);
  console.log(`Match? ${total === 9499500 ? 'YES! ✅' : 'No'}`);
  console.log('='.repeat(80));
}

main();
