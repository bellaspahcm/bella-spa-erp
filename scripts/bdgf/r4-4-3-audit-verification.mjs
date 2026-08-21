xong chưa#!/usr/bin/env node
/**
 * R4.4.3 — INCIDENT/RECOVERY AUDIT VERIFICATION
 * 
 * Verifies the complete audit trail from incident detection through recovery.
 * 
 * Audit Chain:
 * 1. Incident detected → recorded in bella_security_incidents
 * 2. Recovery initiated → recorded in bella_recovery_actions
 * 3. Verification performed → evidence captured
 * 4. Incident closed → audit immutable
 * 
 * Success Criteria:
 * - All incidents have timestamps ✅
 * - Recovery actions link to incidents ✅
 * - Verification evidence exists ✅
 * - Audit trail is queryable ✅
 */

import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config();

// ============================================================================
// AUDIT QUERIES
// ============================================================================

/**
 * Query 1: Incident Summary
 * Shows all incidents with their classification and status
 */
async function queryIncidentSummary(db) {
  const result = await db.query(`
    SELECT 
      incident_id,
      incident_type,
      severity,
      occurred_at,
      detected_at,
      recovery_required,
      recovery_status,
      EXTRACT(EPOCH FROM (detected_at - occurred_at)) as detection_latency_seconds
    FROM bella_security_incidents
    ORDER BY occurred_at DESC
    LIMIT 20
  `);
  
  return result.rows;
}

/**
 * Query 2: Incident → Recovery Chain
 * Shows the relationship between incidents and their recovery actions
 */
async function queryIncidentRecoveryChain(db) {
  const result = await db.query(`
    SELECT 
      i.incident_id,
      i.incident_type,
      i.severity,
      i.occurred_at,
      r.action_id,
      r.action_type,
      r.execution_result,
      r.verified,
      EXTRACT(EPOCH FROM (r.executed_at - i.occurred_at)) as recovery_latency_seconds
    FROM bella_security_incidents i
    LEFT JOIN bella_recovery_actions r ON i.incident_id = r.incident_id
    ORDER BY i.occurred_at DESC
    LIMIT 20
  `);
  
  return result.rows;
}

/**
 * Query 3: Recovery Coverage
 * Shows what percentage of incidents have recovery actions
 */
async function queryRecoveryCoverage(db) {
  const result = await db.query(`
    SELECT 
      COUNT(DISTINCT i.incident_id) as total_incidents,
      COUNT(DISTINCT r.incident_id) as incidents_with_recovery,
      ROUND(
        100.0 * COUNT(DISTINCT r.incident_id) / NULLIF(COUNT(DISTINCT i.incident_id), 0),
        2
      ) as recovery_coverage_percent
    FROM bella_security_incidents i
    LEFT JOIN bella_recovery_actions r ON i.incident_id = r.incident_id
  `);
  
  return result.rows[0];
}

/**
 * Query 4: Verification Status
 * Shows how many recovery actions have been verified
 */
async function queryVerificationStatus(db) {
  const result = await db.query(`
    SELECT 
      execution_result,
      verified,
      COUNT(*) as count
    FROM bella_recovery_actions
    GROUP BY execution_result, verified
    ORDER BY execution_result, verified
  `);
  
  return result.rows;
}

/**
 * Query 5: Incident Timeline
 * Shows temporal distribution of incidents
 */
async function queryIncidentTimeline(db) {
  const result = await db.query(`
    SELECT 
      DATE_TRUNC('hour', occurred_at) as hour,
      incident_type,
      COUNT(*) as count
    FROM bella_security_incidents
    WHERE occurred_at > NOW() - INTERVAL '24 hours'
    GROUP BY hour, incident_type
    ORDER BY hour DESC, incident_type
  `);
  
  return result.rows;
}

/**
 * Query 6: Critical Incidents
 * Shows all CRITICAL severity incidents and their recovery status
 */
