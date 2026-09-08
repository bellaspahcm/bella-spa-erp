/**
 * Verify Primary Guardian Constraint
 * 
 * Tests that DB constraint prevents multiple primary guardians per student
 * 
 * MUST RUN AFTER migration 20260907000001
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyConstraint() {
  console.log('🔍 Verifying Primary Guardian Constraint...\n');

  try {
    // 1. Setup: Create test tenant
    console.log('1️⃣ Creating test tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Constraint Test Tenant',
        slug: `constraint-test-${Date.now()}`,
        settings: {},
      })
      .select()
      .single();

    if (tenantError) {
      console.error('❌ Tenant creation failed:', tenantError.message);
      return;
    }
    console.log(`✅ Tenant created: ${tenant.id}\n`);

    // 2. Create test student
    console.log('2️⃣ Creating test student...');
    const { data: student, error: studentError } = await supabase
      .from('preschool_students')
      .insert({
        tenant_id: tenant.id,
        student_code: `TEST-${Date.now()}`,
        first_name: 'Test',
        last_name: 'Student',
        date_of_birth: '2020-01-01',
        status: 'active',
      })
      .select()
      .single();

    if (studentError) {
      console.error('❌ Student creation failed:', studentError.message);
      return;
    }
    console.log(`✅ Student created: ${student.id}\n`);

    // 3. Create test customers (guardians)
    console.log('3️⃣ Creating test customers...');
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .insert([
        {
          tenant_id: tenant.id,
          name_mother: 'Guardian One',
          phone: '+1-555-0001',
        },
        {
          tenant_id: tenant.id,
          name_mother: 'Guardian Two',
          phone: '+1-555-0002',
        },
      ])
      .select();

    if (customerError || !customers || customers.length < 2) {
      console.error('❌ Customer creation failed:', customerError?.message);
      return;
    }
    console.log(`✅ Created ${customers.length} customers\n`);

    // 4. Test: Add first primary guardian (should succeed)
    console.log('4️⃣ Adding first primary guardian...');
    const { data: guardian1, error: guardian1Error } = await supabase
      .from('preschool_student_guardians')
      .insert({
        tenant_id: tenant.id,
        student_id: student.id,
        guardian_customer_id: customers[0].id,
        relationship_type: 'mother',
        is_primary_contact: true,
        is_authorized_pickup: true,
        is_emergency_contact: false,
      })
      .select()
      .single();

    if (guardian1Error) {
      console.error('❌ First guardian creation failed:', guardian1Error.message);
      return;
    }
    console.log(`✅ First primary guardian added: ${guardian1.id}\n`);

    // 5. Test: Add second primary guardian WITHOUT updating first (should FAIL)
    console.log('5️⃣ Attempting to add second primary guardian (should fail)...');
    const { data: guardian2, error: guardian2Error } = await supabase
      .from('preschool_student_guardians')
      .insert({
        tenant_id: tenant.id,
        student_id: student.id,
        guardian_customer_id: customers[1].id,
        relationship_type: 'father',
        is_primary_contact: true, // This should violate constraint
        is_authorized_pickup: true,
        is_emergency_contact: false,
      })
      .select()
      .single();

    if (guardian2Error) {
      // Expected error
      if (guardian2Error.message.includes('preschool_student_guardians_one_primary_per_student')) {
        console.log('✅ CONSTRAINT ENFORCED: Duplicate primary guardian rejected');
        console.log(`   Error: ${guardian2Error.message}\n`);
      } else {
        console.error('❌ Unexpected error:', guardian2Error.message);
        return;
      }
    } else {
      console.error('❌ CONSTRAINT FAILED: Second primary guardian was allowed!');
      console.error(`   Guardian 2 ID: ${guardian2?.id}`);
      console.error('   This violates business invariant!\n');
      return;
    }

    // 6. Verify: Check only ONE primary guardian exists
    console.log('6️⃣ Verifying only one primary guardian exists...');
    const { data: primaryGuardians, error: queryError } = await supabase
      .from('preschool_student_guardians')
      .select('*')
      .eq('student_id', student.id)
      .eq('is_primary_contact', true);

    if (queryError) {
      console.error('❌ Query failed:', queryError.message);
      return;
    }

    if (primaryGuardians.length === 1) {
      console.log('✅ VERIFIED: Exactly ONE primary guardian exists');
      console.log(`   Primary guardian ID: ${primaryGuardians[0].id}\n`);
    } else {
      console.error(`❌ INVARIANT VIOLATED: Found ${primaryGuardians.length} primary guardians`);
      console.error('   Expected: 1');
      console.error('   Actual:', primaryGuardians.map((g) => g.id));
      return;
    }

    // 7. Test: Update first guardian to non-primary, then add second as primary (should succeed)
    console.log('7️⃣ Unsetting first primary, adding second...');

    // Unset first
    const { error: unsetError } = await supabase
      .from('preschool_student_guardians')
      .update({ is_primary_contact: false })
      .eq('id', guardian1.id);

    if (unsetError) {
      console.error('❌ Unset failed:', unsetError.message);
      return;
    }

    // Add second as primary
    const { data: guardian2Success, error: guardian2SuccessError } = await supabase
      .from('preschool_student_guardians')
      .insert({
        tenant_id: tenant.id,
        student_id: student.id,
        guardian_customer_id: customers[1].id,
        relationship_type: 'father',
        is_primary_contact: true,
        is_authorized_pickup: true,
        is_emergency_contact: false,
      })
      .select()
      .single();

    if (guardian2SuccessError) {
      console.error('❌ Second guardian creation failed:', guardian2SuccessError.message);
      return;
    }

    console.log('✅ Second primary guardian added successfully after unsetting first');
    console.log(`   Guardian 2 ID: ${guardian2Success.id}\n`);

    // 8. Final verification
    console.log('8️⃣ Final verification...');
    const { data: finalPrimaryGuardians } = await supabase
      .from('preschool_student_guardians')
      .select('*')
      .eq('student_id', student.id)
      .eq('is_primary_contact', true);

    if (finalPrimaryGuardians && finalPrimaryGuardians.length === 1) {
      console.log('✅ FINAL VERIFICATION PASSED: Still only ONE primary guardian\n');
    } else {
      console.error(`❌ FINAL VERIFICATION FAILED: ${finalPrimaryGuardians?.length} primary guardians\n`);
      return;
    }

    // 9. Cleanup
    console.log('9️⃣ Cleaning up test data...');
    await supabase.from('preschool_student_guardians').delete().eq('student_id', student.id);
    await supabase.from('preschool_students').delete().eq('id', student.id);
    await supabase.from('customers').delete().eq('tenant_id', tenant.id);
    await supabase.from('tenants').delete().eq('id', tenant.id);
    console.log('✅ Cleanup complete\n');

    // Success summary
    console.log('═══════════════════════════════════════');
    console.log('✅ PRIMARY GUARDIAN CONSTRAINT VERIFIED');
    console.log('═══════════════════════════════════════\n');

    console.log('✅ Constraint prevents duplicate primary guardians');
    console.log('✅ Invariant enforced at DB level');
    console.log('✅ Application can safely rely on ONE primary per student\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyConstraint();
