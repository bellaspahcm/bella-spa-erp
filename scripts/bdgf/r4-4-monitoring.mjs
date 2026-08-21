#!/usr/bin/env node
/**
 * R4.4.1 — SECURITY MONITORING LAYER
 * 
 * Wraps R4.3 execution boundary with detection, classification, and alerting.
 * 
 * Architecture:
 *   R4.3 executeMigration() 
 *       ↓
 *   R4.4 executeWithMonitoring()
 *       ↓
 *   Detect → Classify → Record → Alert
 * 
 * Does NOT replace R4.3 security boundary.
 * Only observes and records incidents.
 */

import { executeMigration } from './migration-executor.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;
dotenv.config();

// ============================================================================
// INCIDENT CLASSIFICATION
// ============================================================================

/**
 * Classify error into incident type and severity
 */
function classifyIncident(error) {
  const code = error.code || '';
  const message = error.message || '';
  
  // Forged/invalid token
  if (code === 'INVALID_TOKEN_STRUCTURE' || message.includes('missing required fields')) {
    return { type: 'forged_token', severity: 'CRITICAL' };
  }
  
  if (code === 'INVALID_SIGNATURE' || message.includes('INVALID_SIGNATURE') || message.includes('signature')) {
    return { type: 'forged_token', severity: 'CRITICAL' };
  }
  
  // Invalid token (general validation failure - could be forged or structural issue)
  if (code === 'INVALID_TOKEN' && (message.includes('INVALID_SIGNATURE') || message.includes('VALIDATION_ERROR'))) {
    return { type: 'forged_token', severity: 'CRITICAL' };
  }
  
  // Expired token
  if (code === 'TOKEN_EXPIRED' || message.includes('expired')) {
    return { type: 'expired_token', severity: 'WARNING' };
  }
  
  // Replay attack
  if (code === 'TOKEN_ALREADY_USED' || message.includes('already used') || message.includes('TOKEN_ALREADY_USED')) {
    return { type: 'replay_attack', severity: 'CRITICAL' };
  }
  
  // Binding mismatch
  if (code === 'HASH_MISMATCH' || code === 'MIGRATION_HASH_MISMATCH' || message.includes('mismatch') || message.includes('MIGRATION_HASH_MISMATCH')) {
    return { type: 'binding_mismatch', severity: 'CRITICAL' };
  }
  
  // Bypass attempt (no token)
  if (code === 'NO_TOKEN' || message.includes('requires valid gate token')) {
    return { type: 'bypass_attempt', severity: 'CRITICAL' };
  }
  
  // Invalid approval
  if (code === 'INVALID_APPROVAL' || message.includes('approval')) {
    return { type: 'invalid_approval', severity: 'WARNING' };
  }
  
  // Concurrent execution
  if (code === 'CONCURRENT_EXECUTION' || message.includes('concurrent')) {
    return { type: 'concurrent_execution', severity: 'WARNING' };
  }
  
  // Execution failure (default)
  return { type: 'execution_failure', severity: 'ERROR' };
}

/**
 * Extract details from error for audit
 */
function extractIncidentDetails(error, params) {
  return {
    error_code: error.code || 'UNKNOWN',
    error_message: error.message,
    error_stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Truncate stack
    blocked: error.blocked || false,
    failed: error.failed || false,
    params: {
      migration_id: params.token?.migration_id,
      approval_id: params.token?.approval_id,
      migration_hash: params.token?.migration_hash,
      executor_identity: params.executor_identity
    }
  };
}

// ============================================================================
// INCIDENT RECORDING
// ============================================================================

/**
 * Record incident to bella_security_incidents table
 */
async function recordIncident(incident, db) {
  try {
    const result = await db.query(`
      INSERT INTO bella_security_incidents (
        incident_id,
        incident_type,
        severity,
        migration_id,
        approval_id,
        token_id,
        executor_identity,
        occurred_at,
        detected_at,
        detection_method,
        error_code,
        error_message,
        error_details,
        recovery_required,
        recovery_status,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING incident_id
    `, [
      incident.incident_id,
      incident.type,
      incident.severity,
      incident.migration_id,
      incident.approval_id,
      incident.token_id,
      incident.executor_identity,
      incident.occurred_at,
      incident.detected_at,
      incident.detection_method,
      incident.error_code,
      incident.error_message,
      JSON.stringify(incident.error_details),
      incident.recovery_required,
      incident.recovery_status,
      'system'
    ]);
    
    return result.rows[0].incident_id;
  } catch (error) {
    console.error(`⚠️  Failed to record incident: ${error.message}`);
    // Don't fail execution if audit fails
    return null;
  }
}

