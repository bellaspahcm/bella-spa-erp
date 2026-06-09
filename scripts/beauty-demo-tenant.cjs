const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const DEMO_MARKER = 'BEAUTY_DEMO_FRANCHISE_TEST';
const DEMO_TENANT_NAME = 'Beauty Spa Franchise Demo - TEST';
const DEMO_TENANT_EMAIL = 'beauty-demo-branch@bellaspa.test';
const DEMO_ADMIN_EMAIL = 'admin.beauty.demo@bellaspa.test';
const DEMO_HQ_NAME = 'Bella Spa Headquarter';

const ROLE_PERMISSIONS = {
  ktv_lead: {
    dashboard: true,
    customers: false,
    bookings: true,
    sessions: true,
    chat: true,
    crm: true,
    services: true,
    finance: false,
    reconciliation: false,
    inventory: false,
    salary: false,
    audit: false,
    settings: false,
  },
  admin_staff: {
    dashboard: true,
    customers: true,
    bookings: true,
    sessions: true,
    chat: true,
    crm: true,
    services: true,
    inventory: true,
    finance: true,
    reconciliation: false,
    salary: false,
    audit: false,
    settings: false,
  },
  accountant: {
    dashboard: true,
    customers: false,
    bookings: false,
    sessions: false,
    chat: false,
    crm: false,
    services: true,
    inventory: true,
    finance: true,
    reconciliation: true,
    salary: true,
    audit: false,
    settings: false,
  },
  hr: {
    dashboard: true,
    customers: false,
    bookings: false,
    sessions: true,
    chat: false,
    crm: false,
    services: false,
    inventory: false,
    finance: false,
    reconciliation: false,
    salary: true,
    audit: false,
    settings: false,
  },
};

const SALARY_CONFIG = {
  bonus_5_star: 60000,
  bonus_4_5_star: 35000,
  bonus_4_star: 15000,
  kpi_target_sessions: 32,
  kpi_bonus_amount: 1200000,
  penalty_late_per_day: 50000,
  penalty_absent_per_day: 200000,
};

const DELETE_TABLES_BY_TENANT = [
  'audit_logs',
  'app_notifications',
  'ai_action_approvals',
  'ai_agent_logs',
  'ai_action_logs',
  'meta_ad_insights',
  'marketing_meta_ad_account_tokens',
  'marketing_meta_ad_accounts',
  'franchise_royalty_invoices',
  'subscription_invoices',
  'subscription_usage_counters',
  'tenant_quota_overrides',
  'inventory_transfer_orders',
  'inventory_logs',
  'inventory_items',
  'accounting_outbox',
  'accounting_review_queue',
  'journal_lines',
  'journal_entries',
  'accounting_periods',
  'accounting_accounts',
  'session_reviews',
  'chat_messages',
  'chat_threads',
  'membership_records',
  'revenue',
  'expenses',
  'salary_records',
  'kpi_records',
  'attendance',
  'staff_leaves',
  'ktv_schedule',
  'shifts',
  'session_logs',
  'bookings',
  'customers',
  'booking_resources',
  'packages',
  'users',
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...valueParts] = line.split('=');
    const rawValue = valueParts.join('=').trim();
    env[key.trim()] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function getEnv() {
  return {
    ...readEnvFile('.env.local'),
    ...process.env,
  };
}

function getSupabaseCredentials(env = getEnv()) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  const missing = [];

  if (!supabaseUrl) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');

  return {
    supabaseUrl,
    serviceRoleKey,
    missing,
    isConfigured: missing.length === 0,
  };
}

function getAdminPassword(env = getEnv()) {
  return env.BEAUTY_DEMO_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
}

