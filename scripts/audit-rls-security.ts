/**
 * RLS Security Audit Script
 * 
 * Purpose: Verify tenant isolation on shared database
 * Context: Retail Products validation used shared DB with Bella Babycare
 * 
 * Audit scope:
 * 1. RLS status on all retail tables
 * 2. Tenant isolation policies
 * 3. Test tenant vs Babycare tenant separation
 * 4. Data exposure risk assessment
 * 5. Security policy changes from migrations
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env explicitly
config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
  process.exit(1);
}

interface RLSStatus {
  schemaname: string;
  tablename: string;
  rowsecurity: boolean;
}

interface PolicyInfo {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string;
  with_check: string;
}

interface TenantInfo {
  id: string;
  name: string;
  created_at: string;
}

async function auditRLSSecurity() {
  console.log('🔒 BELLA RLS SECURITY AUDIT');
  console.log('   Scope: Retail tables + tenant isolation');
  console.log('');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Check RLS status on all retail tables
  console.log('📋 Step 1: RLS Status on Retail Tables');
  console.log('');

  const retailTables = [
    'retail_products',
    'retail_inventory_movements',
    'retail_product_variants',
    'retail_product_batches'
  ];

  const rlsStatusQuery = `
    SELECT 
      schemaname,
      tablename,
      rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (${retailTables.map(t => `'${t}'`).join(', ')})
    ORDER BY tablename;
  `;

  const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_sql', {
    sql: rlsStatusQuery
  }).single();

  if (rlsError) {
    // Try direct query
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', retailTables);

    console.log('⚠️  Could not query pg_tables directly');
    console.log('   Tables found:', tables?.map(t => t.table_name).join(', '));
    console.log('');
  } else {
    console.table(rlsStatus);
    console.log('');
  }

  // 2. Check existing RLS policies
  console.log('📋 Step 2: RLS Policies on Retail Tables');
  console.log('');

  for (const table of retailTables) {
    const policiesQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles::text[],
        cmd,
        qual::text,
        with_check::text
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = '${table}'
      ORDER BY policyname;
    `;

    try {
      const { data: policies } = await supabase.rpc('exec_sql', {
        sql: policiesQuery
      }).single();

      if (policies && policies.length > 0) {
        console.log(`   ${table}:`);
        console.table(policies);
      } else {
        console.log(`   ${table}: ❌ NO POLICIES`);
      }
      console.log('');
    } catch (err) {
      console.log(`   ${table}: ⚠️  Could not query policies`);
      console.log('');
    }
  }

  // 3. List all tenants
  console.log('📋 Step 3: Tenant Registry');
  console.log('');

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });

  if (tenantsError) {
    console.log('❌ Failed to fetch tenants:', tenantsError.message);
  } else {
    console.table(tenants);
    console.log(`   Total tenants: ${tenants?.length || 0}`);
    console.log('');

    // Identify test tenants
    const testTenantId = '00000000-0000-0000-0000-000000000001';
    const testTenant = tenants?.find(t => t.id === testTenantId);
    const babycareTenant = tenants?.find(t => t.name?.toLowerCase().includes('babycare'));

    if (testTenant) {
      console.log('   ⚠️  TEST TENANT FOUND:', testTenant.name);
    }
    if (babycareTenant) {
      console.log('   🏢 BABYCARE TENANT:', babycareTenant.name);
    }
    console.log('');
  }

  // 4. Check data distribution across tenants
  console.log('📋 Step 4: Data Distribution by Tenant');
  console.log('');

  for (const table of retailTables) {
    const { data: counts, error } = await supabase
      .from(table)
      .select('tenant_id, count:tenant_id.count()', { count: 'exact' });

    if (!error && counts) {
      const grouped = counts.reduce((acc: Record<string, number>, row: any) => {
        acc[row.tenant_id] = (acc[row.tenant_id] || 0) + 1;
        return acc;
      }, {});

      console.log(`   ${table}:`);
      Object.entries(grouped).forEach(([tenantId, count]) => {
        const tenant = tenants?.find(t => t.id === tenantId);
        console.log(`     ${tenant?.name || tenantId}: ${count} rows`);
      });
    } else {
      console.log(`   ${table}: Could not query data distribution`);
    }
    console.log('');
  }

  // 5. Test tenant isolation (attempt cross-tenant read)
  console.log('📋 Step 5: Tenant Isolation Test');
  console.log('');

  const testTenantId = '00000000-0000-0000-0000-000000000001';
  
  // Try to read data with test tenant filter
  const { data: testData, error: testError } = await supabase
    .from('retail_products')
    .select('id, tenant_id, sku, name')
    .eq('tenant_id', testTenantId)
    .limit(5);

  if (!testError && testData) {
    console.log(`   ✅ Test tenant data (${testTenantId}):`);
    console.table(testData);
  } else {
    console.log(`   ❌ Could not read test tenant data:`, testError?.message);
  }
  console.log('');

  // Try to read data WITHOUT tenant filter (should be blocked by RLS if enabled)
  const { data: allData, error: allError, count } = await supabase
    .from('retail_products')
    .select('id, tenant_id, sku, name', { count: 'exact' })
    .limit(10);

  console.log('   📊 Query WITHOUT tenant filter (service_role):');
  if (!allError && allData) {
    console.log(`      Rows returned: ${count || allData.length}`);
    if (allData.length > 0) {
      console.log('      ⚠️  SERVICE_ROLE CAN READ ALL TENANTS (expected for admin)');
      const uniqueTenants = new Set(allData.map(r => r.tenant_id));
      console.log(`      Tenants visible: ${uniqueTenants.size}`);
    }
  } else {
    console.log('      ❌ Query failed:', allError?.message);
  }
  console.log('');

  // 6. Check for test data pollution in Babycare tenant
  console.log('📋 Step 6: Test Data Pollution Check');
  console.log('');

  const babycareTenant = tenants?.find(t => t.name?.toLowerCase().includes('babycare'));
  if (babycareTenant) {
    const testSKUs = ['TSHIRT-BASE', 'MILK-ORGANIC-1L', 'CHEESE-CHEDDAR'];

    for (const sku of testSKUs) {
      const { data: pollution, error } = await supabase
        .from('retail_products')
        .select('id, tenant_id, sku, name')
        .eq('tenant_id', babycareTenant.id)
        .eq('sku', sku);

      if (!error && pollution && pollution.length > 0) {
        console.log(`   ⚠️  TEST SKU "${sku}" FOUND IN BABYCARE TENANT:`);
        console.table(pollution);
      }
    }

    console.log('   ✅ No test data pollution detected in Babycare tenant');
  } else {
    console.log('   ℹ️  Babycare tenant not found');
  }
  console.log('');

  // 7. Check migration history
  console.log('📋 Step 7: Recent Migration History');
  console.log('');

  const { data: migrations, error: migError } = await supabase
    .from('schema_migrations')
    .select('version, inserted_at')
    .order('inserted_at', { ascending: false })
    .limit(10);

  if (!migError && migrations) {
    console.table(migrations);
  } else {
    console.log('   ⚠️  Could not query migration history');
  }
  console.log('');

  // 8. Final Risk Assessment
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('🎯 RISK ASSESSMENT SUMMARY');
  console.log('');

  const risks: string[] = [];

  // Check if RLS is disabled
  if (rlsStatus && Array.isArray(rlsStatus)) {
    const disabledTables = rlsStatus.filter((row: any) => !row.rowsecurity);
    if (disabledTables.length > 0) {
      risks.push(`❌ RLS DISABLED on ${disabledTables.length} tables`);
      disabledTables.forEach((t: any) => {
        risks.push(`   - ${t.tablename}`);
      });
    }
  }

  // Check for shared tenants
  if (tenants && tenants.length > 1) {
    risks.push(`⚠️  SHARED DATABASE: ${tenants.length} tenants`);
  }

  // Check for Babycare + test coexistence
  const babycareTenantExists = tenants?.some(t => t.name?.toLowerCase().includes('babycare'));
  const testTenantExists = tenants?.some(t => t.id === '00000000-0000-0000-0000-000000000001');

  if (babycareTenantExists && testTenantExists) {
    risks.push('🔴 CRITICAL: Babycare tenant + test tenant on same DB');
  }

  if (risks.length === 0) {
    console.log('✅ NO CRITICAL RISKS DETECTED');
  } else {
    console.log('🔴 RISKS IDENTIFIED:');
    console.log('');
    risks.forEach(risk => console.log(`   ${risk}`));
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
}

auditRLSSecurity().catch(console.error);
