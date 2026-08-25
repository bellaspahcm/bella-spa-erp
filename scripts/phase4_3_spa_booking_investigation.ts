#!/usr/bin/env tsx
/**
 * Phase 4.3: SPA_BOOKING Schema & Provenance Investigation
 * READ-ONLY analysis - FINAL INFERABLE SOURCE (31 records, 5%)
 * 
 * CRITICAL: If links to production SPA data → REPORT ONLY, no automatic classification
 * 
 * FROZEN BOUNDARY:
 * ✅ READ-ONLY
 * ❌ NO migrations, NO mutations, NO SPA business data changes
 * ⚠️  Production SPA data → Human Architect review required
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 Phase 4.3: SPA_BOOKING Schema & Provenance Investigation');
  console.log('📊 Target: 31 SPA_BOOKING transactions (5% of F1 POSTED)');
  console.log('⚠️  FINAL INFERABLE SOURCE — CRITICAL INVESTIGATION');
  console.log('🔒 Mode: READ-ONLY (no mutations)');
  console.log('═'.repeat(80));

  // Step 1: Verify SPA_BOOKING count
  console.log('\n📋 Step 1: Verify SPA_BOOKING Transaction Count');
  console.log('─'.repeat(80));
  
  const { count: f1Count, error: f1Error } = await supabase
    .from('finance_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'SPA_BOOKING')
    .eq('status', 'POSTED');

  if (f1Error) {
    console.error(`❌ Error: ${f1Error.message}`);
    return;
  }

  console.log(`✅ Found ${f1Count || 0} SPA_BOOKING transactions in F1`);
  
  if (f1Count !== 31) {
    console.log(`⚠️  Count mismatch: Expected 31, found ${f1Count}`);
  }

  if (!f1Count || f1Count === 0) {
    console.log('\n⚠️  WARNING: No SPA_BOOKING transactions found');
    return;
  }

  // Step 2: Sample SPA_BOOKING transactions
  console.log('\n📋 Step 2: Sample SPA_BOOKING Transactions');
  console.log('─'.repeat(80));
  
  const { data: f1Samples, error: f1SampleError } = await supabase
    .from('finance_transactions')
    .select('id, source_id, tenant_id, posted_at, created_at, status')
    .eq('source_type', 'SPA_BOOKING')
    .eq('status', 'POSTED')
    .order('created_at', { ascending: true })
    .limit(10);

  if (f1SampleError) {
    console.error(`❌ Error: ${f1SampleError.message}`);
    return;
  }

  if (f1Samples && f1Samples.length > 0) {
    console.log(`✅ Sample ${f1Samples.length} SPA_BOOKING F1 records`);
    console.log('\n📝 Sample source_ids:');
    f1Samples.slice(0, 5).forEach(r => {
      console.log(`   ${r.source_id}`);
      console.log(`      tenant: ${r.tenant_id}`);
      console.log(`      created: ${r.created_at}`);
    });

    // CRITICAL: Analyze source_id format
    console.log(`\n🔍 GATE 1: source_id Format Analysis (Type Compatibility)`);
    console.log('─'.repeat(80));
    
    const firstSourceId = f1Samples[0].source_id;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSourceId);
    const isCustomString = !isUUID;

    console.log(`   First source_id: ${firstSourceId}`);
    console.log(`   Format: ${isUUID ? '✅ UUID' : '❌ Custom string'}`);
    
    if (isCustomString) {
      console.log(`\n🔴 GATE 1: FAILED (Custom string format)`);
      console.log(`   Same pattern as SALES_ORDER/AP_PAYMENT`);
      console.log(`   Classification: UNKNOWABLE (type incompatibility)`);
      console.log('');
      console.log('⚠️  Test/demo data pattern detected');
      console.log('   Recommendation: Consolidate with SALES_ORDER + AP_PAYMENT cleanup');
      console.log('');
      console.log('Impact:');
      console.log('   Total UNKNOWABLE: 554 (82%)');
      console.log('   PROVABLE: 128 (19%)');
      console.log('   INFERABLE: 0 (0%)');
      return;
    }

    console.log(`\n✅ GATE 1: PASSED (UUID format — compatible with bookings.id)`);

    // Step 3: bookings table linkage
    console.log(`\n📋 Step 3 / GATE 2: bookings Table Linkage Verification`);
    console.log('─'.repeat(80));
    
    const sourceIds = f1Samples.map(f => f.source_id);
    
    try {
      const { data: linkedBookings, error: linkError } = await supabase
        .from('bookings')
        .select('*')
        .in('id', sourceIds);

      if (linkError) {
        console.error(`❌ Linkage check error: ${linkError.message}`);
        console.log(`\n🔴 GATE 2: FAILED (Linkage error)`);
        console.log(`   Classification: UNKNOWABLE`);
        return;
      }

      const matchCount = linkedBookings?.length || 0;
      const sampleTotal = f1Samples.length;
      const matchRate = (matchCount / sampleTotal) * 100;

      console.log(`\n📊 Linkage Results (sample):`);
      console.log(`   Total F1 SPA_BOOKING: ${sampleTotal}`);
      console.log(`   Matched bookings: ${matchCount}`);
      console.log(`   Unmatched: ${sampleTotal - matchCount}`);
      console.log(`   Match rate: ${matchRate.toFixed(1)}%`);

      if (matchRate < 80) {
        console.log(`\n🔴 GATE 2: FAILED (Match rate < 80%)`);
        console.log(`   Classification: UNKNOWABLE (poor linkage quality)`);
        return;
      }

      console.log(`\n✅ GATE 2: PASSED (Match rate >= 80%)`);

      if (matchCount > 0) {
        // Step 4: CRITICAL - Production data check
        console.log(`\n📋 Step 4 / GATE 3: Production SPA Data Detection (CRITICAL)`);
        console.log('═'.repeat(80));
        
        const sampleBooking = linkedBookings![0];
        const allFields = Object.keys(sampleBooking);
        
        console.log(`\n📝 Sample booking Schema:`);
        console.log(`   Total fields: ${allFields.length}`);
        
        // Check for production indicators
        const productionIndicators = {
          hasCustomerId: 'customer_id' in sampleBooking && sampleBooking.customer_id,
          hasServiceId: 'service_id' in sampleBooking && sampleBooking.service_id,
          hasStaffId: 'staff_id' in sampleBooking && sampleBooking.staff_id,
          hasStatus: 'status' in sampleBooking && sampleBooking.status,
          statusValue: sampleBooking.status,
          isCompleted: sampleBooking.status === 'COMPLETED' || sampleBooking.status === 'CONFIRMED',
          createdAt: sampleBooking.created_at,
          isRecent: new Date(sampleBooking.created_at) > new Date('2026-01-01')
        };

        console.log(`\n🔍 Production Data Indicators:`);
        console.log(`   customer_id populated: ${productionIndicators.hasCustomerId ? '⚠️  YES' : '✅ NO'}`);
        console.log(`   service_id populated: ${productionIndicators.hasServiceId ? '⚠️  YES' : '✅ NO'}`);
        console.log(`   staff_id populated: ${productionIndicators.hasStaffId ? '⚠️  YES' : '✅ NO'}`);
        console.log(`   status: ${productionIndicators.statusValue}`);
        console.log(`   completed/confirmed: ${productionIndicators.isCompleted ? '⚠️  YES' : '✅ NO'}`);
        console.log(`   created_at: ${productionIndicators.createdAt}`);
        console.log(`   recent (2026+): ${productionIndicators.isRecent ? '⚠️  YES' : '✅ NO'}`);

        const productionScore = [
          productionIndicators.hasCustomerId,
          productionIndicators.hasServiceId,
          productionIndicators.hasStaffId,
          productionIndicators.isCompleted,
          productionIndicators.isRecent
        ].filter(Boolean).length;

        console.log(`\n📊 Production Score: ${productionScore}/5`);

        if (productionScore >= 3) {
          console.log(`\n🛑 GATE 3: PRODUCTION SPA DATA DETECTED`);
          console.log('═'.repeat(80));
          console.log('');
          console.log('⚠️  CRITICAL: SPA_BOOKING links to production SPA bookings');
          console.log('');
          console.log('🔒 FROZEN BOUNDARY ACTIVATED:');
          console.log('   ❌ NO automatic classification');
          console.log('   ❌ NO backfill strategy design');
          console.log('   ❌ NO SPA business data modifications');
          console.log('');
          console.log('📋 Evidence Summary:');
          console.log(`   - ${matchCount}/${sampleTotal} F1 records link to bookings (${matchRate.toFixed(1)}%)`);
          console.log(`   - Production indicators: ${productionScore}/5`);
          console.log(`   - customer_id: ${productionIndicators.hasCustomerId}`);
          console.log(`   - service_id: ${productionIndicators.hasServiceId}`);
          console.log(`   - staff_id: ${productionIndicators.hasStaffId}`);
          console.log(`   - status: ${productionIndicators.statusValue}`);
          console.log('');
          console.log('🎯 Required Actions:');
          console.log('   1. Human Architect review');
          console.log('   2. Determine if SPA_BOOKING backfill is safe');
          console.log('   3. Define policy: Which date = document_date?');
          console.log('   4. Approve classification (PROVABLE/INFERABLE)');
          console.log('   5. Approve backfill strategy');
          console.log('');
          console.log('📅 Date Fields Available (for Human Architect review):');
          
          const dateFields = allFields.filter(key => {
            const value = sampleBooking[key];
            return value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/);
          });
          
          if (dateFields.length > 0) {
            const systemMetadata = ['created_at', 'updated_at', 'deleted_at'];
            dateFields.forEach(field => {
              const isSystem = systemMetadata.includes(field);
              const marker = isSystem ? '⚠️  SYSTEM' : '✅ BUSINESS';
              console.log(`   ${marker}: ${field} = ${sampleBooking[field]}`);
            });
          }

          console.log('');
          console.log('🔴 Investigation PAUSED — awaiting Human Architect decision');
          return;
        }

        console.log(`\n✅ GATE 3: PASSED (Test/demo data, production score < 3)`);

        // Step 5: Date field analysis (only if non-production)
        console.log(`\n📋 Step 5 / GATE 4: Date Field Analysis`);
        console.log('─'.repeat(80));
        
        const dateFields = allFields.filter(key => {
          const value = sampleBooking[key];
          return value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/);
        });

        console.log(`\n📅 Date Fields Found (${dateFields.length}):`);
        
        if (dateFields.length === 0) {
          console.log('   ❌ No date fields found');
          console.log(`\n🔴 GATE 4: FAILED (No date fields)`);
          console.log(`   Classification: UNKNOWABLE`);
          return;
        }

        const systemMetadata = ['created_at', 'updated_at', 'deleted_at'];
        const businessDateFields = dateFields.filter(f => !systemMetadata.includes(f));

        dateFields.forEach(field => {
          const isSystem = systemMetadata.includes(field);
          const marker = isSystem ? '⚠️  SYSTEM' : '✅ BUSINESS';
          console.log(`   ${marker}: ${field} = ${sampleBooking[field]}`);
        });

        console.log(`\n📊 Date Field Quality:`);
        console.log(`   Business date fields: ${businessDateFields.length}`);
        console.log(`   System metadata fields: ${dateFields.filter(f => systemMetadata.includes(f)).length}`);

        if (businessDateFields.length === 0) {
          console.log(`\n🔴 GATE 4: FAILED (Only system metadata)`);
          console.log(`   Classification: UNKNOWABLE`);
          console.log(`   Reason: No business date fields available`);
          return;
        }

        console.log(`\n✅ GATE 4: PASSED (Business date fields available)`);

        // Final classification
        console.log(`\n📋 Step 6: Provenance Classification`);
        console.log('═'.repeat(80));
        console.log('');
        console.log('✅ ALL GATES PASSED');
        console.log('');
        console.log('Classification Decision:');
        console.log('');
        
        const hasExplicitDocDate = businessDateFields.includes('booking_date') || businessDateFields.includes('document_date');
        
        if (hasExplicitDocDate) {
          console.log('🟢 Preliminary: PROVABLE');
          console.log('   - UUID linkage: ✅');
          console.log('   - Match rate > 80%: ✅');
          console.log('   - Explicit business date field: ✅');
          console.log('   - Non-production data: ✅');
          console.log('');
          console.log('Recommended field:', businessDateFields.find(f => f.includes('booking') || f.includes('document')));
        } else {
          console.log('🟡 Preliminary: INFERABLE');
          console.log('   - UUID linkage: ✅');
          console.log('   - Match rate > 80%: ✅');
          console.log('   - Business date field available: ✅');
          console.log('   - Requires policy assumption: ⚠️');
          console.log('');
          console.log('Available fields:', businessDateFields.join(', '));
          console.log('Policy decision required: Which date = document_date?');
        }

        console.log('');
        console.log('Impact:');
        console.log(`   SPA_BOOKING: 31 records recoverable`);
        console.log(`   UNKNOWABLE: 519 → 488 (77% → 72%)`);
        console.log(`   ${hasExplicitDocDate ? 'PROVABLE' : 'INFERABLE'}: 128 → ${hasExplicitDocDate ? 159 : 128} (${hasExplicitDocDate ? '24%' : '19%'})`);
      }

    } catch (err) {
      console.error(`❌ Exception: ${err}`);
    }
  }

  console.log('\n✅ Phase 4.3 Investigation Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Document findings in PHASE4_3_SPA_BOOKING_INVESTIGATION.md');
  console.log('   2. If production data: Await Human Architect review');
  console.log('   3. If non-production: Update PHASE3_BACKFILL_POLICY.md');
  console.log('   4. Proceed to Migration Proposal design (Phase 4.4)');
  console.log('');
  console.log('🔒 Reminder: NO mutations performed (READ-ONLY investigation)');
  console.log('');
}

main().catch(console.error);
