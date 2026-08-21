#!/usr/bin/env node

/**
 * Apply Logistics Schema Migration
 * 
 * Week 3 Day 3 Gate A - Step 1
 * 
 * Applies the migration file to the remote Supabase database
 * using pg (PostgreSQL client) for direct SQL execution.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse Supabase DB URL from environment
const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('❌ Missing SUPABASE_DB_URL in environment');
  process.exit(1);
}

async function applyMigration() {
  console.log('🔄 APPLYING LOGISTICS SCHEMA MIGRATION\n');
  console.log('Database:', DB_URL.replace(/:[^:]+@/, ':****@')); // Hide password
  console.log('Migration: supabase/migrations/20260821115404_logistics_schema.sql\n');

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL
  });

  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    // Read migration file
    const migrationPath = join(__dirname, '../../supabase/migrations/20260821115404_logistics_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log(`   Size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);
    console.log(`   Lines: ${migrationSQL.split('\n').length}\n`);

    // Execute migration
    console.log('⚙️  Executing migration...\n');
    
    await client.query(migrationSQL);
    
    console.log('✅ MIGRATION APPLIED SUCCESSFULLY\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    
    const result = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'log_%'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${result.rows.length} logistics tables:\n`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name} (${row.table_type})`);
    });
    console.log();

    if (result.rows.length !== 6) {
      console.warn(`⚠️  Expected 6 tables, found ${result.rows.length}`);
      console.warn('   Migration may be incomplete\n');
    }

    return true;
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

console.log('═══════════════════════════════════════════════════════════\n');
console.log('  WEEK 3 DAY 3 — GATE A — STEP 1: APPLY MIGRATION');
console.log('\n═══════════════════════════════════════════════════════════\n');

applyMigration().then(() => {
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('  STEP 1 COMPLETE — Proceed to Step 2 (Verify Tables)');
  console.log('\n═══════════════════════════════════════════════════════════\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
