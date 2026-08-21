#!/usr/bin/env node
/**
 * R4.3.2 — Gate Token Module
 * 
 * Cryptographically signed, single-use authorization tokens for migration execution.
 * 
 * Token is NOT a password executor can create arbitrarily.
 * Token is PROOF issued by Approval Gate after verifyApproval() PASS.
 * 
 * Security Properties:
 * - Signed with secrets manager key (HMAC-SHA256)
 * - Binds approval_id, migration_hash, environment, schema, executor, attempt, nonce
 * - Short-lived (60 seconds max)
 * - Single-use (atomic consume)
 * - Fail-closed (any error → BLOCK)
 * 
 * Contract: docs/architecture/R4_3_EXECUTION_CONTRACT_SPECIFICATION.md v1.0.0
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { getSigningKey } from './get-signing-key.mjs';

dotenv.config();

// Token TTL (max 60 seconds per R4.3 contract)
const TOKEN_TTL_SECONDS = 60;

// ============================================================================
// TOKEN STRUCTURE
// ============================================================================

/**
 * @typedef {Object} GateTokenPayload
 * @property {string} approval_id - Which approval authorized this
 * @property {string} migration_id - Which migration is approved
 * @property {string} migration_hash - Exact content hash (prevents substitution)
 * @property {string} target_environment - Where approved to execute
 * @property {string|null} target_schema - Schema restriction (if any)
 * @property {string} executor_identity - Who can execute
 * @property {string} execution_attempt_id - Unique per attempt
 * @property {string} nonce - Replay prevention
 * @property {number} issued_at - Unix timestamp (seconds)
 * @property {number} expires_at - Unix timestamp (seconds)
 */

/**
 * @typedef {Object} GateToken
 * @property {GateTokenPayload} payload
 * @property {string} signature - HMAC-SHA256 signature
 */

// ============================================================================
// CRYPTOGRAPHY
// ============================================================================

/**
 * Compute HMAC-SHA256 signature of token payload
 * 
 * @param {GateTokenPayload} payload 
 * @param {string} signingKey 
 * @returns {string} Hex signature (64 chars)
 */
function signPayload(payload, signingKey) {
  // Canonical representation: sorted keys
  const canonical = {
    approval_id: payload.approval_id,
    execution_attempt_id: payload.execution_attempt_id,
    executor_identity: payload.executor_identity,
    expires_at: payload.expires_at,
    issued_at: payload.issued_at,
    migration_hash: payload.migration_hash,
    migration_id: payload.migration_id,
    nonce: payload.nonce,
    target_environment: payload.target_environment,
    target_schema: payload.target_schema
  };
  
  const message = JSON.stringify(canonical);
  const hmac = crypto.createHmac('sha256', signingKey);
  hmac.update(message, 'utf8');
  return hmac.digest('hex');
}

/**
 * Verify token signature
 * 
 * @param {GateTokenPayload} payload 
 * @param {string} signature 
 * @param {string} signingKey 
 * @returns {boolean}
 */
