/**
 * E8.0.2: Check Legacy Migration Records (READ ONLY)
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({ 
  connectionString: process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL 
});

const LEGACY_VERSIONS = [
  '20260820',
  '20260821'
];

async function investigate() {
  await client.connect();

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  E8.0.2: Legacy Migration Investigation                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Check remote records for legacy versions
  console.log('Checking remote schema_migrations for legacy versions...\n');

  for (const version of LEGACY_VERSIONS) {
    const result = await client.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE version LIKE $1
      ORDER BY version
    `, [`${version}%`]);

    console.log(`\n━━━ Version prefix: ${version} ━━━`);
    console.log(`Found ${result.rows.length} records:\n`);
    
    if (result.rows.length > 0) {
      console.table(result.rows);
    } else {
      console.log('  (none)');
    }
  }

  // Check exact format comparison
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Format Analysis                                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const formatCheck = await client.query(`
    SELECT 
      version,
      LENGTH(version) as version_length,
      name
    FROM supabase_migrations.schema_migrations
    WHERE version LIKE '202608%'
    ORDER BY version
  `);

  console.log('All August 2026 migrations with version length:\n');
  console.table(formatCheck.rows);

  await client.end();
}

investigate().catch(error => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});
