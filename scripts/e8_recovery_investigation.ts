/**
 * E8 RECOVERY INVESTIGATION (READ ONLY)
 * 
 * Purpose: Determine official Supabase migration recording mechanism
 * Method: Inspect existing successful migrations as evidence
 * Status: READ ONLY (NO DEPLOYMENT, NO MODIFICATIONS)
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString });

async function investigate() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E8 RECOVERY INVESTIGATION (READ ONLY)                        ║');
  console.log('║  Date: 2026-08-24                                             ║');
  console.log('║  Purpose: Determine official deployment mechanism            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  await client.connect();

  try {
    // I1: Inspect schema_migrations schema
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('I1: SCHEMA_MIGRATIONS SCHEMA');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const schemaInspect = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations'
      ORDER BY ordinal_position
    `);

    console.log('Actual columns:');
    console.table(schemaInspect.rows);

    // I2: Inspect successful recent migration (20260821115404)
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('I2: SUCCESSFUL MIGRATION EVIDENCE (20260821115404)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const successfulMigration = await client.query(`
      SELECT *
      FROM supabase_migrations.schema_migrations
      WHERE version = '20260821115404'
    `);

    if (successfulMigration.rows.length > 0) {
      console.log('Found successful migration record:');
      console.log(JSON.stringify(successfulMigration.rows[0], null, 2));
      
      const record = successfulMigration.rows[0];
      console.log('\nKey fields:');
      console.log(`  version: ${record.version}`);
      console.log(`  name: ${record.name || 'NULL'}`);
      console.log(`  created_by: ${record.created_by || 'NULL'}`);
      console.log(`  idempotency_key: ${record.idempotency_key || 'NULL'}`);
      console.log(`  statements: ${record.statements ? `Array[${record.statements.length}]` : 'NULL'}`);
      console.log(`  rollback: ${record.rollback ? `Array[${record.rollback.length}]` : 'NULL'}`);
    } else {
      console.log('❌ Migration 20260821115404 not found in remote');
    }

    // I3: Compare with local file
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('I3: LOCAL FILE IDENTITY COMPARISON');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const localFile = 'supabase/migrations/20260821115404_f2_update_set_effective_date_rpc.sql';
    const localPath = path.join(process.cwd(), localFile);

    if (fs.existsSync(localPath)) {
      const localSQL = fs.readFileSync(localPath, 'utf-8');
      console.log(`Local file: ${localFile}`);
      console.log(`File size: ${localSQL.length} bytes`);
      console.log(`First 200 chars:\n${localSQL.substring(0, 200)}...\n`);
      
      if (successfulMigration.rows.length > 0) {
        const record = successfulMigration.rows[0];
        console.log('Remote record has statements array:', !!record.statements);
        console.log('Local file exists:', true);
        console.log('\n✅ This migration was deployed successfully.');
        console.log('   Deployment mechanism recorded statements array.');
      }
    } else {
      console.log(`❌ Local file not found: ${localFile}`);
    }

    // I4: Inspect deployment pattern across all successful migrations
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('I4: DEPLOYMENT PATTERN ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const patternAnalysis = await client.query(`
      SELECT 
        CASE 
          WHEN statements IS NOT NULL THEN 'HAS_STATEMENTS'
          ELSE 'NULL_STATEMENTS'
        END as statement_status,
        COUNT(*) as count,
        MIN(version) as earliest_version,
        MAX(version) as latest_version
      FROM supabase_migrations.schema_migrations
      GROUP BY statement_status
      ORDER BY statement_status
    `);

    console.log('Migration recording patterns:');
    console.table(patternAnalysis.rows);

    // I5: Inspect recent successful migrations (last 5 with statements)
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('I5: RECENT SUCCESSFUL MIGRATIONS (LAST 5 WITH STATEMENTS)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const recentSuccessful = await client.query(`
      SELECT 
        version,
        name,
        created_by,
        array_length(statements, 1) as statement_count
      FROM supabase_migrations.schema_migrations
      WHERE statements IS NOT NULL
      ORDER BY version DESC
      LIMIT 5
    `);

    console.log('Recent successfully deployed migrations:');
    console.table(recentSuccessful.rows);

    // I6: Check if 20260824000000 attempted (should be absent)
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('I6: VERIFY E8 TARGET MIGRATION ABSENT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const e8Check = await client.query(`
      SELECT *
      FROM supabase_migrations.schema_migrations
      WHERE version = '20260824000000'
    `);

    console.log(`Migration 20260824000000: ${e8Check.rows.length === 0 ? '✅ ABSENT (expected)' : '❌ EXISTS (unexpected)'}`);

    if (e8Check.rows.length > 0) {
      console.log('\n⚠️  Unexpected: Migration record exists but E8 verification failed.');
      console.log(JSON.stringify(e8Check.rows[0], null, 2));
    }

    // I7: Verify RPC absent
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('I7: VERIFY RPC ABSENT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const rpcCheck = await client.query(`
      SELECT 
        routine_schema,
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'finance_test_cleanup'
    `);

    console.log(`RPC finance_test_cleanup: ${rpcCheck.rows.length === 0 ? '✅ ABSENT (expected)' : '❌ EXISTS (unexpected)'}`);

    if (rpcCheck.rows.length > 0) {
      console.log('\n⚠️  Unexpected: RPC exists but E8.5 failed.');
      console.table(rpcCheck.rows);
    }

    // Final Analysis
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  INVESTIGATION SUMMARY                                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('Key findings:');
    console.log('');
    console.log('1. Schema structure:');
    console.log('   - Actual columns documented in I1');
    console.log('   - Check for: version, name, statements, created_by, idempotency_key');
    console.log('');
    console.log('2. Successful deployment evidence:');
    console.log('   - 20260821115404 deployment mechanism documented in I2');
    console.log('   - Check statements array presence');
    console.log('');
    console.log('3. Deployment patterns:');
    console.log('   - Migrations WITH statements: proper deployment mechanism');
    console.log('   - Migrations WITHOUT statements: legacy/historical (79 records)');
    console.log('');
    console.log('4. E8 deployment status:');
    console.log('   - 20260824000000: Should be ABSENT');
    console.log('   - finance_test_cleanup RPC: Should be ABSENT');
    console.log('   - Database: Should be CLEAN');
    console.log('');
    console.log('RECOMMENDATION:');
    console.log('');
    console.log('Based on successful migration evidence (I2), determine:');
    console.log('  - Which tool/mechanism created the statements array?');
    console.log('  - Was it CLI "db push"?');
    console.log('  - Was it Dashboard "Run migration" feature?');
    console.log('  - Was it programmatic with explicit recording?');
    console.log('');
    console.log('DO NOT:');
    console.log('  - Manually INSERT into schema_migrations');
    console.log('  - Redeploy without identifying correct mechanism');
    console.log('  - Modify historical NULL statements records');
    console.log('');
    console.log('NEXT: Use the same mechanism that deployed 20260821115404');
    console.log('      successfully to deploy 20260824000000.');

  } finally {
    await client.end();
  }
}

// Execute
investigate().catch(error => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});
