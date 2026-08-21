/**
 * Runtime Tenant Identity Data Audit — RCA #6
 * 
 * Purpose: Verify existing tenant_id values before TEXT→UUID migration
 * 
 * Checks:
 * 1. Count of tenant records
 * 2. UUID format validation
 * 3. Non-UUID tenant IDs
 * 4. Child table record counts
 * 5. Orphan tenants (Runtime but not in Core)
 * 6. Missing tenants (Core but not in Runtime)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceKey);

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function auditRuntimeData() {
  console.log('🔍 Runtime Tenant Identity Data Audit — RCA #6\n');
  console.log('═'.repeat(80));
  
  // 1. Count tenants in runtime_tenant_registry
  console.log('\n1. RUNTIME TENANT REGISTRY COUNT');
  console.log('─'.repeat(80));
  
  const { data: tenants, error: tenantsError } = await client
    .from('runtime_tenant_registry')
    .select('tenant_id, tenant_name, is_active');
  
  if (tenantsError) {
    console.log(`❌ Error: ${tenantsError.message}`);
  } else {
    console.log(`Total tenants: ${tenants?.length || 0}`);
    
    if (tenants && tenants.length > 0) {
      console.log('\nTenant IDs:');
      tenants.forEach((t, i) => {
        const isUuid = UUID_REGEX.test(t.tenant_id);
        const status = isUuid ? '✅ UUID' : '❌ TEXT';
        console.log(`  ${i + 1}. ${t.tenant_id} (${t.tenant_name}) - ${status}`);
      });
      
      // 2. UUID format validation
      console.log('\n2. UUID FORMAT VALIDATION');
      console.log('─'.repeat(80));
      
      const uuidTenants = tenants.filter(t => UUID_REGEX.test(t.tenant_id));
      const textTenants = tenants.filter(t => !UUID_REGEX.test(t.tenant_id));
      
      console.log(`✅ UUID-compliant: ${uuidTenants.length}`);
      console.log(`❌ TEXT (non-UUID): ${textTenants.length}`);
      
      if (textTenants.length > 0) {
        console.log('\n⚠️  NON-UUID TENANT IDs (blocking ALTER COLUMN):');
        textTenants.forEach(t => {
          console.log(`   - ${t.tenant_id} (${t.tenant_name})`);
        });
        console.log('\n⛔ CANNOT ALTER COLUMN TYPE UUID until TEXT values resolved');
      } else {
        console.log('\n✅ All tenant IDs are UUID-compliant - safe to ALTER COLUMN');
      }
    } else {
      console.log('✅ No tenant records - safe to ALTER COLUMN TYPE UUID');
    }
  }
  
  // 3. Child table record counts
  console.log('\n3. CHILD TABLE RECORD COUNTS');
  console.log('─'.repeat(80));
  
  const tables = [
    'runtime_outbox',
    'runtime_idempotency_registry',
    'runtime_audit_log',
    'runtime_quarantine',
  ];
  
  for (const table of tables) {
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`${table}: ❌ Error - ${error.message}`);
    } else {
      console.log(`${table}: ${count || 0} records`);
    }
  }
  
  // 4. Orphan audit: Runtime tenants not in Core
  console.log('\n4. ORPHAN AUDIT (Runtime → Core)');
  console.log('─'.repeat(80));
  
  if (tenants && tenants.length > 0) {
    const { data: coreTenants } = await client
      .from('tenants')
      .select('id');
    
    const coreTenantIds = new Set(coreTenants?.map(t => t.id) || []);
    
    const orphans = tenants.filter(rt => {
      // Check if TEXT tenant matches any Core UUID (cast comparison)
      return !coreTenantIds.has(rt.tenant_id) && 
             !Array.from(coreTenantIds).some(id => id === rt.tenant_id);
    });
    
    if (orphans.length > 0) {
      console.log(`❌ Found ${orphans.length} orphan tenant(s) in Runtime:`);
      orphans.forEach(t => {
        console.log(`   - ${t.tenant_id} (${t.tenant_name}) - NOT in public.tenants`);
      });
    } else {
      console.log('✅ No orphan tenants found');
    }
  }
  
  // 5. Missing tenants: Core tenants not in Runtime
  console.log('\n5. MISSING TENANTS (Core → Runtime)');
  console.log('─'.repeat(80));
  
  const { data: coreTenants } = await client
    .from('tenants')
    .select('id, name');
  
  if (coreTenants && coreTenants.length > 0) {
    const runtimeTenantIds = new Set(tenants?.map(t => t.tenant_id) || []);
    
    const missing = coreTenants.filter(ct => {
      return !runtimeTenantIds.has(ct.id) &&
             !runtimeTenantIds.has(ct.id.toLowerCase());
    });
    
    if (missing.length > 0) {
      console.log(`⚠️  Found ${missing.length} Core tenant(s) NOT in Runtime registry:`);
      missing.forEach(t => {
        console.log(`   - ${t.id} (${t.name})`);
      });
    } else {
      console.log('✅ All Core tenants exist in Runtime registry');
    }
  }
  
  // Summary
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('AUDIT SUMMARY');
  console.log('═'.repeat(80));
  
  const textCount = tenants?.filter(t => !UUID_REGEX.test(t.tenant_id)).length || 0;
  
  if (textCount > 0) {
    console.log('\n🔴 MIGRATION BLOCKED');
    console.log(`   Reason: ${textCount} TEXT tenant ID(s) found`);
    console.log('   Action: Require data migration strategy before ALTER COLUMN');
  } else if ((tenants?.length || 0) === 0) {
    console.log('\n🟢 MIGRATION SAFE');
    console.log('   Reason: No tenant data exists');
    console.log('   Action: Proceed with ALTER COLUMN TYPE UUID');
  } else {
    console.log('\n🟢 MIGRATION SAFE');
    console.log('   Reason: All tenant IDs are UUID-compliant');
    console.log('   Action: Proceed with ALTER COLUMN TYPE UUID');
  }
}

auditRuntimeData().catch(console.error);
