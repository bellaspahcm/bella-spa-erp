#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load DB URL
const envContent = readFileSync(join(projectRoot, '.env.local'), 'utf-8');
const DB_URL = envContent.match(/SUPABASE_DB_URL=(.+)/)?.[1]?.trim();

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log('Connecting...');
  await client.connect();
  console.log('✓ Connected');

  // Test simple query
  console.log('\nTesting simple CREATE TABLE...');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_migration_debug (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT
      );
    `);
    console.log('✓ Simple table creation OK');
  } catch (err) {
    console.log('✗ Failed:', err.message);
  }

  // Test with CHECK constraint
  console.log('\nTesting with CHECK constraint...');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_migration_check (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'google'))
      );
    `);
    console.log('✓ CHECK constraint OK');
  } catch (err) {
    console.log('✗ Failed:', err.message);
  }

  // Test with COALESCE in UNIQUE
  console.log('\nTesting with COALESCE in UNIQUE constraint...');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_migration_coalesce (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        col1 VARCHAR(50),
        col2 VARCHAR(50),
        CONSTRAINT uq_test UNIQUE (
          COALESCE(col1, ''),
          COALESCE(col2, '')
        )
      );
    `);
    console.log('✓ COALESCE in UNIQUE OK');
  } catch (err) {
    console.log('✗ Failed:', err.message);
  }

  // Test actual problematic part from migration
  console.log('\nTesting actual migration snippet...');
  const migrationSnippet = readFileSync(
    join(projectRoot, 'supabase', 'migrations', '20260622200000_create_external_ads_data.sql'),
    'utf-8'
  );
  
  // Get just the CREATE TABLE statement
  const createTableMatch = migrationSnippet.match(/CREATE TABLE IF NOT EXISTS external_ads_data \([^;]+\);/s);
  if (createTableMatch) {
    console.log('Extracted CREATE TABLE (first 200 chars):');
    console.log(createTableMatch[0].substring(0, 200) + '...');
    try {
      await client.query(createTableMatch[0]);
      console.log('✓ Actual CREATE TABLE OK!');
    } catch (err) {
      console.log('✗ Failed:', err.message);
      console.log('  Position:', err.position);
      console.log('  Line:', err.line);
    }
  }

} catch (error) {
  console.error('Connection error:', error.message);
} finally {
  console.log('\nCleaning up test tables...');
  try {
    await client.query(`DROP TABLE IF EXISTS test_migration_debug;`);
    await client.query(`DROP TABLE IF EXISTS test_migration_check;`);
    await client.query(`DROP TABLE IF EXISTS test_migration_coalesce;`);
    console.log('✓ Cleanup OK');
  } catch (err) {
    console.log('✗ Cleanup failed:', err.message);
  }
  await client.end();
}
