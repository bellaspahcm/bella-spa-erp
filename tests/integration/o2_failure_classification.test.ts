/**
 * H1.2 Phase 7: O2 Failure Classification — Behavioral Verification
 * Constitution: v1.3 FROZEN
 * Purpose: Prove system distinguishes TRANSIENT vs PERMANENT failures
 * 
 * Failure Taxonomy:
 * - TRANSIENT: 503, timeout, network failure → Retry with backoff
 * - PERMANENT: 400, 422, schema violation → Quarantine immediately (no retry)
 * - POISON: Deterministic crash → Quarantine after threshold (O3)
 * - UNKNOWN: Novel error codes → Retry with backoff (safe default)
 * 
 * Acceptance Criteria (O2):
 * ✓ 503/timeout/crash → failure_classification='TRANSIENT' → retry occurs
 * ✓ 400/422 → failure_classification='PERMANENT' → quarantine immediately (retry_count=0)
 * ✓ Retry policy NOT applied to PERMANENT failures
 * ✓ UNKNOWN errors default to TRANSIENT behavior
 * ✓ last_error captured with classification metadata
 * ✓ Worker crash handled as TRANSIENT (O4 lease recovery)
 * 
 * Evidence Collection:
 * - Classification logic (HTTP status → failure_classification)
 * - State transitions per classification type
 * - Retry behavior differences (TRANSIENT vs PERMANENT)
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Use native crypto.randomUUID() instead of uuid package
const uuidv4 = randomUUID;
import { claimEvent, processEvent, FinanceApiClient } from '../../src/platform/integration-hub/finance-outbox-worker';
import { getWorkerPool, closeAllConnections } from '../../src/platform/integration-hub/db-connection';

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_TENANT_ID = randomUUID(); // Valid UUID
const MAX_RETRY = 10;

let db: Pool;

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeAll(async () => {
  db = getWorkerPool();
  
  // Create test tenant
  await db.query(`
    INSERT INTO tenants (id, name, created_at)
    VALUES ($1, 'Test Tenant O2', now())
    ON CONFLICT (id) DO NOTHING
  `, [TEST_TENANT_ID]);
  
  await db.query(`DELETE FROM finance_outbox_events WHERE tenant_id = $1`, [TEST_TENANT_ID]);
});

afterAll(async () => {
  await db.query(`DELETE FROM finance_outbox_events WHERE tenant_id = $1`, [TEST_TENANT_ID]);
  await closeAllConnections();
});

beforeEach(async () => {
  await db.query(`DELETE FROM finance_outbox_events WHERE tenant_id = $1`, [TEST_TENANT_ID]);
});

// ============================================================================
// Test Suite: O2 Failure Classification
// ============================================================================

describe('O2: Failure Classification', () => {
  
  // ==========================================================================
  // Test 1: TRANSIENT Classification (503 Service Unavailable)
  // ==========================================================================
  
  test('O2.1: 503 Service Unavailable classified as TRANSIENT → retry occurs', async () => {
    // Arrange: Use unique tenant to avoid claim conflicts
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.1', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    const idempotencyKey = `o2-transient-503-${Date.now()}`;
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'TRANSIENT_503_TEST',
      JSON.stringify({ amount: 100 }),
      'PENDING',
      idempotencyKey,
      MAX_RETRY,
    ]);
    
    // Mock Finance API: 503 error
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Service temporarily unavailable',
        http_status: 503,
      }),
    };
    
    // Act: Manually claim specific event (bypass claimEvent to avoid cross-test interference)
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    expect(claimed).toBeDefined();
    expect(claimed.event_id).toBe(eventId);
    
    await processEvent(claimed!, mockFinanceApi, db);
    
    // Assert: TRANSIENT classification + retry behavior
    const result = await db.query(`
      SELECT status, failure_classification, retry_count, next_retry_at, last_error
      FROM finance_outbox_events
      WHERE event_id = $1
    `, [eventId]);
    
    const row = result.rows[0];
    
    expect(row.status).toBe('FAILED');
    expect(row.failure_classification).toBe('TRANSIENT');
    expect(row.retry_count).toBe(1); // Incremented
    expect(row.next_retry_at).not.toBeNull(); // Retry scheduled
    expect(row.last_error).toContain('Service temporarily unavailable');
    
    console.log('=== O2.1 Evidence: TRANSIENT (503) ===');
    console.log(row);
  });
  
  // ==========================================================================
  // Test 2: TRANSIENT Classification (504 Gateway Timeout)
  // ==========================================================================
  
  test('O2.2: 504 Gateway Timeout classified as TRANSIENT → retry occurs', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.2', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'TRANSIENT_504_TEST',
      JSON.stringify({ test: true }),
      'PENDING',
      `o2-504-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Gateway timeout',
        http_status: 504,
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    const result = await db.query(`
      SELECT status, failure_classification, retry_count, next_retry_at
      FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    expect(result.rows[0].failure_classification).toBe('TRANSIENT');
    expect(result.rows[0].retry_count).toBe(1);
    expect(result.rows[0].next_retry_at).not.toBeNull();
    
    console.log('=== O2.2 Evidence: TRANSIENT (504) ===');
    console.log(result.rows[0]);
  });
  
  // ==========================================================================
  // Test 3: TRANSIENT Classification (500 Internal Server Error)
  // ==========================================================================
  
  test('O2.3: 500 Internal Server Error classified as TRANSIENT → retry occurs', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.3', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'TRANSIENT_500_TEST',
      JSON.stringify({ test: true }),
      'PENDING',
      `o2-500-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Internal server error',
        http_status: 500,
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    const result = await db.query(`
      SELECT failure_classification, retry_count FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    expect(result.rows[0].failure_classification).toBe('TRANSIENT');
    expect(result.rows[0].retry_count).toBe(1);
  });
  
  // ==========================================================================
  // Test 4: PERMANENT Classification (400 Bad Request)
  // ==========================================================================
  
  test('O2.4: 400 Bad Request classified as PERMANENT → quarantine immediately', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.4', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    const idempotencyKey = `o2-permanent-400-${Date.now()}`;
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'PERMANENT_400_TEST',
      JSON.stringify({ invalid: 'payload' }),
      'PENDING',
      idempotencyKey,
      MAX_RETRY,
    ]);
    
    // Mock Finance API: 400 error
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Invalid request: missing required field "amount"',
        http_status: 400,
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    expect(claimed).toBeDefined();
    expect(claimed.event_id).toBe(eventId);
    
    await processEvent(claimed!, mockFinanceApi, db);
    
    // Assert: PERMANENT classification + immediate quarantine (NO RETRY)
    const result = await db.query(`
      SELECT status, failure_classification, retry_count, next_retry_at, 
             quarantine_reason, quarantined_at, last_error
      FROM finance_outbox_events
      WHERE event_id = $1
    `, [eventId]);
    
    const row = result.rows[0];
    
    expect(row.status).toBe('QUARANTINED');
    expect(row.failure_classification).toBe('PERMANENT');
    expect(row.retry_count).toBe(0); // NOT incremented (no retry attempted)
    expect(row.next_retry_at).toBeNull(); // No retry scheduled
    expect(row.quarantine_reason).toBe('PERMANENT_FAILURE');
    expect(row.quarantined_at).not.toBeNull();
    expect(row.last_error).toContain('Invalid request');
    
    console.log('=== O2.4 Evidence: PERMANENT (400) ===');
    console.log(row);
    
    // Verify: Worker does NOT retry quarantined event
    const secondClaim = await claimEvent(db);
    expect(secondClaim?.event_id).not.toBe(eventId);
  });
  
  // ==========================================================================
  // Test 5: PERMANENT Classification (422 Unprocessable Entity)
  // ==========================================================================
  
  test('O2.5: 422 Unprocessable Entity classified as PERMANENT → quarantine immediately', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.5', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'PERMANENT_422_TEST',
      JSON.stringify({ malformed: 'schema' }),
      'PENDING',
      `o2-422-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Schema validation failed: amount must be positive',
        http_status: 422,
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    const result = await db.query(`
      SELECT status, failure_classification, retry_count, quarantine_reason
      FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    const row = result.rows[0];
    
    expect(row.status).toBe('QUARANTINED');
    expect(row.failure_classification).toBe('PERMANENT');
    expect(row.retry_count).toBe(0); // No retry
    expect(row.quarantine_reason).toBe('PERMANENT_FAILURE');
    
    console.log('=== O2.5 Evidence: PERMANENT (422) ===');
    console.log(row);
  });
  
  // ==========================================================================
  // Test 6: UNKNOWN Classification (Novel Error Code)
  // ==========================================================================
  
  test('O2.6: Unknown HTTP status classified as UNKNOWN → retry with backoff (safe default)', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.6', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'UNKNOWN_CODE_TEST',
      JSON.stringify({ test: true }),
      'PENDING',
      `o2-unknown-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    // Mock Finance API: Novel error code (418 I'm a teapot)
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Unexpected error code',
        http_status: 418, // Not in classification table
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    const result = await db.query(`
      SELECT status, failure_classification, retry_count, next_retry_at
      FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    const row = result.rows[0];
    
    // Safe default: UNKNOWN → retry behavior (like TRANSIENT)
    expect(row.status).toBe('FAILED');
    expect(row.failure_classification).toBe('UNKNOWN');
    expect(row.retry_count).toBe(1); // Retry attempted
    expect(row.next_retry_at).not.toBeNull(); // Retry scheduled
    
    console.log('=== O2.6 Evidence: UNKNOWN (418) ===');
    console.log(row);
  });
  
  // ==========================================================================
  // Test 7: Network Error (No HTTP Status)
  // ==========================================================================
  
  test('O2.7: Network error (no HTTP status) classified as UNKNOWN → retry occurs', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.7', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'NETWORK_ERROR_TEST',
      JSON.stringify({ test: true }),
      'PENDING',
      `o2-network-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    // Mock Finance API: Network error (no http_status)
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'ECONNREFUSED: Connection refused',
        // http_status: undefined
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    const result = await db.query(`
      SELECT status, failure_classification, retry_count, next_retry_at, last_error
      FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    const row = result.rows[0];
    
    expect(row.status).toBe('FAILED');
    expect(row.failure_classification).toBe('UNKNOWN');
    expect(row.retry_count).toBe(1);
    expect(row.next_retry_at).not.toBeNull();
    expect(row.last_error).toContain('ECONNREFUSED');
    
    console.log('=== O2.7 Evidence: Network Error ===');
    console.log(row);
  });
  
  // ==========================================================================
  // Test 8: Retry Policy NOT Applied to PERMANENT
  // ==========================================================================
  
  test('O2.8: PERMANENT failures do NOT increment retry_count', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.8', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'NO_RETRY_PERMANENT',
      JSON.stringify({ bad: 'payload' }),
      'PENDING',
      `o2-no-retry-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    // Evidence: Before state
    const before = await db.query(`SELECT retry_count FROM finance_outbox_events WHERE event_id = $1`, [eventId]);
    expect(before.rows[0].retry_count).toBe(0);
    
    // Mock: PERMANENT failure
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Bad request',
        http_status: 400,
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    // Evidence: After state
    const after = await db.query(`
      SELECT status, retry_count, failure_classification, next_retry_at
      FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    const row = after.rows[0];
    
    // Assert: No retry increment
    expect(row.status).toBe('QUARANTINED');
    expect(row.retry_count).toBe(0); // Still 0 (not incremented)
    expect(row.failure_classification).toBe('PERMANENT');
    expect(row.next_retry_at).toBeNull(); // No retry scheduled
    
    console.log('=== O2.8 Evidence: PERMANENT No Retry ===');
    console.log('Before:', before.rows[0]);
    console.log('After:', row);
  });
  
  // ==========================================================================
  // Test 9: Classification Consistency
  // ==========================================================================
  
  test('O2.9: Same error code produces consistent classification', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.9', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    // Create 3 events, all fail with 503
    const eventIds = [uuidv4(), uuidv4(), uuidv4()];
    
    for (const eventId of eventIds) {
      await db.query(`
        INSERT INTO finance_outbox_events (
          event_id, tenant_id, event_type, payload, status, created_at,
          idempotency_key, retry_count, max_retry
        ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
      `, [
        eventId,
        testTenantId,
        'CONSISTENCY_TEST',
        JSON.stringify({ test: true }),
        'PENDING',
        `o2-consistent-${eventId}`,
        MAX_RETRY,
      ]);
    }
    
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: 'Service unavailable',
        http_status: 503,
      }),
    };
    
    // Process all 3 events (direct claim for each)
    for (const eventId of eventIds) {
      const claimResult = await db.query(`
        UPDATE finance_outbox_events
        SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
        WHERE event_id = $1 AND status = 'PENDING'
        RETURNING *
      `, [eventId]);
      
      const claimed = claimResult.rows[0];
      expect(claimed).toBeDefined();
      expect(claimed.event_id).toBe(eventId);
      await processEvent(claimed, mockFinanceApi, db);
    }
    
    // Verify: All 3 have same classification
    const results = await db.query(`
      SELECT event_id, failure_classification
      FROM finance_outbox_events
      WHERE event_id = ANY($1::uuid[])
      ORDER BY event_id
    `, [eventIds]);
    
    expect(results.rows.length).toBe(3);
    expect(results.rows[0].failure_classification).toBe('TRANSIENT');
    expect(results.rows[1].failure_classification).toBe('TRANSIENT');
    expect(results.rows[2].failure_classification).toBe('TRANSIENT');
    
    console.log('=== O2.9 Evidence: Classification Consistency ===');
    console.log(results.rows);
  });
  
  // ==========================================================================
  // Test 10: last_error Captured
  // ==========================================================================
  
  test('O2.10: last_error field captures detailed error message', async () => {
    // Arrange: Use unique tenant
    const testTenantId = randomUUID();
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ($1, 'Test Tenant O2.10', now())
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId]);
    
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (
        event_id, tenant_id, event_type, payload, status, created_at,
        idempotency_key, retry_count, max_retry
      ) VALUES ($1, $2, $3, $4, $5, now(), $6, 0, $7)
    `, [
      eventId,
      testTenantId,
      'ERROR_CAPTURE_TEST',
      JSON.stringify({ test: true }),
      'PENDING',
      `o2-error-${Date.now()}`,
      MAX_RETRY,
    ]);
    
    const detailedError = 'Validation failed: field "amount" is required and must be a positive number greater than zero. Current value: undefined';
    
    const mockFinanceApi: FinanceApiClient = {
      post: jest.fn().mockResolvedValue({
        status: 'ERROR',
        error: detailedError,
        http_status: 422,
      }),
    };
    
    // Act: Direct claim
    const claimResult = await db.query(`
      UPDATE finance_outbox_events
      SET status = 'PROCESSING', claimed_by = 'test-worker', claimed_at = now()
      WHERE event_id = $1 AND status = 'PENDING'
      RETURNING *
    `, [eventId]);
    
    const claimed = claimResult.rows[0];
    await processEvent(claimed, mockFinanceApi, db);
    
    const result = await db.query(`
      SELECT last_error, failure_classification
      FROM finance_outbox_events WHERE event_id = $1
    `, [eventId]);
    
    expect(result.rows[0].last_error).toBe(detailedError);
    expect(result.rows[0].failure_classification).toBe('PERMANENT');
    
    console.log('=== O2.10 Evidence: Error Message Capture ===');
    console.log('Captured error:', result.rows[0].last_error);
  });
});

// ============================================================================
// Classification Reference Table
// ============================================================================

/**
 * Failure Classification Table (O2):
 * 
 * | HTTP Status | Classification | Retry Behavior          | State Transition          |
 * |-------------|----------------|-------------------------|---------------------------|
 * | 503         | TRANSIENT      | Retry with backoff      | PROCESSING → FAILED       |
 * | 504         | TRANSIENT      | Retry with backoff      | PROCESSING → FAILED       |
 * | 500         | TRANSIENT      | Retry with backoff      | PROCESSING → FAILED       |
 * | 400         | PERMANENT      | Quarantine immediately  | PROCESSING → QUARANTINED  |
 * | 422         | PERMANENT      | Quarantine immediately  | PROCESSING → QUARANTINED  |
 * | (none)      | UNKNOWN        | Retry with backoff      | PROCESSING → FAILED       |
 * | Novel codes | UNKNOWN        | Retry with backoff      | PROCESSING → FAILED       |
 * 
 * Implementation Location: finance-outbox-worker.ts → classifyFailure()
 */

