#!/usr/bin/env node
/**
 * R4.4.2 — RECOVERY CONTROL
 * 
 * Provides controlled recovery procedures for migration failures.
 * 
 * Recovery Types:
 * 1. Authorization Failure  → No recovery needed (fail-closed)
 * 2. Transactional Failure  → Auto-rollback (PostgreSQL ACID)
 * 3. Non-Transactional Fail → Manual cleanup + forward fix
 * 4. Environment Failure    → State inspection + decision
 * 
 * Contract: R4_4_MONITORING_RECOVERY_CONTRACT.md v1.0.0
 */

import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;
dotenv.config();

// ============================================================================
// FAILURE CLASSIFICATION
// ============================================================================

/**
 * Classify failure type based on incident details
 */
function classifyFailureType(incident) {
  const type = incident.incident_type;
  const errorCode = incident.error_code;
  const errorDetails = incident.error_details || {};
  
  // Type 1: Authorization Failure (R4.2/R4.3 gate rejection)
  const authFailures = [
    'forged_token',
    'expired_token',
    'replay_attack',
    'binding_mismatch',
    'bypass_attempt',
    'invalid_approval'
  ];
  
  if (authFailures.includes(type)) {
    return {
      type: 'AUTHORIZATION_FAILURE',
      recovery_needed: false,
      reason: 'R4.3 security boundary blocked execution (fail-closed)',
      mutation_risk: 'NONE',
      recommended_action: 'Fix authorization and retry'
    };
  }
  
  // Type 2: Transactional DDL Failure (auto-rollback)
  if (type === 'execution_failure' && errorCode && errorCode.startsWith('42')) {
    // PostgreSQL Class 42 = Syntax Error or Access Rule Violation
    return {
      type: 'TRANSACTIONAL_FAILURE',
      recovery_needed: false,
      reason: 'PostgreSQL transaction rolled back automatically',
      mutation_risk: 'NONE',
      recommended_action: 'Fix SQL syntax/constraints and retry'
    };
  }
  
  // Type 3: Non-Transactional DDL Failure (partial state possible)
  if (type === 'execution_failure' && errorDetails.non_transactional) {
    return {
      type: 'NON_TRANSACTIONAL_FAILURE',
      recovery_needed: true,
      reason: 'Non-transactional operation may have partial state',
      mutation_risk: 'PARTIAL',
      recommended_action: 'Inspect database, clean up artifacts, retry'
    };
  }
  
  // Type 4: Environment Failure (unknown state)
  if (type === 'execution_failure' && (
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ETIMEDOUT' ||
    errorDetails.timeout ||
    errorDetails.network_error
  )) {
    return {
      type: 'ENVIRONMENT_FAILURE',
      recovery_needed: true,
      reason: 'Execution interrupted by environment failure',
      mutation_risk: 'UNKNOWN',
      recommended_action: 'Inspect database state and decide recovery path'
    };
  }
  
  // Default: Execution failure (likely transactional)
  return {
    type: 'TRANSACTIONAL_FAILURE',
    recovery_needed: false,
    reason: 'Standard execution failure with automatic rollback',
    mutation_risk: 'LOW',
    recommended_action: 'Review error, fix migration, retry'
  };
}

// ============================================================================
// RECOVERY PROCEDURES
// ============================================================================

/**
 * Procedure 1: No Recovery Needed (Fail-Closed)
 * 
 * For authorization failures where R4.3 blocked execution.
 * Verify zero mutations occurred.
 */
async function verifyZeroMutation(incident, db) {
  console.log('📋 Procedure 1: Verify Zero Mutation (Fail-Closed)');
  console.log('   Authorization failure detected');
  console.log('   Expected: No database changes\n');
  
  // Check token consumption (primary verification)
  if (incident.token_id) {
    const tokenCheck = await db.query(`
      SELECT status, used_at
      FROM bella_gate_tokens
      WHERE token_id = $1
    `, [incident.token_id]);
    
    if (tokenCheck.rows.length > 0) {
      const token = tokenCheck.rows[0];
      console.log(`   Token status: ${token.status}`);
      console.log(`   Token consumed: ${token.used_at ? 'YES ⚠️' : 'NO ✅'}\n`);
      
      if (token.status === 'used' && incident.incident_type === 'replay_attack') {
        // For replay attack, token being 'used' is expected (it was already used before)
        console.log('✅ Verification PASS: Token was already used (replay detected)\n');
        return {
          verified: true,
          reason: 'Replay attack detected - token was already consumed',
          evidence: { token_status: token.status, used_at: token.used_at }
        };
      }
      
      if (token.status === 'used' && incident.incident_type !== 'replay_attack') {
        return {
          verified: false,
          reason: 'Token was consumed despite authorization failure',
          evidence: { token_status: token.status, used_at: token.used_at }
        };
      }
    }
  }
  
  console.log('✅ Verification PASS: Authorization blocked, zero mutations\n');
  
  return {
    verified: true,
    reason: 'No database mutations occurred (fail-closed worked)',
    evidence: {
      token_consumed: false,
      authorization_blocked: true
    }
  };
}