function verifySignature(payload, signature, signingKey) {
  const expectedSignature = signPayload(payload, signingKey);
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Async wrapper for signPayload (retrieves signing key)
 * 
 * @param {GateTokenPayload} payload 
 * @returns {Promise<string>} Hex signature
 */
async function signPayloadAsync(payload) {
  const signingKey = await getSigningKey();
  return signPayload(payload, signingKey);
}

/**
 * Async wrapper for verifySignature (retrieves signing key)
 * 
 * @param {GateTokenPayload} payload 
 * @param {string} signature 
 * @returns {Promise<boolean>}
 */
async function verifySignatureAsync(payload, signature) {
  const signingKey = await getSigningKey();
  return verifySignature(payload, signature, signingKey);
}

// ============================================================================
// TOKEN ISSUANCE
// ============================================================================

/**
 * Issue gate token after verifyApproval() PASS
 * 
 * This function MUST only be called by execution gate after approval verification succeeds.
 * Token is PROOF of authorization, not a credential executor can create arbitrarily.
 * 
 * @param {Object} params
 * @param {string} params.approval_id - UUID of approved approval
 * @param {string} params.migration_id - Migration identifier
 * @param {string} params.migration_hash - SHA-256 of migration content
 * @param {string} params.target_environment - production|staging|dev
 * @param {string|null} params.target_schema - Schema restriction
 * @param {string} params.executor_identity - Who will execute (e.g., 'bella_migration_executor')
 * @param {Object} db - PostgreSQL client (bella_migration_executor role)
 * @returns {Promise<GateToken>}
 */
async function issueGateToken(params, db, customTTL = null) {
  const {
    approval_id,
    migration_id,
    migration_hash,
    target_environment,
    target_schema,
    executor_identity
  } = params;
  
  // Validate required fields
  if (!approval_id || !migration_id || !migration_hash || !target_environment || !executor_identity) {
    throw new Error('Missing required token fields');
  }
  
  // Generate unique identifiers
  const execution_attempt_id = crypto.randomUUID();
  const nonce = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  
  // Token temporal (use custom TTL for testing, otherwise default)
  const ttl = customTTL !== null ? customTTL : TOKEN_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000); // Unix timestamp (seconds)
  const issued_at = now;
  const expires_at = now + ttl;
  
  // Build payload
  const payload = {
    approval_id,
    migration_id,
    migration_hash,
    target_environment,
    target_schema: target_schema || null,
    executor_identity,
    execution_attempt_id,
    nonce,
    issued_at,
    expires_at
  };
  
  // Sign payload
  const signature = await signPayloadAsync(payload);
  
  // Store token in database (bella_gate_tokens table)
  try {
    const result = await db.query(`
      INSERT INTO bella_gate_tokens (
        approval_id,
        migration_id,
        migration_hash,
        target_environment,
        target_schema,
        executor_identity,
        execution_attempt_id,
        nonce,
        token_signature,
        issued_at,
        expires_at,
        status,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        NOW(),
        NOW() + INTERVAL '60 seconds',
        'issued',
        $10
      )
      RETURNING token_id, issued_at, expires_at
    `, [
      approval_id,
      migration_id,
      migration_hash,
      target_environment,
      target_schema,
      executor_identity,
      execution_attempt_id,
      nonce,
      signature,
      executor_identity // created_by
    ]);
    
    const tokenRecord = result.rows[0];
    
    return {
      payload,
      signature,
      token_id: tokenRecord.token_id
    };
    
  } catch (error) {
    // Fail closed: any database error blocks token issuance
    throw new Error(`Token issuance failed: ${error.message}`);
  }
}

// ============================================================================
// TOKEN VALIDATION
// ============================================================================

/**
 * Validate gate token before execution
 * 
 * Checks:
 * 1. Token exists in database
 * 2. Signature is valid (not forged/tampered)
 * 3. Token not expired
 * 4. Token not already used
 * 5. All bindings match execution context
 * 
 * Does NOT consume token (use consumeGateToken for that)
 * 
 * @param {GateToken} token 
 * @param {Object} executionContext
 * @param {string} executionContext.migration_hash - Actual migration content hash
 * @param {string} executionContext.target_environment - Where executing
 * @param {string|null} executionContext.target_schema - Schema context
 * @param {string} executionContext.executor_identity - Who is executing
 * @param {Object} db - PostgreSQL client
 * @returns {Promise<{valid: boolean, reason?: string, evidence?: Object}>}
 */
