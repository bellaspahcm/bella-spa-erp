/**
 * E0.1A-R2 — Execute Party Backfill + R2V Verification
 * 
 * Purpose: Create party_parties from persons using sealed R1 mapping
 * Scope: BACKFILL ONLY — NO FK CUTOVER
 * 
 * Usage: tsx scripts/remediation/r2-execute.ts
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

interface R2Counters {
  planned: number;
  created: number;
  still_pending: number;
  parties_in_db: number;
  r2_status: string;
}

interface R2VCheck {
  check_name: string;
  result: string;
  [key: string]: any;
}

async function executeSQL(filePath: string): Promise<any> {
  console.log(`\n📄 Executing: ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const result = await pool.query(sql);
    console.log(`✅ ${path.basename(filePath)} complete`);
    return result; // Return full result object
  } catch (error: any) {
    console.error(`❌ ${path.basename(filePath)} failed:`, error.message);
    throw error;
  }
}

async function executeR2Backfill(): Promise<R2Counters> {
  console.log('\n🚀 E0.1A-R2 — PARTY BACKFILL EXECUTION\n');
  console.log('═'.repeat(80));
  
  const sqlPath = path.join(__dirname, 'r2-party-backfill.sql');
  const result = await executeSQL(sqlPath);
  
  // pg returns multiple statements - last one has counters
  const rows = result.rows || [];
  
  if (rows.length === 0) {
    throw new Error('No counters returned from R2 backfill');
  }
  
  const counters = rows[0] as R2Counters;
  
  console.log('\n📊 R2 EXECUTION COUNTERS:');
  console.log(`   Planned:        ${counters.planned}`);
  console.log(`   Created:        ${counters.created}`);
  console.log(`   Still Pending:  ${counters.still_pending}`);
  console.log(`   Parties in DB:  ${counters.parties_in_db}`);
  console.log(`   Status:         ${counters.r2_status}\n`);
  
  if (counters.r2_status && counters.r2_status.includes('INCOMPLETE')) {
    throw new Error('R2 backfill incomplete');
  }
  
  return counters;
}

async function executeR2VVerification(): Promise<{ passed: boolean; checks: R2VCheck[] }> {
  console.log('\n🔍 E0.1A-R2V — BACKFILL VERIFICATION\n');
  console.log('═'.repeat(80));
  
  const sqlPath = path.join(__dirname, 'r2v-verification.sql');
  const result = await executeSQL(sqlPath);
  
  const rows = result.rows || [];
  
  // Parse verification results
  const checks: R2VCheck[] = [];
  let allPassed = true;
  
  for (const row of rows) {
    if (row.check_name && row.result) {
      checks.push(row);
      console.log(`   ${row.check_name}: ${row.result}`);
      if (row.result.includes('FAIL')) {
        allPassed = false;
      }
    }
  }
  
  console.log('\n═'.repeat(80));
  
  if (allPassed) {
    console.log('\n🎉 R2V VERIFICATION: ✅ PASS');
    console.log('\n📋 R3 Education Cutover: 🟢 AUTHORIZED\n');
  } else {
    console.log('\n❌ R2V VERIFICATION: 🔴 FAIL');
    console.log('\n📋 R3 Education Cutover: 🚫 BLOCKED\n');
    console.log('⚠️  ROLLBACK R2 and fix issues before retrying.\n');
  }
  
  return { passed: allPassed, checks };
}

async function generateR2Report(counters: R2Counters, verification: { passed: boolean; checks: R2VCheck[] }) {
  console.log('📝 Generating R2 completion report...\n');
  
  const checksTable = verification.checks.map(check => {
    const details = Object.entries(check)
      .filter(([key]) => key !== 'check_name' && key !== 'result')
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return `| ${check.check_name} | ${check.result} | ${details || 'N/A'} |`;
  }).join('\n');
  
  const report = `---
remediation_id: E0.1A-R
phase: R2_PARTY_BACKFILL
status: ${verification.passed ? 'complete' : 'failed'}
completed: ${new Date().toISOString()}
---

# R2 PARTY BACKFILL — COMPLETION REPORT

> **Completed:** ${new Date().toISOString()}

---

## ✅ R2 EXECUTION SUMMARY

\`\`\`text
Planned Mappings:                 ${counters.planned}
Parties Created:                  ${counters.created}
Still Pending:                    ${counters.still_pending}
Parties in DB:                    ${counters.parties_in_db}

R2 Status:                        ${counters.r2_status}
\`\`\`

---

## 📊 R2 DATA CLASSIFICATION

### MIGRATED TO party_parties

✅ **Core Identity Fields:**
- \`id\` (mapped from R1 sealed mapping)
- \`tenant_id\`
- \`party_type\` = 'person'
- \`display_name\` (first_name + last_name)
- \`dob\` (date_of_birth)
- \`gender\`
- \`created_at\`, \`updated_at\`
- \`created_by\`, \`updated_by\`
- \`version\`

### DEFERRED (Requires Subtables)

⏸️  **Complex Fields (not in party_parties core):**
- \`persons.identifiers\` (JSONB array) → requires \`party_identifiers\` subtable
- \`persons.contacts\` (JSONB array) → requires \`party_contacts\` subtable
- \`persons.addresses\` (JSONB array) → requires \`party_addresses\` subtable
- \`persons.photo_url\` → requires Party metadata or attachment system
- \`persons.preferred_language\` → requires Party metadata

**Status:** NOT SILENTLY DROPPED — retained in legacy \`persons\` table

### RETAINED IN LEGACY

🔒 **All \`persons\` Fields Preserved:**
- Full \`persons\` table unchanged
- Available for rollback
- Available for reference during migration

### SEMANTIC MAPPING NOTES

- \`persons.first_name + last_name\` → \`party.display_name\`
- \`persons.date_of_birth\` → \`party.dob\`
- \`persons.middle_name\` → NOT MAPPED (party schema lacks middle_name)
- \`persons.nationality\` → NOT MAPPED (party schema lacks nationality)
- \`persons.status\` → NOT MAPPED (party uses \`deleted_at\` instead)

---

## ✅ R2V VERIFICATION RESULTS

| Check | Result | Details |
|-------|--------|---------|
${checksTable}

### R2V Summary

\`\`\`text
Total Checks:                     ${verification.checks.length}
Passed:                           ${verification.checks.filter(c => c.result.includes('PASS')).length}
Failed:                           ${verification.checks.filter(c => c.result.includes('FAIL')).length}

R2V Status:                       ${verification.passed ? '✅ PASS' : '❌ FAIL'}
\`\`\`

---

## ${verification.passed ? '🟢' : '🔴'} R3 AUTHORIZATION

\`\`\`text
R2 Party Backfill                 ${counters.r2_status.includes('COMPLETE') ? '✅ COMPLETE' : '❌ INCOMPLETE'}
R2V Verification                  ${verification.passed ? '✅ PASS' : '❌ FAIL'}

R3 Education Cutover              ${verification.passed ? '🟢 AUTHORIZED' : '🚫 BLOCKED'}
\`\`\`

${verification.passed ? `
**R3 is now AUTHORIZED to proceed.**

Next steps:
1. Review R2V verification results
2. Proceed to R3 Education Cutover (students FK migration)
3. Execute R3 with compatibility-safe staged deployment
` : `
**R3 is BLOCKED. R2V verification failed.**

Required actions:
1. Review failed R2V checks
2. Rollback R2 backfill
3. Fix identified issues
4. Retry R2 execution
5. Only proceed to R3 after R2V PASS
`}

---

## 🔒 PRESERVED STATE

**persons table:** UNCHANGED (${counters.planned} rows preserved)  
**students.person_id:** UNCHANGED (no FK cutover in R2)  
**StudentService:** UNCHANGED (no code changes in R2)  
**Contract:** UNCHANGED (no semantic changes in R2)

**Rollback:** Safe to rollback by deleting created parties + reverting mapping status

---

**R2 STATUS:** ${verification.passed ? '✅ COMPLETE' : '❌ FAILED'}

**NEXT:** ${verification.passed ? 'R3 Education Cutover' : 'Fix R2V failures and retry'}
`;
  
  const reportPath = path.join(__dirname, '../../docs/products/bella-english-center/R2_COMPLETION_REPORT.md');
  fs.writeFileSync(reportPath, report);
  
  console.log(`✅ Report generated: ${reportPath}\n`);
}

async function main() {
  try {
    console.log('🚀 E0.1A-R2 — PARTY BACKFILL + R2V VERIFICATION\n');
    console.log('⚠️  SCOPE: BACKFILL ONLY — NO FK CUTOVER\n');
    
    // Execute R2 backfill
    const counters = await executeR2Backfill();
    
    // Execute R2V verification
    const verification = await executeR2VVerification();
    
    // Generate report
    await generateR2Report(counters, verification);
    
    if (verification.passed) {
      console.log('═'.repeat(80));
      console.log('\n🎉 R2 + R2V COMPLETE\n');
      console.log('📊 Summary:');
      console.log(`   Parties Created: ${counters.created}`);
      console.log(`   Verification: ${verification.checks.length} checks PASS`);
      console.log('\n🟢 R3 AUTHORIZED');
      console.log('   Ready for Education Cutover (students FK migration)\n');
    } else {
      console.log('═'.repeat(80));
      console.log('\n❌ R2V VERIFICATION FAILED\n');
      console.log('🚫 R3 BLOCKED');
      console.log('   Must fix issues and retry R2 before proceeding\n');
    }
    
    await pool.end();
    process.exit(verification.passed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ R2 execution failed:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
