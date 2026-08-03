const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const DEMO_MARKER = 'BELLA_AUTO_DEMO_TEST';
const DEMO_TENANT_NAME = 'Bella Auto Franchise Demo - TEST';
const DEMO_TENANT_EMAIL = 'auto-demo-branch@bellaauto.test';
const DEMO_ADMIN_EMAIL = 'admin.auto.demo@bellaauto.test';

const ROLE_PERMISSIONS = {
  sales_advisor: {
    dashboard: true,
    customers: true,
    vehicles: true,
    journey: true,
    experience: true,
    leads: true,
    sales: true,
    workshop: false,
    settings: false,
  },
  service_advisor: {
    dashboard: true,
    customers: true,
    vehicles: true,
    journey: true,
    experience: true,
    leads: false,
    sales: false,
    workshop: true,
    settings: false,
  }
};

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

async function mustInsert(client, table, payload) {
  const { data, error } = await client.from(table).insert(payload).select();
  if (error) throw new Error(`[${table}.insert] ${error.message}`);
  return data || [];
}

async function findDemoTenant(client) {
  const { data, error } = await client
    .from('tenants')
    .select('id,name,email')
    .or(`name.eq.${DEMO_TENANT_NAME},email.eq.${DEMO_TENANT_EMAIL}`)
    .maybeSingle();
  if (error) throw new Error(`[tenants.select] ${error.message}`);
  return data;
}

async function findAuthUserByEmail(client, email) {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 10 });
  if (error) throw new Error(`[auth.listUsers] ${error.message}`);
  return data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function ensureDemoAuthUser(client, password) {
  const existing = await findAuthUserByEmail(client, DEMO_ADMIN_EMAIL);
  if (existing?.id) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Admin Bella Auto Demo', demo_marker: DEMO_MARKER },
    });
    if (error) throw new Error(`[auth.updateUserById] ${error.message}`);
    return data.user;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: DEMO_ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Admin Bella Auto Demo', demo_marker: DEMO_MARKER },
  });
  if (error) throw new Error(`[auth.createUser] ${error.message}`);
  return data.user;
}

async function runSeeding() {
  const client = createSupabaseAdmin();
  const existing = await findDemoTenant(client);
  if (existing) {
    console.log(`Demo tenant already exists with ID: ${existing.id}`);
    return;
  }

  const password = crypto.randomBytes(12).toString('hex');
  const authUser = await ensureDemoAuthUser(client, password);

  // 1. Insert Tenant
  const [tenant] = await mustInsert(client, 'tenants', {
    name: DEMO_TENANT_NAME,
    email: DEMO_TENANT_EMAIL,
    status: 'active',
    enabled_modules: { bella_auto: true },
    brand_theme: {
      primary: '#0A1628',
      accent: '#C0A060',
      surface: '#F8F9FA',
      demo_marker: DEMO_MARKER,
    },
    role_permissions: ROLE_PERMISSIONS,
  });

  const tenantId = tenant.id;
  console.log(`Tenant created: ${tenantId}`);

  // 2. Insert User profile
  await mustInsert(client, 'users', {
    id: authUser.id,
    email: DEMO_ADMIN_EMAIL,
    full_name: 'Admin Bella Auto Demo',
    role: 'admin',
    status: 'active',
    tenant_id: tenantId,
  });

  // 3. Insert Brand
  const [brand] = await mustInsert(client, 'auto_brands', {
    tenant_id: tenantId,
    name: 'BMW',
    country_of_origin: 'Germany',
    is_active: true
  });

  // 4. Insert Model
  const [model] = await mustInsert(client, 'auto_models', {
    tenant_id: tenantId,
    brand_id: brand.id,
    name: '3 Series',
    segment: 'Sedan',
    is_active: true
  });

  // 5. Insert Variant
  await mustInsert(client, 'auto_variants', {
    tenant_id: tenantId,
    model_id: model.id,
    name: '330i Luxury Line',
    year: 2026,
    fuel_type: 'Gasoline',
    transmission: 'Automatic',
    specs_json: {
      horsepower: 258,
      engine: '2.0L TwinPower Turbo'
    },
    is_active: true
  });

  console.log('Seeding completed successfully!');
  console.log(`Credentials:\nEmail: ${DEMO_ADMIN_EMAIL}\nPassword: ${password}`);
}

runSeeding().catch(err => {
  console.error('Error running seeding:', err);
  process.exit(1);
});
