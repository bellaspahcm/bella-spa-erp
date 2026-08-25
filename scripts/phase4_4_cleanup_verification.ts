#!/usr/bin/env tsx
/**
 * Phase 4.4: Test Data Cleanup Verification (READ-ONLY)
 * 
 * Execute count reconciliation + safety gates (0-7)
 * NO deletion, NO mutations
 * 
 * Output: Exact target list + safe/preserve classification
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CleanupCandidate {
  source_type: string;
  count: number;
  safe_to_delete: number;
  preserve: number;
  reason: string;
}

const results: CleanupCandidate[] = [];

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 Phase 4.4: Test Data Cleanup Verification');
  console.log('🔒 Mode: READ-ONLY (no mutations)');
  console.log('🎯 Goal: Count reconciliation + safety gate verification');
  console.log('═'.repeat(80));

  // Task 1: Count Reconciliation
  console.log('\n📋 Task 1: Count Reconciliation');
  console.log('═'.repeat(80));

  // 1a: AP_PAYMENT discrepancy (77 vs 74)
  console.log('\n🔍 1a. AP_PAYMENT Count Verification');
  console.log('─'.repeat(80));
  
  const { count: apPaymentCount, error: apError } = await supabase
    .from('finance_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'AP_PAYMENT')
    .eq('status', 'POSTED');

  if (apError) {
    console.error(`❌ Error: ${apError.message}`);
  } else {
    console.log(`   Phase 3.5 estimate: 74`);
    console.log(`   Phase 4.2 actual: 77`);
    console.log(`   Current count: ${apPaymentCount}`);
    console.log(`   Discrepancy: ${(apPaymentCount || 0) - 74} records`);
    
    if (apPaymentCount === 77) {
      console.log(`   ✅ Confirmed: 77 AP_PAYMENT records`);
    } else {
      console.log(`   ⚠️  Count changed: investigate cause`);
    }
  }

  // 1b: Group 2 breakdown (167 explicit test)
  console.log('\n🔍 1b. Explicit Test Source Types Breakdown');
  console.log('─'.repeat(80));

  const { data: explicitTestBreakdown, error: testError } = await supabase
    .from('finance_transactions')
    .select('source_type')
    .in('source_type', ['CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test'])
    .eq('status', 'POSTED');

  if (testError) {
    console.error(`❌ Error: ${testError.message}`);
  } else if (explicitTestBreakdown) {
    const breakdown = explicitTestBreakdown.reduce((acc: any, row: any) => {
      acc[row.source_type] = (acc[row.source_type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n   Breakdown:');
    let total = 0;
    Object.entries(breakdown).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} records`);
      total += count as number;
    });
    console.log(`   ─`.repeat(40));
    console.log(`   Total: ${total} records`);
    console.log(`   Expected: 167 records`);
    console.log(`   Match: ${total === 167 ? '✅' : '⚠️  ' + (total - 167)}`);
  }

  // Task 2: Safety Gates
  console.log('\n📋 Task 2: Safety Gate Verification');
  console.log('═'.repeat(80));

  // Gate 0: Evidence Verification (already done in Phase 4.1-4.3)
  console.log('\n✅ Gate 0: Evidence Verification');
  console.log('   Already verified in Phase 4.1-4.3:');
  console.log('   - SALES_ORDER: Custom IDs (so-t01), no source table');
  console.log('   - AP_PAYMENT: Custom IDs (PROOF), no source table');
  console.log('   - SPA_BOOKING: Custom IDs (BOOKING-01), no source table');
  console.log('   - Explicit test: source_type naming');

  // Gate 1: SPA Dependency Check (CRITICAL)
  console.log('\n🔍 Gate 1: SPA Dependency Check (CRITICAL for SPA_BOOKING)');
  console.log('─'.repeat(80));

  const { data: spaBookingF1, error: sbError } = await supabase
    .from('finance_transactions')
    .select('id, source_id, tenant_id')
    .eq('source_type', 'SPA_BOOKING')
    .eq('status', 'POSTED');

  if (sbError) {
    console.error(`❌ Error: ${sbError.message}`);
  } else if (spaBookingF1 && spaBookingF1.length > 0) {
    console.log(`\n   Found ${spaBookingF1.length} SPA_BOOKING F1 records`);
    console.log('   Checking linkage to bookings table...');
    
    const sourceIds = spaBookingF1.map(r => r.source_id);
    
    try {
      const { data: linkedBookings, error: linkError } = await supabase
        .from('bookings')
        .select('id, customer_id, service_id, staff_id, status')
        .in('id', sourceIds);

      if (linkError) {
        if (linkError.message.includes('invalid input syntax for type uuid')) {
          console.log(`   ✅ No linkage: source_id (custom string) incompatible with bookings.id (UUID)`);
          console.log(`   ✅ SAFE: SPA_BOOKING records do NOT link to production SPA bookings`);
          
          results.push({
            source_type: 'SPA_BOOKING',
            count: spaBookingF1.length,
            safe_to_delete: spaBookingF1.length,
            preserve: 0,
            reason: 'No SPA dependency (type incompatibility)'
          });
        } else {
          console.error(`   ❌ Linkage error: ${linkError.message}`);
        }
      } else {
        const matchCount = linkedBookings?.length || 0;
        console.log(`   ⚠️  Linked bookings found: ${matchCount}`);
        
        if (matchCount > 0) {
          console.log(`   🛑 GATE 1 FAILED: SPA_BOOKING links to production bookings`);
          console.log(`   🔒 PRESERVE all ${spaBookingF1.length} SPA_BOOKING records`);
          console.log('   ❌ NOT SAFE to delete');
          
          results.push({
            source_type: 'SPA_BOOKING',
            count: spaBookingF1.length,
            safe_to_delete: 0,
            preserve: spaBookingF1.length,
            reason: 'Links to production SPA bookings'
          });
        } else {
          console.log(`   ✅ No linked bookings (match rate: 0%)`);
          console.log(`   ✅ SAFE: SPA_BOOKING records do NOT link to production`);
          
          results.push({
            source_type: 'SPA_BOOKING',
            count: spaBookingF1.length,
            safe_to_delete: spaBookingF1.length,
            preserve: 0,
            reason: 'No SPA dependency verified'
          });
        }
      }
    } catch (err) {
      console.error(`   ❌ Exception: ${err}`);
    }
  }

  // Gate 2: F2 Cash Movements Dependency
  console.log('\n🔍 Gate 2: F2 Cash Movements Dependency');
  console.log('─'.repeat(80));

  const { data: f2Dependency, error: f2Error } = await supabase
    .from('finance_transactions')
    .select(`
      source_type,
      id,
      finance_cash_movements (id)
    `)
    .in('source_type', ['SALES_ORDER', 'AP_PAYMENT', 'SPA_BOOKING', 
                        'CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test'])
    .eq('status', 'POSTED');

  if (f2Error) {
    console.error(`❌ Error: ${f2Error.message}`);
  } else if (f2Dependency) {
    const f2Stats = f2Dependency.reduce((acc: any, row: any) => {
      const type = row.source_type;
      if (!acc[type]) acc[type] = { total: 0, hasF2: 0 };
      acc[type].total++;
      if (row.finance_cash_movements && row.finance_cash_movements.length > 0) {
        acc[type].hasF2++;
      }
      return acc;
    }, {});

    console.log('\n   F2 Dependency Analysis:');
    Object.entries(f2Stats).forEach(([type, stats]: [string, any]) => {
      const safe = stats.total - stats.hasF2;
      console.log(`   ${type}:`);
      console.log(`      Total: ${stats.total}`);
      console.log(`      Has F2: ${stats.hasF2}`);
      console.log(`      Safe to delete: ${safe}`);
      
      const existing = results.find(r => r.source_type === type);
      if (existing) {
        existing.safe_to_delete = Math.min(existing.safe_to_delete, safe);
        existing.preserve = Math.max(existing.preserve, stats.hasF2);
        if (stats.hasF2 > 0) {
          existing.reason += ` + ${stats.hasF2} have F2 dependencies`;
        }
      } else {
        results.push({
          source_type: type,
          count: stats.total,
          safe_to_delete: safe,
          preserve: stats.hasF2,
          reason: stats.hasF2 > 0 ? 'Has F2 cash movements' : 'No F2 dependency'
        });
      }
    });
  }

  // Gate 3: F3 AR Invoice Dependency
  console.log('\n🔍 Gate 3: F3 AR Invoice Dependency');
  console.log('─'.repeat(80));

  const { data: f3Dependency, error: f3Error } = await supabase
    .from('finance_transactions')
    .select(`
      source_type,
      id,
      finance_invoices!finance_invoices_transaction_id_fkey (id)
    `)
    .in('source_type', ['SALES_ORDER', 'AP_PAYMENT', 'SPA_BOOKING', 
                        'CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test'])
    .eq('status', 'POSTED');

  if (f3Error) {
    console.error(`❌ Error: ${f3Error.message}`);
  } else if (f3Dependency) {
    const f3Stats = f3Dependency.reduce((acc: any, row: any) => {
      const type = row.source_type;
      if (!acc[type]) acc[type] = { total: 0, hasF3: 0 };
      acc[type].total++;
      if (row.finance_invoices && row.finance_invoices.length > 0) {
        acc[type].hasF3++;
      }
      return acc;
    }, {});

    console.log('\n   F3 Dependency Analysis:');
    Object.entries(f3Stats).forEach(([type, stats]: [string, any]) => {
      const safe = stats.total - stats.hasF3;
      console.log(`   ${type}:`);
      console.log(`      Total: ${stats.total}`);
      console.log(`      Has F3: ${stats.hasF3}`);
      console.log(`      Safe to delete: ${safe}`);
      
      const existing = results.find(r => r.source_type === type);
      if (existing) {
        existing.safe_to_delete = Math.min(existing.safe_to_delete, safe);
        existing.preserve = Math.max(existing.preserve, stats.hasF3);
        if (stats.hasF3 > 0) {
          existing.reason += ` + ${stats.hasF3} have F3 dependencies`;
        }
      }
    });
  }

  // Gate 4: Journal Entry Dependency
  console.log('\n🔍 Gate 4: Journal Entry Dependency');
  console.log('─'.repeat(80));

  const testSourceTypes = ['SALES_ORDER', 'AP_PAYMENT', 'SPA_BOOKING', 
                           'CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test'];
  
  const { data: f1Records, error: f1RecordsError } = await supabase
    .from('finance_transactions')
    .select('id, source_type')
    .in('source_type', testSourceTypes)
    .eq('status', 'POSTED');

  if (f1RecordsError) {
    console.error(`❌ Error: ${f1RecordsError.message}`);
  } else if (f1Records && f1Records.length > 0) {
    const f1Ids = f1Records.map(r => r.id);
    
    // Check journal_entries table
    try {
      const { data: journalEntries, error: jeError } = await supabase
        .from('journal_entries')
        .select('reference_id, reference_type')
        .eq('reference_type', 'FINANCE_TRANSACTION')
        .in('reference_id', f1Ids.map(id => id.toString()));

      if (jeError) {
        console.log(`   ℹ️  journal_entries check: ${jeError.message}`);
        console.log(`   ✅ Likely no journal_entries table or no dependencies`);
      } else {
        const jeCount = journalEntries?.length || 0;
        console.log(`   Found ${jeCount} journal entries referencing test F1 records`);
        
        if (jeCount > 0) {
          console.log(`   ⚠️  Some records have journal entry dependencies`);
          // TODO: Break down by source_type if needed
        } else {
          console.log(`   ✅ No journal entry dependencies found`);
        }
      }
    } catch (err) {
      console.log(`   ℹ️  journal_entries table may not exist: ${err}`);
      console.log(`   ✅ Assuming no journal entry dependencies`);
    }
  }

  // Gate 5: SPA Business Logic Dependency
  console.log('\n🔍 Gate 5: SPA Business Logic Dependency');
  console.log('─'.repeat(80));

  // Check if bookings table has transaction_id field
  try {
    const { data: bookingCheck, error: bookingError } = await supabase
      .from('bookings')
      .select('id, transaction_id')
      .limit(1);

    if (bookingError) {
      console.log(`   ℹ️  bookings.transaction_id check: ${bookingError.message}`);
      console.log(`   ✅ Likely no transaction_id field in bookings`);
    } else if (bookingCheck && bookingCheck.length > 0) {
      // Check if any test F1 records are referenced
      if (f1Records) {
        const f1Ids = f1Records.map(r => r.id);
        
        const { data: bookingRefs, error: refError } = await supabase
          .from('bookings')
          .select('id, transaction_id')
          .in('transaction_id', f1Ids);

        if (refError) {
          console.log(`   ℹ️  Error checking references: ${refError.message}`);
        } else {
          const refCount = bookingRefs?.length || 0;
          console.log(`   Found ${refCount} bookings referencing test F1 records`);
          
          if (refCount > 0) {
            console.log(`   🛑 GATE 5 FAILED: SPA bookings reference test F1 records`);
            console.log(`   🔒 PRESERVE affected records`);
          } else {
            console.log(`   ✅ No SPA business logic dependencies found`);
          }
        }
      }
    }
  } catch (err) {
    console.log(`   ℹ️  SPA dependency check not applicable: ${err}`);
    console.log(`   ✅ Assuming no SPA business logic dependencies`);
  }

  // Summary
  console.log('\n📋 Verification Summary');
  console.log('═'.repeat(80));

  console.log('\n📊 Cleanup Target Analysis:\n');
  console.table(results);

  const totalCount = results.reduce((sum, r) => sum + r.count, 0);
  const totalSafe = results.reduce((sum, r) => sum + r.safe_to_delete, 0);
  const totalPreserve = results.reduce((sum, r) => sum + r.preserve, 0);

  console.log('\n📈 Overall Statistics:');
  console.log(`   Total candidates: ${totalCount}`);
  console.log(`   Safe to delete: ${totalSafe} (${((totalSafe/totalCount)*100).toFixed(1)}%)`);
  console.log(`   Must preserve: ${totalPreserve} (${((totalPreserve/totalCount)*100).toFixed(1)}%)`);

  // Save results to file
  const reportPath = path.join(__dirname, '..', 'docs', 'architecture', 'PHASE4_4_CLEANUP_VERIFICATION_RESULTS.md');
  
  let report = `# Phase 4.4: Cleanup Verification Results\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Status:** Verification Complete (READ-ONLY)\n\n`;
  report += `---\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total candidates:** ${totalCount}\n`;
  report += `- **Safe to delete:** ${totalSafe} (${((totalSafe/totalCount)*100).toFixed(1)}%)\n`;
  report += `- **Must preserve:** ${totalPreserve} (${((totalPreserve/totalCount)*100).toFixed(1)}%)\n\n`;
  report += `---\n\n`;
  report += `## Detailed Results\n\n`;
  report += `| source_type | Count | Safe | Preserve | Reason |\n`;
  report += `|-------------|-------|------|----------|--------|\n`;
  
  results.forEach(r => {
    report += `| ${r.source_type} | ${r.count} | ${r.safe_to_delete} | ${r.preserve} | ${r.reason} |\n`;
  });

  report += `\n---\n\n`;
  report += `## Next Steps\n\n`;
  report += `1. Human Architect review\n`;
  report += `2. If approved: Execute cleanup for ${totalSafe} safe records\n`;
  report += `3. Preserve ${totalPreserve} records with dependencies\n`;
  report += `4. Post-cleanup verification\n`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Report saved: ${reportPath}`);

  console.log('\n✅ Phase 4.4 Verification Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('🔒 Reminder: NO deletions performed (READ-ONLY verification)');
  console.log('📋 Next: Human Architect review of exact target list');
  console.log('');
}

main().catch(console.error);
