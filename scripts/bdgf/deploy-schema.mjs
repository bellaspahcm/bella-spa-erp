#!/usr/bin/env node
/**
 * BDGF SCHEMA DEPLOYMENT
 * Deploys all BDGF tables to production database
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
const { Client } = pg;

dotenv.config();

async function deploySchema() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ BDGF SCHEMA DEPLOYMENT                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const db = new Client({
    connectionString: process.env.DATABASE_EXECUTOR_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await db.connect();
  console.log('✅ Connected to database\n');
  
  // Read SQL file
  const sql = fs.readFileSync('scripts/bdgf/deploy-schema.sql', 'utf8');
  
  console.log('📄 Executing deployment SQL...\n');
  
  try {
    // Execute the SQL
    await db.query(sql);
    
    console.log('\n✅ BDGF SCHEMA DEPLOYMENT COMPLETE\n');
    
    // Verify tables
    const tables = [
      'bella_gate_approvals',
      'bella_gate_tokens',
      'bella_security_incidents',
      'bella_recovery_actions'
    ];
    
    console.log('Verifying tables:\n');
    for (const table of tables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} ${table}`);
    }
    
    console.log('\n🎉 Deployment successful!\n');
    
  } catch (error) {
    console.error(`\n❌ Deployment failed: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

deploySchema();
