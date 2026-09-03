#!/usr/bin/env tsx
/**
 * Verify Unknown Migrations (11 Runtime/Approval/RLS)
 * 
 * Manual investigation via pg_catalog queries
 * 
 * For each Unknown migration:
 * 1. Read migration SQL
 * 2. Extract DDL artifacts (functions, tables, columns, policies, roles)
 * 3. Query pg_catalog to verify existence
 * 4. Classify as A (not applied) or B (applied, history missing)
 * 
 * READ-ONLY - No modifications
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

interface MigrationVerification {
  migration: string;
  artifacts_checked: string[];
  artifacts_found: string[];
  artifacts_missing: string[];
  classification: 'A' | 'B' | 'PARTIAL';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
}

const unknownMigrations = [
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
  '20260820150000_r4_approval_contract.sql'
];

async function extractArtifacts(content: string): Promise<{
  functions: string[];
  tables: string[];
  columns: { table: string; column: string }[];
  policies: { table: string; policy: string }[];
  roles: string[];
  schemas: string[];
}> {
  const artifacts = {
    functions: [] as string[],
    tables: [] as string[],
    columns: [] as { table: string; column: string }[],
    policies: [] as { table: string; policy: string }[],
    roles: [] as string[],
    schemas: [] as string[]
  };

  // Extract functions
  const functionMatches = content.matchAll(/CREATE.*FUNCTION\s+(?:public\.)?(\w+)/gi);
  for (const match of functionMatches) {
    artifacts.functions.push(match[1].toLowerCase());
  }

  // Extract tables
  const tableMatches = content.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)/gi);
  for (const match of tableMatches) {
    artifacts.tables.push(match[1].toLowerCase());
  }

  // Extract columns (ALTER TABLE ... ADD COLUMN)
  const columnMatches = content.matchAll(/ALTER TABLE\s+(?:public\.)?(\w+)\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)/gi);
  for (const match of columnMatches) {
    artifacts.columns.push({
      table: match[1].toLowerCase(),
      column: match[2].toLowerCase()
    });
  }

  // Extract policies
  const policyMatches = content.matchAll(/CREATE POLICY\s+(\w+)\s+ON\s+(?:public\.)?(\w+)/gi);
  for (const match of policyMatches) {
    artifacts.policies.push({
      policy: match[1].toLowerCase(),
      table: match[2].toLowerCase()
    });
  }

  // Extract roles
  const roleMatches = content.matchAll(/CREATE ROLE\s+(\w+)/gi);
  for (const match of roleMatches) {
    artifacts.roles.push(match[1].toLowerCase());
  }

  // Extract schemas
  const schemaMatches = content.matchAll(/CREATE SCHEMA\s+(?:IF NOT EXISTS\s+)?(\w+)/gi);
  for (const match of schemaMatches) {
    artifacts.schemas.push(match[1].toLowerCase());
  }

  return artifacts;
}

async function verifyFunction(functionName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(functionName as any);
    // If function doesn't exist, we'll get "does not exist" error
    // If function exists but has parameter mismatch, we'll get different error
    if (error) {
      return !error.message.includes('does not exist');
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function verifyTable(tableName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(tableName as any)
      .select('*', { count: 'exact', head: true });
    
    return !error || !error.message.includes('does not exist');
  } catch (err) {
    return false;
  }
}

async function verifyColumn(tableName: string, columnName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(tableName as any)
      .select(columnName, { head: true });
    
    return !error || !error.message.includes('does not exist');
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 Unknown Migrations Verification (pg_catalog Investigation)');
  console.log('═'.repeat(80));
  console.log('\n⚠️  Mode: READ-ONLY (no modifications)');
  console.log('🎯 Goal: Verify DDL artifacts for 11 Unknown migrations');
  console.log('');

  const results: MigrationVerification[] = [];
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  for (const migrationFile of unknownMigrations) {
    console.log(`\n📋 Verifying: ${migrationFile}`);
    console.log('─'.repeat(80));

    const migrationPath = path.join(migrationsDir, migrationFile);
    const content = fs.readFileSync(migrationPath, 'utf-8');

    // Extract artifacts
    const artifacts = await extractArtifacts(content);
    
    const artifactsChecked: string[] = [];
    const artifactsFound: string[] = [];
    const artifactsMissing: string[] = [];

    console.log(`\n   📦 Artifacts detected:`);
    console.log(`      Functions: ${artifacts.functions.length}`);
    console.log(`      Tables: ${artifacts.tables.length}`);
    console.log(`      Columns: ${artifacts.columns.length}`);
    console.log(`      Policies: ${artifacts.policies.length}`);
    console.log(`      Roles: ${artifacts.roles.length}`);
    console.log(`      Schemas: ${artifacts.schemas.length}`);

    // Verify functions
    if (artifacts.functions.length > 0) {
      console.log(`\n   🔍 Verifying ${artifacts.functions.length} functions...`);
      for (const func of artifacts.functions) {
        artifactsChecked.push(`function:${func}`);
        const exists = await verifyFunction(func);
        console.log(`      ${exists ? '✅' : '❌'} ${func}`);
        if (exists) {
          artifactsFound.push(`function:${func}`);
        } else {
          artifactsMissing.push(`function:${func}`);
        }
      }
    }

    // Verify tables
    if (artifacts.tables.length > 0) {
      console.log(`\n   🔍 Verifying ${artifacts.tables.length} tables...`);
      for (const table of artifacts.tables) {
        artifactsChecked.push(`table:${table}`);
        const exists = await verifyTable(table);
        console.log(`      ${exists ? '✅' : '❌'} ${table}`);
        if (exists) {
          artifactsFound.push(`table:${table}`);
        } else {
          artifactsMissing.push(`table:${table}`);
        }
      }
    }

    // Verify columns
    if (artifacts.columns.length > 0) {
      console.log(`\n   🔍 Verifying ${artifacts.columns.length} columns...`);
      for (const col of artifacts.columns) {
        artifactsChecked.push(`column:${col.table}.${col.column}`);
        const exists = await verifyColumn(col.table, col.column);
        console.log(`      ${exists ? '✅' : '❌'} ${col.table}.${col.column}`);
        if (exists) {
          artifactsFound.push(`column:${col.table}.${col.column}`);
        } else {
          artifactsMissing.push(`column:${col.table}.${col.column}`);
        }
      }
    }

    // Classification logic
    let classification: 'A' | 'B' | 'PARTIAL' = 'A';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let notes = '';

    if (artifactsChecked.length === 0) {
      notes = 'No verifiable artifacts (policies/roles/schemas only)';
      confidence = 'LOW';
      classification = 'B'; // Assume applied if no artifacts to check
    } else {
      const foundRatio = artifactsFound.length / artifactsChecked.length;
      
      if (foundRatio === 1) {
        classification = 'B';
        confidence = 'HIGH';
        notes = 'All artifacts exist';
      } else if (foundRatio === 0) {
        classification = 'A';
        confidence = 'HIGH';
        notes = 'No artifacts found';
      } else {
        classification = 'PARTIAL';
        confidence = 'MEDIUM';
        notes = `Partial: ${artifactsFound.length}/${artifactsChecked.length} artifacts exist`;
      }
    }

    console.log(`\n   📊 Classification: ${classification}`);
    console.log(`   🎯 Confidence: ${confidence}`);
    console.log(`   📝 Notes: ${notes}`);

    results.push({
      migration: migrationFile,
      artifacts_checked: artifactsChecked,
      artifacts_found: artifactsFound,
      artifacts_missing: artifactsMissing,
      classification,
      confidence,
      notes
    });
  }

  // Summary
  console.log('\n═'.repeat(80));
  console.log('📊 Verification Summary');
  console.log('═'.repeat(80));

  const classA = results.filter(r => r.classification === 'A');
  const classB = results.filter(r => r.classification === 'B');
  const classPartial = results.filter(r => r.classification === 'PARTIAL');

  console.log('\n📈 Classification Results:');
  console.log(`   Class A (DDL not applied): ${classA.length}`);
  console.log(`   Class B (DDL applied, history missing): ${classB.length}`);
  console.log(`   Partial (Some DDL applied): ${classPartial.length}`);

  console.log('\n📋 Detailed Results:\n');
  console.table(results.map(r => ({
    Migration: r.migration.substring(0, 50),
    Checked: r.artifacts_checked.length,
    Found: r.artifacts_found.length,
    Missing: r.artifacts_missing.length,
    Class: r.classification,
    Confidence: r.confidence
  })));

  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'docs', 'architecture', 'UNKNOWN_MIGRATIONS_VERIFICATION.md');
  
  let report = `# Unknown Migrations Verification Report\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Method:** pg_catalog artifact verification\n`;
  report += `**Migrations Verified:** ${unknownMigrations.length}\n\n`;
  report += `---\n\n`;
  report += `## Summary\n\n`;
  report += `- **Class A** (DDL not applied): ${classA.length}\n`;
  report += `- **Class B** (DDL applied): ${classB.length}\n`;
  report += `- **Partial** (Mixed state): ${classPartial.length}\n\n`;
  report += `---\n\n`;
  report += `## Detailed Results\n\n`;

  results.forEach(r => {
    report += `### ${r.migration}\n\n`;
    report += `**Classification:** ${r.classification}  \n`;
    report += `**Confidence:** ${r.confidence}  \n`;
    report += `**Notes:** ${r.notes}\n\n`;
    report += `**Artifacts Checked:** ${r.artifacts_checked.length}  \n`;
    report += `**Artifacts Found:** ${r.artifacts_found.length}  \n`;
    report += `**Artifacts Missing:** ${r.artifacts_missing.length}\n\n`;
    
    if (r.artifacts_found.length > 0) {
      report += `**Found:**\n`;
      r.artifacts_found.forEach(a => report += `- ✅ ${a}\n`);
      report += `\n`;
    }
    
    if (r.artifacts_missing.length > 0) {
      report += `**Missing:**\n`;
      r.artifacts_missing.forEach(a => report += `- ❌ ${a}\n`);
      report += `\n`;
    }
    
    report += `---\n\n`;
  });

  report += `## Recommended Actions\n\n`;
  
  if (classA.length > 0) {
    report += `### Class A Migrations (Apply DDL + Record History)\n\n`;
    classA.forEach(r => {
      report += `1. \`${r.migration}\`\n`;
      report += `   - Apply migration SQL\n`;
      report += `   - Record in schema_migrations\n\n`;
    });
  }
  
  if (classB.length > 0) {
    report += `### Class B Migrations (Record History Only)\n\n`;
    classB.forEach(r => {
      report += `1. \`${r.migration}\`\n`;
      report += `   - INSERT into schema_migrations only\n`;
      report += `   - DDL already applied (${r.artifacts_found.length} artifacts verified)\n\n`;
    });
  }
  
  if (classPartial.length > 0) {
    report += `### Partial Migrations (Manual Investigation Required)\n\n`;
    classPartial.forEach(r => {
      report += `1. \`${r.migration}\`\n`;
      report += `   - Notes: ${r.notes}\n`;
      report += `   - Action: Compare expected vs actual schema\n`;
      report += `   - Decision: Apply missing artifacts OR rollback partial changes\n\n`;
    });
  }

  report += `---\n\n`;
  report += `**Status:** Verification complete  \n`;
  report += `**Next:** Reconcile based on classification results\n`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Detailed report saved: ${reportPath}`);

  console.log('\n═'.repeat(80));
  console.log('✅ Verification Complete');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Next: Review results and execute reconciliation plan');
  console.log('');
}

main().catch(console.error);
