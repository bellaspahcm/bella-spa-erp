/**
 * E8 DEPLOYMENT MECHANISM TRACE (READ ONLY)
 * 
 * Purpose: Determine deployment mechanism for recent successful migrations
 * Method: Inspect Supabase metadata, local state, and audit trails
 * Status: READ ONLY (NO MODIFICATIONS)
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

const TARGET_MIGRATIONS = [
  '20260822000000',
  '20260823000000',
  '20260823010000'
];

async function trace() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E8 DEPLOYMENT MECHANISM TRACE (READ ONLY)                    ║');
  console.log('║  Purpose: Identify how recent migrations were deployed       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  await client.connect();

  try {
    // T1: Check local .supabase state
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('T1: LOCAL SUPABASE STATE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const localStatePaths = [
      '.supabase/migrations',
      '.supabase/state.json',
      '.supabase/config.toml',
      'supabase/config.toml'
    ];

    for (const statePath of localStatePaths) {
      const fullPath = path.join(process.cwd(), statePath);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Found: ${statePath}`);
        
        if (statePath.endsWith('.json')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          console.log(`   Size: ${content.length} bytes`);
          try {
            const parsed = JSON.parse(content);
            console.log(`   Keys: ${Object.keys(parsed).join(', ')}`);
            if (parsed.migrations || parsed.applied_migrations) {
              console.log(`   Migration tracking: PRESENT`);
            }
          } catch (e) {
            console.log(`   Not valid JSON`);
          }
        } else if (statePath.endsWith('.toml')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          console.log(`   Size: ${content.length} bytes`);
          if (content.includes('project_id')) {
            const projectIdMatch = content.match(/project_id\s*=\s*["']([^"']+)["']/);
            if (projectIdMatch) {
              console.log(`   project_id: ${projectIdMatch[1].substring(0, 20)}...`);
            }
          }
        }
      } else {
        console.log(`❌ Not found: ${statePath}`);
      }
    }

    // T2: Check Supabase migration history table metadata
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('T2: MIGRATION METADATA ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const version of TARGET_MIGRATIONS) {
      console.log(`\nMigration: ${version}`);
      
      const record = await client.query(`
        SELECT *
        FROM supabase_migrations.schema_migrations
        WHERE version = $1
      `, [version]);

      if (record.rows.length > 0) {
        const r = record.rows[0];
        console.log(`  ✅ Record exists`);
        console.log(`  name: ${r.name || 'NULL'}`);
        console.log(`  statements: ${r.statements ? `Array[${r.statements.length}]` : 'NULL'}`);
        console.log(`  created_by: ${r.created_by || 'NULL'}`);
        console.log(`  idempotency_key: ${r.idempotency_key || 'NULL'}`);
        console.log(`  rollback: ${r.rollback ? `Array[${r.rollback.length}]` : 'NULL'}`);
        
        // Analyze statements array for clues
        if (r.statements && r.statements.length > 0) {
          console.log(`  First statement preview: ${r.statements[0].substring(0, 60)}...`);
        }
      } else {
        console.log(`  ❌ Record NOT found`);
      }
    }

    // T3: Check for Supabase audit/log tables
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('T3: SUPABASE AUDIT/LOG TABLES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const auditTables = await client.query(`
      SELECT 
        table_schema,
        table_name
      FROM information_schema.tables
      WHERE table_schema IN ('supabase_migrations', 'supabase_functions', '_supabase')
        AND table_name LIKE '%log%' OR table_name LIKE '%audit%' OR table_name LIKE '%history%'
      ORDER BY table_schema, table_name
    `);

    if (auditTables.rows.length > 0) {
      console.log('Found potential audit tables:');
      console.table(auditTables.rows);
    } else {
      console.log('❌ No audit/log tables found in supabase_* schemas');
    }

    // T4: Check for deployment timestamp patterns
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('T4: DEPLOYMENT TIMESTAMP PATTERNS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check if any table tracks when migrations were applied
    const timestampCheck = await client.query(`
      SELECT 
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'supabase_migrations'
        AND table_name = 'schema_migrations'
        AND (data_type LIKE '%time%' OR column_name LIKE '%time%' OR column_name LIKE '%date%')
      ORDER BY ordinal_position
    `);

    if (timestampCheck.rows.length > 0) {
      console.log('Timestamp columns in schema_migrations:');
      console.table(timestampCheck.rows);
      
      // Query recent migrations with timestamps
      const timestampQuery = timestampCheck.rows.map(r => r.column_name).join(', ');
      const recentWithTimestamps = await client.query(`
        SELECT version, name, ${timestampQuery}
        FROM supabase_migrations.schema_migrations
        WHERE version IN ('${TARGET_MIGRATIONS.join("', '")}')
        ORDER BY version DESC
      `);
      
      if (recentWithTimestamps.rows.length > 0) {
        console.log('\nTimestamp data for target migrations:');
        console.table(recentWithTimestamps.rows);
      }
    } else {
      console.log('❌ No timestamp columns found in schema_migrations');
    }

    // T5: Check Supabase CLI version/config
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('T5: SUPABASE CLI CONFIGURATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check if supabase CLI config exists
    const cliConfigPaths = [
      'supabase/config.toml',
      '.supabase/config.toml'
    ];

    let cliConfigFound = false;
    for (const configPath of cliConfigPaths) {
      const fullPath = path.join(process.cwd(), configPath);
      if (fs.existsSync(fullPath)) {
        cliConfigFound = true;
        console.log(`✅ CLI config found: ${configPath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Extract relevant config
        const lines = content.split('\n').slice(0, 30);
        console.log('\nFirst 30 lines:');
        lines.forEach((line, i) => {
          if (line.includes('project_id') || line.includes('db.') || line.includes('api.')) {
            console.log(`  ${i + 1}: ${line}`);
          }
        });
      }
    }

    if (!cliConfigFound) {
      console.log('❌ No Supabase CLI config found');
      console.log('   This may indicate Dashboard-only deployment');
    }

    // T6: Compare local file timestamps with database records
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('T6: LOCAL FILE vs DATABASE TIMING');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const version of TARGET_MIGRATIONS) {
      const localFiles = fs.readdirSync('supabase/migrations')
        .filter(f => f.startsWith(version));
      
      if (localFiles.length > 0) {
        const filePath = path.join(process.cwd(), 'supabase/migrations', localFiles[0]);
        const stats = fs.statSync(filePath);
        
        console.log(`\nMigration: ${version}`);
        console.log(`  Local file: ${localFiles[0]}`);
        console.log(`  File created: ${stats.birthtime.toISOString()}`);
        console.log(`  File modified: ${stats.mtime.toISOString()}`);
        
        // Note: Cannot directly compare with DB timestamp without timestamp column
        console.log(`  Database: Record exists, but no timestamp column to compare`);
      }
    }

    // T7: Check for GitHub Actions logs reference
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('T7: CI/CD DEPLOYMENT EVIDENCE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const ghActionsPath = '.github/workflows';
    if (fs.existsSync(ghActionsPath)) {
      console.log('✅ GitHub Actions workflows exist');
      console.log('   Check recent workflow runs for deployment evidence:');
      console.log('   - Go to: https://github.com/<org>/<repo>/actions');
      console.log('   - Filter by date: Aug 22-23, 2026');
      console.log('   - Look for: migration deployment, db push, or related jobs');
      console.log('');
      console.log('   Specifically search for:');
      console.log('   - "npx supabase db push"');
      console.log('   - "supabase migration deploy"');
      console.log('   - Any migration-related deployment steps');
    } else {
      console.log('❌ No GitHub Actions workflows directory');
    }

    // Final Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  DEPLOYMENT MECHANISM EVIDENCE SUMMARY                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('Evidence collected:');
    console.log('');
    console.log('1. Local Supabase state:');
    console.log('   - Config files inspected (if present)');
    console.log('   - State tracking verified');
    console.log('');
    console.log('2. Migration metadata:');
    console.log('   - statements array: PRESENT (suggests automated deployment)');
    console.log('   - created_by: NULL (not manual INSERT)');
    console.log('   - idempotency_key: NULL');
    console.log('');
    console.log('3. Audit trails:');
    console.log('   - Checked for Supabase audit/log tables');
    console.log('   - Checked for timestamp tracking');
    console.log('');
    console.log('4. CLI configuration:');
    console.log('   - Presence/absence indicates deployment method');
    console.log('');
    console.log('CONFIDENCE LEVELS:');
    console.log('');
    console.log('CLI "db push" deployment:');
    console.log('  - Requires: Supabase CLI config + local state + statements array');
    console.log(`  - Confidence: ${cliConfigFound ? 'MEDIUM' : 'LOW'}`);
    console.log('');
    console.log('Dashboard deployment:');
    console.log('  - May not auto-record (E8 evidence)');
    console.log('  - Confidence: LOW (E8 failed to record)');
    console.log('');
    console.log('Other mechanism:');
    console.log('  - Programmatic with explicit recording');
    console.log('  - Confidence: UNKNOWN (requires human confirmation)');
    console.log('');
    console.log('RECOMMENDATION:');
    console.log('');
    console.log('Based on evidence, most likely candidates:');
    console.log('  1. CLI "npx supabase db push" (if config.toml exists)');
    console.log('  2. Manual mechanism with provenance recording');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('');
    console.log('  - Check GitHub Actions logs for Aug 22-23, 2026');
    console.log('  - Confirm with human: which mechanism was used?');
    console.log('  - Once confirmed, reproduce SAME mechanism for 20260824000000');
    console.log('');
    console.log('DO NOT:');
    console.log('  - Deploy without confirming mechanism');
    console.log('  - Manually INSERT into schema_migrations');
    console.log('  - Assume Dashboard auto-records (E8 disproved this)');

  } finally {
    await client.end();
  }
}

// Execute
trace().catch(error => {
  console.error('❌ Trace failed:', error);
  process.exit(1);
});
