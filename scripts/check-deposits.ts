import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from('bookings')
    .select('booking_number, deposit_amount, full_price, created_at')
    .gte('created_at', '2026-06-01')
    .lt('created_at', '2026-07-01')
    .order('created_at');

  const real = data?.filter((b: any) => !b.booking_number.includes('DEMO')) || [];

  let totalDeposits = 0;
  console.log('\nDeposits received in June (excluding DEMO):\n');
  
  real.forEach((b: any) => {
    const dep = Number(b.deposit_amount || 0);
    totalDeposits += dep;
    console.log(`  ${b.booking_number}: ${dep.toLocaleString('vi-VN')}đ (${b.created_at?.substring(0, 10)})`);
  });

  console.log(`\nTotal Deposits: ${totalDeposits.toLocaleString('vi-VN')}đ`);
  console.log(`\nIs this 9,300,000? ${totalDeposits === 9300000 ? 'YES!' : 'No'}`);
}

main();
