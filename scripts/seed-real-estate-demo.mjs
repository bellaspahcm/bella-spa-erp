#!/usr/bin/env node
/**
 * Real Estate Demo Tenant Seed Script
 * 
 * Creates a complete demo tenant for the Real Estate business domain:
 * - Tenant with 'real_estate' module enabled
 * - Projects ('Vinhomes Green Paradise')
 * - Products/Units with statuses matching the EIP UI Mockup
 * 
 * Usage:
 *   node --env-file=.env.local scripts/seed-real-estate-demo.mjs
 * 
 * Marker: REAL_ESTATE_DEMO_MARKER
 * This marker is used by cleanup script to identify demo data.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  console.error('   Usage: node --env-file=.env.local scripts/seed-real-estate-demo.mjs');
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
  console.log('🏢 Starting Real Estate Demo Tenant Seed...\n');

  // 1. Create Tenant with 'real_estate' enabled
  console.log('📋 Step 1: Creating tenant...');
  const tenantData = {
    name: 'Bella Real Estate Development [DEMO]',
    status: 'active',
    enabled_modules: ['real_estate'],
    brand_theme: {
      brandName: 'Bella Land',
      logoUrl: '',
      primaryColor: '#1e3a8a',
      accentColor: '#d97706',
      portalDisplayName: 'Bella Land Portal',
      invoiceDisplayName: 'Bella Land Corporation',
      stylePreset: 'luxury_navy',
      radiusStyle: 'balanced',
      buttonStyle: 'rounded',
      menuStyle: 'compact'
    },
    metadata: { marker: 'REAL_ESTATE_DEMO_MARKER' }
  };

  let tenantResult = await post('tenants', tenantData);
  let tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
  if (!tenant) {
    tenant = await fetchOne('tenants', 'name=eq.Bella%20Real%20Estate%20Development%20%5BDEMO%5D');
  }

  if (!tenant) {
    console.error('❌ Failed to create tenant');
    process.exit(1);
  }

  const tid = tenant.id;
  console.log(`✅ Tenant resolved: ${tenant.name} (ID: ${tid})\n`);

  // 2. Create Real Estate Projects
  console.log('🏗️ Step 2: Creating projects...');
  const projectsData = [
    {
      tenant_id: tid,
      name: 'Vinhomes Green Paradise',
      location: 'Grand Island, TP. Hồ Chí Minh',
      description: 'Phân khu căn hộ cao cấp bên sông với không gian xanh và tiện ích 5 sao.',
      status: 'active'
    },
    {
      tenant_id: tid,
      name: 'Vinhomes Saigon Park',
      location: 'Block Diamond, TP. Hồ Chí Minh',
      description: 'Căn hộ thông minh chuẩn thượng lưu tại lõi trung tâm thành phố.',
      status: 'planning'
    },
    {
      tenant_id: tid,
      name: 'Elyse Island',
      location: 'Shophouse Marina, TP. Nha Trang',
      description: 'Tổ hợp biệt thự nghỉ dưỡng và shophouse thương mại ven biển.',
      status: 'planning'
    }
  ];

  const insertedProjects = await post('real_estate_projects', projectsData);
  if (!insertedProjects || insertedProjects.length === 0) {
    console.error('❌ Failed to create projects');
    process.exit(1);
  }
  console.log(`✅ Created ${insertedProjects.length} projects.`);
  
  const greenParadiseProject = insertedProjects.find(p => p.name === 'Vinhomes Green Paradise');
  const projId = greenParadiseProject.id;

  // 3. Create Real Estate Products (Units) inside Vinhomes Green Paradise
  console.log('🏬 Step 3: Creating products/units inside Vinhomes Green Paradise...');
  const productsData = [
    // Floor 25
    {
      project_id: projId,
      tenant_id: tid,
      product_code: 'A25.01',
      product_type: 'apartment',
      floor: 'Tầng 25',
      block: 'Block A1',
      area: 320.00,
      unit_price: 35000000000.00, // 35 Tỷ
      status: 'available',
      owner_name: 'Chưa có chủ sở hữu'
    },
    {
      project_id: projId,
      tenant_id: tid,
      product_code: 'A25.02',
      product_type: 'apartment',
      floor: 'Tầng 25',
      block: 'Block A1',
      area: 290.00,
      unit_price: 32500000000.00, // 32.5 Tỷ
      status: 'booked',
      owner_name: 'Nguyễn Thị Hoa'
    },
    // Floor 24
    {
      project_id: projId,
      tenant_id: tid,
      product_code: 'A24.01',
      product_type: 'apartment',
      floor: 'Tầng 24',
      block: 'Block A1',
      area: 115.00,
      unit_price: 12800000000.00, // 12.8 Tỷ
      status: 'contracted',
      owner_name: 'Phạm Minh Đức'
    },
    {
      project_id: projId,
      tenant_id: tid,
      product_code: 'A24.02',
      product_type: 'apartment',
      floor: 'Tầng 24',
      block: 'Block A1',
      area: 85.00,
      unit_price: 8500000000.00, // 8.5 Tỷ
      status: 'available',
      owner_name: 'Chưa có chủ sở hữu'
    },
    {
      project_id: projId,
      tenant_id: tid,
      product_code: 'A24.03',
      product_type: 'apartment',
      floor: 'Tầng 24',
      block: 'Block A1',
      area: 82.00,
      unit_price: 7900000000.00, // 7.9 Tỷ
      status: 'deposited',
      owner_name: 'Nguyễn Văn An'
    },
    {
      project_id: projId,
      tenant_id: tid,
      product_code: 'A24.04',
      product_type: 'apartment',
      floor: 'Tầng 24',
      block: 'Block A1',
      area: 55.00,
      unit_price: 5200000000.00, // 5.2 Tỷ
      status: 'contracted',
      owner_name: 'Hoàng Kim Khánh'
    }
  ];

  const insertedProducts = await post('real_estate_products', productsData);
  if (!insertedProducts || insertedProducts.length === 0) {
    console.error('❌ Failed to create products');
    process.exit(1);
  }
  console.log(`✅ Created ${insertedProducts.length} units inside ${greenParadiseProject.name}.\n`);

  // 4. Create Real Estate Admin user in Supabase Auth and Public Users table
  console.log('👤 Step 4: Creating Real Estate Admin user in Supabase Auth...');
  const email = 'admin.realestate@bellagroup.vn';
  const pwd = 'Password123!';

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Check if auth user already exists or create new
  let authUserId = null;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
    user_metadata: { full_name: 'Quản Lý BĐS Bella Land' }
  });

  if (authError) {
    if (authError.message.includes('already') || authError.message.includes('exists')) {
      console.log(`ℹ️ Auth user ${email} already exists. Updating credentials...`);
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = listData?.users?.find(u => u.email === email);
      if (existingUser) {
        authUserId = existingUser.id;
        await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: pwd });
      }
    } else {
      console.error('❌ Failed to create Auth user:', authError.message);
    }
  } else {
    authUserId = authData?.user?.id;
    console.log(`✅ Supabase Auth user created: ${email} (Auth ID: ${authUserId})`);
  }

  if (authUserId) {
    // Delete stale public.users row if ID doesn't match authUserId
    await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers
    });

    const userPayload = {
      id: authUserId,
      tenant_id: tid,
      email,
      full_name: 'Quản Lý BĐS Bella Land',
      role: 'admin',
      status: 'active',
    };

    const insertedUser = await post('users', userPayload);
    if (insertedUser) {
      console.log(`✅ Synced public.users record with Auth ID (${authUserId}) for: ${email}\n`);
    }
  }

  console.log('📊 Seeding Summary:');
  console.log(`   Tenant: ${tenant.name} (${tid})`);
  console.log(`   Projects: ${insertedProjects.length}`);
  console.log(`   Units: ${insertedProducts.length}`);
  console.log(`   Admin User: ${email}`);
  console.log(`   Access Key: ${pwd}`);
  console.log('\n🎉 Real Estate Demo Seeding completed successfully!');
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

