#!/usr/bin/env node
/**
 * Deploy R4.4 Monitoring & Audit Schema
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployMigration() {
  console.log('🚀 Deploying R4.4 Monitoring & Audit Schema...\n');
  
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_EXECUTOR_URL not found in .env');
    process.exit(1);
  }
  
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260820152000_r4_4_monitoring_audit.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration...\n');
    await client.query(migrationSQL);
    
    console.log('✅ Migration executed successfully\n');
    
    // Verify tables created
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('bella_security_incidents', 'bella_recovery_actions')
      ORDER BY table_name
    `);
    
    console.log('📊 Verification:');
    checkTables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    if (checkTables.rows.length === 2) {
      console.log('\n🎉 R4.4 schema deployment COMPLETE\n');
      process.exit(0);
    } else {
      console.log('\n❌ Schema verification failed\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

deployMigration();
