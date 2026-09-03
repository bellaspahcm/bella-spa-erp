#!/usr/bin/env tsx
/**
 * Migration Divergence Audit
 * 
 * READ-ONLY audit of 16 local migrations vs remote schema
 * 
 * Output: Classification table
 * - Migration file
 * - Local exists?
 * - Remote history recorded?
 * - DDL actually applied?
 * - Classification (A/B/C/D)
 * - Recommended action
 * 
 * NO MODIFICATIONS - Pure investigation
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

interface MigrationAudit {
  migration_file: string;
  version: string;
  local_exists: boolean;
  remote_history: boolean;
  ddl_applied: string; // 'YES' | 'PARTIAL' | 'NO' | 'UNKNOWN'
  classification: string; // 'A' | 'B' | 'C' | 'D' | 'UNKNOWN'
  action: string;
  notes: string;
}

const conflictingMigrations = [
  '20260819040000_runtime_migration_e1_gate_schema_safe.sql',
  '20260819050000_runtime_migration_05a_classification_reservation.sql',
  '20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql',
  '20260819050002_runtime_migration_05b_canonical_tenant_creation.sql',
  '20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql',
  '20260819050004_runtime_migration_e3_post_05c_verification.sql',
  '20260820110000_database_role_separation_v2.sql',
  '20260820140000_enable_rls_block_service_key.sql',
  '20260820151000_r4_3_gate_tokens.sql',
  '20260820152000_r4_4_monitoring_audit.sql',
  '20260820150000_r4_approval_contract.sql',
  '20260821115404_logistics_schema.sql',
  '20260821122000_create_accessorial_rates_table.sql',
  '20260821121000_create_carrier_rates_table.sql',
  '20260821123000_create_discrepancies_table.sql',
  '20260821120000_create_freight_audit_tables.sql'
];

async function checkRemoteHistory(version: string): Promise<boolean> {
  // Try to query schema_migrations
  try {
    const { data, error } = await supabase
      .rpc('exec_sql' as any, {
        sql_query: `SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}'`
      });
    
    if (error) {
      // RPC may not exist, try direct query
      return false;
    }
    
    return data && data.length > 0;
  } catch (err) {
    return false;
  }
}

async function checkDDLApplied(migrationFile: string, content: string): Promise<{ status: string; evidence: string }> {
  // Extract key DDL operations from migration content
  const hasFunctions = /CREATE.*FUNCTION/i.test(content);
  const hasTables = /CREATE TABLE/i.test(content);
  const hasColumns = /ALTER TABLE.*ADD COLUMN/i.test(content);
  const hasRLS = /ALTER TABLE.*ENABLE ROW LEVEL SECURITY/i.test(content);
  
  let evidence = '';
  
  // Check specific artifacts based on migration name
  if (migrationFile.includes('e1_gate_schema_safe')) {
    // Check for migration_05_e1_gate function
    const { data, error } = await supabase
      .rpc('migration_05_e1_gate' as any);
    
    if (!error || error.message.includes('does not exist')) {
      return {
        status: error ? 'NO' : 'YES',
        evidence: error ? 'Function migration_05_e1_gate not found' : 'Function exists'
      };
    }
  }
  
  if (migrationFile.includes('logistics_schema')) {
    // Check for logistics tables
    try {
      const { data, error } = await supabase
        .from('inventory_items' as any)
        .select('id', { count: 'exact', head: true });
      
      return {
        status: error ? 'NO' : 'YES',
        evidence: error ? 'inventory_items table not found' : 'Logistics tables exist'
      };
    } catch (err) {
      return { status: 'NO', evidence: 'Logistics schema not found' };
    }
  }
  
  if (migrationFile.includes('carrier_rates')) {
    try {
      const { data, error } = await supabase
        .from('carrier_rates' as any)
        .select('id', { count: 'exact', head: true });
      
      return {
        status: error ? 'NO' : 'YES',
        evidence: error ? 'carrier_rates table not found' : 'Table exists'
      };
    } catch (err) {
      return { status: 'NO', evidence: 'carrier_rates not found' };
    }
  }
  
  if (migrationFile.includes('accessorial_rates')) {
    try {
      const { data, error } = await supabase
        .from('accessorial_rates' as any)
        .select('id', { count: 'exact', head: true });
      
      return {
        status: error ? 'NO' : 'YES',
        evidence: error ? 'accessorial_rates table not found' : 'Table exists'
      };
    } catch (err) {
      return { status: 'NO', evidence: 'accessorial_rates not found' };
    }
  }
  
  if (migrationFile.includes('discrepancies')) {
    try {
      const { data, error } = await supabase
        .from('discrepancies' as any)
        .select('id', { count: 'exact', head: true });
      
      return {
        status: error ? 'NO' : 'YES',
        evidence: error ? 'discrepancies table not found' : 'Table exists'
      };
    } catch (err) {
      return { status: 'NO', evidence: 'discrepancies not found' };
    }
  }
  
  if (migrationFile.includes('freight_audit')) {
    try {
      const { data, error } = await supabase
        .from('freight_audits' as any)
        .select('id', { count: 'exact', head: true });
      
      return {
        status: error ? 'NO' : 'YES',
        evidence: error ? 'freight_audits table not found' : 'Table exists'
      };
    } catch (err) {
      return { status: 'NO', evidence: 'freight_audits not found' };
    }
  }
  
  // For runtime/approval migrations, check for specific patterns
  if (migrationFile.includes('approval_contract')) {
    // Check for approval-related tables/functions
    evidence = 'Cannot verify remotely (requires specific table/function check)';
    return { status: 'UNKNOWN', evidence };
  }
  
  // Default: cannot determine without specific checks
  return {
    status: 'UNKNOWN',
    evidence: 'Requires manual schema inspection (no specific check implemented)'
  };
}

function classifyMigration(localExists: boolean, remoteHistory: boolean, ddlStatus: string): { classification: string; action: string } {
  if (!localExists) {
    return {
      classification: 'D',
      action: 'Remove from conflict list (file not found)'
    };
  }
  
  if (!remoteHistory && ddlStatus === 'NO') {
    return {
      classification: 'A',
      action: 'Apply migration (DDL not executed, history missing)'
    };
  }
  
  if (!remoteHistory && ddlStatus === 'YES') {
    return {
      classification: 'B',
      action: 'Record history only (DDL exists, history missing)'
    };
  }
  
  if (!remoteHistory && ddlStatus === 'PARTIAL') {
    return {
      classification: 'C',
      action: 'Manual investigation (DDL partially applied)'
    };
  }
  
  if (remoteHistory && ddlStatus === 'YES') {
    return {
      classification: 'RESOLVED',
      action: 'No action (already applied and recorded)'
    };
  }
  
  return {
    classification: 'UNKNOWN',
    action: 'Manual investigation required'
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 Migration Divergence Audit (READ-ONLY)');
  console.log('═'.repeat(80));
  console.log('\n⚠️  Mode: Investigation only - NO modifications');
  console.log('🎯 Goal: Classify 16 conflicting migrations');
  console.log('');

  const auditResults: MigrationAudit[] = [];
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  for (const migrationFile of conflictingMigrations) {
    console.log(`\n📋 Auditing: ${migrationFile}`);
    console.log('─'.repeat(80));

    const version = migrationFile.split('_')[0];
    const migrationPath = path.join(migrationsDir, migrationFile);
    
    // Check local exists
    const localExists = fs.existsSync(migrationPath);
    console.log(`   Local file: ${localExists ? '✅' : '❌'}`);
    
    if (!localExists) {
      auditResults.push({
        migration_file: migrationFile,
        version,
        local_exists: false,
        remote_history: false,
        ddl_applied: 'N/A',
        classification: 'D',
        action: 'Remove from list',
        notes: 'File not found locally'
      });
      continue;
    }
    
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Check remote history (best effort)
    const remoteHistory = await checkRemoteHistory(version);
    console.log(`   Remote history: ${remoteHistory ? '✅' : '❌'}`);
    
    // Check DDL applied
    const { status: ddlStatus, evidence } = await checkDDLApplied(migrationFile, content);
    console.log(`   DDL applied: ${ddlStatus}`);
    console.log(`   Evidence: ${evidence}`);
    
    // Classify
    const { classification, action } = classifyMigration(localExists, remoteHistory, ddlStatus);
    console.log(`   Classification: ${classification}`);
    console.log(`   Action: ${action}`);
    
    auditResults.push({
      migration_file: migrationFile,
      version,
      local_exists: localExists,
      remote_history: remoteHistory,
      ddl_applied: ddlStatus,
      classification,
      action,
      notes: evidence
    });
  }

  // Summary
  console.log('\n═'.repeat(80));
  console.log('📊 Audit Summary');
  console.log('═'.repeat(80));

  console.log('\n📋 Full Reconciliation Table:\n');
  console.table(auditResults.map(r => ({
    Migration: r.migration_file.substring(0, 50) + '...',
    Local: r.local_exists ? '✅' : '❌',
    'Remote History': r.remote_history ? '✅' : '❌',
    'DDL Applied': r.ddl_applied,
    Class: r.classification,
    Action: r.action.substring(0, 40)
  })));

  // Classification breakdown
  const classA = auditResults.filter(r => r.classification === 'A');
  const classB = auditResults.filter(r => r.classification === 'B');
  const classC = auditResults.filter(r => r.classification === 'C');
  const classD = auditResults.filter(r => r.classification === 'D');
  const classUnknown = auditResults.filter(r => r.classification === 'UNKNOWN');

  console.log('\n📈 Classification Breakdown:');
  console.log(`   Class A (DDL not run, history missing): ${classA.length}`);
  console.log(`   Class B (DDL exists, history missing): ${classB.length}`);
  console.log(`   Class C (DDL partial, needs investigation): ${classC.length}`);
  console.log(`   Class D (Obsolete/not found): ${classD.length}`);
  console.log(`   Unknown (Requires manual check): ${classUnknown.length}`);

  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'docs', 'architecture', 'MIGRATION_RECONCILIATION_AUDIT.md');
  
  let report = `# Migration Reconciliation Audit Report\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Mode:** READ-ONLY Investigation\n`;
  report += `**Migrations Audited:** ${conflictingMigrations.length}\n\n`;
  report += `---\n\n`;
  report += `## Classification Summary\n\n`;
  report += `- **Class A** (DDL not run): ${classA.length}\n`;
  report += `- **Class B** (DDL exists, history missing): ${classB.length}\n`;
  report += `- **Class C** (DDL partial): ${classC.length}\n`;
  report += `- **Class D** (Obsolete): ${classD.length}\n`;
  report += `- **Unknown** (Manual check needed): ${classUnknown.length}\n\n`;
  report += `---\n\n`;
  report += `## Detailed Audit Results\n\n`;
  report += `| Migration | Local | Remote History | DDL Applied | Class | Action |\n`;
  report += `|-----------|-------|----------------|-------------|-------|--------|\n`;
  
  auditResults.forEach(r => {
    report += `| ${r.migration_file} | ${r.local_exists ? '✅' : '❌'} | ${r.remote_history ? '✅' : '❌'} | ${r.ddl_applied} | ${r.classification} | ${r.action} |\n`;
  });

  report += `\n---\n\n`;
  report += `## Next Steps\n\n`;
  
  if (classA.length > 0) {
    report += `### Class A Migrations (Apply DDL + Record History)\n\n`;
    classA.forEach(r => {
      report += `- \`${r.migration_file}\`\n`;
      report += `  - Action: Apply migration SQL\n`;
      report += `  - Then: Record in schema_migrations\n\n`;
    });
  }
  
  if (classB.length > 0) {
    report += `### Class B Migrations (Record History Only)\n\n`;
    classB.forEach(r => {
      report += `- \`${r.migration_file}\`\n`;
      report += `  - Action: INSERT into schema_migrations only\n`;
      report += `  - DDL already applied\n\n`;
    });
  }
  
  if (classC.length > 0) {
    report += `### Class C Migrations (Manual Investigation)\n\n`;
    classC.forEach(r => {
      report += `- \`${r.migration_file}\`\n`;
      report += `  - Evidence: ${r.notes}\n`;
      report += `  - Action: Manual schema inspection required\n\n`;
    });
  }
  
  if (classUnknown.length > 0) {
    report += `### Unknown Classification (Manual Check)\n\n`;
    classUnknown.forEach(r => {
      report += `- \`${r.migration_file}\`\n`;
      report += `  - Notes: ${r.notes}\n`;
      report += `  - Action: Requires specific schema verification\n\n`;
    });
  }

  report += `---\n\n`;
  report += `## Reconciliation Strategy\n\n`;
  report += `1. Review audit results\n`;
  report += `2. For Class A: Apply migrations in order\n`;
  report += `3. For Class B: Record history only\n`;
  report += `4. For Class C/Unknown: Manual investigation\n`;
  report += `5. Verify: \`npx supabase db push\` should succeed\n`;
  report += `6. Deploy: \`20260824000000_finance_test_cleanup_rpc.sql\`\n\n`;
  report += `---\n\n`;
  report += `**Status:** Audit complete, awaiting reconciliation decision\n`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Detailed report saved: ${reportPath}`);

  console.log('\n═'.repeat(80));
  console.log('✅ Audit Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Next: Review audit results and decide reconciliation strategy');
  console.log('');
}

main().catch(console.error);
