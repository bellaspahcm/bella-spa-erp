#!/usr/bin/env node
/**
 * BDGF DEPLOYMENT VERIFICATION
 * Verifies all required components are deployed and operational
 */

import pg from 'pg';
import dotenv from 'dotenv';
const { Client } = pg;

dotenv.config();

async function verifyDeployment() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ BDGF DEPLOYMENT VERIFICATION                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const db = new Client({
    connectionString: process.env.DATABASE_EXECUTOR_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await db.connect();
  
  let allPass = true;
  
  // ========================================================================
  // 1. Schema Verification
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('1. DATABASE SCHEMA');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const requiredTables = [
    'bella_gate_approvals',
    'bella_gate_tokens',
    'bella_security_incidents',
    'bella_recovery_actions'
  ];
  
  for (const table of requiredTables) {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [table]);
    
    const exists = result.rows[0].exists;
    console.log(`${exists ? '✅' : '❌'} ${table}`);
    if (!exists) allPass = false;
  }
  
  // ========================================================================
  // 2. Environment Configuration
  // ========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('2. ENVIRONMENT CONFIGURATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const requiredEnvVars = [
    'DATABASE_EXECUTOR_URL',
    'GATE_SIGNING_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  for (const envVar of requiredEnvVars) {
    const exists = !!process.env[envVar];
    console.log(`${exists ? '✅' : '❌'} ${envVar}`);
    if (!exists) allPass = false;
  }
  
  // ========================================================================
  // 3. Database Connectivity
  // ========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('3. DATABASE CONNECTIVITY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const result = await db.query('SELECT NOW() as timestamp');
    console.log(`✅ Database connection: OK`);
    console.log(`   Timestamp: ${result.rows[0].timestamp}`);
  } catch (error) {
    console.log(`❌ Database connection: FAILED`);
    console.log(`   Error: ${error.message}`);
    allPass = false;
  }
  
  // ========================================================================
  // 4. Table Row Counts
  // ========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('4. TABLE DATA STATUS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  for (const table of requiredTables) {
    try {
      const result = await db.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`✅ ${table}: ${result.rows[0].count} records`);
    } catch (error) {
      console.log(`❌ ${table}: ERROR (${error.message})`);
      allPass = false;
    }
  }
  
  // ========================================================================
  // 5. Foreign Key Constraints
  // ========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('5. FOREIGN KEY CONSTRAINTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const fkChecks = [
    {
      table: 'bella_gate_tokens',
      fk: 'approval_id → bella_gate_approvals',
      query: `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'bella_gate_tokens' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%approval%'
        )
      `
    },
    {
      table: 'bella_recovery_actions',
      fk: 'incident_id → bella_security_incidents',
      query: `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'bella_recovery_actions' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%incident%'
        )
      `
    }
  ];
  
  for (const check of fkChecks) {
    try {
      const result = await db.query(check.query);
      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '⚠️'} ${check.fk}`);
    } catch (error) {
      console.log(`❌ ${check.fk}: ERROR`);
      allPass = false;
    }
  }
  
  // ========================================================================
  // 6. Core Functions Test
  // ========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('6. CORE FUNCTIONS TEST');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Test approval creation
  try {
    const testApproval = await db.query(`
      INSERT INTO bella_gate_approvals (
        approval_id, migration_hash, target_environment, 
        target_schema, approved_by, approval_type
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING approval_id
    `, [
      'test-deployment-verification',
      'a'.repeat(64),
      'test',
      'public',
      'deployment-verify',
      'automated'
    ]);
    console.log(`✅ Approval creation: OK`);
    
    // Cleanup
    await db.query('DELETE FROM bella_gate_approvals WHERE approval_id = $1', 
      ['test-deployment-verification']);
  } catch (error) {
    console.log(`❌ Approval creation: FAILED`);
    console.log(`   Error: ${error.message}`);
    allPass = false;
  }
  
  // Test incident recording
  try {
    const testIncident = await db.query(`
      INSERT INTO bella_security_incidents (
        incident_id, incident_type, severity, 
        occurred_at, detected_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING incident_id
    `, [
      'test-deployment-verification',
      'deployment_test',
      'INFO'
    ]);
    console.log(`✅ Incident recording: OK`);
    
    // Cleanup
    await db.query('DELETE FROM bella_security_incidents WHERE incident_id = $1', 
      ['test-deployment-verification']);
  } catch (error) {
    console.log(`❌ Incident recording: FAILED`);
    console.log(`   Error: ${error.message}`);
    allPass = false;
  }
  
  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('DEPLOYMENT VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (allPass) {
    console.log('✅ ALL CHECKS PASSED\n');
    console.log('🎉 BDGF is ready for production use.\n');
    console.log('Next steps:');
    console.log('  1. Review production checklist');
    console.log('  2. Configure monitoring/alerting');
    console.log('  3. Set up secrets manager (Q3 2024)');
    console.log('  4. Document incident response procedures\n');
  } else {
    console.log('❌ SOME CHECKS FAILED\n');
    console.log('Please fix the issues above before deploying to production.\n');
  }
  
  await db.end();
  process.exit(allPass ? 0 : 1);
}

verifyDeployment().catch(error => {
  console.error(`\n❌ Verification error: ${error.message}\n`);
  process.exit(1);
});