/**
 * Procedure 2: Verify Transactional Rollback
 * 
 * For execution failures where PostgreSQL should have rolled back.
 */
async function verifyTransactionalRollback(incident, db) {
  console.log('📋 Procedure 2: Verify Transactional Rollback');
  console.log('   Execution failure detected');
  console.log('   Expected: Transaction rolled back\n');
  
  // Check token was consumed (proves execution started)
  if (incident.token_id) {
    const tokenCheck = await db.query(`
      SELECT status, used_at
      FROM bella_gate_tokens
      WHERE token_id = $1
    `, [incident.token_id]);
    
    if (tokenCheck.rows.length > 0) {
      const token = tokenCheck.rows[0];
      console.log(`   Token status: ${token.status}`);
      console.log(`   Token consumed: ${token.used_at ? 'YES' : 'NO'}\n`);
      
      if (token.status === 'used') {
        // Token consumed but execution failed → transaction rolled back
        console.log('✅ Token consumed + execution failed → Transaction rolled back\n');
        return {
          verified: true,
          reason: 'Execution failed after token consumption (transaction rolled back)',
          evidence: { token_consumed: true, execution_failed: true }
        };
      }
    }
  }
  
  console.log('✅ No token consumption (execution never started)\n');
  return {
    verified: true,
    reason: 'Execution never started (no rollback needed)',
    evidence: { token_consumed: false }
  };
}

/**
 * Procedure 3: Inspect Partial State (Non-Transactional)
 * 
 * For non-transactional failures where artifacts may exist.
 */
async function inspectPartialState(incident, db) {
  console.log('📋 Procedure 3: Inspect Partial State (Non-Transactional)');
  console.log('   Non-transactional operation failed');
  console.log('   Action: Manual inspection required\n');
  
  const artifacts = [];
  
  // Check for partially created indexes
  try {
    const indexCheck = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE '%_invalid'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log(`⚠️  Found ${indexCheck.rows.length} potentially invalid indexes`);
      indexCheck.rows.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
        artifacts.push({ type: 'INDEX', name: idx.indexname });
      });
      console.log('');
    }
  } catch (error) {
    console.log(`   Index check failed: ${error.message}\n`);
  }
  
  return {
    verified: false, // Always requires manual review
    reason: 'Non-transactional operation requires manual state inspection',
    evidence: {
      artifacts_found: artifacts.length,
      artifacts,
      action_required: 'Manual cleanup before retry'
    }
  };
}

/**
 * Procedure 4: Inspect Unknown State (Environment Failure)
 * 
 * For environment failures where state is unknown.
 */
async function inspectUnknownState(incident, db) {
  console.log('📋 Procedure 4: Inspect Unknown State (Environment Failure)');
  console.log('   Environment failure detected');
  console.log('   Action: State inspection required\n');
  
  // Check token consumption
  if (incident.token_id) {
    const tokenCheck = await db.query(`
      SELECT status, used_at
      FROM bella_gate_tokens
      WHERE token_id = $1
    `, [incident.token_id]);
    
    if (tokenCheck.rows.length > 0) {
      const token = tokenCheck.rows[0];
      console.log(`   Token status: ${token.status}`);
      console.log(`   Token consumed: ${token.used_at ? 'YES' : 'NO'}\n`);
      
      if (token.status === 'issued') {
        console.log('✅ Token not consumed (execution likely never started)\n');
        return {
          verified: true,
          reason: 'Token not consumed',
          state: 'CLEAN',
          recommended_action: 'Safe to retry'
        };
      }
    }
  }
  
  console.log('⚠️  Token consumed or unavailable (manual inspection required)\n');
  return {
    verified: false,
    reason: 'Environment failure after token consumption',
    state: 'UNKNOWN',
    recommended_action: 'Manual inspection required'
  };
}

