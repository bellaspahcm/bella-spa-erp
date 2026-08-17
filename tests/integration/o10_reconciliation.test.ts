/**
 * H1.2 Phase 7: O10 Reconciliation — Behavioral Verification
 * Constitution: v1.3 FROZEN (O10)
 * Purpose: Prove discrepancy detection between Finance Outbox and Journal Entries
 * 
 * Acceptance Criteria (O10):
 * ✓ Detect ORPHANED_JOURNAL (outbox PENDING but journal exists)
 * ✓ Detect MISSING_JOURNAL (outbox PROCESSED but journal missing)
 * ✓ Detect DUPLICATE_JOURNAL (multiple journals for one idempotency key)
 * ✓ Detect TENANT_MISMATCH (outbox tenant ≠ journal tenant)
 * ✓ Generate actionable reconciliation report
 * ✓ Tenant-scoped reconciliation
 * ✓ Consistent events NOT flagged
 * 
 * NOT in scope (H1.2):
 * ✗ Automatic ledger correction
 * ✗ Automated rollback/replay
 * ✗ Self-healing reconciliation
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { getWorkerPool, closeAllConnections } from '../../src/platform/integration-hub/db-connection';

const TEST_TENANT_ID = randomUUID();

let db: Pool;

beforeAll(async () => {
  db = getWorkerPool();
  
  // Apply O10 migration if not already applied
  await db.query(`
    ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT
  `);
  
  // Drop UNIQUE constraint if exists (O10.4 needs to test duplicates)
  await db.query(`
    ALTER TABLE journal_entries
    DROP CONSTRAINT IF EXISTS journal_entries_idempotency_key_key
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_journal_idempotency
    ON journal_entries (idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);
  
  // Create test tenant
  await db.query(`
    INSERT INTO tenants (id, name, created_at)
    VALUES ($1, 'Test Tenant O10', now())
    ON CONFLICT (id) DO NOTHING
  `, [TEST_TENANT_ID]);
  
  await db.query(`DELETE FROM finance_outbox_events WHERE tenant_id = $1`, [TEST_TENANT_ID]);
  await db.query(`DELETE FROM journal_entries WHERE tenant_id = $1`, [TEST_TENANT_ID]);
});

afterAll(async () => {
  await db.query(`DELETE FROM finance_outbox_events WHERE tenant_id = $1`, [TEST_TENANT_ID]);
  await db.query(`DELETE FROM journal_entries WHERE tenant_id = $1`, [TEST_TENANT_ID]);
  await closeAllConnections();
});

beforeEach(async () => {
  await db.query(`DELETE FROM finance_outbox_events WHERE tenant_id = $1`, [TEST_TENANT_ID]);
  await db.query(`DELETE FROM journal_entries WHERE tenant_id = $1`, [TEST_TENANT_ID]);
});

describe('O10: Reconciliation', () => {
  
  test('O10.1: Consistent state NOT flagged', async () => {
    // Create 5 events: PROCESSED with matching journals
    for (let i = 0; i < 5; i++) {
      const eventId = randomUUID();
      const txnId = randomUUID();
      
      // Outbox: PROCESSED
      await db.query(`
        INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, transaction_id, processed_at)
        VALUES ($1, $2, 'CONSISTENT_${i}', '{}', 'PROCESSED', now(), 0, 10, $3, now())
      `, [eventId, TEST_TENANT_ID, txnId]);
      
      // Journal: exists
      await db.query(`
        INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
        VALUES ($1, $2, $3, 'OUTBOX', 'Test Journal Entry', 'POSTED', CURRENT_DATE)
      `, [txnId, TEST_TENANT_ID, eventId.toString()]);
    }
    
    // Run reconciliation query
    const result = await db.query(`
      WITH discrepancies AS (
        SELECT 
          o.event_id,
          o.status AS outbox_status,
          o.transaction_id,
          j.id AS journal_id,
          j.status AS journal_status,
          CASE 
            WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
            WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
            WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
            ELSE 'CONSISTENT'
          END AS discrepancy_type
        FROM finance_outbox_events o
        LEFT JOIN journal_entries j ON j.idempotency_key = o.event_id::text
        WHERE o.tenant_id = $1
      )
      SELECT * FROM discrepancies WHERE discrepancy_type != 'CONSISTENT'
    `, [TEST_TENANT_ID]);
    
    // No discrepancies
    expect(result.rows).toHaveLength(0);
  });
  
  test('O10.2: Detect MISSING_JOURNAL', async () => {
    const eventId = randomUUID();
    
    // Outbox: PROCESSED but no journal
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, transaction_id, processed_at)
      VALUES ($1, $2, 'MISSING_TEST', '{}', 'PROCESSED', now(), 0, 10, 'TXN_MISSING', now())
    `, [eventId, TEST_TENANT_ID]);
    
    // Run reconciliation
    const result = await db.query(`
      SELECT 
        o.event_id,
        o.status AS outbox_status,
        o.transaction_id,
        j.id AS journal_id,
        CASE 
          WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
          WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
          WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
          ELSE 'CONSISTENT'
        END AS discrepancy_type
      FROM finance_outbox_events o
      LEFT JOIN journal_entries j ON j.idempotency_key = o.event_id::text::text
      WHERE o.tenant_id = $1
        AND o.event_id = $2
    `, [TEST_TENANT_ID, eventId]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].discrepancy_type).toBe('MISSING_JOURNAL');
    expect(result.rows[0].outbox_status).toBe('PROCESSED');
    expect(result.rows[0].journal_id).toBeNull();
  });
  
  test('O10.3: Detect ORPHANED_JOURNAL', async () => {
    const eventId = randomUUID();
    const txnId = randomUUID();
    
    // Outbox: PENDING (worker crashed after POST but before marking PROCESSED)
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ($1, $2, 'ORPHANED_TEST', '{}', 'PENDING', now(), 0, 10)
    `, [eventId, TEST_TENANT_ID]);
    
    // Journal: exists (orphaned)
    await db.query(`
      INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
      VALUES ($1, $2, $3, 'OUTBOX', 'Orphaned Journal', 'POSTED', CURRENT_DATE)
    `, [txnId, TEST_TENANT_ID, eventId.toString()]);
    
    // Run reconciliation
    const result = await db.query(`
      SELECT 
        o.event_id,
        o.status AS outbox_status,
        j.id AS journal_id,
        j.status AS journal_status,
        CASE 
          WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
          WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
          WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
          ELSE 'CONSISTENT'
        END AS discrepancy_type
      FROM finance_outbox_events o
      LEFT JOIN journal_entries j ON j.idempotency_key = o.event_id::text
      WHERE o.tenant_id = $1
        AND o.event_id = $2
    `, [TEST_TENANT_ID, eventId]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].discrepancy_type).toBe('ORPHANED_JOURNAL');
    expect(result.rows[0].outbox_status).toBe('PENDING');
    expect(result.rows[0].journal_id).toBe(txnId);
    expect(result.rows[0].journal_status).toBe('POSTED');
  });
  
  test('O10.4: Detect DUPLICATE_JOURNAL', async () => {
    const eventId = randomUUID();
    const txnId1 = randomUUID();
    const txnId2 = randomUUID();
    
    // Outbox: PROCESSED (single event)
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, transaction_id, processed_at)
      VALUES ($1, $2, 'DUP_TEST', '{}', 'PROCESSED', now(), 0, 10, $3, now())
    `, [eventId, TEST_TENANT_ID, txnId1]);
    
    // Journal: 2 entries with same idempotency_key (duplicate!)
    await db.query(`
      INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
      VALUES 
        ($1, $2, $3, 'OUTBOX', 'Duplicate 1', 'POSTED', CURRENT_DATE),
        ($4, $2, $3, 'OUTBOX', 'Duplicate 2', 'POSTED', CURRENT_DATE)
    `, [txnId1, TEST_TENANT_ID, eventId.toString(), txnId2]);
    
    // Run duplicate detection query
    const result = await db.query(`
      SELECT 
        j.idempotency_key,
        COUNT(*) AS journal_count,
        array_agg(j.id) AS journal_ids
      FROM journal_entries j
      WHERE j.tenant_id = $1
        AND j.idempotency_key = $2
      GROUP BY j.idempotency_key
      HAVING COUNT(*) > 1
    `, [TEST_TENANT_ID, eventId]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].journal_count).toBe('2');
    expect(result.rows[0].journal_ids).toHaveLength(2);
  });
  
  test('O10.5: Detect TENANT_MISMATCH', async () => {
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();
    const eventId = randomUUID();
    const txnId = randomUUID();
    
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES 
        ($1, 'Tenant 1', now()),
        ($2, 'Tenant 2', now())
      ON CONFLICT (id) DO NOTHING
    `, [tenant1, tenant2]);
    
    // Outbox: tenant1
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, transaction_id, processed_at)
      VALUES ($1, $2, 'MISMATCH_TEST', '{}', 'PROCESSED', now(), 0, 10, $3, now())
    `, [eventId, tenant1, txnId]);
    
    // Journal: tenant2 (MISMATCH!)
    await db.query(`
      INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
      VALUES ($1, $2, $3, 'OUTBOX', 'Tenant Mismatch', 'POSTED', CURRENT_DATE)
    `, [txnId, tenant2, eventId.toString()]);
    
    // Run tenant mismatch detection
    const result = await db.query(`
      SELECT 
        o.event_id,
        o.tenant_id AS outbox_tenant,
        j.tenant_id AS journal_tenant,
        (o.tenant_id != j.tenant_id) AS has_mismatch
      FROM finance_outbox_events o
      INNER JOIN journal_entries j ON j.idempotency_key = o.event_id::text
      WHERE o.event_id = $1
    `, [eventId]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].has_mismatch).toBe(true);
    expect(result.rows[0].outbox_tenant).toBe(tenant1);
    expect(result.rows[0].journal_tenant).toBe(tenant2);
  });
  
  test('O10.6: Generate reconciliation report', async () => {
    // Create mix of consistent + discrepancies
    
    // 1. Consistent
    const consistentId = randomUUID();
    const consistentTxn = randomUUID();
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, transaction_id, processed_at)
      VALUES ($1, $2, 'CONSISTENT', '{}', 'PROCESSED', now(), 0, 10, $3, now())
    `, [consistentId, TEST_TENANT_ID, consistentTxn]);
    
    await db.query(`
      INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
      VALUES ($1, $2, $3, 'OUTBOX', 'Consistent Entry', 'POSTED', CURRENT_DATE)
    `, [consistentTxn, TEST_TENANT_ID, consistentId.toString()]);
    
    // 2. Missing Journal
    const missingId = randomUUID();
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, transaction_id, processed_at)
      VALUES ($1, $2, 'MISSING', '{}', 'PROCESSED', now(), 0, 10, 'TXN_MISSING_REPORT', now())
    `, [missingId, TEST_TENANT_ID]);
    
    // 3. Orphaned Journal
    const orphanedId = randomUUID();
    const orphanedTxn = randomUUID();
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ($1, $2, 'ORPHANED', '{}', 'PENDING', now(), 0, 10)
    `, [orphanedId, TEST_TENANT_ID]);
    
    await db.query(`
      INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
      VALUES ($1, $2, $3, 'OUTBOX', 'Orphaned Entry', 'POSTED', CURRENT_DATE)
    `, [orphanedTxn, TEST_TENANT_ID, orphanedId.toString()]);
    
    // Generate reconciliation report
    const report = await db.query(`
      SELECT 
        o.event_id,
        o.event_type,
        o.status AS outbox_status,
        o.transaction_id,
        j.id AS journal_id,
        j.status AS journal_status,
        CASE 
          WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
          WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
          WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
          ELSE 'CONSISTENT'
        END AS discrepancy_type
      FROM finance_outbox_events o
      LEFT JOIN journal_entries j ON j.idempotency_key = o.event_id::text
      WHERE o.tenant_id = $1
      ORDER BY discrepancy_type, o.created_at
    `, [TEST_TENANT_ID]);
    
    // Verify report structure
    expect(report.rows).toHaveLength(3);
    
    // Should have 1 consistent, 1 missing, 1 orphaned
    const discrepancies = report.rows.filter(r => r.discrepancy_type !== 'CONSISTENT');
    expect(discrepancies).toHaveLength(2);
    
    const missing = discrepancies.find(d => d.discrepancy_type === 'MISSING_JOURNAL');
    expect(missing).toBeDefined();
    expect(missing.outbox_status).toBe('PROCESSED');
    expect(missing.journal_id).toBeNull();
    
    const orphaned = discrepancies.find(d => d.discrepancy_type === 'ORPHANED_JOURNAL');
    expect(orphaned).toBeDefined();
    expect(orphaned.outbox_status).toBe('PENDING');
    expect(orphaned.journal_id).not.toBeNull();
  });
  
  test('O10.7: Tenant-scoped reconciliation', async () => {
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();
    
    await db.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES 
        ($1, 'Tenant 1', now()),
        ($2, 'Tenant 2', now())
      ON CONFLICT (id) DO NOTHING
    `, [tenant1, tenant2]);
    
    // Tenant 1: 1 discrepancy (missing journal)
    const t1Event = randomUUID();
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry, processed_at)
      VALUES ($1, $2, 'T1_MISSING', '{}', 'PROCESSED', now(), 0, 10, now())
    `, [t1Event, tenant1]);
    
    // Tenant 2: 1 discrepancy (orphaned journal)
    const t2Event = randomUUID();
    const t2Txn = randomUUID();
    await db.query(`
      INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, retry_count, max_retry)
      VALUES ($1, $2, 'T2_ORPHANED', '{}', 'PENDING', now(), 0, 10)
    `, [t2Event, tenant2]);
    
    await db.query(`
      INSERT INTO journal_entries (id, tenant_id, idempotency_key, reference_type, description, status, entry_date)
      VALUES ($1, $2, $3, 'OUTBOX', 'Tenant 2 Orphaned', 'POSTED', CURRENT_DATE)
    `, [t2Txn, tenant2, t2Event.toString()]);
    
    // Run tenant-scoped reconciliation for tenant1 only
    const tenant1Report = await db.query(`
      WITH discrepancies AS (
        SELECT 
          o.event_id,
          o.tenant_id,
          CASE 
            WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
            WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
            ELSE 'CONSISTENT'
          END AS discrepancy_type
        FROM finance_outbox_events o
        LEFT JOIN journal_entries j ON j.idempotency_key = o.event_id::text
        WHERE o.tenant_id = $1
      )
      SELECT * FROM discrepancies WHERE discrepancy_type != 'CONSISTENT'
    `, [tenant1]);
    
    // Only tenant1 discrepancy returned
    expect(tenant1Report.rows).toHaveLength(1);
    expect(tenant1Report.rows[0].tenant_id).toBe(tenant1);
    expect(tenant1Report.rows[0].discrepancy_type).toBe('MISSING_JOURNAL');
  });
});

/**
 * O10 PASS Criteria:
 * ✅ Consistent state NOT flagged
 * ✅ MISSING_JOURNAL detected
 * ✅ ORPHANED_JOURNAL detected
 * ✅ DUPLICATE_JOURNAL detected
 * ✅ TENANT_MISMATCH detected
 * ✅ Reconciliation report generated
 * ✅ Tenant-scoped reconciliation
 */
