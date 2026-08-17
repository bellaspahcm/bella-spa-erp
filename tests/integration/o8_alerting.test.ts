/**
 * H1.2 Phase 7: O8 Alerting — Behavioral Verification
 * Constitution: v1.3 FROZEN
 * Purpose: Prove alert thresholds detected correctly
 * 
 * Acceptance Criteria (O8):
 * ✓ HIGH_PENDING_BACKLOG: pending_count > 1000 → WARNING
 * ✓ QUARANTINE_ACCUMULATION: quarantined_count > 100 → CRITICAL
 * ✓ STUCK_EVENTS: stuck_processing_count > 10 → WARNING
 * ✓ PROCESSING_LAG: oldest_pending_age > 5 minutes → WARNING
 * ✓ HIGH_FAILURE_RATE: failure_rate > 50% → CRITICAL
 * ✓ Alert returns only triggered alerts
 * ✓ Severity levels correct (WARNING vs CRITICAL)
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Use native crypto.randomUUID() instead of uuid package
const uuidv4 = randomUUID;
import { checkAlertThresholds } from '../../src/platform/integration-hub/finance-outbox-observability';
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

describe('O8: Alerting', () => {
  
  test('O8.1: HIGH_PENDING_BACKLOG alert triggered', async () => {
    // Create 1001 pending events
    const insertValues = [];
    for (let i = 0; i < 1001; i++) {
      insertValues.push(`('${uuidv4()}', '${TEST_TENANT_ID}', 'BACKLOG_${i}', '{}', 'PENDING', now(), 0, 10)`);
    }
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ${insertValues.join(',')}
    `);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    const backlogAlert = alerts.find(a => a.alert_type === 'HIGH_PENDING_BACKLOG');
    expect(backlogAlert).toBeDefined();
    expect(backlogAlert!.triggered).toBe(true);
    expect(backlogAlert!.current_value).toBe(1001);
    expect(backlogAlert!.threshold).toBe(1000);
    expect(backlogAlert!.severity).toBe('WARNING');
  });
  
  test('O8.2: QUARANTINE_ACCUMULATION alert triggered', async () => {
    const insertValues = [];
    for (let i = 0; i < 101; i++) {
      insertValues.push(`('${uuidv4()}', '${TEST_TENANT_ID}', 'Q_${i}', '{}', 'QUARANTINED', now(), 10, 10)`);
    }
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ${insertValues.join(',')}
    `);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    const quarantineAlert = alerts.find(a => a.alert_type === 'QUARANTINE_ACCUMULATION');
    expect(quarantineAlert).toBeDefined();
    expect(quarantineAlert!.triggered).toBe(true);
    expect(quarantineAlert!.current_value).toBe(101);
    expect(quarantineAlert!.threshold).toBe(100);
    expect(quarantineAlert!.severity).toBe('CRITICAL');
  });
  
  test('O8.3: STUCK_EVENTS alert triggered', async () => {
    const insertValues = [];
    for (let i = 0; i < 11; i++) {
      insertValues.push(`('${uuidv4()}', '${TEST_TENANT_ID}', 'STUCK_${i}', '{}', 'PROCESSING', now(), 0, 10, 'worker-${i}', now() - interval '5 minutes')`);
    }
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, claimed_by, lease_expires_at)
      VALUES ${insertValues.join(',')}
    `);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    const stuckAlert = alerts.find(a => a.alert_type === 'STUCK_EVENTS');
    expect(stuckAlert).toBeDefined();
    expect(stuckAlert!.triggered).toBe(true);
    expect(stuckAlert!.current_value).toBe(11);
    expect(stuckAlert!.threshold).toBe(10);
    expect(stuckAlert!.severity).toBe('WARNING');
  });
  
  test('O8.4: PROCESSING_LAG alert triggered', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ($1, $2, 'OLD_PENDING', '{}', 'PENDING', now() - interval '10 minutes', 0, 10)
    `, [uuidv4(), TEST_TENANT_ID]);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    const lagAlert = alerts.find(a => a.alert_type === 'PROCESSING_LAG');
    expect(lagAlert).toBeDefined();
    expect(lagAlert!.triggered).toBe(true);
    expect(lagAlert!.current_value).toBeGreaterThan(5); // minutes
    expect(lagAlert!.threshold).toBe(5);
    expect(lagAlert!.severity).toBe('WARNING');
  });
  
  test('O8.5: HIGH_FAILURE_RATE alert triggered', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES 
        ($1, $2, 'FAILED_1', '{}', 'FAILED', now(), 3, 10),
        ($3, $2, 'FAILED_2', '{}', 'FAILED', now(), 3, 10),
        ($4, $2, 'FAILED_3', '{}', 'FAILED', now(), 3, 10),
        ($5, $2, 'PENDING_1', '{}', 'PENDING', now(), 0, 10)
    `, [uuidv4(), TEST_TENANT_ID, uuidv4(), uuidv4(), uuidv4()]);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    const failureRateAlert = alerts.find(a => a.alert_type === 'HIGH_FAILURE_RATE');
    expect(failureRateAlert).toBeDefined();
    expect(failureRateAlert!.triggered).toBe(true);
    expect(failureRateAlert!.current_value).toBeCloseTo(0.75, 1); // 3/4 = 75%
    expect(failureRateAlert!.threshold).toBe(0.5);
    expect(failureRateAlert!.severity).toBe('CRITICAL');
  });
  
  test('O8.6: Returns only triggered alerts', async () => {
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ($1, $2, 'HEALTHY', '{}', 'PENDING', now(), 0, 10)
    `, [uuidv4(), TEST_TENANT_ID]);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    // No alerts triggered
    expect(alerts.length).toBe(0);
  });
  
  test('O8.7: Multiple alerts can trigger simultaneously', async () => {
    // Create condition for 2 alerts: HIGH_PENDING_BACKLOG + PROCESSING_LAG
    const insertValues = [];
    for (let i = 0; i < 1001; i++) {
      insertValues.push(`('${uuidv4()}', '${TEST_TENANT_ID}', 'MULTI_${i}', '{}', 'PENDING', now() - interval '10 minutes', 0, 10)`);
    }
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ${insertValues.join(',')}
    `);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    
    const backlogAlert = alerts.find(a => a.alert_type === 'HIGH_PENDING_BACKLOG');
    const lagAlert = alerts.find(a => a.alert_type === 'PROCESSING_LAG');
    
    expect(backlogAlert).toBeDefined();
    expect(lagAlert).toBeDefined();
  });
  
  test('O8.8: Severity levels correct', async () => {
    const insertValues = [];
    for (let i = 0; i < 101; i++) {
      insertValues.push(`('${uuidv4()}', '${TEST_TENANT_ID}', 'Q${i}', '{}', 'QUARANTINED', now(), 10, 10)`);
    }
    
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ${insertValues.join(',')}
    `);
    
    const alerts = await checkAlertThresholds(TEST_TENANT_ID, db);
    
    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
    const warningAlerts = alerts.filter(a => a.severity === 'WARNING');
    
    // QUARANTINE_ACCUMULATION is CRITICAL
    expect(criticalAlerts.length).toBeGreaterThan(0);
    expect(criticalAlerts.some(a => a.alert_type === 'QUARANTINE_ACCUMULATION')).toBe(true);
  });
});

/**
 * O8 PASS Criteria:
 * ✅ HIGH_PENDING_BACKLOG detected
 * ✅ QUARANTINE_ACCUMULATION detected
 * ✅ STUCK_EVENTS detected
 * ✅ PROCESSING_LAG detected
 * ✅ HIGH_FAILURE_RATE detected
 * ✅ Returns only triggered alerts
 * ✅ Multiple alerts simultaneously
 * ✅ Severity levels correct
 */






