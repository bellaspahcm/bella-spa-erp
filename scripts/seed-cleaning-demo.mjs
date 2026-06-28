#!/usr/bin/env node
/**
 * Industrial Cleaning Demo Tenant Seed Script
 * 
 * Creates a complete demo tenant for industrial cleaning business domain with:
 * - Tenant with industrial_cleaning module enabled
 * - Chart of Accounts (COA)
 * - Cleaning-specific packages
 * - Cleaning staff (workers)
 * - Business customers
 * - Work orders (bookings) + completed work sessions
 * - Salary records
 * - Revenue records
 * - Accounting outbox verification
 * 
 * Usage:
 *   node --env-file=.env.local scripts/seed-cleaning-demo.mjs
 * 
 * Marker: CLEANING_DEMO_TENANT
 * This marker is used by cleanup script to identify demo data.
 */

// Load environment variables from process.env (use --env-file flag)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  console.error('   Usage: node --env-file=.env.local scripts/seed-cleaning-demo.mjs');
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
    console.error(`❌ Error posting to ${table}:`, error);
    return null;
  }
  return await res.json();
}

async function fetchOne(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*&limit=1`, { headers });
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function run() {
  console.log('🧹 Starting Industrial Cleaning Demo Tenant Seed...\n');

  // 1. Create Cleaning Tenant with industrial_cleaning module enabled
  console.log('📋 Step 1: Creating tenant...');
  const tenantData = {
    name: 'CleanPro Industrial Services [DEMO]',
    status: 'active',
    enabled_modules: {
      babycare: false,
      beauty_spa: false,
      student_training: false,
      industrial_cleaning: true
    },
    brand_theme: {
      brandName: 'CleanPro',
      logoUrl: '',
      primaryColor: '#1E40AF',
      accentColor: '#3B82F6',
      portalDisplayName: 'CleanPro Services',
      invoiceDisplayName: 'CleanPro Industrial Cleaning',
      stylePreset: 'ocean_clean',
      radiusStyle: 'balanced',
      buttonStyle: 'rounded',
      menuStyle: 'compact'
    },
    metadata: { marker: 'CLEANING_DEMO_TENANT' }
  };

  let tenant = await post('tenants', tenantData);
  if (!tenant) {
    // Try fetching if already exists
    tenant = await fetchOne('tenants', 'name=eq.CleanPro%20Industrial%20Services%20%5BDEMO%5D');
  }
  
  if (!tenant) {
    console.error('❌ Failed to create tenant');
    process.exit(1);
  }

  const tid = tenant.id;
  console.log(`✅ Tenant created: ${tenant.name} (ID: ${tid})\n`);

  // 2. Create Cleaning Staff
  console.log('👷 Step 2: Creating cleaning staff...');
  const staff = [
    { 
      email: 'admin@cleanpro-demo.com', 
      full_name: 'Nguyễn Văn An', 
      role: 'admin', 
      tenant_id: tid,
      base_salary: 15000000
    },
    { 
      email: 'lead@cleanpro-demo.com', 
      full_name: 'Trần Minh Quân', 
      role: 'ktv_lead', 
      tenant_id: tid,
      base_salary: 10000000
    },
    { 
      email: 'accountant@cleanpro-demo.com', 
      full_name: 'Lê Thị Hương', 
      role: 'accountant', 
      tenant_id: tid,
      base_salary: 12000000
    },
    { 
      email: 'worker1@cleanpro-demo.com', 
      full_name: 'Phạm Văn Hùng', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7000000,
      hire_date: '2026-01-01'
    },
    { 
      email: 'worker2@cleanpro-demo.com', 
      full_name: 'Nguyễn Thị Mai', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7000000,
      hire_date: '2026-01-01'
    },
    { 
      email: 'worker3@cleanpro-demo.com', 
      full_name: 'Lê Văn Dũng', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7500000,
      hire_date: '2025-12-01'
    },
    { 
      email: 'worker4@cleanpro-demo.com', 
      full_name: 'Trần Thị Lan', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 8000000,
      hire_date: '2025-11-01'
    },
    { 
      email: 'worker5@cleanpro-demo.com', 
      full_name: 'Hoàng Văn Tú', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7000000,
      hire_date: '2026-02-01'
    },
  ];

  const insertedStaff = await post('users', staff);
  const workerIds = insertedStaff?.filter(u => u.role === 'ktv').map(u => u.id) || [];
  console.log(`✅ Created ${insertedStaff?.length || 0} staff members (${workerIds.length} workers)\n`);

  // 3. Create Business Customers
  console.log('🏢 Step 3: Creating business customers...');
  const customers = [
    {
      phone: '0901234567',
      name_mother: 'Công ty TNHH ABC Electronics',
      name_baby: 'Nhà máy sản xuất điện tử',
      address: 'KCN Tân Bình, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        business_type: 'manufacturing',
        facility_size: '2000m²',
        contact_person: 'Nguyễn Văn A'
      }
    },
    {
      phone: '0901234568',
      name_mother: 'Tập đoàn XYZ Logistics',
      name_baby: 'Kho bãi logistics',
      address: 'Quận 2, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        business_type: 'warehouse',
        facility_size: '5000m²',
        contact_person: 'Trần Thị B'
      }
    },
    {
      phone: '0901234569',
      name_mother: 'Văn phòng Luật DEF',
      name_baby: 'Văn phòng cao cấp',
      address: 'Quận 1, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        business_type: 'office',
        facility_size: '300m²',
        contact_person: 'Lê Văn C'
      }
    },
    {
      phone: '0901234570',
      name_mother: 'Nhà máy GHI Textile',
      name_baby: 'Nhà máy dệt may',
      address: 'Bình Dương',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        business_type: 'manufacturing',
        facility_size: '3500m²',
        contact_person: 'Phạm Thị D'
      }
    },
    {
      phone: '0901234571',
      name_mother: 'Bệnh viện Đa khoa JKL',
      name_baby: 'Cơ sở y tế',
      address: 'Quận 3, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        business_type: 'healthcare',
        facility_size: '1500m²',
        contact_person: 'BS. Nguyễn E'
      }
    },
    {
      phone: '0901234572',
      name_mother: 'Nhà hàng MNO Premium',
      name_baby: 'Nhà hàng cao cấp',
      address: 'Quận 7, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        business_type: 'food_service',
        facility_size: '800m²',
        contact_person: 'Vũ Văn F'
      }
    },
  ];

  const insertedCustomers = await post('customers', customers);
  console.log(`✅ Created ${insertedCustomers?.length || 0} business customers\n`);

  // 4. Fetch Cleaning Packages
  console.log('📦 Step 4: Fetching cleaning packages...');
  const packagesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/packages?module_key=eq.industrial_cleaning&select=*`,
    { headers }
  );
  const packages = await packagesRes.json();
  console.log(`✅ Found ${packages.length} cleaning packages\n`);

  if (packages.length === 0) {
    console.error('❌ No cleaning packages found. Run migration 20260622120000_seed_cleaning_packages.sql first.');
    process.exit(1);
  }

  // 5. Create Work Orders (Bookings)
  console.log('📋 Step 5: Creating work orders (bookings)...');
  const bookings = [];
  
  insertedCustomers.forEach((customer, i) => {
    const pkg = packages[i % packages.length];
    const startMonth = (i % 3) + 1; // Jan, Feb, Mar 2026
    
    bookings.push({
      booking_number: `WO-2026-${String(i + 1).padStart(4, '0')}`,
      customer_id: customer.id,
      package_name: pkg.name,
      status: i < 3 ? 'completed' : (i < 5 ? 'in_progress' : 'booked'),
      deposit_amount: pkg.price * 0.3, // 30% deposit
      full_price: pkg.price,
      start_date: `2026-0${startMonth}-01`,
      total_sessions: pkg.total_sessions,
      completed_sessions: i < 3 ? pkg.total_sessions : (i < 5 ? Math.floor(pkg.total_sessions / 2) : 0),
      assigned_ktv_id: workerIds[i % workerIds.length],
      tenant_id: tid,
      ktv_commission: 200000, // 200k per session for cleaning
      metadata: {
        contract_type: 'monthly',
        payment_terms: 'NET30'
      }
    });
  });

  const insertedBookings = await post('bookings', bookings);
  console.log(`✅ Created ${insertedBookings?.length || 0} work orders\n`);

  // 6. Create Session Logs (Completed Work)
  console.log('🔨 Step 6: Creating session logs (completed work)...');
  const sessions = [];
  
  insertedBookings.forEach((booking, bookingIdx) => {
    const completedCount = booking.completed_sessions || 0;
    const pkg = packages.find(p => p.name === booking.package_name);
    
    for (let sessionNum = 1; sessionNum <= completedCount; sessionNum++) {
      const dayOffset = (sessionNum - 1) * 2; // Every 2 days
      const completedDate = new Date(`2026-0${((bookingIdx % 3) + 1)}-01`);
      completedDate.setDate(completedDate.getDate() + dayOffset);
      
      sessions.push({
        booking_id: booking.id,
        session_number: sessionNum,
        status: 'completed',
        completed_by_ktv_id: booking.assigned_ktv_id,
        completed_date: completedDate.toISOString().split('T')[0],
        rating: [4.0, 4.5, 5.0][sessionNum % 3], // Mix of ratings
        notes: `Completed ${pkg?.name || 'cleaning'} session ${sessionNum}`,
        tenant_id: tid,
        metadata: {
          work_duration_minutes: pkg?.estimated_duration || 240,
          workers_count: pkg?.required_workers || 1
        }
      });
    }
  });

  if (sessions.length > 0) {
    await post('session_logs', sessions);
    console.log(`✅ Created ${sessions.length} session logs\n`);
  } else {
    console.log('⚠️  No completed sessions to log\n');
  }

  // 7. Create Revenue Records
  console.log('💰 Step 7: Creating revenue records...');
  const revenue = [];
  
  insertedBookings.forEach((booking, i) => {
    // Deposit
    revenue.push({
      booking_id: booking.id,
      amount: booking.deposit_amount,
      revenue_type: 'deposit',
      payment_method: 'bank_transfer',
      received_date: booking.start_date,
      status: 'confirmed',
      tenant_id: tid,
      notes: `Deposit for ${booking.booking_number}`
    });
    
    // Remaining payment for completed bookings
    if (booking.status === 'completed') {
      revenue.push({
        booking_id: booking.id,
        amount: booking.full_price - booking.deposit_amount,
        revenue_type: 'remaining_payment',
        payment_method: 'bank_transfer',
        received_date: `2026-0${((i % 3) + 1) + 1}-05`,
        status: 'confirmed',
        tenant_id: tid,
        notes: `Final payment for ${booking.booking_number}`
      });
    }
  });

  await post('revenue', revenue);
  console.log(`✅ Created ${revenue.length} revenue records\n`);

  // 8. Create Operating Expenses
  console.log('💸 Step 8: Creating operating expenses...');
  const expenses = [
    {
      category: 'Supplies',
      amount: 3500000,
      description: 'Mua hóa chất vệ sinh công nghiệp (tháng 1/2026)',
      expense_date: '2026-01-15',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Equipment',
      amount: 12000000,
      description: 'Mua máy hút bụi công nghiệp Karcher',
      expense_date: '2026-02-01',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Transport',
      amount: 2500000,
      description: 'Thuê xe vận chuyển thiết bị',
      expense_date: '2026-02-10',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Rent',
      amount: 8000000,
      description: 'Thuê kho chứa thiết bị và văn phòng',
      expense_date: '2026-02-01',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Utilities',
      amount: 1500000,
      description: 'Tiền điện nước tháng 2',
      expense_date: '2026-03-05',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Marketing',
      amount: 4000000,
      description: 'Quảng cáo Google Ads và Facebook',
      expense_date: '2026-03-10',
      status: 'approved',
      tenant_id: tid
    },
  ];

  await post('expenses', expenses);
  console.log(`✅ Created ${expenses.length} expense records\n`);

  // 9. Summary
  console.log('📊 Demo Tenant Summary:\n');
  console.log(`   Tenant: ${tenant.name}`);
  console.log(`   Module: industrial_cleaning ✅`);
  console.log(`   Staff: ${insertedStaff?.length || 0} (${workerIds.length} workers)`);
  console.log(`   Customers: ${insertedCustomers?.length || 0} businesses`);
  console.log(`   Packages: ${packages.length}`);
  console.log(`   Work Orders: ${insertedBookings?.length || 0}`);
  console.log(`   Completed Sessions: ${sessions.length}`);
  console.log(`   Revenue Records: ${revenue.length}`);
  console.log(`   Expenses: ${expenses.length}`);
  console.log(`\n✅ Industrial Cleaning Demo Tenant created successfully!\n`);
  console.log(`🔑 Login credentials:`);
  console.log(`   Admin: admin@cleanpro-demo.com`);
  console.log(`   Lead: lead@cleanpro-demo.com`);
  console.log(`   Worker: worker1@cleanpro-demo.com (and worker2-5)\n`);
  console.log(`⚠️  Note: Set passwords via Supabase Auth before login\n`);
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