function createSupabaseAdmin(credentials = getSupabaseCredentials()) {
  if (!credentials.isConfigured) {
    throw new Error(`Missing Supabase admin config: ${credentials.missing.join(', ')}.`);
  }

  return createClient(credentials.supabaseUrl, credentials.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortId(id) {
  return String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

function assertDemoTenantSafe(tenant) {
  if (!tenant) return;

  const hasSafeIdentity =
    tenant.name === DEMO_TENANT_NAME ||
    tenant.email === DEMO_TENANT_EMAIL;
  const modules = tenant.enabled_modules || {};
  const isBeautyOnly = modules.beauty_spa === true && modules.babycare === false;

  if (!hasSafeIdentity || !isBeautyOnly) {
    throw new Error(
      `Refusing to touch tenant ${tenant.id}: it does not match the Beauty demo safety marker.`,
    );
  }
}

async function mustInsert(client, table, payload) {
  const { data, error } = await client.from(table).insert(payload).select();
  if (error) throw new Error(`[${table}.insert] ${error.message}`);
  return data || [];
}

async function optionalDeleteByTenant(client, table, tenantId) {
  const { error } = await client.from(table).delete().eq('tenant_id', tenantId);
  if (error) {
    const tableMissing = error.code === '42P01' || /does not exist/i.test(error.message || '');
    const columnMissing = error.code === '42703' || /column .* does not exist/i.test(error.message || '');
    if (tableMissing || columnMissing) return { table, skipped: true, reason: error.message };
    throw new Error(`[${table}.delete] ${error.message}`);
  }
  return { table, skipped: false };
}

async function findDemoTenant(client) {
  const { data: byTenant, error: tenantError } = await client
    .from('tenants')
    .select('id,name,email,enabled_modules,status,franchise_agreement_date,subscription_tier')
    .or(`name.eq.${DEMO_TENANT_NAME},email.eq.${DEMO_TENANT_EMAIL}`)
    .maybeSingle();

  if (tenantError) throw new Error(`[tenants.select] ${tenantError.message}`);
  if (byTenant) return byTenant;

  const { data: user, error: userError } = await client
    .from('users')
    .select('tenant_id')
    .eq('email', DEMO_ADMIN_EMAIL)
    .maybeSingle();

  if (userError) throw new Error(`[users.select] ${userError.message}`);
  if (!user?.tenant_id) return null;

  const { data: byAdmin, error: adminTenantError } = await client
    .from('tenants')
    .select('id,name,email,enabled_modules,status,franchise_agreement_date,subscription_tier')
    .eq('id', user.tenant_id)
    .maybeSingle();

  if (adminTenantError) throw new Error(`[tenants.select] ${adminTenantError.message}`);
  return byAdmin || null;
}

async function findHqTenant(client) {
  const { data, error } = await client
    .from('tenants')
    .select('id,name')
    .eq('name', DEMO_HQ_NAME)
    .maybeSingle();

  if (error) throw new Error(`[tenants.select HQ] ${error.message}`);
  if (!data?.id) {
    throw new Error(`Cannot create franchise demo tenant because "${DEMO_HQ_NAME}" was not found.`);
  }
  return data;
}

async function findAuthUserByEmail(client, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`[auth.listUsers] ${error.message}`);
    const found = data?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
}

async function ensureDemoAuthUser(client, password) {
  const existing = await findAuthUserByEmail(client, DEMO_ADMIN_EMAIL);
  if (existing?.id) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Admin Beauty Spa Demo', demo_marker: DEMO_MARKER },
    });
    if (error) throw new Error(`[auth.updateUserById] ${error.message}`);
    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: DEMO_ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Admin Beauty Spa Demo', demo_marker: DEMO_MARKER },
  });
  if (error) throw new Error(`[auth.createUser] ${error.message}`);
  return data.user;
}

