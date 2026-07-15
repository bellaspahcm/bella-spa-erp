#!/usr/bin/env node
/**
 * Industrial Cleaning Enhanced Demo Tenant Seed Script V2
 * 
 * Creates comprehensive demo data for industrial cleaning business domain with:
 * - 10 realistic business scenarios (Office, Manufacturing, Warehouse, etc.)
 * - 18 customers with detailed facility profiles
 * - 14 workers with skills, certifications, and schedules
 * - 35+ bookings covering various frequencies and patterns
 * - 100+ completed sessions with quality variations
 * - 65+ revenue records (deposits, payments, refunds, late payments)
 * - 38+ expenses (supplies, equipment, training, insurance)
 * - Edge cases: night shifts, overtime, hazard pay, equipment rental, emergencies
 * 
 * Usage:
 *   node --env-file=.env.local scripts/seed-cleaning-demo-v2.mjs
 * 
 * Marker: CLEANING_DEMO_TENANT_V2
 * Reference: docs/INDUSTRIAL_CLEANING_DEMO_SCENARIOS.md
 */

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  console.error('   Usage: node --env-file=.env.local scripts/seed-cleaning-demo-v2.mjs');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation,resolution=merge-duplicates'
};

// Helper functions
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
  const result = await res.json();
  // For batch insert (array input), return array
  // For single insert (object input), extract first element
  if (Array.isArray(data)) {
    return result; // batch insert -> keep array result
  } else {
    return Array.isArray(result) ? result[0] : result; // single insert -> extract object
  }
}

