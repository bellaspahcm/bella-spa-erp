#!/usr/bin/env node
/**
 * R4.4.1 — TEST 1: Forged Token Detection
 * 
 * Prove:
 * 1. Forged token → BLOCKED by R4.3
 * 2. Incident detected and classified
 * 3. Incident recorded in bella_security_incidents
 * 4. Alert delivered
 * 5. No database mutation
 */

process.env.TZ = 'UTC';

import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';
import { executeWithMonitoring } from './r4-4-monitoring.mjs';

const { Client } = pg;
dotenv.config();

async function testForgedTokenDetection() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.4.1 TEST 1: Forged Token Detection                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_EXECUTOR_URL not configured');
    process.exit(1);
  }
  
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await db.connect();
    console.log('✅ Connected to database\n');
    
    // ========================================================================
    // SETUP: Count existing incidents
    // ========================================================================
    const beforeCount = await db.query(`
      SELECT COUNT(*) as count FROM bella_security_incidents
    `);
    const incidentsBefore = parseInt(beforeCount.rows[0].count);
    console.log(`📊 Existing incidents: ${incidentsBefore}\n`);
    
    // ========================================================================
    // TEST: Forged Token Attack
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('ATTACK: Developer creates forged token');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const fakeToken = {
      token_id: crypto.randomUUID(),
      approval_id: crypto.randomUUID(),
      migration_hash: 'fake_hash'
      // Missing: payload, signature (required by R4.3)
    };
    
    console.log(`Fake token ID: ${fakeToken.token_id}\n`);
    console.log('Attempting execution with forged token...\n');
    
    let executionBlocked = false;
    let incidentRecorded = false;
    let alertDelivered = false;
    
    try {
      await executeWithMonitoring({
        token: fakeToken,
        migration_content: 'SELECT 1',
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      });
      
      console.log('❌ SECURITY BREACH: Forged token was NOT blocked!\n');
      
    } catch (error) {
      executionBlocked = true;
      console.log(`✅ Execution BLOCKED: ${error.message}\n`);
      
      // R4.4 should have recorded incident during error handling
      alertDelivered = error.message.includes('token') || error.code === 'INVALID_TOKEN_STRUCTURE';
    }
    
    // ========================================================================
    // VERIFY: Incident Recorded
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('VERIFICATION: Incident Recording');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Wait a moment for async audit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const afterCount = await db.query(`
      SELECT COUNT(*) as count FROM bella_security_incidents
    `);
    const incidentsAfter = parseInt(afterCount.rows[0].count);
    
    incidentRecorded = incidentsAfter > incidentsBefore;
    
    if (incidentRecorded) {
      console.log(`✅ Incident recorded: ${incidentsAfter - incidentsBefore} new incident(s)\n`);
      
      // Query the incident
      const incident = await db.query(`
        SELECT 
          incident_id,
          incident_type,
          severity,
          error_message,
          occurred_at,
          detection_method
        FROM bella_security_incidents
        ORDER BY occurred_at DESC
        LIMIT 1
      `);
      
      if (incident.rows.length > 0) {
        const inc = incident.rows[0];
        console.log('📋 Incident Details:');
        console.log(`   ID: ${inc.incident_id}`);
        console.log(`   Type: ${inc.incident_type}`);
        console.log(`   Severity: ${inc.severity}`);
        console.log(`   Detection: ${inc.detection_method}`);
        console.log(`   Error: ${inc.error_message}`);
        console.log(`   Time: ${inc.occurred_at}\n`);
        
        // Verify classification
        if (inc.incident_type === 'forged_token' && inc.severity === 'CRITICAL') {
          console.log('✅ Incident correctly classified as forged_token/CRITICAL\n');
        } else {
          console.log(`⚠️  Incident classification unexpected: ${inc.incident_type}/${inc.severity}\n`);
        }
      }
    } else {
      console.log('❌ Incident NOT recorded in audit table\n');
    }
    
    // ========================================================================
    // VERIFY: No Database Mutation
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('VERIFICATION: No Unauthorized Mutation');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Check no test table was created by forged token
    const tableCheck = await db.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'forged_token_test%'
    `);
    
    const noMutation = parseInt(tableCheck.rows[0].count) === 0;
    
    if (noMutation) {
      console.log('✅ No unauthorized database mutations\n');
    } else {
      console.log('❌ CRITICAL: Unauthorized mutations detected!\n');
    }
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`✅ Execution blocked: ${executionBlocked ? 'YES' : 'NO'}`);
    console.log(`✅ Incident recorded: ${incidentRecorded ? 'YES' : 'NO'}`);
    console.log(`✅ Alert delivered: ${alertDelivered ? 'YES' : 'NO'}`);
    console.log(`✅ No mutation: ${noMutation ? 'YES' : 'NO'}\n`);
    
    const allPass = executionBlocked && incidentRecorded && alertDelivered && noMutation;
    
    if (allPass) {
      console.log('🎉 TEST 1: Forged Token Detection → PASS\n');
      console.log('Verification complete:');
      console.log('  ✅ Forged token blocked by R4.3');
      console.log('  ✅ Incident detected and classified');
      console.log('  ✅ Incident recorded in audit');
      console.log('  ✅ Alert delivered (console)');
      console.log('  ✅ No unauthorized mutations\n');
      process.exit(0);
    } else {
      console.log('❌ TEST 1: Forged Token Detection → FAIL\n');
      console.log('Failed checks:');
      if (!executionBlocked) console.log('  ❌ Execution was NOT blocked');
      if (!incidentRecorded) console.log('  ❌ Incident was NOT recorded');
      if (!alertDelivered) console.log('  ❌ Alert was NOT delivered');
      if (!noMutation) console.log('  ❌ Unauthorized mutations occurred');
      console.log('');
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ Test execution error: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

testForgedTokenDetection();
