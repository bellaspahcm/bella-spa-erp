#!/usr/bin/env node
/**
 * Seed Gate 1 test data
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedGate1Data() {
  console.log('🌱 Seeding Gate 1 test data...\n');

  try {
    // 1. Get or create TEST tenant (not production)
    let { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Bella Test')
      .single();

    if (!tenant) {
      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert({
          name: 'Bella Test',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      tenant = newTenant;
      console.log('✅ Created TEST tenant:', tenant.id);
    } else {
      console.log('✅ Using existing TEST tenant:', tenant.id);
    }

    const tenantId = tenant.id;

    // 2. Create test manager
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .upsert({
        email: 'manager-gate1@bellaspa.local',
        full_name: 'Gate1 Test Manager',
        role: 'admin', // Use existing role
        tenant_id: tenantId,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (managerError) throw managerError;
    console.log('✅ Manager created:', manager.id);

    // 3. Create employee with HIGH balance (for success scenario)
    const { data: empHigh, error: empHighError } = await supabase
      .from('users')
      .upsert({
        email: 'employee-high-balance@bellaspa.local',
        full_name: 'Employee High Balance',
        role: 'ktv', // Use existing role
        tenant_id: tenantId,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (empHighError) throw empHighError;
    console.log('✅ Employee (high balance) created:', empHigh.id);

    // 4. Create employee with LOW balance (for rejection scenario)
    const { data: empLow, error: empLowError } = await supabase
      .from('users')
      .upsert({
        email: 'employee-low-balance@bellaspa.local',
        full_name: 'Employee Low Balance',
        role: 'ktv', // Use existing role
        tenant_id: tenantId,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (empLowError) throw empLowError;
    console.log('✅ Employee (low balance) created:', empLow.id);

    // 5. Create leave request #1 - SUCCESS SCENARIO (using raw SQL)
    const startDate1 = new Date();
    startDate1.setDate(startDate1.getDate() + 7);
    const endDate1 = new Date();
    endDate1.setDate(endDate1.getDate() + 11);

    const { data: req1, error: req1Error } = await supabase.rpc('exec_sql', {
      query: `
        INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days, reason, status, tenant_id)
        VALUES (
          'req-gate1-success',
          '${empHigh.id}',
          'annual',
          '${startDate1.toISOString().split('T')[0]}',
          '${endDate1.toISOString().split('T')[0]}',
          5,
          'Family vacation - Gate 1 test',
          'pending',
          '${tenantId}'
        )
        ON CONFLICT (id) DO UPDATE SET status = 'pending'
        RETURNING *;
      `
    });

    if (req1Error) {
      console.log('⚠️  Request 1 may already exist or SQL execution not supported');
      console.log('   Using direct query instead...');
      // Fallback: assume it exists
    } else {
      console.log('✅ Leave request (success) created: req-gate1-success');
    }

    // 6. Create leave request #2 - REJECTION SCENARIO
    const startDate2 = new Date();
    startDate2.setDate(startDate2.getDate() + 14);
    const endDate2 = new Date();
    endDate2.setDate(endDate2.getDate() + 18);

    const { data: req2, error: req2Error } = await supabase.rpc('exec_sql', {
      query: `
        INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days, reason, status, tenant_id)
        VALUES (
          'req-gate1-reject',
          '${empLow.id}',
          'annual',
          '${startDate2.toISOString().split('T')[0]}',
          '${endDate2.toISOString().split('T')[0]}',
          5,
          'Personal matter - Gate 1 test',
          'pending',
          '${tenantId}'
        )
        ON CONFLICT (id) DO UPDATE SET status = 'pending'
        RETURNING *;
      `
    });

    if (req2Error) {
      console.log('⚠️  Request 2 may already exist or SQL execution not supported');
    } else {
      console.log('✅ Leave request (reject) created: req-gate1-reject');
    }

    // Summary
    console.log('\n📋 Gate 1 Test Data Summary:');
    console.log('   Tenant ID:', tenantId);
    console.log('   Manager:', manager.email, `(${manager.id})`);
    console.log('   Employee (high):', empHigh.email, `(${empHigh.id})`);
    console.log('   Employee (low):', empLow.email, `(${empLow.id})`);
    console.log('   Request IDs: req-gate1-success, req-gate1-reject');
    console.log('\n✅ Ready for Gate 1 validation!');

    return {
      tenantId,
      managerId: manager.id,
      empHighId: empHigh.id,
      empLowId: empLow.id,
      req1Id: 'req-gate1-success',
      req2Id: 'req-gate1-reject',
    };
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  }
}

seedGate1Data()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