async function createBeautyDemoTenant(client = createSupabaseAdmin()) {
  const existing = await findDemoTenant(client);
  if (existing) {
    assertDemoTenantSafe(existing);
    throw new Error(
      `Beauty demo tenant already exists (${existing.id}). Run "node scripts/beauty-demo-tenant.cjs cleanup --confirm" before creating it again.`,
    );
  }

  const password = getAdminPassword();
  const authUser = await ensureDemoAuthUser(client, password);
  const hqTenant = await findHqTenant(client);
  const createdUserIds = [authUser.id];

  try {
    const [tenant] = await mustInsert(client, 'tenants', {
      name: DEMO_TENANT_NAME,
      parent_tenant_id: hqTenant.id,
      franchise_agreement_date: daysFromToday(0),
      royalty_rate: 0.08,
      royalty_type: 'percentage',
      contact_name: 'Admin Beauty Spa Demo',
      contact_phone: '0909002026',
      address: 'Demo Beauty Spa, Quận 1, TP. Hồ Chí Minh',
      email: DEMO_TENANT_EMAIL,
      status: 'active',
      enabled_modules: { babycare: false, beauty_spa: true },
      brand_theme: {
        primary: '#9F1239',
        accent: '#E879F9',
        surface: '#FFF1F2',
        demo_marker: DEMO_MARKER,
      },
      role_permissions: ROLE_PERMISSIONS,
      salary_config: SALARY_CONFIG,
      subscription_tier: 'enterprise',
      subscription_expires_at: daysFromToday(90),
      internal_clearing_rate: 0.05,
    });

    const tenantId = tenant.id;
    const suffix = shortId(tenantId);

    await mustInsert(client, 'users', {
      id: authUser.id,
      email: DEMO_ADMIN_EMAIL,
      full_name: 'Admin Beauty Spa Demo',
      phone: '0909002026',
      role: 'admin',
      status: 'active',
      tenant_id: tenantId,
    });

    const staff = await mustInsert(client, 'users', [
      {
        email: `ktv.beauty.${suffix.toLowerCase()}.1@bellaspa.test`,
        full_name: 'KTV Demo Facial',
        phone: '0909002101',
        role: 'ktv',
        status: 'active',
        base_salary: 7000000,
        tenant_id: tenantId,
      },
      {
        email: `ktv.beauty.${suffix.toLowerCase()}.2@bellaspa.test`,
        full_name: 'KTV Demo Body',
        phone: '0909002102',
        role: 'ktv',
        status: 'active',
        base_salary: 7500000,
        tenant_id: tenantId,
      },
      {
        email: `accountant.beauty.${suffix.toLowerCase()}@bellaspa.test`,
        full_name: 'Kế toán Beauty Demo',
        phone: '0909002103',
        role: 'accountant',
        status: 'active',
        tenant_id: tenantId,
      },
    ]);
    createdUserIds.push(...staff.map((user) => user.id));

    const ktvUsers = staff.filter((user) => user.role === 'ktv');

    const packages = await mustInsert(client, 'packages', [
      {
        name: 'Facial Cấp Ẩm Chuyên Sâu Demo',
        description: `${DEMO_MARKER}: Liệu trình chăm sóc da mặt cấp ẩm, phục hồi hàng rào da.`,
        details: ['Soi da cơ bản', 'Làm sạch sâu', 'Đắp mask phục hồi', 'Massage nâng cơ nhẹ'],
        full_price: 1800000,
        price: 1500000,
        duration: '75 phút/buổi',
        total_sessions: 3,
        ktv_commission: 120000,
        status: 'active',
        tenant_id: tenantId,
        module_key: 'beauty_spa',
        service_kind: 'treatment_package',
        service_category: 'facial',
        default_duration_minutes: 75,
        requires_resource: true,
        default_resource_type: 'bed',
        before_after_required: true,
        session_multiplier: 1,
        allowed_franchise_override: true,
      },
      {
        name: 'Triệt Lông Diode Demo',
        description: `${DEMO_MARKER}: Dịch vụ triệt lông công nghệ cao theo vùng.`,
        details: ['Tư vấn vùng triệt', 'Làm sạch', 'Triệt diode', 'Làm dịu da sau dịch vụ'],
        full_price: 2500000,
        price: 2200000,
        duration: '60 phút/buổi',
        total_sessions: 5,
        ktv_commission: 150000,
        status: 'active',
        tenant_id: tenantId,
        module_key: 'beauty_spa',
        service_kind: 'treatment_package',
        service_category: 'laser',
        default_duration_minutes: 60,
        requires_resource: true,
        default_resource_type: 'machine',
        before_after_required: true,
        session_multiplier: 1,
        allowed_franchise_override: false,
      },
      {
        name: 'Gội Đầu Dưỡng Sinh Demo',
        description: `${DEMO_MARKER}: Dịch vụ đơn lẻ thư giãn cổ vai gáy và da đầu.`,
        details: ['Gội thảo mộc', 'Massage cổ vai gáy', 'Xông tinh dầu'],
        full_price: 450000,
        price: 390000,
        duration: '45 phút',
        total_sessions: 1,
        ktv_commission: 60000,
        status: 'active',
        tenant_id: tenantId,
        module_key: 'beauty_spa',
        service_kind: 'single_service',
        service_category: 'relaxation',
        default_duration_minutes: 45,
        requires_resource: true,
        default_resource_type: 'chair',
        before_after_required: false,
        session_multiplier: 0.5,
        allowed_franchise_override: true,
      },
    ]);

    await mustInsert(client, 'booking_resources', [
      {
        tenant_id: tenantId,
        branch_tenant_id: tenantId,
        name: 'Giường Facial Demo 01',
        resource_type: 'bed',
        status: 'available',
        capacity: 1,
        location_note: 'Tầng 1 - Phòng chăm sóc da',
        metadata: { demo_marker: DEMO_MARKER },
      },
      {
        tenant_id: tenantId,
        branch_tenant_id: tenantId,
        name: 'Máy Diode Demo 01',
        resource_type: 'machine',
        status: 'available',
        capacity: 1,
        location_note: 'Phòng công nghệ cao',
        metadata: { demo_marker: DEMO_MARKER },
      },
      {
        tenant_id: tenantId,
        branch_tenant_id: tenantId,
        name: 'Ghế Gội Dưỡng Sinh Demo 01',
        resource_type: 'chair',
        status: 'available',
        capacity: 1,
        location_note: 'Khu thư giãn',
        metadata: { demo_marker: DEMO_MARKER },
      },
    ]);

    const phoneSuffix = crypto.randomInt(1000, 9999);
    const customers = await mustInsert(client, 'customers', [
      {
        phone: `0908${phoneSuffix}01`,
        name_mother: 'Khách Beauty Demo Linh',
        name_baby: 'Beauty Demo',
        gender_baby: 'Nữ',
        address: 'Quận 1, TP. Hồ Chí Minh',
        status: 'active',
        notes: `${DEMO_MARKER}: Khách đang chạy liệu trình facial.`,
        tenant_id: tenantId,
      },
      {
        phone: `0908${phoneSuffix}02`,
        name_mother: 'Khách Beauty Demo Mai',
        name_baby: 'Beauty Demo',
        gender_baby: 'Nữ',
        address: 'Quận 3, TP. Hồ Chí Minh',
        status: 'active',
        notes: `${DEMO_MARKER}: Khách hẹn triệt lông theo liệu trình.`,
        tenant_id: tenantId,
      },
      {
        phone: `0908${phoneSuffix}03`,
        name_mother: 'Khách Beauty Demo An',
        name_baby: 'Beauty Demo',
        gender_baby: 'Nam',
        address: 'Bình Thạnh, TP. Hồ Chí Minh',
        status: 'active',
        notes: `${DEMO_MARKER}: Khách dùng dịch vụ đơn lẻ.`,
        tenant_id: tenantId,
      },
    ]);

    const bookings = await mustInsert(client, 'bookings', [
      {
        booking_number: `BSP-DEMO-${suffix}-001`,
        customer_id: customers[0].id,
        package_id: packages[0].id,
        package_name: packages[0].name,
        status: 'in_progress',
        deposit_amount: 300000,
        full_price: 1500000,
        discount_percent: 16.67,
        start_date: daysFromToday(-2),
        end_date: daysFromToday(14),
        total_sessions: 3,
        completed_sessions: 1,
        contract_signed: true,
        preferred_time: '10:00',
        assigned_ktv_id: ktvUsers[0].id,
        tenant_id: tenantId,
      },
      {
        booking_number: `BSP-DEMO-${suffix}-002`,
        customer_id: customers[1].id,
        package_id: packages[1].id,
        package_name: packages[1].name,
        status: 'booked',
        deposit_amount: 500000,
        full_price: 2200000,
        discount_percent: 12,
        start_date: daysFromToday(1),
        end_date: daysFromToday(35),
        total_sessions: 5,
        completed_sessions: 0,
        contract_signed: true,
        preferred_time: '14:30',
        assigned_ktv_id: ktvUsers[1].id,
        tenant_id: tenantId,
      },
      {
        booking_number: `BSP-DEMO-${suffix}-003`,
        customer_id: customers[2].id,
        package_id: packages[2].id,
        package_name: packages[2].name,
        status: 'completed',
        deposit_amount: 0,
        full_price: 390000,
        discount_percent: 0,
        start_date: daysFromToday(-1),
        end_date: daysFromToday(-1),
        total_sessions: 1,
        completed_sessions: 1,
        contract_signed: false,
        preferred_time: '16:00',
        assigned_ktv_id: ktvUsers[0].id,
        tenant_id: tenantId,
      },
    ]);

    await mustInsert(client, 'session_logs', [
      {
        booking_id: bookings[0].id,
        session_number: 1,
        assigned_date: daysFromToday(-2),
        assigned_time: '10:00',
        completed_date: daysFromToday(-2),
        completed_by_ktv_id: ktvUsers[0].id,
        status: 'completed',
        rating: 5,
        rating_comment: 'Khách demo hài lòng, da đủ ẩm sau buổi đầu.',
        notes: DEMO_MARKER,
        standard_duration: 75,
        actual_duration: 78,
        tenant_id: tenantId,
      },
      {
        booking_id: bookings[0].id,
        session_number: 2,
        assigned_date: daysFromToday(2),
        assigned_time: '10:00',
        completed_by_ktv_id: ktvUsers[0].id,
        status: 'scheduled',
        notes: DEMO_MARKER,
        standard_duration: 75,
        tenant_id: tenantId,
      },
      {
        booking_id: bookings[1].id,
        session_number: 1,
        assigned_date: daysFromToday(1),
        assigned_time: '14:30',
        completed_by_ktv_id: ktvUsers[1].id,
        status: 'scheduled',
        notes: DEMO_MARKER,
        standard_duration: 60,
        tenant_id: tenantId,
      },
      {
        booking_id: bookings[2].id,
        session_number: 1,
        assigned_date: daysFromToday(-1),
        assigned_time: '16:00',
        completed_date: daysFromToday(-1),
        completed_by_ktv_id: ktvUsers[0].id,
        status: 'completed',
        rating: 5,
        rating_comment: 'Gội dưỡng sinh demo hoàn tất.',
        notes: DEMO_MARKER,
        standard_duration: 45,
        actual_duration: 45,
        tenant_id: tenantId,
      },
    ]);

    await mustInsert(client, 'revenue', [
      {
        booking_id: bookings[0].id,
        amount: 300000,
        revenue_type: 'deposit',
        payment_method: 'bank_transfer',
        received_date: daysFromToday(-2),
        recorded_by_id: authUser.id,
        status: 'confirmed',
        notes: DEMO_MARKER,
        tenant_id: tenantId,
      },
      {
        booking_id: bookings[1].id,
        amount: 500000,
        revenue_type: 'deposit',
        payment_method: 'bank_transfer',
        received_date: daysFromToday(0),
        recorded_by_id: authUser.id,
        status: 'confirmed',
        notes: DEMO_MARKER,
        tenant_id: tenantId,
      },
      {
        booking_id: bookings[2].id,
        amount: 390000,
        revenue_type: 'session_completed',
        payment_method: 'cash',
        received_date: daysFromToday(-1),
        recorded_by_id: authUser.id,
        status: 'confirmed',
        notes: DEMO_MARKER,
        tenant_id: tenantId,
      },
    ]);

    await mustInsert(client, 'expenses', [
      {
        category: 'Marketing',
        amount: 1200000,
        description: `${DEMO_MARKER}: Chi phí ads khai trương Beauty Spa demo.`,
        expense_date: daysFromToday(-3),
        status: 'approved',
        submitted_by_id: authUser.id,
        approved_by_id: authUser.id,
        tenant_id: tenantId,
      },
      {
        category: 'Supplies',
        amount: 850000,
        description: `${DEMO_MARKER}: Mỹ phẩm, mask và tinh chất demo.`,
        expense_date: daysFromToday(-2),
        status: 'approved',
        submitted_by_id: authUser.id,
        approved_by_id: authUser.id,
        tenant_id: tenantId,
      },
    ]);

    return {
      tenantId,
      adminEmail: DEMO_ADMIN_EMAIL,
      adminPassword: password,
      counts: {
        users: 4,
        packages: packages.length,
        resources: 3,
        customers: customers.length,
        bookings: bookings.length,
      },
    };
  } catch (error) {
    await cleanupBeautyDemoTenant(client, { confirm: true, quiet: true }).catch((cleanupError) => {
      console.error(`[cleanup after failure] ${cleanupError.message}`);
    });
    throw error;
  }
}

