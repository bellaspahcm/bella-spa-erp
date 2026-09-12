/**
 * E0.1A-R0 — Identity Migration Preflight Census
 * 
 * Purpose: Census existing Person/Party data before migration
 * Output: R0_CENSUS_REPORT.md with exact counts
 * 
 * Usage: tsx scripts/remediation/r0-identity-census.ts
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

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
});

interface CensusResult {
  timestamp: string;
  persons: PersonCensus;
  parties: PartyCensus;
  collisions: CollisionCensus;
  duplicates: DuplicateCensus;
  fks: FKCensus;
}

interface PersonCensus {
  total: number;
  byTenant: Array<{ tenant_id: string; count: number }>;
  missingName: number;
  missingDOB: number;
  sample: any[];
}

interface PartyCensus {
  total: number;
  byType: Array<{ type: string; count: number }>;
  byTenant: Array<{ tenant_id: string; count: number }>;
  individuals: number;
  sample: any[];
}

interface CollisionCensus {
  total: number;
  collisions: any[];
}

interface DuplicateCensus {
  total: number;
  matches: any[];
}

interface FKCensus {
  studentsFKs: number;
  otherTables: string[];
}

async function runCensus(): Promise<CensusResult> {
  console.log('🔍 Starting Identity Migration Preflight Census...\n');

  const result: CensusResult = {
    timestamp: new Date().toISOString(),
    persons: await censusPersons(),
    parties: await censusParties(),
    collisions: await detectCollisions(),
    duplicates: await detectDuplicates(),
    fks: await censusFKs(),
  };

  return result;
}

async function censusPersons(): Promise<PersonCensus> {
  console.log('📊 R0.1 — Census Persons...');

  // Total count
  const totalResult = await pool.query('SELECT COUNT(*) AS total FROM persons');
  const total = parseInt(totalResult.rows[0].total);

  // By tenant
  const byTenantResult = await pool.query(`
    SELECT tenant_id, COUNT(*) AS count
    FROM persons
    GROUP BY tenant_id
    ORDER BY count DESC
  `);

  // Missing name
  const missingNameResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM persons
    WHERE first_name IS NULL OR last_name IS NULL
  `);
  const missingName = parseInt(missingNameResult.rows[0].count);

  // Missing DOB
  const missingDOBResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM persons
    WHERE date_of_birth IS NULL
  `);
  const missingDOB = parseInt(missingDOBResult.rows[0].count);

  // Sample
  const sampleResult = await pool.query(`
    SELECT id, tenant_id, first_name, last_name, date_of_birth, created_at
    FROM persons
    LIMIT 10
  `);

  console.log(`  ✅ Total Persons: ${total}`);
  console.log(`  ⚠️  Missing Name: ${missingName}`);
  console.log(`  ⚠️  Missing DOB: ${missingDOB}\n`);

  return {
    total,
    byTenant: byTenantResult.rows,
    missingName,
    missingDOB,
    sample: sampleResult.rows,
  };
}

async function censusParties(): Promise<PartyCensus> {
  console.log('📊 R0.2 — Census Parties...');

  // Total count
  const totalResult = await pool.query('SELECT COUNT(*) AS total FROM party_parties');
  const total = parseInt(totalResult.rows[0].total);

  // By type
  const byTypeResult = await pool.query(`
    SELECT party_type AS type, COUNT(*) AS count
    FROM party_parties
    GROUP BY party_type
    ORDER BY count DESC
  `);

  // By tenant
  const byTenantResult = await pool.query(`
    SELECT tenant_id, COUNT(*) AS count
    FROM party_parties
    GROUP BY tenant_id
    ORDER BY count DESC
  `);

  // Individuals (person type)
  const individualsResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM party_parties
    WHERE party_type = 'person'
  `);
  const individuals = parseInt(individualsResult.rows[0].count);

  // Sample
  const sampleResult = await pool.query(`
    SELECT id, tenant_id, party_type, display_name, created_at
    FROM party_parties
    LIMIT 10
  `);

  console.log(`  ✅ Total Parties: ${total}`);
  console.log(`  📝 Individuals (person): ${individuals}\n`);

  return {
    total,
    byType: byTypeResult.rows,
    byTenant: byTenantResult.rows,
    individuals,
    sample: sampleResult.rows,
  };
}

async function detectCollisions(): Promise<CollisionCensus> {
  console.log('📊 R0.3 — Detect UUID Collisions...');

  const result = await pool.query(`
    SELECT 
      p.id,
      p.tenant_id AS person_tenant,
      pp.tenant_id AS party_tenant,
      p.first_name || ' ' || p.last_name AS person_name,
      pp.display_name AS party_name,
      p.created_at AS person_created,
      pp.created_at AS party_created
    FROM persons p
    INNER JOIN party_parties pp ON p.id = pp.id
    ORDER BY p.created_at
  `);

  console.log(`  ${result.rows.length > 0 ? '❌' : '✅'} UUID Collisions: ${result.rows.length}\n`);

  return {
    total: result.rows.length,
    collisions: result.rows,
  };
}

async function detectDuplicates(): Promise<DuplicateCensus> {
  console.log('📊 R0.4 — Detect Same-Human Duplicates...');

  const result = await pool.query(`
    WITH person_normalized AS (
      SELECT 
        id AS person_id,
        tenant_id,
        LOWER(TRIM(first_name || ' ' || last_name)) AS name_normalized,
        date_of_birth,
        created_at
      FROM persons
      WHERE first_name IS NOT NULL AND last_name IS NOT NULL
    ),
    party_normalized AS (
      SELECT 
        id AS party_id,
        tenant_id,
        LOWER(TRIM(display_name)) AS name_normalized,
        created_at
      FROM party_parties
      WHERE party_type = 'person' AND display_name IS NOT NULL
    )
    SELECT 
      pn.person_id,
      pn.name_normalized AS person_name,
      pp.party_id,
      pp.name_normalized AS party_name,
      pn.tenant_id,
      pn.date_of_birth,
      'NAME_MATCH' AS match_type
    FROM person_normalized pn
    INNER JOIN party_normalized pp 
      ON pn.tenant_id = pp.tenant_id
      AND pn.name_normalized = pp.name_normalized
    LIMIT 100
  `);

  console.log(`  ${result.rows.length > 0 ? '⚠️ ' : '✅'} Probable Matches: ${result.rows.length}\n`);

  return {
    total: result.rows.length,
    matches: result.rows,
  };
}

async function censusFKs(): Promise<FKCensus> {
  console.log('📊 R0.5 — Census Person FKs...');

  // Check students
  const studentsResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM students
    WHERE person_id IS NOT NULL
  `);
  const studentsFKs = parseInt(studentsResult.rows[0].count);

  // Find other tables with person_id
  const tablesResult = await pool.query(`
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE column_name LIKE '%person_id%'
      AND table_schema = 'public'
    ORDER BY table_name
  `);

  console.log(`  ✅ Students with person_id: ${studentsFKs}`);
  console.log(`  ✅ Tables with person_id: ${tablesResult.rows.length}\n`);

  return {
    studentsFKs,
    otherTables: tablesResult.rows.map(r => r.table_name),
  };
}

async function generateReport(census: CensusResult) {
  console.log('📝 Generating R0 Census Report...\n');

  const report = `---
remediation_id: E0.1A-R
phase: R0_PREFLIGHT
document: R0_CENSUS_REPORT
generated: ${census.timestamp}
status: complete
---

# R0 CENSUS REPORT — IDENTITY MIGRATION PREFLIGHT

> **Generated:** ${census.timestamp}

---

## 📊 R0.1 — PERSON CENSUS

\`\`\`text
Total Persons:                    ${census.persons.total.toLocaleString()}
Missing Name:                     ${census.persons.missingName} (${((census.persons.missingName / census.persons.total) * 100).toFixed(2)}%)
Missing DOB:                      ${census.persons.missingDOB} (${((census.persons.missingDOB / census.persons.total) * 100).toFixed(2)}%)

Tenants with Persons:             ${census.persons.byTenant.length}
\`\`\`

### Persons by Tenant (Top 10)

${census.persons.byTenant.slice(0, 10).map((t, i) => `${i + 1}. Tenant ${t.tenant_id}: ${t.count} persons`).join('\n')}

### Sample Persons

\`\`\`json
${JSON.stringify(census.persons.sample.slice(0, 3), null, 2)}
\`\`\`

---

## 📊 R0.2 — PARTY CENSUS

\`\`\`text
Total Parties:                    ${census.parties.total.toLocaleString()}
Individual Parties:               ${census.parties.individuals} (${((census.parties.individuals / census.parties.total) * 100).toFixed(2)}%)

Tenants with Parties:             ${census.parties.byTenant.length}
\`\`\`

### Parties by Type

${census.parties.byType.map((t, i) => `${i + 1}. ${t.type}: ${t.count} parties`).join('\n')}

### Sample Parties

\`\`\`json
${JSON.stringify(census.parties.sample.slice(0, 3), null, 2)}
\`\`\`

---

## 📊 R0.3 — UUID COLLISION DETECTION

\`\`\`text
UUID Collisions:                  ${census.collisions.total}
\`\`\`

${census.collisions.total > 0 ? `
### ❌ COLLISION DETECTED

\`\`\`json
${JSON.stringify(census.collisions.collisions, null, 2)}
\`\`\`

**ACTION REQUIRED:** Resolve UUID collisions before migration.
` : '✅ **NO COLLISIONS DETECTED** — Safe to proceed'}

---

## 📊 R0.4 — SAME-HUMAN DUPLICATE DETECTION

\`\`\`text
Probable Same-Human Matches:      ${census.duplicates.total}
\`\`\`

${census.duplicates.total > 0 ? `
### ⚠️ AMBIGUOUS MATCHES FOUND

\`\`\`json
${JSON.stringify(census.duplicates.matches.slice(0, 5), null, 2)}
\`\`\`

**ACTION REQUIRED:** Manual review of ${census.duplicates.total} matches.
` : '✅ **NO DUPLICATES DETECTED** — Create new Party for each Person'}

---

## 📊 R0.5 — PERSON FK CENSUS

\`\`\`text
Students with person_id:          ${census.fks.studentsFKs}
Tables with person_id FK:         ${census.fks.otherTables.length}
\`\`\`

### Tables Requiring Migration

${census.fks.otherTables.map((t, i) => `${i + 1}. ${t}`).join('\n')}

**CRITICAL:** All ${census.fks.studentsFKs} students must migrate person_id → party_id

---

## ✅ PREFLIGHT DECISION

\`\`\`text
R0.1 Person Census                ✅ COMPLETE
R0.2 Party Census                 ✅ COMPLETE
R0.3 Collision Detection          ${census.collisions.total === 0 ? '✅ PASS' : '❌ BLOCKED'}
R0.4 Duplicate Detection          ${census.duplicates.total === 0 ? '✅ PASS' : '⚠️  REVIEW'}
R0.5 FK Census                    ✅ COMPLETE

Missing Critical Fields:          ${((census.persons.missingName / census.persons.total) * 100).toFixed(2)}% (threshold: 5%)
Data Quality:                     ${((census.persons.missingName / census.persons.total) * 100) > 5 ? '❌ REQUIRES CLEANUP' : '✅ ACCEPTABLE'}
\`\`\`

### Migration Strategy

${census.collisions.total === 0 && census.duplicates.total === 0 ? `
**STRATEGY: CREATE NEW PARTY FOR EACH PERSON**

\`\`\`sql
-- Each Person → new Party with same UUID
INSERT INTO party_parties (id, tenant_id, type, display_name, created_at, updated_at)
SELECT 
  id,  -- Same UUID as Person
  tenant_id,
  'individual',
  full_name,
  created_at,
  updated_at
FROM persons
WHERE id NOT IN (SELECT id FROM party_parties);
\`\`\`

**Risk:** LOW (no collisions, no duplicates)
` : `
**STRATEGY: REQUIRES MANUAL RESOLUTION**

${census.collisions.total > 0 ? '❌ UUID collisions must be resolved first\n' : ''}
${census.duplicates.total > 0 ? `⚠️  ${census.duplicates.total} ambiguous matches require review\n` : ''}

**Action:** Export ambiguous cases, human review, then proceed.
`}

---

**PREFLIGHT STATUS:** ${census.collisions.total === 0 && ((census.persons.missingName / census.persons.total) * 100) <= 5 ? '✅ READY FOR MIGRATION' : '🔴 BLOCKED'}

**NEXT:** ${census.collisions.total === 0 && ((census.persons.missingName / census.persons.total) * 100) <= 5 ? 'R1 Identity Mapping' : 'Resolve blockers → Re-run R0'}

`;

  // Write report
  const reportPath = path.join(__dirname, '../../docs/products/bella-english-center/R0_CENSUS_REPORT.md');
  fs.writeFileSync(reportPath, report);

  console.log(`✅ Report generated: ${reportPath}\n`);
}

// Main execution
async function main() {
  try {
    const census = await runCensus();
    await generateReport(census);

    console.log('✅ R0 Identity Migration Preflight Census COMPLETE\n');
    
    // Close pool
    await pool.end();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Census failed:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
