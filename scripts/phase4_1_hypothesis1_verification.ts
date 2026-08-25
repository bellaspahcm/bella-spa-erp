#!/usr/bin/env tsx
/**
 * Phase 4.1 Hypothesis 1: SALES_ORDER → spa_bookings Verification
 * READ-ONLY verification of misnamed source_type hypothesis
 * 
 * Goal: Verify if SALES_ORDER source_ids resolve to spa_bookings.id
 *       AND if spa_bookings provides legitimate document_date provenance
 * 
 * NOT ALLOWED: Automatic upgrade from UNKNOWABLE to PROVABLE just because IDs match
 * REQUIRED: Verify semantic + lineage before classification
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
  console.log('🔍 Phase 4.1 Hypothesis 1: SALES_ORDER → spa_bookings Verification');
  console.log('🎯 Theory: source_type = "SALES_ORDER" is misnamed, actually references spa_bookings');
  console.log('🔒 Mode: READ-ONLY (no mutations)');
  console.log('═'.repeat(80));

  // Step 1: Verify spa_bookings table exists
  console.log('\n📋 Step 1: Check if spa_bookings table exists');
  console.log('─'.repeat(80));
  
  let spaBookingsExists = false;
  let foundTable: string | null = null;
  
  const bookingTableCandidates = [
    'spa_bookings',
    'bookings',
    'spa_services',
    'service_bookings',
    'appointments',
    'spa_appointments'
  ];
  
  for (const tableName of bookingTableCandidates) {
    try {
      console.log(`   Trying: ${tableName}...`);
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

      if (!error) {
        console.log(`   ✅ Table "${tableName}" exists!`);
        foundTable = tableName;
        spaBookingsExists = true;
        break;
      } else {
        console.log(`   ❌ ${tableName}: ${error.message}`);
      }
    } catch (err) {
      console.log(`   ❌ ${tableName}: not found`);
    }
  }

  if (!spaBookingsExists || !foundTable) {
    console.log(`\n🔴 Hypothesis 1: REJECTED (no booking tables found)`);
    console.log('   Attempted tables: ' + bookingTableCandidates.join(', '));
    console.log('   Classification remains: UNKNOWABLE');
    console.log('');
    console.log('🎯 Alternative Investigation:');
    console.log('   • Check if SALES_ORDER is external system reference');
    console.log('   • Review F1 creation code for source_type origin');
    console.log('   • Consider manual review of 208 records');
    return;
  }

  console.log(`\n✅ Using table: ${foundTable}`);

  // Step 2: Get SALES_ORDER F1 records
  console.log('\n📋 Step 2: Fetch SALES_ORDER F1 Transaction Sample');
  console.log('─'.repeat(80));

  const { data: f1Records, error: f1Error } = await supabase
    .from('finance_transactions')
    .select('id, source_id, tenant_id, posted_at, created_at')
    .eq('source_type', 'SALES_ORDER')
    .eq('status', 'POSTED')
    .order('created_at', { ascending: true })
    .limit(10);

  if (f1Error) {
    console.error(`❌ Error fetching F1: ${f1Error.message}`);
    return;
  }

  if (!f1Records || f1Records.length === 0) {
    console.log('⚠️  No SALES_ORDER F1 records found');
    return;
  }

  console.log(`✅ Found ${f1Records.length} SALES_ORDER F1 records (sample)`);
  console.log('\n📝 Sample F1 source_ids:');
  f1Records.slice(0, 5).forEach(r => {
    console.log(`   ${r.source_id} (tenant: ${r.tenant_id})`);
  });

  // Step 3: Attempt to resolve source_ids in spa_bookings
  console.log('\n📋 Step 3: Resolve source_ids in spa_bookings');
  console.log('─'.repeat(80));

  const sourceIds = f1Records.map(r => r.source_id);
  
  const { data: resolvedBookings, error: resolveError } = await supabase
    .from(foundTable)
    .select('*')
    .in('id', sourceIds);

  if (resolveError) {
    console.error(`❌ Error resolving: ${resolveError.message}`);
    return;
  }

  const matchedCount = resolvedBookings?.length || 0;
  const totalSample = f1Records.length;

  console.log(`\n✅ ID Resolution Results (sample):`);
  console.log(`   Total F1 SALES_ORDER: ${totalSample}`);
  console.log(`   Matched spa_bookings: ${matchedCount}`);
  console.log(`   Unmatched: ${totalSample - matchedCount}`);
  console.log(`   Match rate: ${((matchedCount / totalSample) * 100).toFixed(1)}%`);

  if (matchedCount === 0) {
    console.log('\n🔴 Hypothesis 1: REJECTED (no ID matches found)');
    console.log('   SALES_ORDER source_ids do NOT resolve to spa_bookings');
    console.log('   Classification remains: UNKNOWABLE');
    return;
  }

  // Step 4: Analyze date fields in matched spa_bookings
  console.log(`\n📋 Step 4: Date Field Analysis in ${foundTable}`);
  console.log('─'.repeat(80));

  if (resolvedBookings && resolvedBookings.length > 0) {
    const sampleBooking = resolvedBookings[0];
    
    console.log(`\n📝 Sample ${foundTable} Schema:`);
    const allFields = Object.keys(sampleBooking);
    console.log(`   Total fields: ${allFields.length}`);
    
    // Identify date fields
    const dateFields = allFields.filter(key => {
      const value = sampleBooking[key];
      return value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/);
    });

    console.log(`\n📅 Date Fields Found (${dateFields.length}):`);
    
    if (dateFields.length === 0) {
      console.log('   ❌ No date fields found');
      console.log('\n🔴 Hypothesis 1: REJECTED (no date provenance available)');
      console.log('   Classification remains: UNKNOWABLE');
      return;
    }

    const systemMetadataFields = ['created_at', 'updated_at', 'deleted_at'];
    const businessDateFields = dateFields.filter(f => !systemMetadataFields.includes(f));

    dateFields.forEach(field => {
      const isSystemMetadata = systemMetadataFields.includes(field);
      const marker = isSystemMetadata ? '⚠️  SYSTEM' : '✅ BUSINESS';
      console.log(`   ${marker}: ${field} = ${sampleBooking[field]}`);
    });

    console.log(`\n📊 Date Field Classification:`);
    console.log(`   Business date fields: ${businessDateFields.length}`);
    console.log(`   System metadata fields: ${dateFields.filter(f => systemMetadataFields.includes(f)).length}`);

    if (businessDateFields.length === 0) {
      console.log('\n🟡 WARNING: Only system metadata dates available (created_at/updated_at)');
      console.log('   Using created_at as document_date requires policy approval');
      console.log('   Classification: INFERABLE (not PROVABLE) if approved');
    }

    // Step 5: Semantic Analysis
    console.log('\n📋 Step 5: Semantic Analysis — Document Date Candidates');
    console.log('─'.repeat(80));

    const documentDateCandidates = [
      { field: 'booking_date', semantic: 'Booking creation/confirmation date', quality: 'HIGH' },
      { field: 'service_date', semantic: 'Service delivery date', quality: 'HIGH' },
      { field: 'start_date', semantic: 'Booking start date', quality: 'MEDIUM' },
      { field: 'completed_date', semantic: 'Service completion date', quality: 'MEDIUM' },
      { field: 'created_at', semantic: 'System record creation (NOT business date)', quality: 'LOW' },
    ];

    console.log('\n📝 Document Date Candidates:');
    const availableCandidates = documentDateCandidates.filter(c => allFields.includes(c.field));
    
    if (availableCandidates.length === 0) {
      console.log('   ❌ No standard document date fields found');
    } else {
      availableCandidates.forEach(c => {
        const value = sampleBooking[c.field];
        const hasValue = value ? '✅' : '❌';
        console.log(`   ${hasValue} ${c.field}:`);
        console.log(`      Semantic: ${c.semantic}`);
        console.log(`      Quality: ${c.quality}`);
        if (value) {
          console.log(`      Sample value: ${value}`);
        }
      });
    }

    // Step 6: Full Coverage Analysis
    console.log('\n📋 Step 6: Full Coverage Analysis (all 208 SALES_ORDER records)');
    console.log('─'.repeat(80));

    const { count: totalF1, error: countError } = await supabase
      .from('finance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('source_type', 'SALES_ORDER')
      .eq('status', 'POSTED');

    if (countError) {
      console.error(`❌ Error counting: ${countError.message}`);
    } else {
      console.log(`\n📊 Full Population Coverage:`);
      console.log(`   Total SALES_ORDER F1: ${totalF1 || 0}`);
      
      // Estimate based on sample match rate
      const estimatedMatches = Math.round((totalF1 || 0) * (matchedCount / totalSample));
      const estimatedUnmatched = (totalF1 || 0) - estimatedMatches;
      
      console.log(`   Estimated ${foundTable} matches: ${estimatedMatches} (~${((matchedCount / totalSample) * 100).toFixed(1)}%)`);
      console.log(`   Estimated unmatched: ${estimatedUnmatched}`);
    }

    // Step 7: Provenance Classification
    console.log('\n📋 Step 7: Provenance Quality Classification');
    console.log('═'.repeat(80));

    const hasBusinessDate = businessDateFields.length > 0;
    const highQualityCandidates = availableCandidates.filter(c => c.quality === 'HIGH');
    
    console.log('\n🎯 Classification Decision:');
    console.log('');

    if (matchedCount === totalSample && hasBusinessDate && highQualityCandidates.length > 0) {
      console.log('✅ PROVABLE (if all conditions verified):');
      console.log('   • 100% ID match rate (sample)');
      console.log('   • Business date field(s) available');
      console.log('   • High-quality document date candidate(s) present');
      console.log('');
      console.log('   Recommended field: ' + highQualityCandidates[0].field);
      console.log('   Semantic: ' + highQualityCandidates[0].semantic);
      console.log('');
      console.log('   ⚠️  REQUIRES: Full population verification (all 208 records)');
      
    } else if (matchedCount >= totalSample * 0.8 && hasBusinessDate) {
      console.log('🟡 INFERABLE (with policy assumption):');
      console.log('   • Partial ID match rate: ' + ((matchedCount / totalSample) * 100).toFixed(1) + '%');
      console.log('   • Business date field(s) available');
      console.log('   • Requires policy: Which date = document_date?');
      console.log('');
      console.log('   Unmatched records: Remain UNKNOWABLE');
      
    } else if (matchedCount > 0 && businessDateFields.length === 0) {
      console.log('🟡 INFERABLE (system metadata only):');
      console.log('   • IDs match spa_bookings');
      console.log('   • Only created_at/updated_at available');
      console.log('   • Requires explicit policy approval to use created_at');
      console.log('');
      console.log('   ⚠️  Anti-Pattern AP-5: created_at as business date fallback');
      console.log('   Classification: INFERABLE (NOT PROVABLE)');
      
    } else {
      console.log('❌ UNKNOWABLE:');
      console.log('   • Low match rate or no date provenance');
      console.log('   • Cannot reliably determine document_date');
    }

    // Step 8: Hypothesis Verdict
    console.log('\n📋 Step 8: Hypothesis 1 Verdict');
    console.log('═'.repeat(80));
    console.log('');

    if (matchedCount === totalSample) {
      console.log('✅ Hypothesis 1: CONFIRMED (sample verification)');
      console.log(`   • SALES_ORDER source_ids DO resolve to ${foundTable}`);
      console.log('   • Source_type is likely misnamed or legacy');
      console.log('   • Date provenance: ' + (hasBusinessDate ? 'Available' : 'Limited to system metadata'));
      console.log('');
      console.log('🎯 Recommendation:');
      console.log('   1. Verify full population (all 208 records)');
      console.log('   2. Document semantic mismatch in architecture');
      console.log('   3. Update classification based on date field quality');
      
      if (highQualityCandidates.length > 0) {
        console.log(`   4. Use ${foundTable}.` + highQualityCandidates[0].field + ' as document_date provenance');
        console.log('   5. Classification: PROVABLE (if full verification passes)');
      } else if (hasBusinessDate) {
        console.log(`   4. Define policy: Which ${foundTable} date = document_date?`);
        console.log('   5. Classification: INFERABLE (requires policy)');
      } else {
        console.log('   4. Requires policy approval to use created_at');
        console.log('   5. Classification: INFERABLE (Anti-Pattern AP-5 risk)');
      }

    } else if (matchedCount > 0) {
      console.log('🟡 Hypothesis 1: PARTIALLY CONFIRMED');
      console.log(`   • ${matchedCount}/${totalSample} source_ids resolve to ${foundTable} (${((matchedCount / totalSample) * 100).toFixed(1)}%)`);
      console.log('   • Partial provenance recovery possible');
      console.log('');
      console.log('🎯 Recommendation:');
      console.log('   1. Verify full population to get exact match rate');
      console.log('   2. Matched records: Upgrade to INFERABLE');
      console.log('   3. Unmatched records: Remain UNKNOWABLE');

    } else {
      console.log('🔴 Hypothesis 1: REJECTED');
      console.log(`   • SALES_ORDER source_ids do NOT resolve to ${foundTable}`);
      console.log('   • Classification remains: UNKNOWABLE');
    }

    // Step 9: Impact Summary
    console.log('\n📋 Step 9: Impact Summary');
    console.log('═'.repeat(80));

    if (matchedCount > 0) {
      const potentialRecovery = Math.round((totalF1 || 208) * (matchedCount / totalSample));
      const newUnknowable = 442 - potentialRecovery;
      
      console.log('\n📊 Potential Impact (if Hypothesis 1 confirmed):');
      console.log(`   Recoverable records: ~${potentialRecovery} (from UNKNOWABLE to INFERABLE/PROVABLE)`);
      console.log(`   Remaining UNKNOWABLE: ~${newUnknowable} (${((newUnknowable / 675) * 100).toFixed(1)}%)`);
      console.log('');
      console.log('   Before: UNKNOWABLE = 442 (65%)');
      console.log(`   After: UNKNOWABLE = ~${newUnknowable} (${((newUnknowable / 675) * 100).toFixed(1)}%)`);
      console.log(`   Improvement: ${((potentialRecovery / 675) * 100).toFixed(1)}% coverage increase`);
    }

  }

  console.log('\n✅ Phase 4.1 Hypothesis 1 Verification Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Document findings in PHASE4_SALES_ORDER_INVESTIGATION.md');
  console.log('   2. Human Architect: Review classification decision');
  console.log('   3. If PROVABLE/INFERABLE: Update PHASE3_BACKFILL_POLICY.md');
  console.log('   4. Proceed to Phase 4.2: AP_PAYMENT investigation');
  console.log('');
  console.log('🔒 Reminder: NO mutations performed (READ-ONLY verification)');
  console.log('');
}

main().catch(console.error);