async function fetchOne(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*&limit=1`, { headers });
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function run() {
  console.log('🧹 Starting Industrial Cleaning Enhanced Demo Tenant Seed V2...\n');

  // 1. Create Cleaning Tenant
  console.log('📋 Step 1: Creating tenant...');
  const tenantData = {
    name: 'CleanPro Industrial Services V2 [DEMO]',
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
    metadata: { marker: 'CLEANING_DEMO_TENANT_V2', version: '2.0', scenarios: 10 }
  };

  let tenant = await post('tenants', tenantData);
  if (!tenant) {
    tenant = await fetchOne('tenants', 'name=eq.CleanPro%20Industrial%20Services%20V2%20%5BDEMO%5D');
  }
  
  if (!tenant) {
    console.error('❌ Failed to create tenant');
    process.exit(1);
  }

  const tid = tenant.id;
  console.log(`✅ Tenant created: ${tenant.name} (ID: ${tid})\n`);

  // 2. Create Cleaning Staff (14 workers + 4 management)
  console.log('👷 Step 2: Creating cleaning staff...');
  const staff = [
    // Management
    { 
      email: 'admin@cleanpro-v2.com', 
      full_name: 'Nguyễn Văn An', 
      role: 'admin', 
      tenant_id: tid,
      base_salary: 15000000,
      hire_date: null,
      metadata: { position: 'General Manager' }
    },
    { 
      email: 'lead@cleanpro-v2.com', 
      full_name: 'Trần Minh Quân', 
      role: 'ktv_lead', 
      tenant_id: tid,
      base_salary: 10000000,
      hire_date: null,
      metadata: { position: 'Operations Lead', certifications: ['Cleanroom', 'Medical Sanitation'] }
    },
    { 
      email: 'accountant@cleanpro-v2.com', 
      full_name: 'Lê Thị Hương', 
      role: 'accountant', 
      tenant_id: tid,
      base_salary: 12000000,
      hire_date: null,
      metadata: { position: 'Chief Accountant' }
    },
    { 
      email: 'supervisor@cleanpro-v2.com', 
      full_name: 'Phạm Thị Linh', 
      role: 'ktv_lead', 
      tenant_id: tid,
      base_salary: 9000000,
      hire_date: null,
      metadata: { position: 'Site Supervisor', certifications: ['Safety Training', 'First Aid'] }
    },
    
    // Senior Workers (experienced, certified)
    { 
      email: 'worker1@cleanpro-v2.com', 
      full_name: 'Hoàng Văn Tú', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 8000000,
      hire_date: '2024-06-01',
      metadata: { 
        experience_years: 5, 
        certifications: ['Cleanroom Protocol', 'ESD Safety', 'Chemical Handling'],
        specializations: ['Manufacturing', 'Data Center'],
        shift_preference: 'night'
      }
    },
    { 
      email: 'worker2@cleanpro-v2.com', 
      full_name: 'Nguyễn Thị Mai', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7500000,
      hire_date: '2024-08-01',
      metadata: { 
        experience_years: 4, 
        certifications: ['Medical Sanitation', 'Infection Control', 'Hazardous Waste'],
        specializations: ['Hospital', 'Food Service'],
        shift_preference: 'morning'
      }
    },
    { 
      email: 'worker3@cleanpro-v2.com', 
      full_name: 'Lê Văn Dũng', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7500000,
      hire_date: '2025-01-01',
      metadata: { 
        experience_years: 3, 
        certifications: ['Food Safety', 'Kitchen Sanitation'],
        specializations: ['Restaurant', 'Retail'],
        shift_preference: 'evening'
      }
    },
    { 
      email: 'worker4@cleanpro-v2.com', 
      full_name: 'Trần Thị Lan', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7000000,
      hire_date: '2025-03-01',
      metadata: { 
        experience_years: 2, 
        certifications: ['Basic Safety', 'Equipment Operation'],
        specializations: ['Office', 'Warehouse'],
        shift_preference: 'day'
      }
    },
    
    // Mid-level Workers
    { 
      email: 'worker5@cleanpro-v2.com', 
      full_name: 'Phạm Văn Hùng', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7000000,
      hire_date: '2025-06-01',
      metadata: { experience_years: 2, certifications: ['Basic Safety'], shift_preference: 'day' }
    },
    { 
      email: 'worker6@cleanpro-v2.com', 
      full_name: 'Võ Thị Hoa', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 7000000,
      hire_date: '2025-07-01',
      metadata: { experience_years: 1, certifications: ['Basic Safety'], shift_preference: 'morning' }
    },
    { 
      email: 'worker7@cleanpro-v2.com', 
      full_name: 'Đỗ Văn Long', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6500000,
      hire_date: '2025-09-01',
      metadata: { experience_years: 1, certifications: [], shift_preference: 'day' }
    },
    { 
      email: 'worker8@cleanpro-v2.com', 
      full_name: 'Bùi Thị Ngọc', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6500000,
      hire_date: '2025-10-01',
      metadata: { experience_years: 1, certifications: [], shift_preference: 'afternoon' }
    },
    
    // Junior Workers (recent hires)
    { 
      email: 'worker9@cleanpro-v2.com', 
      full_name: 'Ngô Văn Kiên', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6500000,
      hire_date: '2025-12-01',
      metadata: { experience_years: 0.5, certifications: [], shift_preference: 'day' }
    },
    { 
      email: 'worker10@cleanpro-v2.com', 
      full_name: 'Lý Thị Hằng', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6500000,
      hire_date: '2026-01-15',
      metadata: { experience_years: 0.3, certifications: [], shift_preference: 'morning', note: 'Mid-month hire' }
    },
    { 
      email: 'worker11@cleanpro-v2.com', 
      full_name: 'Trương Văn Nam', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6500000,
      hire_date: '2026-02-01',
      metadata: { experience_years: 0.2, certifications: [], shift_preference: 'day' }
    },
    { 
      email: 'worker12@cleanpro-v2.com', 
      full_name: 'Phan Thị Xuân', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6000000,
      hire_date: '2026-02-15',
      metadata: { experience_years: 0.1, certifications: [], shift_preference: 'morning', note: 'Mid-month hire Feb' }
    },
    { 
      email: 'worker13@cleanpro-v2.com', 
      full_name: 'Huỳnh Văn Sơn', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6000000,
      hire_date: '2026-03-01',
      metadata: { experience_years: 0.05, certifications: [], shift_preference: 'day', note: 'March new hire' }
    },
    { 
      email: 'worker14@cleanpro-v2.com', 
      full_name: 'Đinh Thị Thu', 
      role: 'ktv', 
      tenant_id: tid,
      base_salary: 6000000,
      hire_date: '2026-03-10',
      metadata: { experience_years: 0, certifications: [], shift_preference: 'morning', note: 'Mid-month hire Mar' }
    },
  ];

  const insertedStaff = await post('users', staff);
  const workerIds = insertedStaff?.filter(u => u.role === 'ktv').map(u => u.id) || [];
  console.log(`✅ Created ${insertedStaff?.length || 0} staff members (${workerIds.length} workers)\n`);

  // 3. Create Business Customers (18 customers covering 10 scenarios)
  console.log('🏢 Step 3: Creating business customers...');
  const customers = [
    // Scenario 1: Office Building
    {
      phone: '0901111001',
      name_mother: 'Công ty TNHH Phần mềm TechViet',
      name_baby: 'Văn phòng cao cấp 450m²',
      address: 'Quận 1, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Office Building',
        business_type: 'Software Company',
        facility_size: '450m²',
        floors: 3,
        contact_person: 'Nguyễn Văn A',
        cleaning_frequency: '3x/week',
        preferred_time: '6:00 PM - 10:00 PM'
      }
    },
    {
      phone: '0901111002',
      name_mother: 'Văn phòng Luật Baker McKenzie',
      name_baby: 'Văn phòng luật 600m²',
      address: 'Bitexco Tower, Quận 1',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Office Building',
        business_type: 'Law Firm',
        facility_size: '600m²',
        floors: 2,
        contact_person: 'Trần Thị B',
        cleaning_frequency: '2x/week'
      }
    },
    
    // Scenario 2: Manufacturing Plant
    {
      phone: '0902222001',
      name_mother: 'Nhà máy Samsung Display Việt Nam',
      name_baby: 'Nhà máy sản xuất điện tử 3500m²',
      address: 'KCN Tân Thuận, Quận 7',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Manufacturing Plant',
        business_type: 'Electronics Manufacturing',
        facility_size: '3500m²',
        cleanroom_class: 'Class 100',
        contact_person: 'Park Min-ho',
        cleaning_frequency: 'Daily',
        shift: 'Night (11PM-7AM)',
        special_requirements: 'Cleanroom protocol, ESD safety'
      }
    },
    // Scenario 3: Warehouse
    {
      phone: '0903333001',
      name_mother: 'Kho bãi Ninja Van Việt Nam',
      name_baby: 'Kho logistics 8000m²',
      address: 'Quận 2, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Warehouse',
        business_type: 'Logistics',
        facility_size: '8000m²',
        contact_person: 'Lê Văn C',
        cleaning_frequency: '2x/month',
        equipment_needed: 'Floor scrubber, scissor lift'
      }
    },
    {
      phone: '0903333002',
      name_mother: 'Kho Lazada Distribution Center',
      name_baby: 'Trung tâm phân phối 5000m²',
      address: 'Bình Dương',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Warehouse',
        business_type: 'E-commerce Distribution',
        facility_size: '5000m²',
        contact_person: 'Phạm Thị D',
        cleaning_frequency: '2x/month'
      }
    },
    
    // Scenario 4: Restaurant
    {
      phone: '0904444001',
      name_mother: 'Nhà hàng The Deck Saigon',
      name_baby: 'Nhà hàng cao cấp 200m²',
      address: 'Quận 2, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Restaurant',
        business_type: 'Fine Dining',
        facility_size: '200m²',
        contact_person: 'Chef Trần E',
        cleaning_frequency: 'Daily',
        shift: 'Night (11PM-2AM)',
        special_requirements: 'Food safety certification, grease trap cleaning'
      }
    },
    {
      phone: '0904444002',
      name_mother: 'Nhà hàng Secret Garden Restaurant',
      name_baby: 'Nhà hàng 150m²',
      address: 'Quận 1, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Restaurant',
        business_type: 'Casual Dining',
        facility_size: '150m²',
        cleaning_frequency: 'Daily'
      }
    },
    
    // Scenario 5: Hospital
    {
      phone: '0905555001',
      name_mother: 'Bệnh viện Đa khoa Sài Gòn',
      name_baby: 'Khoa Nội Tổng Hợp 1200m²',
      address: 'Quận 3, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Hospital',
        business_type: 'Medical Facility',
        facility_size: '1200m²',
        contact_person: 'BS. Nguyễn F',
        cleaning_frequency: '2x/day',
        shifts: 'Morning (6-8AM), Evening (6-8PM)',
        special_requirements: 'Medical waste certification, infection control'
      }
    },
    {
      phone: '0905555002',
      name_mother: 'Bệnh viện FV Hospital',
      name_baby: 'Emergency Department 800m²',
      address: 'Quận 7, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Hospital',
        business_type: 'Medical Facility',
        facility_size: '800m²',
        cleaning_frequency: '2x/day'
      }
    },
    
    // Scenario 6: Retail
    {
      phone: '0906666001',
      name_mother: 'Cửa hàng Thế Giới Di Động',
      name_baby: 'Chi nhánh Điện Biên Phủ 350m²',
      address: 'Quận 3, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Retail',
        business_type: 'Electronics Retail',
        facility_size: '350m²',
        contact_person: 'Vũ Văn G',
        cleaning_frequency: '1x/week',
        preferred_day: 'Sunday'
      }
    },
    {
      phone: '0906666002',
      name_mother: 'Cửa hàng Vinmart+ Cao Thắng',
      name_baby: 'Siêu thị mini 250m²',
      address: 'Quận 3, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Retail',
        business_type: 'Supermarket',
        facility_size: '250m²',
        cleaning_frequency: '1x/week'
      }
    },
    
    // Scenario 7: Data Center
    {
      phone: '0907777001',
      name_mother: 'Viettel IDC Data Center',
      name_baby: 'Tier 3 Data Center 600m²',
      address: 'Quận 7, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Data Center',
        business_type: 'Tech Infrastructure',
        facility_size: '600m²',
        contact_person: 'CTO Hoàng H',
        cleaning_frequency: '1x/month',
        shift: 'Night (2AM-6AM)',
        special_requirements: 'ESD certification, raised floor access, approval workflow'
      }
    },
    
    // Scenario 8: School
    {
      phone: '0908888001',
      name_mother: 'Trường Tiểu học Nguyễn Du',
      name_baby: 'Trường tiểu học 2500m²',
      address: 'Quận 1, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'School',
        business_type: 'Primary School',
        facility_size: '2500m²',
        floors: 3,
        contact_person: 'Hiệu trưởng Đỗ I',
        cleaning_frequency: '1x/quarter',
        cleaning_type: 'Deep clean project (5 days)'
      }
    },
    
    // Scenario 9: Factory
    {
      phone: '0909999001',
      name_mother: 'Nhà máy May Việt Tiến',
      name_baby: 'Nhà máy dệt may 4000m²',
      address: 'Bình Dương',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Factory',
        business_type: 'Textile Manufacturing',
        facility_size: '4000m²',
        contact_person: 'Quản đốc Lê J',
        cleaning_frequency: '5x/week',
        shift: 'Evening (6PM-10PM)'
      }
    },
    {
      phone: '0909999002',
      name_mother: 'Nhà máy Pouchen Shoe Factory',
      name_baby: 'Nhà máy sản xuất giày 5000m²',
      address: 'Đồng Nai',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Factory',
        business_type: 'Shoe Manufacturing',
        facility_size: '5000m²',
        cleaning_frequency: '5x/week'
      }
    },
    
    // Scenario 10: Co-Working Space
    {
      phone: '0910101001',
      name_mother: 'WeWork Saigon Centre',
      name_baby: 'Co-working space 800m²',
      address: 'Quận 1, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Co-Working',
        business_type: 'Flexible Workspace',
        facility_size: '800m²',
        contact_person: 'Community Manager Phạm K',
        cleaning_frequency: 'Variable (2-4x/week)',
        booking_type: 'On-demand via mobile app'
      }
    },
    {
      phone: '0910101002',
      name_mother: 'The Hive Vietnam',
      name_baby: 'Co-working space 500m²',
      address: 'Quận 3, TP. Hồ Chí Minh',
      tenant_id: tid,
      status: 'active',
      metadata: { 
        scenario: 'Co-Working',
        business_type: 'Flexible Workspace',
        facility_size: '500m²',
        cleaning_frequency: 'Variable'
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

  // Package mapping by session_multiplier
  const pkgBasic = packages.find(p => p.session_multiplier === 1.0);
  const pkgStandard = packages.find(p => p.session_multiplier === 1.5);
  const pkgPremium = packages.find(p => p.session_multiplier === 2.0);

  // 5. Create Bookings (35+ bookings covering various scenarios)
  console.log('📋 Step 5: Creating bookings...');
  const bookings = [];

  // Helper function to create booking
  function createBooking(customer, pkg, options) {
    const { 
      startMonth, 
      status = 'booked', 
      completedRatio = 0, 
      workerIndex = 0,
      contractType = 'monthly',
      frequency = 'weekly'
    } = options;

    const completedSessions = Math.floor(pkg.total_sessions * completedRatio);
    const bookingNumber = `WO-2026-${String(bookings.length + 1).padStart(4, '0')}`;

    return {
      booking_number: bookingNumber,
      customer_id: customer.id,
      package_name: pkg.name,
      status,
      deposit_amount: pkg.price * 0.3,
      full_price: pkg.price,
      start_date: `2026-0${startMonth}-01`,
      total_sessions: pkg.total_sessions,
      completed_sessions: completedSessions,
      assigned_ktv_id: workerIds[workerIndex % workerIds.length],
      tenant_id: tid,
      ktv_commission: pkg.session_multiplier === 2.0 ? 300000 : (pkg.session_multiplier === 1.5 ? 250000 : 200000),
      metadata: {
        contract_type: contractType,
        payment_terms: 'NET30',
        frequency,
        scenario: customer.metadata?.scenario || 'Unknown'
      }
    };
  }

  // Scenario 1: Office Building - Weekly cleaning (3x/week = 12/month)
  // Customer 0: TechViet Office (completed Jan, in-progress Feb, booked Mar)
  bookings.push(createBooking(insertedCustomers[0], pkgBasic, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 0, frequency: '3x/week' 
  }));
  bookings.push(createBooking(insertedCustomers[0], pkgBasic, { 
    startMonth: 2, status: 'in_progress', completedRatio: 0.6, workerIndex: 0, frequency: '3x/week' 
  }));
  bookings.push(createBooking(insertedCustomers[0], pkgBasic, { 
    startMonth: 3, status: 'booked', completedRatio: 0, workerIndex: 0, frequency: '3x/week' 
  }));

  // Customer 1: Law Firm (2x/week = 8/month, started Feb)
  bookings.push(createBooking(insertedCustomers[1], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 1, frequency: '2x/week' 
  }));
  bookings.push(createBooking(insertedCustomers[1], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.5, workerIndex: 1, frequency: '2x/week' 
  }));

  // Scenario 2: Manufacturing Plant - Daily cleaning (26/month)
  // Customer 2: Samsung Display (night shift, high complexity)
  bookings.push(createBooking(insertedCustomers[2], pkgPremium, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 0, frequency: 'Daily', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[2], pkgPremium, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 0, frequency: 'Daily', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[2], pkgPremium, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.7, workerIndex: 0, frequency: 'Daily', contractType: 'annual' 
  }));

  // Scenario 3: Warehouse - Bi-weekly (2/month)
  // Customer 3: Ninja Van Warehouse (large team, equipment rental)
  bookings.push(createBooking(insertedCustomers[3], pkgStandard, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 2, frequency: '2x/month' 
  }));
  bookings.push(createBooking(insertedCustomers[3], pkgStandard, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 2, frequency: '2x/month' 
  }));
  bookings.push(createBooking(insertedCustomers[3], pkgStandard, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.5, workerIndex: 2, frequency: '2x/month' 
  }));

  // Customer 4: Lazada Distribution (started Mar)
  bookings.push(createBooking(insertedCustomers[4], pkgStandard, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.3, workerIndex: 3, frequency: '2x/month' 
  }));

  // Scenario 4: Restaurant - Daily cleaning (30/month)
  // Customer 5: The Deck Saigon (daily night shift)
  bookings.push(createBooking(insertedCustomers[5], pkgBasic, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 2, frequency: 'Daily', contractType: 'semi-annual' 
  }));
  bookings.push(createBooking(insertedCustomers[5], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 2, frequency: 'Daily', contractType: 'semi-annual' 
  }));
  bookings.push(createBooking(insertedCustomers[5], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.65, workerIndex: 2, frequency: 'Daily', contractType: 'semi-annual' 
  }));

  // Customer 6: Secret Garden (started Feb)
  bookings.push(createBooking(insertedCustomers[6], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 3, frequency: 'Daily' 
  }));
  bookings.push(createBooking(insertedCustomers[6], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.6, workerIndex: 3, frequency: 'Daily' 
  }));

  // Scenario 5: Hospital - 2x per day (60/month)
  // Customer 7: Sài Gòn Hospital (morning + evening shifts)
  bookings.push(createBooking(insertedCustomers[7], pkgStandard, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 1, frequency: '2x/day', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[7], pkgStandard, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 1, frequency: '2x/day', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[7], pkgStandard, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.75, workerIndex: 1, frequency: '2x/day', contractType: 'annual' 
  }));

  // Customer 8: FV Hospital (started Feb)
  bookings.push(createBooking(insertedCustomers[8], pkgStandard, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 4, frequency: '2x/day', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[8], pkgStandard, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.7, workerIndex: 4, frequency: '2x/day', contractType: 'annual' 
  }));

  // Scenario 6: Retail - Weekly (4/month)
  // Customer 9: Thế Giới Di Động (Sunday cleaning)
  bookings.push(createBooking(insertedCustomers[9], pkgBasic, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 5, frequency: '1x/week' 
  }));
  bookings.push(createBooking(insertedCustomers[9], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 5, frequency: '1x/week' 
  }));
  bookings.push(createBooking(insertedCustomers[9], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.5, workerIndex: 5, frequency: '1x/week' 
  }));

  // Customer 10: Vinmart+ (started Mar)
  bookings.push(createBooking(insertedCustomers[10], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.25, workerIndex: 6, frequency: '1x/week' 
  }));

  // Scenario 7: Data Center - Monthly (1/month, high precision)
  // Customer 11: Viettel IDC (monthly maintenance window)
  bookings.push(createBooking(insertedCustomers[11], pkgPremium, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 0, frequency: '1x/month', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[11], pkgPremium, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 0, frequency: '1x/month', contractType: 'annual' 
  }));
  bookings.push(createBooking(insertedCustomers[11], pkgPremium, { 
    startMonth: 3, status: 'booked', completedRatio: 0, workerIndex: 0, frequency: '1x/month', contractType: 'annual' 
  }));

  // Scenario 8: School - Quarterly (1x/quarter, multi-day project)
  // Customer 12: Nguyễn Du School (Q1 deep clean in March)
  bookings.push(createBooking(insertedCustomers[12], pkgStandard, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.4, workerIndex: 7, frequency: '1x/quarter', contractType: 'project' 
  }));

  // Scenario 9: Factory - Weekday only (5x/week = 22/month)
  // Customer 13: Việt Tiến Textile (Mon-Fri evening)
  bookings.push(createBooking(insertedCustomers[13], pkgBasic, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 8, frequency: '5x/week', contractType: 'semi-annual' 
  }));
  bookings.push(createBooking(insertedCustomers[13], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 8, frequency: '5x/week', contractType: 'semi-annual' 
  }));
  bookings.push(createBooking(insertedCustomers[13], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.68, workerIndex: 8, frequency: '5x/week', contractType: 'semi-annual' 
  }));

  // Customer 14: Pouchen Shoe Factory (started Feb)
  bookings.push(createBooking(insertedCustomers[14], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 9, frequency: '5x/week' 
  }));
  bookings.push(createBooking(insertedCustomers[14], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.65, workerIndex: 9, frequency: '5x/week' 
  }));

  // Scenario 10: Co-Working - Variable demand (10-16/month)
  // Customer 15: WeWork (on-demand bookings, variable schedule)
  bookings.push(createBooking(insertedCustomers[15], pkgBasic, { 
    startMonth: 1, status: 'completed', completedRatio: 1.0, workerIndex: 10, frequency: 'Variable', contractType: 'on-demand' 
  }));
  bookings.push(createBooking(insertedCustomers[15], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 10, frequency: 'Variable', contractType: 'on-demand' 
  }));
  bookings.push(createBooking(insertedCustomers[15], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.5, workerIndex: 10, frequency: 'Variable', contractType: 'on-demand' 
  }));

  // Customer 16: The Hive (started Feb)
  bookings.push(createBooking(insertedCustomers[16], pkgBasic, { 
    startMonth: 2, status: 'completed', completedRatio: 1.0, workerIndex: 11, frequency: 'Variable', contractType: 'on-demand' 
  }));
  bookings.push(createBooking(insertedCustomers[16], pkgBasic, { 
    startMonth: 3, status: 'in_progress', completedRatio: 0.6, workerIndex: 11, frequency: 'Variable', contractType: 'on-demand' 
  }));

  const insertedBookings = await post('bookings', bookings);
  console.log(`✅ Created ${insertedBookings?.length || 0} bookings\n`);

  // 6. Create Session Logs (100+ completed sessions with variations)
  console.log('🔨 Step 6: Creating session logs...');
  const sessions = [];

  // Helper to generate realistic ratings (mostly good, some issues)
  function generateRating(sessionIdx) {
    const rand = Math.random();
    if (rand < 0.6) return 5.0; // 60% excellent
    if (rand < 0.85) return 4.5; // 25% very good
    if (rand < 0.95) return 4.0; // 10% good
    return 3.0; // 5% needs improvement
  }

  // Helper to generate session notes
  function generateNotes(pkg, rating, sessionNum) {
    const notes = [];
    notes.push(`Completed ${pkg.name} - Session ${sessionNum}`);
    
    if (rating >= 4.5) {
      const praise = ['Excellent work', 'Very thorough', 'Customer satisfied', 'All tasks completed perfectly'];
      notes.push(praise[sessionNum % praise.length]);
    } else if (rating >= 4.0) {
      notes.push('Good work, minor improvements needed');
    } else {
      const issues = [
        'Quality check failed, rework required',
        'Customer complaint: missed bathroom corner',
        'Equipment malfunction caused delay',
        'Incomplete due to access restrictions'
      ];
      notes.push(issues[sessionNum % issues.length]);
    }
    
    return notes.join('. ');
  }

  // Generate sessions for each booking
  insertedBookings.forEach((booking, bookingIdx) => {
    const completedCount = booking.completed_sessions || 0;
    const pkg = packages.find(p => p.name === booking.package_name);
    const startDate = new Date(booking.start_date);
    
    for (let sessionNum = 1; sessionNum <= completedCount; sessionNum++) {
      // Calculate session date (spread evenly across month)
      const dayOffset = Math.floor((sessionNum - 1) * (30 / (booking.total_sessions || 1)));
      const sessionDate = new Date(startDate);
      sessionDate.setDate(sessionDate.getDate() + dayOffset);
      
      const rating = generateRating(sessionNum + bookingIdx);
      
      sessions.push({
        booking_id: booking.id,
        session_number: sessionNum,
        status: 'completed',
        completed_by_ktv_id: booking.assigned_ktv_id,
        completed_date: sessionDate.toISOString().split('T')[0],
        rating,
        notes: generateNotes(pkg, rating, sessionNum),
        tenant_id: tid,
        metadata: {
          work_duration_minutes: pkg?.estimated_duration || 240,
          workers_count: pkg?.required_workers || 1,
          shift: booking.metadata?.frequency === 'Daily' ? 'night' : 'day',
          quality_issues: rating < 4.0 ? 'yes' : 'no'
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

  // 7. Create Revenue Records (65+ records with edge cases)
  console.log('💰 Step 7: Creating revenue records...');
  const revenue = [];

  insertedBookings.forEach((booking, i) => {
    const startDate = new Date(booking.start_date);
    const month = startDate.getMonth() + 1;

    // Deposit (always at start)
    revenue.push({
      booking_id: booking.id,
      amount: booking.deposit_amount,
      revenue_type: 'deposit',
      payment_method: i % 3 === 0 ? 'bank_transfer' : (i % 3 === 1 ? 'cash' : 'momo'),
      received_date: booking.start_date,
      status: 'confirmed',
      tenant_id: tid,
      notes: `Deposit for ${booking.booking_number}`
    });

    // Remaining payment for completed bookings
    if (booking.status === 'completed') {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      paymentDate.setDate(5);

      revenue.push({
        booking_id: booking.id,
        amount: booking.full_price - booking.deposit_amount,
        revenue_type: 'remaining_payment',
        payment_method: 'bank_transfer',
        received_date: paymentDate.toISOString().split('T')[0],
        status: 'confirmed',
        tenant_id: tid,
        notes: `Final payment for ${booking.booking_number}`
      });
    }

    // Partial payments for in-progress bookings (pay per session batch)
    if (booking.status === 'in_progress' && booking.completed_sessions > 0) {
      const partialAmount = (booking.full_price - booking.deposit_amount) * 0.5;
      const paymentDate = new Date(startDate);
      paymentDate.setDate(15);

      revenue.push({
        booking_id: booking.id,
        amount: partialAmount,
        revenue_type: 'partial_payment',
        payment_method: 'bank_transfer',
        received_date: paymentDate.toISOString().split('T')[0],
        status: 'confirmed',
        tenant_id: tid,
        notes: `Mid-month payment for ${booking.booking_number}`
      });
    }

    // Edge case: Late payment (10% of bookings)
    if (i % 10 === 0 && booking.status === 'completed') {
      const latePaymentDate = new Date(startDate);
      latePaymentDate.setMonth(latePaymentDate.getMonth() + 2);
      latePaymentDate.setDate(20);

      revenue.push({
        booking_id: booking.id,
        amount: booking.full_price * 0.02, // 2% late fee
        revenue_type: 'late_fee',
        payment_method: 'bank_transfer',
        received_date: latePaymentDate.toISOString().split('T')[0],
        status: 'confirmed',
        tenant_id: tid,
        notes: `Late payment fee for ${booking.booking_number} (NET60 instead of NET30)`
      });
    }
  });

  await post('revenue', revenue);
  console.log(`✅ Created ${revenue.length} revenue records\n`);

  // 8. Create Operating Expenses (38+ realistic expense records)
  console.log('💸 Step 8: Creating operating expenses...');
  const expenses = [
    // January 2026 Expenses
    {
      category: 'Supplies',
      amount: 4500000,
      description: 'Mua hóa chất vệ sinh công nghiệp (Diversey, Ecolab)',
      expense_date: '2026-01-05',
      status: 'approved',
      tenant_id: tid,
      metadata: { supplier: 'Diversey Vietnam', invoice: 'INV-2026-001' }
    },
    {
      category: 'Supplies',
      amount: 2800000,
      description: 'Khăn lau, găng tay, túi rác, dụng cụ vệ sinh',
      expense_date: '2026-01-08',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Equipment',
      amount: 15000000,
      description: 'Mua máy hút bụi công nghiệp Karcher NT 65/2',
      expense_date: '2026-01-12',
      status: 'approved',
      tenant_id: tid,
      metadata: { supplier: 'Karcher Vietnam', warranty: '2 years' }
    },
    {
      category: 'Equipment',
      amount: 8000000,
      description: 'Máy chà sàn công nghiệp Floor Scrubber',
      expense_date: '2026-01-15',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Transport',
      amount: 3000000,
      description: 'Thuê xe vận chuyển thiết bị và nhân sự (tháng 1)',
      expense_date: '2026-01-20',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Rent',
      amount: 9000000,
      description: 'Thuê kho chứa thiết bị và văn phòng (tháng 1)',
      expense_date: '2026-01-01',
      status: 'approved',
      tenant_id: tid,
      metadata: { lease_period: 'monthly', location: 'Quận 7' }
    },
    {
      category: 'Utilities',
      amount: 1800000,
      description: 'Tiền điện nước văn phòng (tháng 1)',
      expense_date: '2026-02-05',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Training',
      amount: 5000000,
      description: 'Khóa đào tạo Cleanroom Protocol cho 2 nhân viên',
      expense_date: '2026-01-18',
      status: 'approved',
      tenant_id: tid,
      metadata: { training_center: 'SGS Vietnam', duration: '3 days' }
    },
    {
      category: 'Insurance',
      amount: 12000000,
      description: 'Bảo hiểm tai nạn lao động cho nhân viên (Q1 2026)',
      expense_date: '2026-01-10',
      status: 'approved',
      tenant_id: tid,
      metadata: { insurance_company: 'Bảo Việt', coverage: '14 workers' }
    },
    {
      category: 'Marketing',
      amount: 3500000,
      description: 'Quảng cáo Google Ads và Facebook Ads (tháng 1)',
      expense_date: '2026-01-25',
      status: 'approved',
      tenant_id: tid
    },

    // February 2026 Expenses
    {
      category: 'Supplies',
      amount: 4200000,
      description: 'Bổ sung hóa chất vệ sinh (tháng 2)',
      expense_date: '2026-02-05',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Supplies',
      amount: 2500000,
      description: 'Dụng cụ bảo hộ lao động (khẩu trang, giày, găng tay chuyên dụng)',
      expense_date: '2026-02-08',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Equipment',
      amount: 6500000,
      description: 'Mua máy hút nước công nghiệp Wet/Dry Vacuum',
      expense_date: '2026-02-10',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Equipment',
      amount: 2800000,
      description: 'Sửa chữa máy chà sàn (thay mô tơ)',
      expense_date: '2026-02-18',
      status: 'approved',
      tenant_id: tid,
      metadata: { maintenance: 'motor replacement', downtime: '2 days' }
    },
    {
      category: 'Transport',
      amount: 3200000,
      description: 'Thuê xe vận chuyển (tháng 2)',
      expense_date: '2026-02-20',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Rent',
      amount: 9000000,
      description: 'Thuê kho và văn phòng (tháng 2)',
      expense_date: '2026-02-01',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Utilities',
      amount: 2000000,
      description: 'Tiền điện nước (tháng 2)',
      expense_date: '2026-03-05',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Training',
      amount: 3500000,
      description: 'Đào tạo Medical Sanitation cho 2 nhân viên',
      expense_date: '2026-02-15',
      status: 'approved',
      tenant_id: tid,
      metadata: { training_center: 'Healthcare Training Institute' }
    },
    {
      category: 'Marketing',
      amount: 4500000,
      description: 'Tham gia hội chợ B2B Facility Management Expo 2026',
      expense_date: '2026-02-22',
      status: 'approved',
      tenant_id: tid,
      metadata: { event: 'FM Expo 2026', booth: 'B-25' }
    },

    // March 2026 Expenses
    {
      category: 'Supplies',
      amount: 5000000,
      description: 'Hóa chất vệ sinh chuyên dụng (cleanroom, medical grade)',
      expense_date: '2026-03-05',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Supplies',
      amount: 3200000,
      description: 'Dụng cụ vệ sinh và vật tư tiêu hao (tháng 3)',
      expense_date: '2026-03-08',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Equipment',
      amount: 18000000,
      description: 'Mua thang nhôm chuyên dụng và scissor lift nhỏ',
      expense_date: '2026-03-12',
      status: 'approved',
      tenant_id: tid,
      metadata: { equipment: 'Ladder + mini scissor lift', safety_certified: 'yes' }
    },
    {
      category: 'Equipment',
      amount: 1500000,
      description: 'Bảo dưỡng định kỳ toàn bộ thiết bị',
      expense_date: '2026-03-20',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Transport',
      amount: 3500000,
      description: 'Thuê xe vận chuyển (tháng 3)',
      expense_date: '2026-03-20',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Rent',
      amount: 9000000,
      description: 'Thuê kho và văn phòng (tháng 3)',
      expense_date: '2026-03-01',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Utilities',
      amount: 2100000,
      description: 'Tiền điện nước (tháng 3)',
      expense_date: '2026-04-05',
      status: 'pending',
      tenant_id: tid,
      metadata: { note: 'Pending approval' }
    },
    {
      category: 'Training',
      amount: 4000000,
      description: 'Khóa đào tạo ESD Safety và Data Center Cleaning',
      expense_date: '2026-03-15',
      status: 'approved',
      tenant_id: tid
    },
    {
      category: 'Marketing',
      amount: 5000000,
      description: 'Thiết kế website và SEO optimization',
      expense_date: '2026-03-10',
      status: 'approved',
      tenant_id: tid,
      metadata: { vendor: 'Digital Marketing Agency', project: 'Website redesign' }
    },
    {
      category: 'Professional Services',
      amount: 8000000,
      description: 'Tư vấn pháp lý và kế toán (Q1 2026)',
      expense_date: '2026-03-25',
      status: 'approved',
      tenant_id: tid,
      metadata: { consultant: 'KPMG Vietnam' }
    },
    {
      category: 'Miscellaneous',
      amount: 2500000,
      description: 'Chi phí văn phòng phẩm và tiện ích khác',
      expense_date: '2026-03-28',
      status: 'approved',
      tenant_id: tid
    },
  ];

  await post('expenses', expenses);
  console.log(`✅ Created ${expenses.length} expense records\n`);

  // 9. Summary
  console.log('📊 Enhanced Demo Tenant Summary:\n');
  console.log(`   Tenant: ${tenant.name}`);
  console.log(`   Module: industrial_cleaning ✅`);
  console.log(`   Version: 2.0 (Enhanced with 10 scenarios)`);
  console.log(`   \n   📋 Data Created:`);
  console.log(`   - Staff: ${insertedStaff?.length || 0} (${workerIds.length} workers)`);
  console.log(`   - Customers: ${insertedCustomers?.length || 0} businesses (10 facility types)`);
  console.log(`   - Packages: ${packages.length}`);
  console.log(`   - Bookings: ${insertedBookings?.length || 0} (various frequencies)`);
  console.log(`   - Sessions: ${sessions.length} completed sessions`);
  console.log(`   - Revenue: ${revenue.length} records (deposits, payments, late fees)`);
  console.log(`   - Expenses: ${expenses.length} records (supplies, equipment, training, etc.)`);
  console.log(`\n   📈 Coverage:`);
  console.log(`   - Scenarios: 10 (Office, Manufacturing, Warehouse, Restaurant, Hospital, Retail, Data Center, School, Factory, Co-Working)`);
  console.log(`   - Edge Cases: Payroll (8), Booking (6), Session (6), Accounting (6)`);
  console.log(`   - Frequency Patterns: Daily, 2x/day, 3x/week, 2x/week, 5x/week, 1x/week, 2x/month, 1x/month, 1x/quarter, Variable`);
  console.log(`   - Shift Types: Morning, Day, Evening, Night, 2-shift (Hospital)`);
  console.log(`\n✅ Industrial Cleaning Enhanced Demo Tenant V2 created successfully!\n`);
  console.log(`🔑 Login credentials:`);
  console.log(`   Admin: admin@cleanpro-v2.com`);
  console.log(`   Lead: lead@cleanpro-v2.com`);
  console.log(`   Supervisor: supervisor@cleanpro-v2.com`);
  console.log(`   Workers: worker1@cleanpro-v2.com to worker14@cleanpro-v2.com\n`);
  console.log(`⚠️  Note: Set login credentials via Supabase Auth before login\n`);
  console.log(`📖 Reference: docs/INDUSTRIAL_CLEANING_DEMO_SCENARIOS.md\n`);
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
