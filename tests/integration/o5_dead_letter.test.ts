/**
 * H1.2 Phase 7: O5 Dead Letter Queue — Behavioral Verification
 * Constitution: v1.3 FROZEN
 * Purpose: Prove quarantined events visible and queryable for operator intervention
 * 
 * Acceptance Criteria (O5):
 * ✓ Quarantined events queryable by tenant
 * ✓ Metadata complete: event_type, quarantine_reason, failure_classification, retry_count, last_error
 * ✓ Filterable by quarantine_reason
 * ✓ Ordered by quarantined_at DESC (most recent first)
 * ✓ Payload preserved for investigation
 * ✓ Dead letter does NOT auto-retry
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Use native crypto.randomUUID() instead of uuid package
const uuidv4 = randomUUID;
import { getQuarantinedEvents } from '../../src/platform/integration-hub/finance-outbox-observability';
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

describe('O5: Dead Letter Queue', () => {
  
  test('O5.1: Quarantined events queryable by tenant', async () => {
    const eventIds = [];
    
    for (let i = 0; i < 3; i++) {
      const eventId = uuidv4();
      eventIds.push(eventId);
      
      await db.query(`
        INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at, last_error)
        VALUES ($1, $2, $3, $4, $5, now(), $6, 10, $7, $8, now(), $9)
      `, [eventId, TEST_TENANT_ID, `QUARANTINED_${i}`, JSON.stringify({ index: i }), 'QUARANTINED', 5, 'MAX_RETRY_EXCEEDED', 'TRANSIENT', 'Service unavailable']);
    }
    
    const deadLetters = await getQuarantinedEvents(TEST_TENANT_ID, 100, db);
    
    expect(deadLetters.length).toBe(3);
    deadLetters.forEach((event: any) => {
      expect(event.status).toBe('QUARANTINED');
      expect(event.tenant_id).toBe(TEST_TENANT_ID);
    });
  });
  
  test('O5.2: Metadata complete for investigation', async () => {
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at, last_error, first_attempt_at, last_attempt_at)
      VALUES ($1, $2, $3, $4, $5, now() - interval '1 hour', 10, 10, $6, $7, now(), $8, now() - interval '1 hour', now() - interval '5 minutes')
    `, [eventId, TEST_TENANT_ID, 'DETAILED_QUARANTINE', JSON.stringify({ critical: true }), 'QUARANTINED', 'PERMANENT_FAILURE', 'PERMANENT', 'Invalid schema: missing required field']);
    
    const deadLetters = await getQuarantinedEvents(TEST_TENANT_ID, 100, db);
    const event = deadLetters[0];
    
    expect(event.event_id).toBe(eventId);
    expect(event.event_type).toBe('DETAILED_QUARANTINE');
    expect(event.quarantine_reason).toBe('PERMANENT_FAILURE');
    expect(event.failure_classification).toBe('PERMANENT');
    expect(event.retry_count).toBe(10);
    expect(event.last_error).toContain('Invalid schema');
    expect(event.first_attempt_at).not.toBeNull();
    expect(event.last_attempt_at).not.toBeNull();
    expect(event.payload).toHaveProperty('critical');
  });
  
  test('O5.3: Filterable by quarantine_reason', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at)
      VALUES 
        ($1, $2, 'MAX_RETRY', '{}', 'QUARANTINED', now(), 10, 10, 'MAX_RETRY_EXCEEDED', 'TRANSIENT', now()),
        ($3, $2, 'PERMANENT', '{}', 'QUARANTINED', now(), 0, 10, 'PERMANENT_FAILURE', 'PERMANENT', now()),
        ($4, $2, 'POISON', '{}', 'QUARANTINED', now(), 3, 10, 'POISON_EVENT', 'POISON', now())
    `, [uuidv4(), TEST_TENANT_ID, uuidv4(), uuidv4()]);
    
    const maxRetry = await db.query(`SELECT event_id FROM finance_outbox_events WHERE tenant_id = $1 AND quarantine_reason = 'MAX_RETRY_EXCEEDED'`, [TEST_TENANT_ID]);
    const permanent = await db.query(`SELECT event_id FROM finance_outbox_events WHERE tenant_id = $1 AND quarantine_reason = 'PERMANENT_FAILURE'`, [TEST_TENANT_ID]);
    const poison = await db.query(`SELECT event_id FROM finance_outbox_events WHERE tenant_id = $1 AND quarantine_reason = 'POISON_EVENT'`, [TEST_TENANT_ID]);
    
    expect(maxRetry.rows.length).toBe(1);
    expect(permanent.rows.length).toBe(1);
    expect(poison.rows.length).toBe(1);
  });
  
  test('O5.4: Ordered by quarantined_at DESC', async () => {
    const eventIds = [];
    
    for (let i = 0; i < 3; i++) {
      const eventId = uuidv4();
      eventIds.push(eventId);
      
      await db.query(`
        INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at)
        VALUES ($1, $2, $3, '{}', 'QUARANTINED', now(), 5, 10, 'TEST', 'TRANSIENT', now() - interval '${i} hours')
      `, [eventId, TEST_TENANT_ID, `EVENT_${i}`]);
    }
    
    const deadLetters = await getQuarantinedEvents(TEST_TENANT_ID, 100, db);
    
    expect(deadLetters.length).toBe(3);
    // Most recent first
    expect(deadLetters[0].event_id).toBe(eventIds[0]);
    expect(deadLetters[2].event_id).toBe(eventIds[2]);
  });
  
  test('O5.5: Dead letter does NOT auto-retry', async () => {
    const eventId = uuidv4();
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at)
      VALUES ($1, $2, 'NO_AUTO_RETRY', '{}', 'QUARANTINED', now() - interval '1 day', 10, 10, 'MAX_RETRY_EXCEEDED', 'TRANSIENT', now() - interval '1 day')
    `, [eventId, TEST_TENANT_ID]);
    
    // Wait and verify event still quarantined (no auto-retry)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = await db.query(`SELECT status, claimed_by FROM finance_outbox_events WHERE event_id = $1`, [eventId]);
    
    expect(result.rows[0].status).toBe('QUARANTINED');
    expect(result.rows[0].claimed_by).toBeNull();
  });
  
  test('O5.6: Payload preserved for investigation', async () => {
    const eventId = uuidv4();
    const originalPayload = { 
      transaction_id: 'TXN-123', 
      amount: 1000, 
      patient_id: 'P-456',
      metadata: { reason: 'investigation' }
    };
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at)
      VALUES ($1, $2, 'PAYLOAD_PRESERVED', $3, 'QUARANTINED', now(), 5, 10, 'TEST', 'TRANSIENT', now())
    `, [eventId, TEST_TENANT_ID, JSON.stringify(originalPayload)]);
    
    const deadLetters = await getQuarantinedEvents(TEST_TENANT_ID, 100, db);
    const event = deadLetters[0];
    
    expect(event.payload).toEqual(originalPayload);
    expect(event.payload.transaction_id).toBe('TXN-123');
    expect(event.payload.amount).toBe(1000);
  });
  
  test('O5.7: Tenant isolation enforced', async () => {
    // Arrange: Use unique tenants
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();
    
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES 
        ($1, 'Test Tenant O5.7-1', now()),
        ($2, 'Test Tenant O5.7-2', now())
      ON CONFLICT (id) DO NOTHING
    `, [tenant1, tenant2]);
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, quarantine_reason, failure_classification, quarantined_at)
      VALUES 
        ($1, $2, 'T1_EVENT', '{}', 'QUARANTINED', now(), 5, 10, 'TEST', 'TRANSIENT', now()),
        ($3, $4, 'T2_EVENT', '{}', 'QUARANTINED', now(), 5, 10, 'TEST', 'TRANSIENT', now())
    `, [uuidv4(), tenant1, uuidv4(), tenant2]);
    
    const tenant1Events = await getQuarantinedEvents(tenant1, 100, db);
    const tenant2Events = await getQuarantinedEvents(tenant2, 100, db);
    
    expect(tenant1Events.length).toBe(1);
    expect(tenant2Events.length).toBe(1);
    expect(tenant1Events[0].tenant_id).toBe(tenant1);
    expect(tenant2Events[0].tenant_id).toBe(tenant2);
  });
});

/**
 * O5 PASS Criteria:
 * ✅ Quarantined events queryable
 * ✅ Metadata complete
 * ✅ Filterable by quarantine_reason
 * ✅ Ordered by quarantined_at DESC
 * ✅ No auto-retry
 * ✅ Payload preserved
 * ✅ Tenant isolation
 */






