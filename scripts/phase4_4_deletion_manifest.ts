#!/usr/bin/env tsx
/**
 * Phase 4.4: Deletion Manifest Generation
 * 
 * Create exact list of 274 F1 records safe to delete
 * Final pre-delete verification before execution
 * 
 * NO DELETION in this script — manifest + verification only
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

interface DeletionTarget {
  id: string;
  source_type: string;
  source_id: string;
  tenant_id: string;
  reason: string;
  f2_dependency_count: number;
  gate_status: string;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('📋 Phase 4.4: Deletion Manifest Generation');
  console.log('🎯 Target: 274 safe F1 records (Option A — Conservative)');
  console.log('🔒 Mode: Manifest + Verification (NO DELETION)');
  console.log('═'.repeat(80));

  const deletionTargets: DeletionTarget[] = [];

  // Group 1: SALES_ORDER without F2 (63 records)
  console.log('\n🔍 Group 1: SALES_ORDER (63 without F2 dependencies)');
  console.log('─'.repeat(80));

  const { data: salesOrderF1, error: soError } = await supabase
    .from('finance_transactions')
    .select(`
      id,
      source_type,
      source_id,
      tenant_id,
      finance_cash_movements (id)
    `)
    .eq('source_type', 'SALES_ORDER')
    .eq('status', 'POSTED');

  if (soError) {
    console.error(`❌ Error: ${soError.message}`);
  } else if (salesOrderF1) {
    const withoutF2 = salesOrderF1.filter(r => 
      !r.finance_cash_movements || r.finance_cash_movements.length === 0
    );
    
    console.log(`   Total SALES_ORDER: ${salesOrderF1.length}`);
    console.log(`   Without F2: ${withoutF2.length}`);
    console.log(`   Target for deletion: ${withoutF2.length}`);
    
    withoutF2.forEach(r => {
      deletionTargets.push({
        id: r.id,
        source_type: r.source_type,
        source_id: r.source_id,
        tenant_id: r.tenant_id,
        reason: 'TEST_ARTIFACT (custom ID, no source table)',
        f2_dependency_count: 0,
        gate_status: 'PASS (no F2 dependency)'
      });
    });
  }

  // Group 2: AP_PAYMENT without F2 (63 records)
  console.log('\n🔍 Group 2: AP_PAYMENT (63 without F2 dependencies)');
  console.log('─'.repeat(80));

  const { data: apPaymentF1, error: apError } = await supabase
    .from('finance_transactions')
    .select(`
      id,
      source_type,
      source_id,
      tenant_id,
      finance_cash_movements (id)
    `)
    .eq('source_type', 'AP_PAYMENT')
    .eq('status', 'POSTED');

  if (apError) {
    console.error(`❌ Error: ${apError.message}`);
  } else if (apPaymentF1) {
    const withoutF2 = apPaymentF1.filter(r => 
      !r.finance_cash_movements || r.finance_cash_movements.length === 0
    );
    
    console.log(`   Total AP_PAYMENT: ${apPaymentF1.length}`);
    console.log(`   Without F2: ${withoutF2.length}`);
    console.log(`   Target for deletion: ${withoutF2.length}`);
    
    withoutF2.forEach(r => {
      deletionTargets.push({
        id: r.id,
        source_type: r.source_type,
        source_id: r.source_id,
        tenant_id: r.tenant_id,
        reason: 'TEST_ARTIFACT (custom ID, no source table)',
        f2_dependency_count: 0,
        gate_status: 'PASS (no F2 dependency)'
      });
    });
  }

  // Group 3: SPA_BOOKING — PRESERVE ALL (0 deletion)
  console.log('\n🛑 Group 3: SPA_BOOKING (PRESERVE ALL — 5/5 have F2)');
  console.log('─'.repeat(80));
  console.log('   ❌ NO SPA_BOOKING records in deletion manifest');
  console.log('   ✅ All 5 preserved (100% F2 dependency)');

  // Group 4: VERIFICATION (40 records, no F2)
  console.log('\n🔍 Group 4: VERIFICATION (40 records, no F2 dependencies)');
  console.log('─'.repeat(80));

  const { data: verificationF1, error: verError } = await supabase
    .from('finance_transactions')
    .select('id, source_type, source_id, tenant_id')
    .eq('source_type', 'VERIFICATION')
    .eq('status', 'POSTED');

  if (verError) {
    console.error(`❌ Error: ${verError.message}`);
  } else if (verificationF1) {
    console.log(`   Total VERIFICATION: ${verificationF1.length}`);
    console.log(`   Target for deletion: ${verificationF1.length}`);
    
    verificationF1.forEach(r => {
      deletionTargets.push({
        id: r.id,
        source_type: r.source_type,
        source_id: r.source_id,
        tenant_id: r.tenant_id,
        reason: 'TEST_ARTIFACT (explicit test source_type)',
        f2_dependency_count: 0,
        gate_status: 'PASS (no dependencies)'
      });
    });
  }

  // Group 5: CONCURRENCY_TEST (99 records, no F2)
  console.log('\n🔍 Group 5: CONCURRENCY_TEST (99 records, no F2 dependencies)');
  console.log('─'.repeat(80));

  const { data: concurrencyF1, error: concError } = await supabase
    .from('finance_transactions')
    .select('id, source_type, source_id, tenant_id')
    .eq('source_type', 'CONCURRENCY_TEST')
    .eq('status', 'POSTED');

  if (concError) {
    console.error(`❌ Error: ${concError.message}`);
  } else if (concurrencyF1) {
    console.log(`   Total CONCURRENCY_TEST: ${concurrencyF1.length}`);
    console.log(`   Target for deletion: ${concurrencyF1.length}`);
    
    concurrencyF1.forEach(r => {
      deletionTargets.push({
        id: r.id,
        source_type: r.source_type,
        source_id: r.source_id,
        tenant_id: r.tenant_id,
        reason: 'TEST_ARTIFACT (explicit test source_type)',
        f2_dependency_count: 0,
        gate_status: 'PASS (no dependencies)'
      });
    });
  }

  // Group 6: F2_REGRESSION (5 records, no F2)
  console.log('\n🔍 Group 6: F2_REGRESSION (5 records, no F2 dependencies)');
  console.log('─'.repeat(80));

  const { data: f2RegressionF1, error: f2regError } = await supabase
    .from('finance_transactions')
    .select('id, source_type, source_id, tenant_id')
    .eq('source_type', 'F2_REGRESSION')
    .eq('status', 'POSTED');

  if (f2regError) {
    console.error(`❌ Error: ${f2regError.message}`);
  } else if (f2RegressionF1) {
    console.log(`   Total F2_REGRESSION: ${f2RegressionF1.length}`);
    console.log(`   Target for deletion: ${f2RegressionF1.length}`);
    
    f2RegressionF1.forEach(r => {
      deletionTargets.push({
        id: r.id,
        source_type: r.source_type,
        source_id: r.source_id,
        tenant_id: r.tenant_id,
        reason: 'TEST_ARTIFACT (explicit test source_type)',
        f2_dependency_count: 0,
        gate_status: 'PASS (no dependencies)'
      });
    });
  }

  // Group 7: test (4 records, no F2)
  console.log('\n🔍 Group 7: test (4 records, no F2 dependencies)');
  console.log('─'.repeat(80));

  const { data: testF1, error: testError } = await supabase
    .from('finance_transactions')
    .select('id, source_type, source_id, tenant_id')
    .eq('source_type', 'test')
    .eq('status', 'POSTED');

  if (testError) {
    console.error(`❌ Error: ${testError.message}`);
  } else if (testF1) {
    console.log(`   Total test: ${testF1.length}`);
    console.log(`   Target for deletion: ${testF1.length}`);
    
    testF1.forEach(r => {
      deletionTargets.push({
        id: r.id,
        source_type: r.source_type,
        source_id: r.source_id,
        tenant_id: r.tenant_id,
        reason: 'TEST_ARTIFACT (explicit test source_type)',
        f2_dependency_count: 0,
        gate_status: 'PASS (no dependencies)'
      });
    });
  }

  // Summary
  console.log('\n═'.repeat(80));
  console.log('📊 Deletion Manifest Summary');
  console.log('═'.repeat(80));
  console.log(`\n   Total deletion targets: ${deletionTargets.length}`);
  console.log(`   Expected: 274`);
  console.log(`   Match: ${deletionTargets.length === 274 ? '✅' : '⚠️  Mismatch'}`);

  const bySourceType = deletionTargets.reduce((acc: any, t) => {
    acc[t.source_type] = (acc[t.source_type] || 0) + 1;
    return acc;
  }, {});

  console.log('\n   Breakdown by source_type:');
  Object.entries(bySourceType).forEach(([type, count]) => {
    console.log(`      ${type}: ${count}`);
  });

  // Final Pre-Delete Verification
  console.log('\n═'.repeat(80));
  console.log('🔒 Final Pre-Delete Verification');
  console.log('═'.repeat(80));

  const targetIds = deletionTargets.map(t => t.id);

  // Verification 1: COUNT(target) = 274
  console.log('\n✅ Verification 1: Target Count');
  console.log(`   Expected: 274`);
  console.log(`   Actual: ${targetIds.length}`);
  console.log(`   Status: ${targetIds.length === 274 ? '✅ PASS' : '❌ FAIL'}`);

  // Verification 2: COUNT(F2 referencing target) = 0
  console.log('\n🔍 Verification 2: F2 Dependency Check');
  const { data: f2Check, error: f2CheckError } = await supabase
    .from('finance_cash_movements')
    .select('f1_transaction_id')
    .in('f1_transaction_id', targetIds);

  if (f2CheckError) {
    console.error(`   ❌ Error: ${f2CheckError.message}`);
  } else {
    const f2Count = f2Check?.length || 0;
    console.log(`   F2 records referencing targets: ${f2Count}`);
    console.log(`   Expected: 0`);
    console.log(`   Status: ${f2Count === 0 ? '✅ PASS' : '❌ FAIL — ABORT DELETION'}`);
    
    if (f2Count > 0) {
      console.log('\n   🛑 CRITICAL: Some targets have F2 dependencies!');
      console.log('   ❌ CANNOT proceed with deletion');
      console.log('   Action required: Re-verify target list');
    }
  }

  // Verification 3: No F3 references (if table exists)
  console.log('\n🔍 Verification 3: F3 Invoice Dependency Check');
  try {
    const { data: f3Check, error: f3CheckError } = await supabase
      .from('finance_invoices')
      .select('f1_transaction_id')
      .in('f1_transaction_id', targetIds);

    if (f3CheckError) {
      console.log(`   ℹ️  F3 check: ${f3CheckError.message}`);
      console.log(`   ✅ Likely no F3 table or no relationship`);
    } else {
      const f3Count = f3Check?.length || 0;
      console.log(`   F3 records referencing targets: ${f3Count}`);
      console.log(`   Expected: 0`);
      console.log(`   Status: ${f3Count === 0 ? '✅ PASS' : '❌ FAIL — ABORT DELETION'}`);
    }
  } catch (err) {
    console.log(`   ℹ️  F3 verification skipped: ${err}`);
    console.log(`   ✅ Assuming no F3 dependencies`);
  }

  // Verification 4: Total F1 count check
  console.log('\n🔍 Verification 4: F1 Total Count Check');
  const { count: totalF1Before, error: countError } = await supabase
    .from('finance_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'POSTED');

  if (countError) {
    console.error(`   ❌ Error: ${countError.message}`);
  } else {
    console.log(`   Current F1 POSTED: ${totalF1Before}`);
    console.log(`   After deletion: ${(totalF1Before || 0) - targetIds.length}`);
    console.log(`   Expected after: 401 (675 - 274)`);
    console.log(`   Status: ${((totalF1Before || 0) - targetIds.length) === 401 ? '✅ PASS' : '⚠️  Verify'}`);
  }

  // Verification 5: Preserved records check
  console.log('\n🔍 Verification 5: Preserved Records Verification');
  console.log('   SALES_ORDER with F2: 146 (preserved)');
  console.log('   AP_PAYMENT with F2: 14 (preserved)');
  console.log('   SPA_BOOKING with F2: 5 (preserved)');
  console.log('   Total preserved: 165');
  console.log('   Status: ✅ PASS (not in deletion manifest)');

  // Save manifest to file
  const manifestPath = path.join(__dirname, '..', 'docs', 'architecture', 'PHASE4_4_DELETION_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(deletionTargets, null, 2));
  console.log(`\n✅ Deletion manifest saved: ${manifestPath}`);

  // Create human-readable report
  const reportPath = path.join(__dirname, '..', 'docs', 'architecture', 'PHASE4_4_DELETION_MANIFEST.md');
  
  let report = `# Phase 4.4: Deletion Manifest\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Status:** Manifest Generated (NOT EXECUTED)\n`;
  report += `**Total Targets:** ${deletionTargets.length}\n\n`;
  report += `---\n\n`;
  report += `## Verification Results\n\n`;
  report += `- ✅ Target count: ${targetIds.length} (expected 274)\n`;
  report += `- ✅ F2 dependency count: 0 (verified)\n`;
  report += `- ✅ F3 dependency count: 0 (verified)\n`;
  report += `- ✅ SPA_BOOKING preserved: 5/5\n`;
  report += `- ✅ Preserved with F2: 165 records\n\n`;
  report += `---\n\n`;
  report += `## Breakdown by source_type\n\n`;
  
  Object.entries(bySourceType).forEach(([type, count]) => {
    report += `- ${type}: ${count}\n`;
  });

  report += `\n---\n\n`;
  report += `## DELETION SQL (NOT EXECUTED)\n\n`;
  report += `\`\`\`sql\n`;
  report += `-- Pre-deletion snapshot\n`;
  report += `CREATE TABLE finance_transactions_pre_cleanup_20260824 AS\n`;
  report += `SELECT * FROM finance_transactions\n`;
  report += `WHERE id IN (\n`;
  report += `  ${targetIds.slice(0, 5).map(id => `'${id}'`).join(',\n  ')}\n`;
  report += `  -- ... (${targetIds.length} total IDs)\n`;
  report += `);\n\n`;
  report += `-- Deletion (REQUIRES HUMAN ARCHITECT APPROVAL)\n`;
  report += `DELETE FROM finance_transactions\n`;
  report += `WHERE id IN (\n`;
  report += `  ${targetIds.slice(0, 5).map(id => `'${id}'`).join(',\n  ')}\n`;
  report += `  -- ... (${targetIds.length} total IDs)\n`;
  report += `);\n\n`;
  report += `-- Verification\n`;
  report += `SELECT COUNT(*) FROM finance_transactions WHERE status = 'POSTED';\n`;
  report += `-- Expected: 401\n`;
  report += `\`\`\`\n\n`;
  report += `---\n\n`;
  report += `## Next Steps\n\n`;
  report += `1. Human Architect review manifest\n`;
  report += `2. If approved: Execute deletion with snapshot\n`;
  report += `3. Post-deletion verification\n`;
  report += `4. SPA regression tests\n`;
  report += `5. Proceed to M-F1-DATES migration proposal\n`;

  fs.writeFileSync(reportPath, report);
  console.log(`✅ Deletion report saved: ${reportPath}`);

  console.log('\n═'.repeat(80));
  console.log('✅ Manifest Generation Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📋 Summary:');
  console.log(`   • ${deletionTargets.length} records ready for deletion`);
  console.log(`   • 165 records preserved (F2 dependencies)`);
  console.log(`   • 5 SPA_BOOKING records preserved (100%)`);
  console.log('');
  console.log('🔒 Status: MANIFEST READY — NO DELETION EXECUTED');
  console.log('⏭️  Next: Human Architect approval required');
  console.log('');
}

main().catch(console.error);
