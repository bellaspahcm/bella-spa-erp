import fs from 'fs';
import path from 'path';

// Load env from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [key, ...value] = line.split('=');
      return [key.trim(), value.join('=').trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation,resolution=merge-duplicates'
};

async function post(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const error = await res.text();
    console.error('Error posting to %s:', table, error);
    return null;
  }
  return await res.json();
}

async function run() {
  console.log('Starting demo data population for 2026...');

  // 1. Get or Create Tenant
  let tenant = await post('tenants', { name: 'Bella Spa Headquarter', status: 'active' });
  if (!tenant) {
    // Try fetching if insert failed due to unique constraint
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tenants?name=eq.Bella%20Spa%20Headquarter&select=id`, { headers });
    tenant = await res.json();
  }
  const tid = Array.isArray(tenant) ? tenant[0].id : tenant.id;
  console.log('Tenant ID:', tid);

  // 2. Staff (Users)
  const staff = [
    { email: 'admin@bellaspa.com.vn', full_name: 'Nguyễn Phương Anh', role: 'admin', tenant_id: tid },
    { email: 'lead@bellaspa.com.vn', full_name: 'Trần Hồng Nhung', role: 'ktv_lead', tenant_id: tid },
    { email: 'ketoan@bellaspa.com.vn', full_name: 'Lê Thị Mai', role: 'accountant', tenant_id: tid },
    { email: 'ktv1@bellaspa.com.vn', full_name: 'Nguyễn Thị Hoa', role: 'ktv', tenant_id: tid },
    { email: 'ktv2@bellaspa.com.vn', full_name: 'Lê Thu Hà', role: 'ktv', tenant_id: tid },
    { email: 'ktv3@bellaspa.com.vn', full_name: 'Phạm Minh Tuyết', role: 'ktv', tenant_id: tid },
    { email: 'ktv4@bellaspa.com.vn', full_name: 'Trần Thị Thanh', role: 'ktv', tenant_id: tid },
    { email: 'ktv5@bellaspa.com.vn', full_name: 'Hoàng Ngọc Mai', role: 'ktv', tenant_id: tid },
  ];
  const insertedStaff = await post('users', staff);
  const ktvIds = insertedStaff?.filter(u => u.role === 'ktv').map(u => u.id) || [];
  console.log('Inserted staff members.');

  // 3. Customers (20)
  const customers = [];
  for (let i = 1; i <= 20; i++) {
    const namePrefixes = ['Nguyễn Thị', 'Trần Thu', 'Lê Diệu', 'Phạm Hải', 'Vũ Bích'];
    customers.push({
      phone: `09${String(i).padStart(8, '0')}`,
      name_mother: `${namePrefixes[i % 5]} ${i}`,
      name_baby: i < 15 ? `Bé ${i}` : 'Chưa sinh',
      address: `Quận ${ (i % 12) + 1 }, TP. Hồ Chí Minh`,
      dob_baby: i < 15 ? `2026-0${(i % 4) + 1}-10` : null,
      dob_expected: i >= 15 ? `2026-0${(i % 4) + 6}-15` : null,
      tenant_id: tid,
      status: 'active'
    });
  }
  const insertedCustomers = await post('customers', customers);
  console.log('Inserted 20 customers.');

  // 4. Bookings
  const bookings = insertedCustomers.map((c, i) => {
    let status = 'inquiry';
    if (i < 5) status = 'completed';
    else if (i < 15) status = 'in_progress';
    else if (i < 18) status = 'booked';

    return {
      booking_number: `BK-2026-${String(i+1).padStart(3, '0')}`,
      customer_id: c.id,
      status: status,
      deposit_amount: 2000000,
      full_price: 15000000 + (i * 100000),
      start_date: `2026-0${(i % 5) + 1}-01`,
      total_sessions: 15,
      completed_sessions: i < 5 ? 15 : (i < 15 ? (i % 10 + 1) : 0),
      assigned_ktv_id: ktvIds[i % ktvIds.length],
      tenant_id: tid
    };
  });
  const insertedBookings = await post('bookings', bookings);
  console.log('Inserted 20 bookings.');

  // 5. Revenue
  const revenue = [];
  insertedBookings.forEach((b, i) => {
    revenue.push({
      booking_id: b.id,
      amount: 2000000,
      revenue_type: 'deposit',
      payment_method: 'bank_transfer',
      received_date: `2026-0${(i % 3) + 1}-05`,
      status: 'confirmed',
      tenant_id: tid
    });
    if (i < 5) {
      revenue.push({
        booking_id: b.id,
        amount: 13000000 + (i * 100000),
        revenue_type: 'session_completed',
        payment_method: 'bank_transfer',
        received_date: '2026-04-30',
        status: 'confirmed',
        tenant_id: tid
      });
    }
  });
  await post('revenue', revenue);
  console.log('Inserted revenue records.');

  // 6. Expenses
  const expenses = [
    { category: 'Marketing', amount: 5000000, description: 'Chạy quảng cáo Facebook tháng 4/2026', expense_date: '2026-04-15', status: 'approved', tenant_id: tid },
    { category: 'Supplies', amount: 2500000, description: 'Mua tinh dầu và thảo dược xông hơ', expense_date: '2026-05-02', status: 'approved', tenant_id: tid },
    { category: 'Rent', amount: 15000000, description: 'Thuê mặt bằng văn phòng', expense_date: '2026-05-01', status: 'approved', tenant_id: tid },
    { category: 'Utilities', amount: 1200000, description: 'Tiền điện nước tháng 4', expense_date: '2026-05-05', status: 'approved', tenant_id: tid },
  ];
  await post('expenses', expenses);
  console.log('Inserted expense records.');

  // 7. Salary Records
  const salaries = ktvIds.map((id, i) => ({
    ktv_id: id,
    month_year: '2026-05-01',
    base_salary: 6000000,
    service_percentage_bonus: 3000000 + (i * 500000),
    kpi_bonus: 1000000,
    total_salary: 10000000 + (i * 500000),
    status: 'pending_approval',
    tenant_id: tid
  }));
  await post('salary_records', salaries);
  console.log('Inserted salary records.');

  // 8. Session Logs
  const sessionLogs = [];
  insertedBookings.slice(0, 15).forEach((b, i) => {
    sessionLogs.push({
      booking_id: b.id,
      session_number: 1,
      assigned_date: '2026-05-10',
      status: 'completed',
      completed_by_ktv_id: ktvIds[i % ktvIds.length],
      tenant_id: tid
    });
    sessionLogs.push({
      booking_id: b.id,
      session_number: 2,
      assigned_date: '2026-05-12',
      status: 'scheduled',
      completed_by_ktv_id: ktvIds[i % ktvIds.length],
      tenant_id: tid
    });
  });
  await post('session_logs', sessionLogs);
  console.log('Inserted session logs.');

  console.log('--- ALL DONE ---');
}

run().catch(console.error);