async function validateGateToken(token, executionContext, db) {
  try {
    const { payload, signature } = token;
    
    // 1. Verify signature (prevents forgery/tampering)
    const signatureValid = await verifySignatureAsync(payload, signature);
    
    if (!signatureValid) {
      return {
        valid: false,
        reason: 'INVALID_SIGNATURE',
        evidence: { message: 'Token signature invalid (forged or tampered)' }
      };
    }
    
    // 2. Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.expires_at) {
      return {
        valid: false,
        reason: 'TOKEN_EXPIRED',
        evidence: {
          now,
          expires_at: payload.expires_at,
          elapsed_seconds: now - payload.expires_at
        }
      };
    }
    
    // 3. Check token exists in database and status is 'issued'
    const tokenCheck = await db.query(`
      SELECT token_id, status, used_at, approval_id
      FROM bella_gate_tokens
      WHERE nonce = $1
      LIMIT 1
    `, [payload.nonce]);
    
    if (tokenCheck.rows.length === 0) {
      return {
        valid: false,
        reason: 'TOKEN_NOT_FOUND',
        evidence: { nonce: payload.nonce.substring(0, 16) + '...' }
      };
    }
    
    const dbToken = tokenCheck.rows[0];
    
    if (dbToken.status !== 'issued') {
      return {
        valid: false,
        reason: 'TOKEN_ALREADY_USED',
        evidence: {
          status: dbToken.status,
          used_at: dbToken.used_at
        }
      };
    }
    
    // 4. Verify bindings match execution context
    
    // Migration hash must match (prevents migration substitution)
    if (payload.migration_hash !== executionContext.migration_hash) {
      return {
        valid: false,
        reason: 'MIGRATION_HASH_MISMATCH',
        evidence: {
          token_hash: payload.migration_hash.substring(0, 16) + '...',
          execution_hash: executionContext.migration_hash.substring(0, 16) + '...'
        }
      };
    }
    
    // Environment must match
    if (payload.target_environment !== executionContext.target_environment) {
      return {
        valid: false,
        reason: 'ENVIRONMENT_MISMATCH',
        evidence: {
          token_environment: payload.target_environment,
          execution_environment: executionContext.target_environment
        }
      };
    }
    
    // Schema must match (if specified)
    if (payload.target_schema && payload.target_schema !== executionContext.target_schema) {
      return {
        valid: false,
        reason: 'SCHEMA_MISMATCH',
        evidence: {
          token_schema: payload.target_schema,
          execution_schema: executionContext.target_schema
        }
      };
    }
    
    // Executor identity must match
    if (payload.executor_identity !== executionContext.executor_identity) {
      return {
        valid: false,
        reason: 'EXECUTOR_IDENTITY_MISMATCH',
        evidence: {
          token_executor: payload.executor_identity,
          actual_executor: executionContext.executor_identity
        }
      };
    }
    
    // 5. Verify approval still exists and is in correct state
    const approvalCheck = await db.query(`
      SELECT approval_id, status, migration_hash
      FROM bella_migration_approval
      WHERE approval_id = $1
      LIMIT 1
    `, [payload.approval_id]);
    
    if (approvalCheck.rows.length === 0) {
      return {
        valid: false,
        reason: 'APPROVAL_NOT_FOUND',
        evidence: { approval_id: payload.approval_id }
      };
    }
    
    const approval = approvalCheck.rows[0];
    
    // Approval should be in 'approved' or 'executing' state
    if (!['approved', 'executing'].includes(approval.status)) {
      return {
        valid: false,
        reason: 'APPROVAL_INVALID_STATE',
        evidence: {
          approval_id: payload.approval_id,
          status: approval.status
        }
      };
    }
    
    // ALL CHECKS PASSED
    return {
      valid: true,
      evidence: {
        token_id: dbToken.token_id,
        approval_id: payload.approval_id,
        nonce: payload.nonce.substring(0, 16) + '...',
        checks_passed: [
          'signature_valid',
          'not_expired',
          'status_issued',
          'migration_hash_match',
          'environment_match',
          'schema_match',
          'executor_identity_match',
          'approval_exists'
        ]
      }
    };
    
  } catch (error) {
    // Fail closed: any error → invalid
    return {
      valid: false,
      reason: 'VALIDATION_ERROR',
      evidence: {
        error: error.message
      }
    };
  }
}