async function cleanupBeautyDemoTenant(client = createSupabaseAdmin(), options = {}) {
  if (!options.confirm) {
    throw new Error('Cleanup requires --confirm to prevent accidental production data deletion.');
  }

  const tenant = await findDemoTenant(client);
  if (!tenant) {
    const existingAuthUser = await findAuthUserByEmail(client, DEMO_ADMIN_EMAIL);
    if (existingAuthUser?.id) {
      const { error } = await client.auth.admin.deleteUser(existingAuthUser.id);
      if (error) throw new Error(`[auth.deleteUser orphan] ${error.message}`);
      return { tenantDeleted: false, authDeleted: true, skippedTables: [] };
    }
    return { tenantDeleted: false, authDeleted: false, skippedTables: [] };
  }

  assertDemoTenantSafe(tenant);

  const { data: publicUsers, error: usersError } = await client
    .from('users')
    .select('id,email')
    .eq('tenant_id', tenant.id);
  if (usersError) throw new Error(`[users.select cleanup] ${usersError.message}`);

  const skippedTables = [];
  for (const table of DELETE_TABLES_BY_TENANT) {
    const result = await optionalDeleteByTenant(client, table, tenant.id);
    if (result.skipped) skippedTables.push(result);
  }

  const { error: tenantDeleteError } = await client.from('tenants').delete().eq('id', tenant.id);
  if (tenantDeleteError) throw new Error(`[tenants.delete] ${tenantDeleteError.message}`);

  const authUsers = await Promise.all(
    (publicUsers || [])
      .filter((user) => user.email === DEMO_ADMIN_EMAIL || user.email?.endsWith('@bellaspa.test'))
      .map(async (user) => {
        const found = await findAuthUserByEmail(client, user.email);
        return found?.id || null;
      }),
  );

  let authDeleted = false;
  for (const userId of authUsers.filter(Boolean)) {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) throw new Error(`[auth.deleteUser] ${error.message}`);
    authDeleted = true;
  }

  if (!options.quiet) {
    console.log(`Deleted Beauty demo tenant: ${tenant.id}`);
  }
  return { tenantDeleted: true, authDeleted, skippedTables };
}