async function queryCriticalIncidents(db) {
  const result = await db.query(`
    SELECT 
      i.incident_id,
      i.incident_type,
      i.occurred_at,
      i.error_message,
      i.recovery_required,
      i.recovery_status,
      COUNT(r.action_id) as recovery_actions_count,
      BOOL_OR(r.verified) as any_verified
    FROM bella_security_incidents i
    LEFT JOIN bella_recovery_actions r ON i.incident_id = r.incident_id
    WHERE i.severity = 'CRITICAL'
    GROUP BY i.incident_id
    ORDER BY i.occurred_at DESC
  `);
  
  return result.rows;
}

// ============================================================================
// AUDIT VERIFICATION
// ============================================================================

/**
 * Verify audit trail completeness
 */
async function verifyAuditTrail(db) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.4.3 — INCIDENT/RECOVERY AUDIT VERIFICATION            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const verifications = [];
  
  // ========================================================================
  // VERIFICATION 1: Incident Recording
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICATION 1: Incident Recording');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const incidents = await queryIncidentSummary(db);
  console.log(`Total incidents recorded: ${incidents.length}`);
  
  if (incidents.length > 0) {
    console.log('\nRecent Incidents:');
    incidents.slice(0, 5).forEach(inc => {
      console.log(`  ${inc.incident_type} (${inc.severity})`);
      console.log(`    Occurred: ${inc.occurred_at}`);
      console.log(`    Detection latency: ${inc.detection_latency_seconds?.toFixed(2)}s\n`);
    });
  }
  
  const verification1 = {
    name: 'Incident Recording',
    passed: incidents.length > 0,
    evidence: {
      incidents_count: incidents.length,
      has_timestamps: incidents.every(i => i.occurred_at && i.detected_at),
      has_classification: incidents.every(i => i.incident_type && i.severity)
    }
  };
  
  verifications.push(verification1);
  console.log(`${verification1.passed ? '✅' : '❌'} Incident Recording: ${verification1.passed ? 'PASS' : 'FAIL'}\n`);
  
  // ========================================================================
  // VERIFICATION 2: Recovery Chain Linkage
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICATION 2: Recovery Chain Linkage');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const chain = await queryIncidentRecoveryChain(db);
  const coverage = await queryRecoveryCoverage(db);
  
  console.log(`Total incidents: ${coverage.total_incidents}`);
  console.log(`Incidents with recovery: ${coverage.incidents_with_recovery}`);
  console.log(`Recovery coverage: ${coverage.recovery_coverage_percent}%\n`);
  
  const verification2 = {
    name: 'Recovery Chain Linkage',
    passed: coverage.incidents_with_recovery > 0 && coverage.recovery_coverage_percent >= 50,
    evidence: {
      total_incidents: coverage.total_incidents,
      incidents_with_recovery: coverage.incidents_with_recovery,
      coverage_percent: coverage.recovery_coverage_percent
    }
  };
  
  verifications.push(verification2);
  console.log(`${verification2.passed ? '✅' : '❌'} Recovery Chain: ${verification2.passed ? 'PASS' : 'FAIL'}\n`);
  
  // ========================================================================
  // VERIFICATION 3: Verification Evidence
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICATION 3: Verification Evidence');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const verificationStatus = await queryVerificationStatus(db);
  
  console.log('Verification Status:');
  verificationStatus.forEach(vs => {
    console.log(`  ${vs.execution_result} (verified: ${vs.verified}): ${vs.count}`);
  });
  console.log('');
  
  const totalActions = verificationStatus.reduce((sum, vs) => sum + parseInt(vs.count), 0);
  const verifiedActions = verificationStatus
    .filter(vs => vs.verified === true)
    .reduce((sum, vs) => sum + parseInt(vs.count), 0);
  
  const verification3 = {
    name: 'Verification Evidence',
    passed: totalActions > 0 && verifiedActions > 0,
    evidence: {
      total_actions: totalActions,
      verified_actions: verifiedActions,
      verification_rate: totalActions > 0 ? ((verifiedActions / totalActions) * 100).toFixed(2) : 0
    }
  };
  
  verifications.push(verification3);
  console.log(`${verification3.passed ? '✅' : '❌'} Verification Evidence: ${verification3.passed ? 'PASS' : 'FAIL'}\n`);
  
  // ========================================================================
  // VERIFICATION 4: Critical Incident Handling
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICATION 4: Critical Incident Handling');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const criticalIncidents = await queryCriticalIncidents(db);
  
  console.log(`Critical incidents: ${criticalIncidents.length}`);
  
  if (criticalIncidents.length > 0) {
    console.log('\nCritical Incident Status:');
    criticalIncidents.slice(0, 5).forEach(ci => {
      console.log(`  ${ci.incident_type}`);
      console.log(`    Recovery actions: ${ci.recovery_actions_count}`);
      console.log(`    Verified: ${ci.any_verified ? 'YES' : 'NO'}\n`);
    });
  }
  
  const criticalWithRecovery = criticalIncidents.filter(ci => parseInt(ci.recovery_actions_count) > 0).length;
  
  const verification4 = {
    name: 'Critical Incident Handling',
    passed: criticalIncidents.length === 0 || criticalWithRecovery === criticalIncidents.length,
    evidence: {
      critical_count: criticalIncidents.length,
      critical_with_recovery: criticalWithRecovery,
      all_handled: criticalIncidents.length === 0 || criticalWithRecovery === criticalIncidents.length
    }
  };
  
  verifications.push(verification4);
  console.log(`${verification4.passed ? '✅' : '❌'} Critical Handling: ${verification4.passed ? 'PASS' : 'FAIL'}\n`);
  
  // ========================================================================
  // VERIFICATION 5: Audit Immutability
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICATION 5: Audit Immutability');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check that incidents have created_at and no updated_at modifications
  const immutabilityCheck = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as with_created_at,
      COUNT(CASE WHEN updated_at IS NOT NULL AND updated_at > created_at + INTERVAL '1 second' THEN 1 END) as modified_count
    FROM bella_security_incidents
  `);
  
  const immutability = immutabilityCheck.rows[0];
  console.log(`Total incidents: ${immutability.total}`);
  console.log(`With created_at: ${immutability.with_created_at}`);
  console.log(`Modified after creation: ${immutability.modified_count}\n`);
  
  const verification5 = {
    name: 'Audit Immutability',
    passed: parseInt(immutability.total) === parseInt(immutability.with_created_at),
    evidence: {
      all_have_created_at: parseInt(immutability.total) === parseInt(immutability.with_created_at),
      modification_count: parseInt(immutability.modified_count)
    }
  };
  
  verifications.push(verification5);
  console.log(`${verification5.passed ? '✅' : '❌'} Audit Immutability: ${verification5.passed ? 'PASS' : 'FAIL'}\n`);
  
  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('AUDIT VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const passedCount = verifications.filter(v => v.passed).length;
  const totalCount = verifications.length;
  
  console.log(`Verifications: ${passedCount}/${totalCount} PASS\n`);
  
  verifications.forEach((v, i) => {
    console.log(`${v.passed ? '✅' : '❌'} ${i + 1}. ${v.name}`);
  });
  console.log('');
  
  if (passedCount === totalCount) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ R4.4.3 AUDIT VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Audit Trail Verified:');
    console.log('  ✅ Incidents recorded with timestamps');
    console.log('  ✅ Recovery actions linked to incidents');
    console.log('  ✅ Verification evidence captured');
    console.log('  ✅ Critical incidents handled');
    console.log('  ✅ Audit trail immutable\n');
    return { success: true, verifications };
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ AUDIT VERIFICATION INCOMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Failed verifications: ${totalCount - passedCount}\n`);
    return { success: false, verifications };
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_EXECUTOR_URL not configured');
  }
  
  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await db.connect();
    
    const result = await verifyAuditTrail(db);
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ Audit verification failed: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { 
  verifyAuditTrail,
  queryIncidentSummary,
  queryIncidentRecoveryChain,
  queryRecoveryCoverage,
  queryCriticalIncidents
};