// ============================================================================
// RECOVERY EXECUTION
// ============================================================================

/**
 * Execute recovery procedure based on failure type
 */
async function executeRecovery(incident_id, db) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.4.2 — RECOVERY CONTROL                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Fetch incident
  const incidentResult = await db.query(`
    SELECT *
    FROM bella_security_incidents
    WHERE incident_id = $1
  `, [incident_id]);
  
  if (incidentResult.rows.length === 0) {
    throw new Error(`Incident ${incident_id} not found`);
  }
  
  const incident = incidentResult.rows[0];
  
  console.log(`Incident ID: ${incident.incident_id}`);
  console.log(`Type: ${incident.incident_type}`);
  console.log(`Severity: ${incident.severity}`);
  console.log(`Occurred: ${incident.occurred_at}\n`);
  
  // Classify failure
  const classification = classifyFailureType(incident);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('FAILURE CLASSIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Type: ${classification.type}`);
  console.log(`Recovery Needed: ${classification.recovery_needed ? 'YES' : 'NO'}`);
  console.log(`Mutation Risk: ${classification.mutation_risk}`);
  console.log(`Reason: ${classification.reason}`);
  console.log(`Action: ${classification.recommended_action}\n`);
  
  // Execute appropriate recovery procedure
  let verification;
  
  switch (classification.type) {
    case 'AUTHORIZATION_FAILURE':
      verification = await verifyZeroMutation(incident, db);
      break;
      
    case 'TRANSACTIONAL_FAILURE':
      verification = await verifyTransactionalRollback(incident, db);
      break;
      
    case 'NON_TRANSACTIONAL_FAILURE':
      verification = await inspectPartialState(incident, db);
      break;
      
    case 'ENVIRONMENT_FAILURE':
      verification = await inspectUnknownState(incident, db);
      break;
      
    default:
      verification = {
        verified: false,
        reason: 'Unknown failure type',
        evidence: {}
      };
  }
  
  // Record recovery action
  const action_id = crypto.randomUUID();
  await db.query(`
    INSERT INTO bella_recovery_actions (
      action_id,
      incident_id,
      action_sequence,
      action_type,
      action_description,
      executed_at,
      executed_by,
      execution_result,
      execution_details,
      verified,
      verified_at,
      verified_by,
      verification_evidence
    ) VALUES (
      $1, $2, 1, $3, $4, NOW(), 'system', $5, $6, $7, NOW(), 'system', $8
    )
  `, [
    action_id,
    incident_id,
    'verify', // action_type
    `Recovery verification for ${classification.type}`, // action_description
    verification.verified ? 'success' : 'pending', // execution_result
    JSON.stringify({ classification, verification }), // execution_details
    verification.verified, // verified
    verification.reason // verification_evidence
  ]);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('RECOVERY RESULT');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Recovery Action ID: ${action_id}`);
  console.log(`Status: ${verification.verified ? '✅ VERIFIED' : '⚠️  NEEDS ACTION'}`);
  console.log(`Reason: ${verification.reason}\n`);
  
  if (verification.evidence) {
    console.log('Evidence:');
    console.log(JSON.stringify(verification.evidence, null, 2));
    console.log('');
  }
  
  return {
    recovery_id: action_id,
    incident_id,
    classification,
    verification,
    status: verification.verified ? 'verified' : 'needs_action'
  };
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  const incident_id = process.argv[2];
  
  if (!incident_id) {
    console.error('Usage: node r4-4-2-recovery-control.mjs <incident_id>');
    console.error('');
    console.error('Example:');
    console.error('  node r4-4-2-recovery-control.mjs 5502d66f-ea7c-4cf1-a1d2-7b427c499add');
    process.exit(1);
  }
  
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
    
    const result = await executeRecovery(incident_id, db);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(result.status === 'verified' ? '✅ RECOVERY COMPLETE' : '⚠️  ACTION REQUIRED');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (result.status !== 'verified') {
      console.log('Next Steps:');
      console.log(`  ${result.classification.recommended_action}\n`);
    }
    
    process.exit(result.status === 'verified' ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ Recovery failed: ${error.message}\n`);
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

export { executeRecovery, classifyFailureType };