async function getBeautyDemoStatus(client = createSupabaseAdmin()) {
  const tenant = await findDemoTenant(client);
  if (!tenant) return { exists: false };
  assertDemoTenantSafe(tenant);

  const tables = ['users', 'packages', 'booking_resources', 'customers', 'bookings', 'session_logs', 'revenue', 'expenses'];
  const counts = {};
  for (const table of tables) {
    const { count, error } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id);
    if (error) throw new Error(`[${table}.count] ${error.message}`);
    counts[table] = count || 0;
  }

  return { exists: true, tenant, counts };
}

function printCreateResult(result) {
  console.log('Beauty demo tenant created.');
  console.log(`Tenant ID   : ${result.tenantId}`);
  console.log(`Admin email : ${result.adminEmail}`);
  console.log(`Admin pass  : ${result.adminPassword}`);
  console.log(`Seed counts : ${JSON.stringify(result.counts)}`);
  console.log('Cleanup     : node scripts/beauty-demo-tenant.cjs cleanup --confirm');
}

function printStatus(status) {
  if (!status.exists) {
    console.log('Beauty demo tenant does not exist.');
    return;
  }

  console.log('Beauty demo tenant exists.');
  console.log(`Tenant ID   : ${status.tenant.id}`);
  console.log(`Tenant name : ${status.tenant.name}`);
  console.log(`Status      : ${status.tenant.status}`);
  console.log(`Subscription: ${status.tenant.subscription_tier}`);
  console.log(`Counts      : ${JSON.stringify(status.counts)}`);
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'status';
  const client = createSupabaseAdmin();

  if (command === 'create') {
    const result = await createBeautyDemoTenant(client);
    printCreateResult(result);
    return;
  }

  if (command === 'cleanup') {
    const result = await cleanupBeautyDemoTenant(client, { confirm: argv.includes('--confirm') });
    console.log(`Beauty demo cleanup completed: ${JSON.stringify(result)}`);
    return;
  }

  if (command === 'status') {
    printStatus(await getBeautyDemoStatus(client));
    return;
  }

  throw new Error(`Unknown command "${command}". Use: create | status | cleanup --confirm`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  DEMO_ADMIN_EMAIL,
  DEMO_MARKER,
  DEMO_TENANT_EMAIL,
  DEMO_TENANT_NAME,
  DELETE_TABLES_BY_TENANT,
  assertDemoTenantSafe,
  cleanupBeautyDemoTenant,
  createBeautyDemoTenant,
  getBeautyDemoStatus,
  getSupabaseCredentials,
  readEnvFile,
};