// ============================================================================
// TOKEN CONSUMPTION (Atomic Single-Use)
// ============================================================================

/**
 * Consume gate token atomically
 * 
 * This function implements single-use enforcement with atomic database operation.
 * Only ONE execution attempt can successfully consume a token.
 * 
 * Race condition protection:
 * - UPDATE WHERE nonce = ? AND status = 'issued'
 * - If 0 rows updated → token already consumed by another request
 * 
 * @param {string} nonce - Token nonce
 * @param {Object} db - PostgreSQL client
 * @returns {Promise<{consumed: boolean, reason?: string, token_id?: string}>}
 */
async function consumeGateToken(nonce, db) {
  try {
    // Atomic consume: UPDATE WHERE status = 'issued'
    // Only succeeds if token is still in 'issued' state
    const result = await db.query(`
      UPDATE bella_gate_tokens
      SET status = 'used',
          used_at = NOW()
      WHERE nonce = $1
        AND status = 'issued'
        AND expires_at > NOW()
      RETURNING token_id, approval_id, migration_id, used_at
    `, [nonce]);
    
    if (result.rows.length === 0) {
      // Token either:
      // - Already consumed (status != 'issued')
      // - Expired (expires_at <= NOW)
      // - Doesn't exist
      return {
        consumed: false,
        reason: 'TOKEN_ALREADY_CONSUMED_OR_EXPIRED',
        evidence: {
          message: 'Token cannot be consumed (already used, expired, or not found)'
        }
      };
    }
    
    const consumedToken = result.rows[0];
    
    return {
      consumed: true,
      token_id: consumedToken.token_id,
      approval_id: consumedToken.approval_id,
      migration_id: consumedToken.migration_id,
      consumed_at: consumedToken.used_at
    };
    
  } catch (error) {
    // Fail closed
    console.error('❌ consumeGateToken exception:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    
    return {
      consumed: false,
      reason: 'CONSUME_ERROR',
      evidence: {
        error: error.message,
        code: error.code,
        detail: error.detail
      }
    };
  }
}

// ============================================================================
// TOKEN BINDING VERIFICATION (Combined Validate + Consume)
// ============================================================================

/**
 * Verify token and consume atomically
 * 
 * This is the main entry point for execution gate:
 * 1. Validate token (signature, expiry, bindings)
 * 2. If valid, consume token atomically
 * 3. Return PASS/BLOCK decision
 * 
 * @param {GateToken} token 
 * @param {Object} executionContext 
 * @param {Object} db 
 * @returns {Promise<{decision: 'PASS'|'BLOCK', reason?: string, evidence: Object}>}
 */
async function verifyTokenBinding(token, executionContext, db) {
  // Step 1: Validate
  const validation = await validateGateToken(token, executionContext, db);
  
  if (!validation.valid) {
    return {
      decision: 'BLOCK',
      reason: validation.reason,
      evidence: validation.evidence
    };
  }
  
  // Step 2: Consume atomically
  const consumption = await consumeGateToken(token.payload.nonce, db);
  
  if (!consumption.consumed) {
    return {
      decision: 'BLOCK',
      reason: consumption.reason,
      evidence: consumption.evidence
    };
  }
  
  // PASS: Token valid and consumed
  return {
    decision: 'PASS',
    evidence: {
      token_id: consumption.token_id,
      approval_id: consumption.approval_id,
      migration_id: consumption.migration_id,
      consumed_at: consumption.consumed_at,
      validation_checks: validation.evidence.checks_passed
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  issueGateToken,
  validateGateToken,
  consumeGateToken,
  verifyTokenBinding,
  signPayload,
  verifySignature,
  signPayloadAsync,
  verifySignatureAsync
};
