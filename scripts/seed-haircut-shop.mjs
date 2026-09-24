import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HAIRCUT_TENANT_ID = '743d7f1e-403f-4817-aaf2-3b5acf540154';

async function run() {
  console.log('✂️ Starting Haircut Shop Demo Seed...\n');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', HAIRCUT_TENANT_ID)
    .single();

  if (!tenant) {
    console.error('❌ Haircut Shop tenant not found!');
    process.exit(1);
  }

  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})\n`);

  // 1. Packages (Services)
  const packages = [
    { name: 'Cắt tóc nam cơ bản', price: 60000, full_price: 60000, total_sessions: 1, status: 'active', tenant_id: HAIRCUT_TENANT_ID, module_key: 'beauty_spa' },
    { name: 'Cắt gội massage', price: 100000, full_price: 100000, total_sessions: 1, status: 'active', tenant_id: HAIRCUT_TENANT_ID, module_key: 'beauty_spa' },
    { name: 'Uốn tóc nam', price: 300000, full_price: 300000, total_sessions: 1, status: 'active', tenant_id: HAIRCUT_TENANT_ID, module_key: 'beauty_spa' },
    { name: 'Nhuộm tóc nam', price: 250000, full_price: 250000, total_sessions: 1, status: 'active', tenant_id: HAIRCUT_TENANT_ID, module_key: 'beauty_spa' },
  ];

  let insertedPackages = [];
  for (const pkg of packages) {
    const { data, error } = await supabase.from('packages').insert(pkg).select().single();
    if (error && error.code !== '23505') console.error('Package error:', error);
    if (data) insertedPackages.push(data);
  }
  if (insertedPackages.length === 0) {
    const { data } = await supabase.from('packages').select('*').eq('tenant_id', HAIRCUT_TENANT_ID);
    insertedPackages = data || [];
  }
  console.log(`✅ Ready ${insertedPackages.length} packages.`);

  // 2. Staff (Users)
  const staff = [
    { email: 'thosu1@haircut.test', full_name: 'Thợ Chính 1', role: 'ktv', tenant_id: HAIRCUT_TENANT_ID, status: 'active' },
    { email: 'thosu2@haircut.test', full_name: 'Thợ Chính 2', role: 'ktv', tenant_id: HAIRCUT_TENANT_ID, status: 'active' },
    { email: 'thophu1@haircut.test', full_name: 'Thợ Phụ 1', role: 'ktv', tenant_id: HAIRCUT_TENANT_ID, status: 'active' },
  ];
  let insertedStaff = [];
  for (const s of staff) {
    const { data, error } = await supabase.from('users').insert(s).select().single();
    if (error && error.code !== '23505') console.error('Staff error:', error);
    if (data) insertedStaff.push(data);
  }
  if (insertedStaff.length === 0) {
    const { data } = await supabase.from('users').select('*').eq('tenant_id', HAIRCUT_TENANT_ID).eq('role', 'ktv');
    insertedStaff = data || [];
  }
  console.log(`✅ Ready ${insertedStaff.length} staff.`);
  const workerIds = insertedStaff.map(s => s.id);

  // 3. Customers
  const customers = [];
  for (let i = 1; i <= 20; i++) {
    customers.push({
      phone: `090000${Math.floor(Math.random()*10000).toString().padStart(4, '0')}${i}`,
      name_mother: `Khách Hàng ${i}`,
      tenant_id: HAIRCUT_TENANT_ID,
      status: 'active'
    });
  }
  const { data: insertedCustomers, error: custErr } = await supabase.from('customers').insert(customers).select();
  if (custErr) console.error('Customer error:', custErr);
  console.log(`✅ Ready ${insertedCustomers?.length || 0} customers.`);

  if (!insertedCustomers || insertedCustomers.length === 0 || !insertedPackages || insertedPackages.length === 0 || workerIds.length === 0) {
    console.error('❌ Could not get customers, packages, or workers. Aborting bookings.');
    return;
  }

  // 4. Bookings
  const bookings = [];
  let bookingIndex = 1;
  const now = new Date();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  for (let i = 0; i < 50; i++) {
    const customer = insertedCustomers[Math.floor(Math.random() * insertedCustomers.length)];
    const pkg = insertedPackages[Math.floor(Math.random() * insertedPackages.length)];
    const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
    
    // Random date within the last 30 days
    const date = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
    
    bookings.push({
      booking_number: `HC-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}-${bookingIndex.toString().padStart(4, '0')}-${randomSuffix}`,
      customer_id: customer.id,
      package_name: pkg.name,
      status: 'completed',
      deposit_amount: 0,
      full_price: pkg.price,
      total_sessions: 1,
      completed_sessions: 1,
      assigned_ktv_id: workerId,
      tenant_id: HAIRCUT_TENANT_ID,
      ktv_commission: pkg.price * 0.2, // 20% commission
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      start_date: date.toISOString().split('T')[0]
    });
    bookingIndex++;
  }

  // Check if we already have bookings to avoid duplicating too much, or just insert
  const { data: insertedBookings, error: bookingErr } = await supabase.from('bookings').insert(bookings).select();
  if (bookingErr) console.error(bookingErr);
  console.log(`✅ Inserted ${insertedBookings?.length || 0} bookings.`);

  let bookingsToProcess = insertedBookings;
  if (!bookingsToProcess || bookingsToProcess.length === 0) {
    const { data } = await supabase.from('bookings').select('*').eq('tenant_id', HAIRCUT_TENANT_ID);
    bookingsToProcess = data || [];
  }

  // 5. Revenue
  const revenueRecords = bookingsToProcess.map(b => ({
    tenant_id: HAIRCUT_TENANT_ID,
    booking_id: b.id,
    amount: b.full_price,
    revenue_type: 'remaining_payment',
    payment_method: Math.random() > 0.5 ? 'cash' : 'bank_transfer',
    status: 'confirmed',
    received_date: b.start_date,
    business_event_type: 'SERVICE_PAYMENT',
  }));

  const { data: insertedRevenue, error: revErr } = await supabase.from('revenue').insert(revenueRecords).select();
  if (revErr) console.error(revErr);
  console.log(`✅ Inserted ${insertedRevenue?.length || 0} revenue records.`);

  // 6. Expenses
  const expenses = [];
  for (let i = 0; i < 10; i++) {
    const date = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
    expenses.push({
      tenant_id: HAIRCUT_TENANT_ID,
      expense_date: date.toISOString().split('T')[0],
      amount: 100000 + Math.floor(Math.random() * 500000),
      category: ['operating', 'marketing', 'supplies'][Math.floor(Math.random() * 3)],
      description: 'Chi phí hoạt động',
      status: 'approved',
    });
  }
  const { data: insertedExpenses, error: expErr } = await supabase.from('expenses').insert(expenses).select();
  if (expErr) console.error(expErr);
  console.log(`✅ Inserted ${insertedExpenses?.length || 0} expenses.`);

  console.log('\n🎉 Seeding completed for Haircut Shop!');
}

run().catch(console.error);
