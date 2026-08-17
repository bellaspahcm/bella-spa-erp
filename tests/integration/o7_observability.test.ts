/**
 * H1.2 Phase 7: O7 Observability — Behavioral Verification
 * Constitution: v1.3 FROZEN
 * Purpose: Prove operational state queryable and visible
 * 
 * Acceptance Criteria (O7):
 * ✓ Health metrics query returns accurate counts
 * ✓ Metrics per status: PENDING, PROCESSING, FAILED, QUARANTINED, PROCESSED
 * ✓ 24h processed count accurate
 * ✓ Average retry count calculated
 * ✓ Oldest pending age tracked
 * ✓ Stuck events detected (PROCESSING with expired lease)
 * ✓ Query performance <1s for 10k events
 * ✓ Tenant isolation enforced
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Use native crypto.randomUUID() instead of uuid package
const uuidv4 = randomUUID;
import { getOutboxHealth } from '../../src/platform/integration-hub/finance-outbox-observability';
import { getWorkerPool, closeAllConnections } from '../../src/platform/integration-hub/db-connection';

const TEST_TENANT_ID = randomUUID(); // Valid UUID

let db: Pool;

beforeAll(async () => {
  db = getWorkerPool();
  
  // Create test tenant
  await db.query(`
    INSERT INTO tenants (id, name, created_at)
    VALUES ($1, 'Test Tenant', now())
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

describe('O7: Observability', () => {
  
  test('O7.1: Health metrics returns accurate counts by status', async () => {
    // Create events across all statuses
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'E1', '{}', 'PENDING', now(), 0, 10),
        ($3, $2, 'E2', '{}', 'PENDING', now(), 0, 10),
        ($4, $2, 'E3', '{}', 'PROCESSING', now(), 0, 10),
        ($5, $2, 'E4', '{}', 'FAILED', now(), 3, 10),
        ($6, $2, 'E5', '{}', 'FAILED', now(), 5, 10),
        ($7, $2, 'E6', '{}', 'QUARANTINED', now(), 10, 10),
        ($8, $2, 'E7', '{}', 'PROCESSED', now(), 0, 10)
    `, [uuidv4(), TEST_TENANT_ID, uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()]);
    
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.pending_count).toBe(2);
    expect(health.processing_count).toBe(1);
    expect(health.failed_count).toBe(2);
    expect(health.quarantined_count).toBe(1);
  });
  
  test('O7.2: 24h processed count accurate', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, processed_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'RECENT', '{}', 'PROCESSED', now() - interval '1 hour', now() - interval '1 hour', 0, 10),
        ($3, $2, 'OLD', '{}', 'PROCESSED', now() - interval '30 hours', now() - interval '30 hours', 0, 10)
    `, [uuidv4(), TEST_TENANT_ID, uuidv4()]);
    
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.processed_count_24h).toBe(1); // Only recent one
  });
  
  test('O7.3: Average retry count calculated', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'R1', '{}', 'FAILED', now(), 2, 10),
        ($3, $2, 'R2', '{}', 'FAILED', now(), 4, 10),
        ($4, $2, 'R3', '{}', 'QUARANTINED', now(), 6, 10)
    `, [uuidv4(), TEST_TENANT_ID, uuidv4(), uuidv4()]);
    
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.avg_retry_count).toBeCloseTo(4, 0); // (2+4+6)/3 = 4
  });
  
  test('O7.4: Oldest pending age tracked', async () => {
    const oldEventId = uuidv4();
    const recentEventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'OLD_PENDING', '{}', 'PENDING', now() - interval '10 minutes', 0, 10),
        ($3, $2, 'RECENT_PENDING', '{}', 'PENDING', now() - interval '1 minute', 0, 10)
    `, [oldEventId, TEST_TENANT_ID, recentEventId]);
    
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.oldest_pending_age_seconds).toBeGreaterThan(590); // ~10 minutes
    expect(health.oldest_pending_age_seconds).toBeLessThan(610);
  });
  
  test('O7.5: Stuck events detected (expired lease)', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, claimed_by, lease_expires_at)
      VALUES 
        ($1, $2, 'STUCK', '{}', 'PROCESSING', now(), 0, 10, 'worker-crashed', now() - interval '5 minutes'),
        ($3, $2, 'ACTIVE', '{}', 'PROCESSING', now(), 0, 10, 'worker-active', now() + interval '30 seconds')
    `, [uuidv4(), TEST_TENANT_ID, uuidv4()]);
    
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.stuck_processing_count).toBe(1);
    expect(health.processing_count).toBe(2);
  });
  
  test('O7.6: Last success and failure timestamps', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, processed_at, retry_count, max_retry)
      VALUES ($1, $2, 'SUCCESS', '{}', 'PROCESSED', now() - interval '1 hour', now() - interval '30 minutes', 0, 10)
    `, [uuidv4(), TEST_TENANT_ID]);
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, last_attempt_at, retry_count, max_retry)
      VALUES ($1, $2, 'FAILURE', '{}', 'FAILED', now() - interval '1 hour', now() - interval '15 minutes', 3, 10)
    `, [uuidv4(), TEST_TENANT_ID]);
    
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.last_success).not.toBeNull();
    expect(health.last_failure).not.toBeNull();
  });
  
  test('O7.7: Tenant isolation enforced', async () => {
    // Arrange: Use unique tenants
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();
    
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES 
        ($1, 'Test Tenant O7.7-1', now()),
        ($2, 'Test Tenant O7.7-2', now())
      ON CONFLICT (id) DO NOTHING
    `, [tenant1, tenant2]);
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'T1_EVENT', '{}', 'PENDING', now(), 0, 10),
        ($3, $4, 'T2_EVENT', '{}', 'PENDING', now(), 0, 10),
        ($5, $4, 'T2_EVENT2', '{}', 'FAILED', now(), 2, 10)
    `, [uuidv4(), tenant1, uuidv4(), tenant2, uuidv4()]);
    
    const health1 = await getOutboxHealth(tenant1, db);
    const health2 = await getOutboxHealth(tenant2, db);
    
    expect(health1.pending_count).toBe(1);
    expect(health1.failed_count).toBe(0);
    
    expect(health2.pending_count).toBe(1);
    expect(health2.failed_count).toBe(1);
  });
  
  test('O7.8: Global health (no tenant filter)', async () => {
    await db.query(`DELETE FROM finance_outbox_events`);
    
    // Create unique tenants for global test
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const tenantC = randomUUID();
    
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES 
        ($1, 'Global Tenant A', now()),
        ($2, 'Global Tenant B', now()),
        ($3, 'Global Tenant C', now())
      ON CONFLICT (id) DO NOTHING
    `, [tenantA, tenantB, tenantC]);
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'E1', '{}', 'PENDING', now(), 0, 10),
        ($3, $4, 'E2', '{}', 'PENDING', now(), 0, 10),
        ($5, $6, 'E3', '{}', 'FAILED', now(), 3, 10)
    `, [uuidv4(), tenantA, uuidv4(), tenantB, uuidv4(), tenantC]);
    
    const globalHealth = await getOutboxHealth(undefined, db);
    
    expect(globalHealth.pending_count).toBe(2);
    expect(globalHealth.failed_count).toBe(1);
  });
  
  test('O7.9: Empty state handling', async () => {
    const health = await getOutboxHealth(TEST_TENANT_ID, db);
    
    expect(health.pending_count).toBe(0);
    expect(health.processing_count).toBe(0);
    expect(health.failed_count).toBe(0);
    expect(health.quarantined_count).toBe(0);
    expect(health.avg_retry_count).toBe(0);
    expect(health.oldest_pending_age_seconds).toBeNull();
  });
});

/**
 * O7 PASS Criteria:
 * ✅ Accurate counts by status
 * ✅ 24h processed count
 * ✅ Average retry count
 * ✅ Oldest pending age
 * ✅ Stuck events detection
 * ✅ Last success/failure timestamps
 * ✅ Tenant isolation
 * ✅ Global health query
 * ✅ Empty state handling
 */






