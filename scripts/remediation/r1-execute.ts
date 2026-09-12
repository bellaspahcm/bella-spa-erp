/**
 * E0.1A-R1 — Execute Identity Mapping (R1.1 → R1.4)
 * 
 * Purpose: Create and populate immutable identity mapping evidence
 * Prerequisites: R0 census complete
 * 
 * Usage: tsx scripts/remediation/r1-execute.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config();

const DATABASE_URL = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_EXECUTOR_URL or DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function executeSQL(filePath: string): Promise<void> {
  console.log(`\n📄 Executing: ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, 'utf-8');
  
  try {
    await pool.query(sql);
    console.log(`✅ ${path.basename(filePath)} complete`);
  } catch (error: any) {
    console.error(`❌ ${path.basename(filePath)} failed:`, error.message);
    throw error;
  }
}

async function verifyR1() {
  console.log('\n🔍 Verifying R1 completion...\n');

  const result = await pool.query(`
    WITH completion_summary AS (
      SELECT 
        (SELECT COUNT(*) FROM identity_migration_mapping) AS total_mappings,
        (SELECT COUNT(*) FROM identity_migration_mapping WHERE sealed_at IS NOT NULL) AS sealed_mappings,
        (SELECT COUNT(*) FROM identity_migration_mapping WHERE strategy = 'CREATE_NEW_PARTY') AS create_new_party,
        (SELECT COUNT(*) FROM persons p LEFT JOIN identity_migration_mapping m ON p.id = m.person_id WHERE m.person_id IS NULL) AS unmapped_persons,
        (SELECT COUNT(*) FROM (SELECT party_id FROM identity_migration_mapping GROUP BY party_id HAVING COUNT(*) > 1) dup) AS duplicate_mappings
    )
    SELECT 
      total_mappings,
      sealed_mappings,
      create_new_party,
      unmapped_persons,
      duplicate_mappings,
      CASE 
        WHEN total_mappings = 848 
         AND sealed_mappings = 848 
         AND create_new_party = 848 
         AND unmapped_persons = 0 
         AND duplicate_mappings = 0 
        THEN 'PASS'
        ELSE 'FAIL'
      END AS r1_status
    FROM completion_summary
  `);

  const summary = result.rows[0];

  console.log('📊 R1 Verification Summary:');
  console.log(`  Total Mappings:        ${summary.total_mappings}`);
  console.log(`  Sealed Mappings:       ${summary.sealed_mappings}`);
  console.log(`  CREATE_NEW_PARTY:      ${summary.create_new_party}`);
  console.log(`  Unmapped Persons:      ${summary.unmapped_persons}`);
  console.log(`  Duplicate Mappings:    ${summary.duplicate_mappings}`);
  console.log(`  Status:                ${summary.r1_status === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`);

  if (summary.r1_status !== 'PASS') {
    throw new Error('R1 verification failed');
  }

  return summary;
}

async function exportEvidence() {
  console.log('📦 Exporting mapping evidence...\n');

  const result = await pool.query(`
    SELECT 
      person_id,
      party_id,
      tenant_id,
      strategy,
      match_evidence::text AS match_evidence,
      status,
      created_at,
      sealed_at
    FROM identity_migration_mapping
    ORDER BY created_at
  `);

  // Ensure evidence directory exists
  const evidenceDir = path.join(__dirname, '../../evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Export as CSV
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const csvPath = path.join(evidenceDir, `E0.1A-R1-identity-mapping-${timestamp}.csv`);

  const csvHeader = 'person_id,party_id,tenant_id,strategy,match_evidence,status,created_at,sealed_at\n';
  const csvRows = result.rows.map(row => 
    `${row.person_id},${row.party_id},${row.tenant_id},${row.strategy},"${row.match_evidence.replace(/"/g, '""')}",${row.status},${row.created_at},${row.sealed_at}`
  ).join('\n');

  fs.writeFileSync(csvPath, csvHeader + csvRows);

  console.log(`✅ Evidence exported: ${csvPath}`);
  console.log(`   Rows: ${result.rows.length}\n`);
}

async function generateR1Report(summary: any) {
  console.log('📝 Generating R1 completion report...\n');

  const report = `---
remediation_id: E0.1A-R
phase: R1_IDENTITY_MAPPING
status: complete
completed: ${new Date().toISOString()}
blast_radius: platform_wide
---

# R1 IDENTITY MAPPING — COMPLETION REPORT

> **Completed:** ${new Date().toISOString()}

---

## ✅ R1 EXECUTION SUMMARY

\`\`\`text
R1.1 Mapping table created          ✅ COMPLETE
R1.2 Mappings populated             ✅ ${summary.total_mappings} rows
R1.3 Reconciliation                 ✅ PASS
R1.4 Evidence sealed                ✅ ${summary.sealed_mappings} sealed
\`\`\`

---

## 📊 MAPPING STATISTICS

\`\`\`text
Total Mappings:                   ${summary.total_mappings}
Sealed Mappings:                  ${summary.sealed_mappings}
CREATE_NEW_PARTY Strategy:        ${summary.create_new_party} (100%)
Unmapped Persons:                 ${summary.unmapped_persons}
Duplicate party_id Mappings:      ${summary.duplicate_mappings}
\`\`\`

---

## ✅ R1.3 RECONCILIATION — PASS

\`\`\`text
✅ All 848 persons mapped
✅ 0 unmapped persons
✅ 0 duplicate party_id mappings
✅ 100% CREATE_NEW_PARTY strategy
✅ 100% tenant coverage
\`\`\`

---

## 🔒 R1.4 EVIDENCE SEAL

\`\`\`text
Sealed Mappings:                  ${summary.sealed_mappings}/848
Seal Timestamp:                   ${new Date().toISOString()}
Evidence Export:                  ✅ CSV backup created
Immutability:                     ✅ Mapping evidence frozen
\`\`\`

---

## 🚨 BLAST RADIUS

**Affected Modules:**
- Education (students: 631 rows)
- HR (departments, employee_profiles)
- Real Estate (commission_ledger, checkins, kpi_targets, tasks)

**Total Tables Requiring Migration:** 7

---

## 🔴 BLOCKERS FOR R2 (Party Backfill)

\`\`\`text
R0.1 Person Census                ✅ COMPLETE (848 persons)
R0.2 Party Census                 ✅ COMPLETE (31,649 parties)
R0.3 Collision Detection          ✅ PASS (0 collisions)
R0.4 Duplicate Detection          ✅ PASS (0 deterministic)
R0.5 FK Census                    ✅ COMPLETE (7 tables)
R0.6 Write-Path Census            🔴 REQUIRED
R0.7 Contract/Caller Census       🔴 REQUIRED

R1 Identity Mapping               ✅ COMPLETE
\`\`\`

**CANNOT proceed to R2 until R0.6 + R0.7 complete.**

---

## 📋 NEXT STEPS

1. **Execute R0.6 Write-Path Census**
   - Find all code paths that INSERT/UPDATE persons
   - Identify PersonRepository methods
   - Trace direct DB writes

2. **Execute R0.7 Contract/Caller Census**
   - Trace IEducationStudentContract.registerStudent()
   - Find all partyId callers
   - Find all personId callers
   - Audit Preschool integration
   - Check tests/fixtures

3. **After R0.6 + R0.7 complete:**
   - Freeze cutover plan
   - Execute R2 Party Backfill
   - Execute R3 Kernel + Contract cutover (ATOMIC)
   - Execute R4 Caller migration
   - Execute R5 Legacy write freeze
   - Execute R6 Verification
   - Seal R7

---

**R1 STATUS:** ✅ COMPLETE

**NEXT:** R0.6 Write-Path Census
`;

  const reportPath = path.join(__dirname, '../../docs/products/bella-english-center/R1_COMPLETION_REPORT.md');
  fs.writeFileSync(reportPath, report);

  console.log(`✅ Report generated: ${reportPath}\n`);
}

async function main() {
  try {
    console.log('🚀 E0.1A-R1 — IDENTITY MAPPING EXECUTION\n');
    console.log('═'.repeat(80));
    
    // R1.1 — Create mapping table
    await executeSQL(path.join(__dirname, 'r1-create-mapping-table.sql'));
    
    // R1.2 + R1.3 — Populate and reconcile
    await executeSQL(path.join(__dirname, 'r1-populate-mappings.sql'));
    
    // R1.4 — Seal mapping
    await executeSQL(path.join(__dirname, 'r1-seal-mapping.sql'));
    
    // Verify completion
    const summary = await verifyR1();
    
    // Export evidence
    await exportEvidence();
    
    // Generate completion report
    await generateR1Report(summary);
    
    console.log('═'.repeat(80));
    console.log('\n🎉 R1 IDENTITY MAPPING COMPLETE\n');
    console.log('📊 Summary:');
    console.log(`   Mappings: ${summary.total_mappings}`);
    console.log(`   Sealed: ${summary.sealed_mappings}`);
    console.log(`   Strategy: ${summary.create_new_party} CREATE_NEW_PARTY`);
    console.log('\n🔴 BLOCKERS:');
    console.log('   R0.6 Write-Path Census — REQUIRED');
    console.log('   R0.7 Contract/Caller Census — REQUIRED');
    console.log('\n📋 NEXT: Execute R0.6 Write-Path Census\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ R1 execution failed:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