// ============================================================================
// Evidence Summary
// ============================================================================

/**
 * O2 PASS Criteria:
 * 
 * ✅ O2.1: 503 → TRANSIENT → retry occurs
 * ✅ O2.2: 504 → TRANSIENT → retry occurs
 * ✅ O2.3: 500 → TRANSIENT → retry occurs
 * ✅ O2.4: 400 → PERMANENT → quarantine immediately (retry_count=0)
 * ✅ O2.5: 422 → PERMANENT → quarantine immediately (retry_count=0)
 * ✅ O2.6: Unknown status → UNKNOWN → retry occurs (safe default)
 * ✅ O2.7: Network error → UNKNOWN → retry occurs
 * ✅ O2.8: PERMANENT failures do NOT increment retry_count
 * ✅ O2.9: Classification consistent across events
 * ✅ O2.10: last_error captured with detail
 * 
 * Evidence to Collect:
 * - Classification logic validation (HTTP status → failure_classification)
 * - State transition differences (TRANSIENT vs PERMANENT)
 * - Retry behavior verification (incremented vs quarantined)
 * - Error message capture
 * 
 * Constitution Compliance:
 * - TRANSIENT errors retry with backoff ✓
 * - PERMANENT errors quarantine immediately ✓
 * - UNKNOWN defaults to retry (safe) ✓
 * - No retry on PERMANENT ✓
 * - Classification metadata captured ✓
 */





