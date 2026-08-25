/**
 * E7: Execute Canonical Identity Audit via PostgreSQL Client
 * 
 * Purpose: Execute all 6 E7 queries and capture results
 * Method: Direct PostgreSQL connection
 * Status: READ-ONLY (no modifications)
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString });

async function executeQuery(title: string, query: string): Promise<any[]> {
  const result = await client.query(query);
  return result.rows;
}

async function e7Audit() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E7: CANONICAL MIGRATION IDENTITY AUDIT                       ║');
  console.log('║  Date: 2026-08-24                                             ║');
  console.log('║  Status: READ-ONLY FORENSIC                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  await client.connect();

  try {
    // E7.1: Enumerate exact remote identities
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('E7.1: ENUMERATE EXACT REMOTE IDENTITIES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e71Data = await executeQuery('E7.1', `
      SELECT 
        version,
        name,
        array_length(statements, 1) as statement_count,
        LEFT(statements[1], 100) as first_statement_preview,
        CASE 
          WHEN version ~ '^\\d{8}_' THEN 'LEGACY_8DIGIT'
          WHEN version ~ '^\\d{14}$' THEN 'STANDARD_14DIGIT'
          ELSE 'OTHER'
        END as version_format
      FROM supabase_migrations.schema_migrations
      WHERE 
        version LIKE '20260820%' 
        OR version LIKE '20260821%'
      ORDER BY version
    `);

    console.log(`Total rows: ${e71Data.length}`);
    console.log('Expected: 16 rows\n');
    
    const legacy = e71Data.filter(m => /^\d{8}_/.test(m.version));
    const standard = e71Data.filter(m => /^\d{14}$/.test(m.version));
    
    console.log(`LEGACY_8DIGIT:     ${legacy.length} (expected: 7)`);
    console.log(`STANDARD_14DIGIT:  ${standard.length} (expected: 9)\n`);
    
    console.table(e71Data.map(m => ({
      version: m.version,
      name: m.name?.substring(0, 30),
      format: m.version_format,
      statements: m.statement_count,
    })));

    // E7.2: Classify each migration
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('E7.2: CLASSIFY EACH MIGRATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e72Data = await executeQuery('E7.2', `
      WITH local_migrations AS (
        SELECT unnest(ARRAY[
          '20260820_r4_3_gate_tokens',
          '20260820_r4_4_monitoring_audit', 
          '20260820_r4_approval_contract',
          '20260820000000',
          '20260820010000',
          '20260820100000',
          '20260820110000',
          '20260820120000',
          '20260820130000',
          '20260820140000',
          '20260821_create_accessorial_rates_table',
          '20260821_create_carrier_rates_table',
          '20260821_create_discrepancies_table',
          '20260821_create_freight_audit_tables',
          '20260821000000',
          '20260821115404'
        ]) as local_version
      ),
      remote_migrations AS (
        SELECT 
          version as remote_version,
          name as remote_name
        FROM supabase_migrations.schema_migrations
        WHERE version LIKE '20260820%' OR version LIKE '20260821%'
      )
      SELECT 
        l.local_version,
        r.remote_version,
        r.remote_name,
        CASE
          WHEN l.local_version = r.remote_version THEN 'CLASS_A_EXACT_MATCH'
          WHEN r.remote_version IS NULL THEN 'CLASS_D_LOCAL_ONLY'
          ELSE 'CLASS_B_DIVERGENCE'
        END as classification
      FROM local_migrations l
      LEFT JOIN remote_migrations r ON l.local_version = r.remote_version
      ORDER BY l.local_version
    `);

    console.table(e72Data.map(m => ({
      local_version: m.local_version,
      remote_version: m.remote_version || '(none)',
      classification: m.classification,
    })));

    const exactMatch = e72Data.filter(c => c.classification === 'CLASS_A_EXACT_MATCH').length;
    const localOnly = e72Data.filter(c => c.classification === 'CLASS_D_LOCAL_ONLY').length;
    const divergence = e72Data.filter(c => c.classification === 'CLASS_B_DIVERGENCE').length;
    
    console.log(`\n${exactMatch === 16 ? '✅' : '❌'} CLASS_A_EXACT_MATCH: ${exactMatch} (expected: 16)`);
    console.log(`${localOnly === 0 ? '✅' : '❌'} CLASS_D_LOCAL_ONLY:  ${localOnly} (expected: 0)`);
    console.log(`${divergence === 0 ? '✅' : '❌'} CLASS_B_DIVERGENCE:  ${divergence} (expected: 0)`);

    // E7.3: Verify 20260824000000 is FREE
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('E7.3: VERIFY 20260824000000 IS FREE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e73Data = await executeQuery('E7.3', `
      SELECT 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM supabase_migrations.schema_migrations 
            WHERE version = '20260824000000'
          ) THEN 'OCCUPIED'
          ELSE 'FREE'
        END as status
    `);

    const status = e73Data[0].status;
    console.log(`20260824000000 status: ${status}`);
    console.log(`Expected: FREE\n`);

    if (status === 'FREE') {
      console.log('✅ Version FREE for RPC deployment');
    } else {
      console.log('❌ Version OCCUPIED — deployment blocked');
    }

    // E7.4: Detect remote-only migrations
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('E7.4: DETECT REMOTE-ONLY MIGRATIONS (Class C)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e74Data = await executeQuery('E7.4', `
      SELECT 
        version as remote_version,
        name as remote_name,
        'CLASS_C_REMOTE_ONLY' as classification
      FROM supabase_migrations.schema_migrations
      WHERE (version LIKE '20260820%' OR version LIKE '20260821%')
        AND version NOT IN (
          '20260820_r4_3_gate_tokens',
          '20260820_r4_4_monitoring_audit',
          '20260820_r4_approval_contract',
          '20260820000000',
          '20260820010000',
          '20260820100000',
          '20260820110000',
          '20260820120000',
          '20260820130000',
          '20260820140000',
          '20260821_create_accessorial_rates_table',
          '20260821_create_carrier_rates_table',
          '20260821_create_discrepancies_table',
          '20260821_create_freight_audit_tables',
          '20260821000000',
          '20260821115404'
        )
      ORDER BY version
    `);

    console.log(`Remote-only migrations: ${e74Data.length} (expected: 0)\n`);
    
    if (e74Data.length > 0) {
      console.log('❌ CLASS_C_REMOTE_ONLY detected:');
      console.table(e74Data);
    } else {
      console.log('✅ No remote-only migrations detected');
    }

    // E7.5: Full identity matrix
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('E7.5: FULL IDENTITY MATRIX');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e75Data = await executeQuery('E7.5', `
      SELECT 
        version,
        name,
        CASE 
          WHEN version ~ '^\\d{8}_' THEN 'LEGACY_8DIGIT'
          WHEN version ~ '^\\d{14}$' THEN 'STANDARD_14DIGIT'
          ELSE 'OTHER'
        END as format,
        CASE
          WHEN version IN (
            '20260820_r4_3_gate_tokens',
            '20260820_r4_4_monitoring_audit',
            '20260820_r4_approval_contract',
            '20260821_create_accessorial_rates_table',
            '20260821_create_carrier_rates_table',
            '20260821_create_discrepancies_table',
            '20260821_create_freight_audit_tables'
          ) THEN 'CLASS_A_LEGACY_EXACT_MATCH'
          WHEN version IN (
            '20260820000000',
            '20260820010000',
            '20260820100000',
            '20260820110000',
            '20260820120000',
            '20260820130000',
            '20260820140000',
            '20260821000000',
            '20260821115404'
          ) THEN 'CLASS_A_STANDARD_EXACT_MATCH'
          ELSE 'UNEXPECTED'
        END as identity_status
      FROM supabase_migrations.schema_migrations
      WHERE version LIKE '20260820%' OR version LIKE '20260821%'
      ORDER BY version
    `);

    console.table(e75Data.map(m => ({
      version: m.version,
      name: m.name?.substring(0, 30),
      format: m.format,
      identity_status: m.identity_status,
    })));

    const unexpected = e75Data.filter(m => m.identity_status === 'UNEXPECTED').length;
    console.log(`\n${unexpected === 0 ? '✅' : '❌'} UNEXPECTED formats: ${unexpected} (expected: 0)`);

    // E7.6: Summary report
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('E7.6: SUMMARY REPORT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e76Data = await executeQuery('E7.6', `
      WITH classification_summary AS (
        SELECT 
          CASE 
            WHEN version ~ '^\\d{8}_' THEN 'LEGACY_8DIGIT'
            WHEN version ~ '^\\d{14}$' THEN 'STANDARD_14DIGIT'
            ELSE 'OTHER'
          END as format,
          COUNT(*) as count
        FROM supabase_migrations.schema_migrations
        WHERE version LIKE '20260820%' OR version LIKE '20260821%'
        GROUP BY format
      )
      SELECT 
        format,
        count,
        CASE
          WHEN format = 'LEGACY_8DIGIT' THEN '7 expected (CLI reconciliation limitation)'
          WHEN format = 'STANDARD_14DIGIT' THEN '9 expected (CLI reconciles correctly)'
          ELSE 'Unexpected format detected'
        END as expected_vs_actual
      FROM classification_summary
      ORDER BY format
    `);

    console.table(e76Data);

    const legacyCount = e76Data.find(r => r.format === 'LEGACY_8DIGIT')?.count || 0;
    const standardCount = e76Data.find(r => r.format === 'STANDARD_14DIGIT')?.count || 0;
    const total = legacyCount + standardCount;

    console.log(`\nLEGACY_8DIGIT:     ${legacyCount} (expected: 7)`);
    console.log(`STANDARD_14DIGIT:  ${standardCount} (expected: 9)`);
    console.log(`Total:             ${total} (expected: 16)`);

    // Final gate evaluation
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  E7 GATE EVALUATION                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const conditions = [
      { name: 'E7.1: 16 rows returned', pass: e71Data.length === 16 },
      { name: 'E7.2: All CLASS_A_EXACT_MATCH', pass: exactMatch === 16 && localOnly === 0 && divergence === 0 },
      { name: 'E7.3: 20260824000000 FREE', pass: status === 'FREE' },
      { name: 'E7.4: 0 remote-only', pass: e74Data.length === 0 },
      { name: 'E7.5: No UNEXPECTED', pass: unexpected === 0 },
      { name: 'E7.6: 7 legacy + 9 standard', pass: legacyCount === 7 && standardCount === 9 },
    ];

    conditions.forEach(c => {
      console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
    });

    const allPass = conditions.every(c => c.pass);

    console.log('\n' + '═'.repeat(67));
    if (allPass) {
      console.log('✅✅✅ E7 CANONICAL IDENTITY AUDIT: PASS ✅✅✅');
      console.log('═'.repeat(67));
      console.log('\nAll 16 migrations have exact local↔remote identity match.');
      console.log('20260824000000 is FREE for RPC deployment.');
      console.log('No identity divergence detected.');
      console.log('\nCLI reconciliation limitation is tooling issue, NOT provenance corruption.');
      console.log('\n🎯 NEXT: E8 Deployment Method Decision (Dashboard deployment recommended)');
    } else {
      console.log('🔴🔴🔴 E7 CANONICAL IDENTITY AUDIT: BLOCKED 🔴🔴🔴');
      console.log('═'.repeat(67));
      console.log('\n❌ Identity divergence detected. DO NOT PROCEED with deployment.');
      console.log('\nRequired actions:');
      console.log('  - Investigate failed conditions');
      console.log('  - Document findings');
      console.log('  - Escalate to Human Architect');
    }
    console.log('\n' + '═'.repeat(67) + '\n');

  } finally {
    await client.end();
  }
}

// Execute
e7Audit().catch(error => {
  console.error('❌ E7 execution failed:', error);
  process.exit(1);
});
