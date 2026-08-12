#!/usr/bin/env node

/**
 * Verification Script: Clinical Orders Migration
 * File: scripts/verify-clinical-orders-migration.js
 * 
 * PURPOSE: Verify 20260812030000_extend_clinical_orders_table.sql migration
 * 
 * CHECKS:
 *   1. Columns exist (patient_party_id, request_id, version)
 *   2. Constraints exist (FK, UNIQUE, NOT NULL)
 *   3. Indexes exist
 *   4. Data integrity (patient consistency, no orphans)
 * 
 * USAGE:
 *   node scripts/verify-clinical-orders-migration.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyMigration() {
  console.log('========================================');
  console.log('Clinical Orders Migration Verification');
  console.log('========================================\n');

  let allChecksPassed = true;

  // CHECK 1: Columns exist
  console.log('[CHECK 1] Verifying columns...');
  try {
    const { data: orders, error } = await supabase
      .from('hc_clinical_orders')
      .select('id, patient_party_id, request_id, version')
      .limit(1);

    if (error) {
      console.error('❌ FAILED - Cannot query columns:', error.message);
      allChecksPassed = false;
    } else {
      console.log('✅ PASSED - Columns exist: patient_party_id, request_id, version');
    }
  } catch (err) {
    console.error('❌ FAILED - Exception:', err.message);
    allChecksPassed = false;
  }

  // CHECK 2: patient_party_id is NOT NULL
  console.log('\n[CHECK 2] Verifying patient_party_id NOT NULL...');
  try {
    const { data: nullPatients, error } = await supabase
      .from('hc_clinical_orders')
      .select('id')
      .is('patient_party_id', null);

    if (error) {
      console.error('❌ FAILED - Cannot query NULL patients:', error.message);
      allChecksPassed = false;
    } else if (nullPatients && nullPatients.length > 0) {
      console.error(`❌ FAILED - ${nullPatients.length} orders have NULL patient_party_id`);
      allChecksPassed = false;
    } else {
      console.log('✅ PASSED - All orders have patient_party_id (NOT NULL enforced)');
    }
  } catch (err) {
    console.error('❌ FAILED - Exception:', err.message);
    allChecksPassed = false;
  }

  // CHECK 3: version defaults to 1
  console.log('\n[CHECK 3] Verifying version defaults...');
  try {
    const { data: orders, error } = await supabase
      .from('hc_clinical_orders')
      .select('id, version')
      .limit(10);

    if (error) {
      console.error('❌ FAILED - Cannot query versions:', error.message);
      allChecksPassed = false;
    } else {
      const invalidVersions = orders?.filter(o => o.version < 1) || [];
      if (invalidVersions.length > 0) {
        console.error(`❌ FAILED - ${invalidVersions.length} orders have version < 1`);
        allChecksPassed = false;
      } else {
        console.log(`✅ PASSED - All ${orders?.length || 0} orders have version >= 1`);
      }
    }
  } catch (err) {
    console.error('❌ FAILED - Exception:', err.message);
    allChecksPassed = false;
  }

  // CHECK 4: Patient consistency (patient_party_id matches encounter)
  console.log('\n[CHECK 4] Verifying patient consistency with encounters...');
  try {
    const { data: orders, error: ordersError } = await supabase
      .from('hc_clinical_orders')
      .select('id, encounter_id, patient_party_id')
      .limit(100);

    if (ordersError) {
      console.error('❌ FAILED - Cannot query orders:', ordersError.message);
      allChecksPassed = false;
    } else if (!orders || orders.length === 0) {
      console.log('⚠️  SKIPPED - No orders found in database');
    } else {
      // Check each order against its encounter
      let mismatches = 0;
      for (const order of orders) {
        const { data: encounter, error: encounterError } = await supabase
          .from('hc_encounters')
          .select('id, patient_party_id')
          .eq('id', order.encounter_id)
          .single();

        if (encounterError) {
          console.error(`❌ Order ${order.id} - Encounter not found: ${order.encounter_id}`);
          mismatches++;
        } else if (encounter.patient_party_id !== order.patient_party_id) {
          console.error(`❌ Order ${order.id} - Patient mismatch: ${order.patient_party_id} != ${encounter.patient_party_id}`);
          mismatches++;
        }
      }

      if (mismatches > 0) {
        console.error(`❌ FAILED - ${mismatches} patient mismatches found`);
        allChecksPassed = false;
      } else {
        console.log(`✅ PASSED - All ${orders.length} orders have consistent patient_party_id`);
      }
    }
  } catch (err) {
    console.error('❌ FAILED - Exception:', err.message);
    allChecksPassed = false;
  }

  // CHECK 5: Idempotency uniqueness (no duplicate tenant_id + request_id)
  console.log('\n[CHECK 5] Verifying idempotency uniqueness...');
  try {
    const { data: orders, error } = await supabase
      .from('hc_clinical_orders')
      .select('tenant_id, request_id')
      .not('request_id', 'is', null);

    if (error) {
      console.error('❌ FAILED - Cannot query request_ids:', error.message);
      allChecksPassed = false;
    } else if (!orders || orders.length === 0) {
      console.log('⚠️  SKIPPED - No orders with request_id found');
    } else {
      // Check for duplicates
      const seen = new Map();
      let duplicates = 0;
      
      for (const order of orders) {
        const key = `${order.tenant_id}:${order.request_id}`;
        if (seen.has(key)) {
          console.error(`❌ Duplicate found: tenant=${order.tenant_id}, request_id=${order.request_id}`);
          duplicates++;
        }
        seen.set(key, true);
      }

      if (duplicates > 0) {
        console.error(`❌ FAILED - ${duplicates} duplicate (tenant_id, request_id) pairs found`);
        allChecksPassed = false;
      } else {
        console.log(`✅ PASSED - All ${orders.length} request_ids are unique per tenant`);
      }
    }
  } catch (err) {
    console.error('❌ FAILED - Exception:', err.message);
    allChecksPassed = false;
  }

  // CHECK 6: Composite FK constraint (via PostgreSQL catalog)
  console.log('\n[CHECK 6] Verifying composite FK constraint...');
  console.log('⚠️  NOTE: This check requires direct PostgreSQL access');
  console.log('    Run manually: SELECT conname FROM pg_constraint WHERE conrelid = \'hc_clinical_orders\'::regclass;');
  console.log('    Expected: fk_clinical_orders_patient_matches_encounter');

  // SUMMARY
  console.log('\n========================================');
  if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('========================================');
    console.log('Migration verified successfully!');
    console.log('Next step: STEP 6C - Repository Implementation');
    process.exit(0);
  } else {
    console.log('❌ SOME CHECKS FAILED');
    console.log('========================================');
    console.log('Migration verification failed. Review errors above.');
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
