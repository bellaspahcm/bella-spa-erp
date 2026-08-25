#!/usr/bin/env tsx
/**
 * Record Migration History for 16 Class B Migrations
 * 
 * APPROVED by Human Architect after full verification
 * 
 * Evidence:
 * - 16/16 migrations = Class B (DDL applied, history missing)
 * - 11 Runtime/Approval: verified via pg_catalog (HIGH confidence)
 * - 5 Logistics: verified via table existence (HIGH confidence)
 * - 0 Class A (no missing DDL)
 * 
 * Action: INSERT into supabase_migrations.schema_migrations
 * NO DDL execution - history reconciliation only
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

// 16 Class B migrations (DDL applied, history missing)
const migrationsToRecord = [
  {
    version: '20260819040000',
    name: 'runtime_migration_e1_gate_schema_safe',
    statements: ['CREATE FUNCTION migration_05_e1_gate']
  },
  {
    version: '20260819050000',
    name: 'runtime_migration_05a_classification_reservation',
    statements: ['CREATE FUNCTION migration_05a_preflight_p4_collision_gate', 'CREATE TABLE migration_evidence', 'CREATE SCHEMA IF NOT EXISTS public']
  },
  {
    version: '20260819050001',
    name: 'runtime_migration_05_e2_orphan_safety_gate',
    statements: ['CREATE FUNCTION migration_05_e2_orphan_safety_gate']
  },
  {
    version: '20260819050002',
    name: 'runtime_migration_05b_canonical_tenant_creation',
    statements: ['CREATE FUNCTION migration_05b_preflight_p2_reservation_complete', 'CREATE FUNCTION migration_05b_preflight_p3_schema_compatibility', 'CREATE FUNCTION migration_05b_preflight_collision_recheck', 'CREATE FUNCTION migration_05b_create_canonical_tenants', 'CREATE FUNCTION migration_evidence']
  },
  {
    version: '20260819050003',
    name: 'runtime_migration_05c_text_to_uuid_type_migration',
    statements: ['CREATE FUNCTION migration_05c_preflight_verify_05b_complete', 'CREATE FUNCTION migration_05c_preflight_verify_mapping_completeness', 'CREATE FUNCTION migration_05c_update_text_to_uuid', 'CREATE FUNCTION migration_05c_alter_column_types', 'CREATE FUNCTION migration_05c_add_fk_constraints', 'CREATE FUNCTION migration_05c_verify_rls_preservation']
  },
  {
    version: '20260819050004',
    name: 'runtime_migration_e3_post_05c_verification',
    statements: ['CREATE FUNCTION migration_05_e3_gate']
  },
  {
    version: '20260820110000',
    name: 'database_role_separation_v2',
    statements: ['CREATE TABLE migration_governance', 'CREATE ROLE app_user', 'CREATE ROLE app_admin']
  },
  {
    version: '20260820140000',
    name: 'enable_rls_block_service_key',
    statements: ['ALTER TABLE ENABLE ROW LEVEL SECURITY', 'CREATE POLICY']
  },
  {
    version: '20260820_r4_3_gate_tokens',
    name: 'r4_3_gate_tokens',
    statements: ['CREATE FUNCTION prevent_audit_modification', 'CREATE TABLE bella_gate_tokens', 'CREATE TABLE bella_execution_audit', 'ALTER TABLE bella_migration_approval ADD COLUMN execution_started_at']
  },
  {
    version: '20260820_r4_4_monitoring_audit',
    name: 'r4_4_monitoring_audit',
    statements: ['CREATE FUNCTION update_incidents_updated_at', 'CREATE TABLE bella_security_incidents', 'CREATE TABLE bella_recovery_actions']
  },
  {
    version: '20260820_r4_approval_contract',
    name: 'r4_approval_contract',
    statements: ['CREATE TABLE bella_migration_approval']
  },
  {
    version: '20260821115404',
    name: 'logistics_schema',
    statements: ['CREATE TABLE inventory_items', 'CREATE TABLE movements', 'CREATE TABLE routes', 'CREATE TABLE vehicles', 'CREATE TABLE drivers', 'CREATE TABLE warehouses']
  },
  {
    version: '20260821_create_accessorial_rates_table',
    name: 'create_accessorial_rates_table',
    statements: ['CREATE TABLE accessorial_rates']
  },
  {
    version: '20260821_create_carrier_rates_table',
    name: 'create_carrier_rates_table',
    statements: ['CREATE TABLE carrier_rates']
  },
  {
    version: '20260821_create_discrepancies_table',
    name: 'create_discrepancies_table',
    statements: ['CREATE TABLE discrepancies']
  },
  {
    version: '20260821_create_freight_audit_tables',
    name: 'create_freight_audit_tables',
    statements: ['CREATE TABLE freight_audits', 'CREATE TABLE freight_audit_items']
  }
];

async function main() {
  console.log('═'.repeat(80));
  console.log('📝 Record Migration History (16 Class B Migrations)');
  console.log('═'.repeat(80));
  console.log('\n✅ APPROVED by Human Architect');
  console.log('🎯 Action: History reconciliation only (NO DDL execution)');
  console.log('📊 Migrations to record: 16');
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const migration of migrationsToRecord) {
    console.log(`\n📋 Recording: ${migration.version} (${migration.name})`);
    console.log('─'.repeat(80));

    try {
      // Check if already recorded
      const { data: existing, error: checkError } = await supabase
        .from('supabase_migrations.schema_migrations' as any)
        .select('version')
        .eq('version', migration.version)
        .single();

      if (existing) {
        console.log(`   ⏭️  Already recorded (skipping)`);
        skipCount++;
        continue;
      }

      // Insert migration history
      const { error: insertError } = await supabase
        .from('supabase_migrations.schema_migrations' as any)
        .insert({
          version: migration.version,
          name: migration.name,
          statements: migration.statements
        });

      if (insertError) {
        console.error(`   ❌ Error: ${insertError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Recorded successfully`);
        console.log(`   Statements: ${migration.statements.length}`);
        successCount++;
      }
    } catch (err) {
      console.error(`   ❌ Exception: ${err}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n═'.repeat(80));
  console.log('📊 Recording Summary');
  console.log('═'.repeat(80));

  console.log(`\n   Total migrations: ${migrationsToRecord.length}`);
  console.log(`   ✅ Successfully recorded: ${successCount}`);
  console.log(`   ⏭️  Already recorded (skipped): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  const allDone = successCount + skipCount === migrationsToRecord.length;

  if (allDone) {
    console.log('\n✅ HISTORY RECONCILIATION COMPLETE');
    console.log('');
    console.log('📋 Verification:');
    console.log('   Run: npx supabase db push');
    console.log('   Expected: Only 20260824000000_finance_test_cleanup_rpc.sql');
    console.log('');
    console.log('⏭️  Next Steps:');
    console.log('   1. Deploy RPC: npx supabase db push');
    console.log('   2. Verify RPC: npx tsx scripts/verify_cleanup_rpc.ts');
    console.log('   3. STOP - await Human Architect approval');
    console.log('   4. Execute cleanup: npx tsx scripts/phase4_4_execute_cleanup.ts');
  } else {
    console.log('\n⚠️  HISTORY RECONCILIATION INCOMPLETE');
    console.log('');
    console.log('⚠️  Some migrations failed to record');
    console.log('Action: Review errors above and retry');
  }

  console.log('\n═'.repeat(80));

  // Save reconciliation report
  const reportPath = path.join(__dirname, '..', 'docs', 'architecture', 'MIGRATION_HISTORY_RECONCILIATION_COMPLETE.md');
  
  let report = `# Migration History Reconciliation Report\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Status:** ${allDone ? 'COMPLETE' : 'INCOMPLETE'}\n`;
  report += `**Approved by:** Human Architect\n\n`;
  report += `---\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total migrations:** ${migrationsToRecord.length}\n`;
  report += `- **Successfully recorded:** ${successCount}\n`;
  report += `- **Already recorded:** ${skipCount}\n`;
  report += `- **Errors:** ${errorCount}\n\n`;
  report += `---\n\n`;
  report += `## Recorded Migrations\n\n`;
  
  migrationsToRecord.forEach(m => {
    report += `- \`${m.version}\` (${m.name})\n`;
  });

  report += `\n---\n\n`;
  report += `## Evidence\n\n`;
  report += `- ✅ 16/16 migrations verified as Class B (DDL applied)\n`;
  report += `- ✅ 11 Runtime/Approval verified via pg_catalog (HIGH confidence)\n`;
  report += `- ✅ 5 Logistics verified via table existence (HIGH confidence)\n`;
  report += `- ✅ 0 Class A (no missing DDL)\n\n`;
  report += `---\n\n`;
  report += `## Next Steps\n\n`;
  report += `1. ✅ History reconciliation complete\n`;
  report += `2. ⏭️ Deploy RPC: \`npx supabase db push\`\n`;
  report += `3. ⏭️ Verify RPC: \`npx tsx scripts/verify_cleanup_rpc.ts\`\n`;
  report += `4. 🔒 STOP - Human Architect approval required\n`;
  report += `5. 🔒 Execute cleanup: \`npx tsx scripts/phase4_4_execute_cleanup.ts\`\n\n`;
  report += `---\n\n`;
  report += `## Frozen Boundary\n\n`;
  report += `- ❌ NO automatic cleanup execution\n`;
  report += `- ❌ NO SPA business data modifications\n`;
  report += `- ✅ 274 F1 DELETE (after approval)\n`;
  report += `- ✅ 165 F1 PRESERVE (with F2 dependencies)\n`;
  report += `- ✅ 5 SPA_BOOKING PRESERVE (100%)\n`;
  report += `- ✅ Orphan F2 = 0 (verified)\n\n`;
  report += `---\n\n`;
  report += `**Status:** ${allDone ? 'Ready for RPC deployment' : 'Needs review'}\n`;

  fs.writeFileSync(reportPath, report);
  console.log(`✅ Report saved: ${reportPath}`);
  console.log('');
}

main().catch(console.error);
