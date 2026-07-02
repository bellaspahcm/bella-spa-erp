#!/usr/bin/env node
/**
 * Apply Recruitment System Migration
 * 
 * This script applies the recruitment system migration directly to the
 * Supabase database using pg library.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('❌ SUPABASE_DB_URL not found in .env.local');
  process.exit(1);
}

console.log('📦 Loading migration file...');
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260622290000_create_recruitment_system.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('🔌 Connecting to Supabase database...');
console.log('   Database URL:', DB_URL.replace(/:[^:@]+@/, ':***@'));

async function applyMigration() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    console.log('\n🚀 Executing migration...\n');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!');
    
    // Verify tables created
    console.log('\n🔍 Verifying tables created...');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'recruitment_%'
      ORDER BY table_name
    `);
    
    console.log('   Tables created:');
    result.rows.forEach(row => {
      console.log('   ✓', row.table_name);
    });
    
    if (result.rows.length === 0) {
      console.warn('   ⚠️  No recruitment tables found (they may already exist)');
    }
    
    console.log('\n✨ Migration process complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Regenerate TypeScript types: npm run db:types');
    console.log('   2. Update recruitment-metrics.ts to use generated types');
    console.log('   3. Rebuild and test: npm run build');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist, skipping creation');
      console.log('   This is expected if migration was previously applied');
    } else {
      console.error('❌ Migration failed:', error.message);
      console.error('\n   Full error:', error);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

applyMigration().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