// ============================================================================
// ALERTING
// ============================================================================

/**
 * Send alert for incident
 * MVP: Console + DB only
 * Production: Add webhook/email/Slack
 */
function sendAlert(incident) {
  const icon = incident.severity === 'CRITICAL' ? '🚨' :
               incident.severity === 'ERROR' ? '❌' : '⚠️';
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${icon} SECURITY INCIDENT DETECTED`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Incident ID: ${incident.incident_id}`);
  console.log(`Type: ${incident.type}`);
  console.log(`Severity: ${incident.severity}`);
  console.log(`Time: ${incident.occurred_at.toISOString()}`);
  console.log(`Detection: ${incident.detection_method}`);
  console.log(`Error: ${incident.error_message}`);
  
  if (incident.token_id) {
    console.log(`Token ID: ${incident.token_id}`);
  }
  if (incident.approval_id) {
    console.log(`Approval ID: ${incident.approval_id}`);
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // TODO: Production alerting (webhook, email, Slack)
  // if (process.env.ALERT_WEBHOOK_URL) {
  //   await fetch(process.env.ALERT_WEBHOOK_URL, {
  //     method: 'POST',
  //     body: JSON.stringify(incident)
  //   });
  // }
}

// ============================================================================
// MONITORING WRAPPER
// ============================================================================

/**
 * Execute migration with monitoring, detection, and alerting
 * 
 * @param {Object} params - Migration execution parameters
 * @returns {Promise<Object>} Execution result
 * @throws {Error} Re-throws original error after recording incident
 */
export async function executeWithMonitoring(params) {
  const startTime = Date.now();
  const occurred_at = new Date();
  
  // Connect to DB for audit
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
    
    // Execute through R4.3 boundary
    const result = await executeMigration(params);
    
    // Success - no incident
    console.log('✅ Execution successful - no incident detected\n');
    
    return result;
    
  } catch (error) {
    // ========================================================================
    // INCIDENT DETECTED
    // ========================================================================
    
    const detected_at = new Date();
    
    // Classify incident
    const { type, severity } = classifyIncident(error);
    
    // Extract details
    const error_details = extractIncidentDetails(error, params);
    
    // Build incident record
    const incident = {
      incident_id: crypto.randomUUID(),
      type,
      severity,
      migration_id: params.token?.migration_id || null,
      approval_id: params.token?.approval_id || null,
      token_id: params.token?.token_id || null,
      executor_identity: params.executor_identity || 'unknown',
      occurred_at,
      detected_at,
      detection_method: error.code || 'executeMigration',
      error_code: error.code || 'UNKNOWN',
      error_message: error.message,
      error_details,
      recovery_required: type === 'execution_failure', // Only execution failures need recovery
      recovery_status: type === 'execution_failure' ? 'pending' : 'none'
    };
    
    // Record incident
    const incident_id = await recordIncident(incident, db);
    
    if (incident_id) {
      console.log(`📋 Incident recorded: ${incident_id}\n`);
    }
    
    // Send alert
    sendAlert(incident);
    
    // Re-throw original error (don't break R4.3 behavior)
    throw error;
    
  } finally {
    await db.end();
  }
}

// ============================================================================
// INCIDENT QUERIES (Utility)
// ============================================================================

/**
 * Query recent incidents
 */
export async function queryRecentIncidents(limit = 10) {
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await db.connect();
    
    const result = await db.query(`
      SELECT 
        incident_id,
        incident_type,
        severity,
        occurred_at,
        error_message,
        token_id,
        approval_id
      FROM bella_security_incidents
      ORDER BY occurred_at DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
    
  } finally {
    await db.end();
  }
}

/**
 * Query incidents by type
 */
export async function queryIncidentsByType(type, limit = 10) {
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await db.connect();
    
    const result = await db.query(`
      SELECT 
        incident_id,
        severity,
        occurred_at,
        error_message,
        error_details
      FROM bella_security_incidents
      WHERE incident_type = $1
      ORDER BY occurred_at DESC
      LIMIT $2
    `, [type, limit]);
    
    return result.rows;
    
  } finally {
    await db.end();
  }
}

/**
 * Query incidents by severity
 */
export async function queryCriticalIncidents(limit = 10) {
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  try {
    await db.connect();
    
    const result = await db.query(`
      SELECT 
        incident_id,
        incident_type,
        occurred_at,
        error_message,
        token_id
      FROM bella_security_incidents
      WHERE severity = 'CRITICAL'
      ORDER BY occurred_at DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
    
  } finally {
    await db.end();
  }
}
