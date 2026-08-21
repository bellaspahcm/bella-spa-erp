#!/usr/bin/env node
/**
 * Check which migrations are already applied
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function checkMigrations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      ORDER BY version DESC
      LIMIT 20
    `);
    
    console.log('\n📋 Applied Migrations:\n');
    result.rows.forEach(row => {
      console.log(`  ${row.version} - ${row.name}`);
    });
    
    console.log('\n✅ Check migrations for R2 and R3:');
    const r2 = result.rows.find(r => r.version === '20260820100000');
    const r3 = result.rows.find(r => r.version === '20260820110000');
    
    console.log(`  R2 (20260820100000): ${r2 ? '✅ APPLIED' : '⏳ NOT APPLIED'}`);
    console.log(`  R3 (20260820110000): ${r3 ? '✅ APPLIED' : '⏳ NOT APPLIED'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMigrations();
