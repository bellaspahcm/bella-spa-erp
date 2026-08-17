# H1.2 Implementation Plan

**Date:** 2026-08-17  
**Constitution:** v1.3 AMENDED (APPROVED + FROZEN)  
**Purpose:** Translate frozen Constitution into executable implementation

---

## Plan Authority

**Constitution Status:** 🔒 FROZEN (v1.3 APPROVED 2026-08-17)

**This plan:**
- ✅ Implements Constitution v1.3 (no architecture changes)
- ✅ Respects H1.1 FROZEN baseline
- ✅ Respects F1-F4 FROZEN Kernel
- ✅ Addresses A1-A5 + C1-C3 clarifications

**This plan does NOT:**
- ❌ Redesign architecture
- ❌ Modify frozen boundaries
- ❌ Expand scope beyond O1-O10
- ❌ Touch H1.1 evidence or baseline

---

## Implementation Overview

**Goal:** Implement H1.2 Operational Resilience guarantees (O1-O10)

**Components:**
1. Schema Extensions (additive only)
2. Worker Implementation (claim, retry, recovery)
3. Replay/Bulk Operations (operator control)
4. Observability (metrics queries)
5. Reconciliation (detect-only)
6. Security Boundary (DB roles)
7. Compatibility Tests (NEW, H1.1 untouched)
8. Verification Gates (O1-O10 behavioral tests)

**Timeline:** Schema → Worker → Operations → Observability → Security → Tests → Verification

---

## 1. Schema Extensions

### 1.1 Extend `finance_outbox_events` Table

**Constraint:** Additive only (H1.1 compatibility)

**New Columns:**

```sql
-- Retry Policy (O1)
ALTER TABLE finance_outbox_events 
ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN next_retry_at TIMESTAMPTZ,
ADD COLUMN max_retry INTEGER DEFAULT 10 NOT NULL;

-- Failure Classification (O2)
ALTER TABLE finance_outbox_events
ADD COLUMN failure_classification TEXT CHECK (failure_classification IN ('TRANSIENT', 'PERMANENT', 'POISON', 'UNKNOWN')),
ADD COLUMN last_error TEXT,
ADD COLUMN last_attempt_at TIMESTAMPTZ,
ADD COLUMN first_attempt_at TIMESTAMPTZ;

-- Quarantine (O3, O5)
ALTER TABLE finance_outbox_events
ADD COLUMN quarantine_reason TEXT,
ADD COLUMN quarantined_at TIMESTAMPTZ,
ADD COLUMN poison_crash_count INTEGER DEFAULT 0;

-- Replay (O6)
ALTER TABLE finance_outbox_events
ADD COLUMN replayed_at TIMESTAMPTZ,
ADD COLUMN replayed_by TEXT;

-- All columns NULLABLE or DEFAULT (H1.1 compatibility)
```

**Indexes:**

```sql
-- Worker claim query optimization
CREATE INDEX idx_outbox_claim 
ON finance_outbox_events (status, next_retry_at, lease_expires_at) 
WHERE status IN ('PENDING', 'FAILED');

-- Quarantine queries (O5)
CREATE INDEX idx_outbox_quarantine 
ON finance_outbox_events (status, quarantine_reason, tenant_id)
WHERE status = 'QUARANTINED';

-- Observability (O7)
CREATE INDEX idx_outbox_metrics 
ON finance_outbox_events (status, created_at, processed_at);
```

**Migration Safety:**
- Additive only (no column removal, no type changes)
- All new columns: DEFAULT or NULLABLE
- H1.1 queries continue working (SELECT without new columns)
- H1.1 workers ignore new columns

---

### 1.2 Idempotency Key (A1 Clarification)

**Decision:** Use SHA256 hash

**Implementation:**

```sql
-- Idempotency key generation function
CREATE OR REPLACE FUNCTION generate_idempotency_key(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_source_transaction_id TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    digest(
      p_tenant_id::TEXT || '|' || p_event_type || '|' || p_source_transaction_id,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Store idempotency key in outbox event (optional, for traceability)
ALTER TABLE finance_outbox_events
ADD COLUMN idempotency_key TEXT;

-- Compute on event creation (Hospital side)
-- idempotency_key passed to Finance API
```

**Note:** Idempotency enforced at `finance_transactions(idempotency_key)` UNIQUE constraint (Finance API responsibility, H1.1 reuse)

---

### 1.3 Finance Transactions Idempotency (H1.1 Baseline)

**NO CHANGES** — Reuse H1.1 proven mechanism

**Existing (H1.1):**
```sql
-- Already exists in H1.1
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_transactions_idempotency
ON finance_transactions (idempotency_key);
```

**Finance API idempotency check (H1.1 proven):**
```typescript
// H1.1 code — NO MODIFICATION
async function createFinanceTransaction(request: FinanceRequest) {
  const existing = await db.query(
    'SELECT id FROM finance_transactions WHERE idempotency_key = $1',
    [request.idempotency_key]
  );
  
  if (existing.rows.length > 0) {
    return { status: 'ALREADY_PROCESSED', transaction_id: existing.rows[0].id };
  }
  
  // Create transaction + journal (atomic)
  // ...
}
```

**H1.2 reuses this, does NOT re-implement.**

---

## 2. Worker Implementation

### 2.1 Atomic Claim (A1, A2)

**File:** `src/platform/integration-hub/finance-outbox-worker.ts`

**Function:** `claimEvent()`

```typescript
async function claimEvent(workerId: string): Promise<OutboxEvent | null> {
  const result = await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PROCESSING',
      claimed_by = $1,
      claimed_at = now(),
      lease_expires_at = now() + interval '60 seconds'
    WHERE event_id = (
      SELECT event_id
      FROM finance_outbox_events
      WHERE status IN ('PENDING', 'FAILED')
        AND (next_retry_at IS NULL OR next_retry_at <= now())
        AND (lease_expires_at IS NULL OR lease_expires_at < now())
        AND claimed_by IS NULL
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `, [workerId]);
  
  if (result.rowCount === 0) {
    return null; // No events to process
  }
  
  if (result.rowCount !== 1) {
    throw new Error('Atomic claim violation'); // Should never happen
  }
  
  return result.rows[0];
}
```

**A1 Enforcement:**
- `WHERE claimed_by IS NULL` — Prevent double claim
- `FOR UPDATE SKIP LOCKED` — Prevent concurrent claims
- `RETURNING *` + `rowCount === 1` check — Verify atomic claim

---

### 2.2 Process Event

**Function:** `processEvent(event: OutboxEvent)`

```typescript
async function processEvent(event: OutboxEvent): Promise<void> {
  try {
    // POST to Finance API (H1.1 boundary)
    const response = await financeApiClient.post('/transactions', {
      idempotency_key: event.idempotency_key,
      tenant_id: event.tenant_id,
      event_type: event.event_type,
      payload: event.payload
    });
    
    if (response.status === 'ALREADY_PROCESSED') {
      // Idempotency hit (H1.1 proven mechanism)
      await markProcessed(event.event_id, response.transaction_id);
      return;
    }
    
    if (response.status === 'SUCCESS') {
      await markProcessed(event.event_id, response.transaction_id);
      return;
    }
    
    // Failure — classify and handle
    await handleFailure(event, response);
    
  } catch (error) {
    // Worker crash or network error
    // Lease will expire → Event returns to PENDING (A2 recovery)
    throw error; // Let worker crash, lease recovery handles it
  }
}
```

---

### 2.3 Mark Processed

**Function:** `markProcessed(eventId: string, transactionId: string)`

```typescript
async function markProcessed(eventId: string, transactionId: string): Promise<void> {
  await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PROCESSED',
      processed_at = now(),
      transaction_id = $2
    WHERE event_id = $1
      AND status = 'PROCESSING'
  `, [eventId, transactionId]);
}
```

---

### 2.4 Handle Failure (O1, O2, C1)

**Function:** `handleFailure(event: OutboxEvent, response: FinanceResponse)`

```typescript
async function handleFailure(event: OutboxEvent, response: FinanceResponse): Promise<void> {
  // O2: Classify failure
  const classification = classifyFailure(response);
  
  if (classification === 'PERMANENT') {
    // Quarantine immediately (no retry)
    await quarantineEvent(event.event_id, 'PERMANENT_FAILURE', response.error);
    return;
  }
  
  // TRANSIENT or UNKNOWN → Retry with backoff
  const newRetryCount = event.retry_count + 1;
  
  if (newRetryCount >= event.max_retry) {
    // Max retry exceeded → Quarantine
    await quarantineEvent(event.event_id, 'MAX_RETRY_EXCEEDED', response.error);
    return;
  }
  
  // C1: Increment retry_count in THIS transaction
  const nextRetryAt = calculateNextRetry(newRetryCount);
  
  await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'FAILED',
      retry_count = $2,
      next_retry_at = $3,
      last_error = $4,
      last_attempt_at = now(),
      failure_classification = $5
    WHERE event_id = $1
      AND status = 'PROCESSING'
  `, [
    event.event_id,
    newRetryCount,
    nextRetryAt,
    response.error,
    classification
  ]);
}
```

**O1: Exponential Backoff:**
```typescript
function calculateNextRetry(retryCount: number): Date {
  const baseInterval = 1000; // 1 second
  const backoffMs = Math.pow(2, retryCount) * baseInterval;
  return new Date(Date.now() + backoffMs);
}
// Retry intervals: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s
```

**O2: Failure Classification:**
```typescript
function classifyFailure(response: FinanceResponse): FailureClassification {
  if (response.status === 400 || response.status === 422) {
    return 'PERMANENT'; // Bad request, unprocessable
  }
  
  if (response.status === 503 || response.status === 504) {
    return 'TRANSIENT'; // Service unavailable, timeout
  }
  
  if (response.status === 500) {
    return 'TRANSIENT'; // Internal error (could be transient)
  }
  
  return 'UNKNOWN'; // Safe default: retry with backoff
}
```

---

### 2.5 Quarantine Event

**Function:** `quarantineEvent(eventId: string, reason: string, error: string)`

```typescript
async function quarantineEvent(
  eventId: string, 
  reason: string, 
  error: string
): Promise<void> {
  await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'QUARANTINED',
      quarantine_reason = $2,
      quarantined_at = now(),
      last_error = $3
    WHERE event_id = $1
      AND status IN ('PROCESSING', 'FAILED')
  `, [eventId, reason, error]);
}
```

---

### 2.6 Lease Recovery (O4)

**File:** `src/platform/integration-hub/finance-outbox-lease-recovery.ts`

**Cron Job:** Run every 30 seconds

```typescript
async function recoverStaleleases(): Promise<number> {
  const result = await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      claimed_by = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL
    WHERE status = 'PROCESSING'
      AND lease_expires_at < now()
    RETURNING event_id
  `);
  
  console.log(`Recovered ${result.rowCount} stale leases`);
  return result.rowCount;
}
```

**Deployment:** Kubernetes CronJob or equivalent

---

### 2.7 Poison Event Detection (O3)

**Strategy:** Track crash count, quarantine after threshold

**Implementation:** 
- Worker crash → Lease recovery → Event returns to PENDING
- If same event causes repeated crashes (detected via monitoring/logs), manually quarantine
- Automatic poison detection: Future enhancement (not in H1.2 scope)

**Manual Quarantine (Operator):**
```sql
-- Operator identifies poison event from logs
UPDATE finance_outbox_events
SET 
  status = 'QUARANTINED',
  quarantine_reason = 'POISON_EVENT',
  quarantined_at = now()
WHERE event_id = '<POISON_EVENT_ID>';
```

**Note:** Automatic poison detection requires crash tracking infrastructure (out of H1.2 scope, defer to H1.3 or future)

---

## 3. Replay / Bulk Operations

### 3.1 Manual Replay (O6, A4)

**File:** `src/platform/integration-hub/finance-outbox-replay.ts`

**Function:** `replayEvent(eventId: string, operatorId: string)`

```typescript
async function replayEvent(eventId: string, operatorId: string): Promise<ReplayResult> {
  // A4: Replay concurrency guard
  const result = await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      retry_count = 0,
      next_retry_at = NULL,
      replayed_at = now(),
      replayed_by = $2,
      claimed_by = NULL,
      lease_expires_at = NULL
    WHERE event_id = $1
      AND status = 'QUARANTINED'
      AND (claimed_by IS NULL OR lease_expires_at < now())
    RETURNING event_id
  `, [eventId, operatorId]);
  
  if (result.rowCount === 0) {
    return { 
      success: false, 
      reason: 'Event not QUARANTINED or currently being processed' 
    };
  }
  
  return { success: true, event_id: eventId };
}
```

**A4 Concurrency Safety:**
- `WHERE status = 'QUARANTINED'` — Cannot replay PROCESSED/PROCESSING
- `AND (claimed_by IS NULL OR lease_expires_at < now())` — Not currently processing
- `RETURNING event_id` + `rowCount` check — Only 1 replay succeeds

---

### 3.2 Bulk Replay (O9, C2)

**Function:** `replayBulk(quarantineReason: string, tenantId: string, limit: number)`

```typescript
async function replayBulk(
  quarantineReason: string, 
  tenantId: string, 
  operatorId: string,
  limit: number = 100 // Hard limit (C2)
): Promise<BulkReplayResult> {
  // Bounded batch size
  const clampedLimit = Math.min(limit, 100);
  
  const result = await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      retry_count = 0,
      next_retry_at = NULL,
      replayed_at = now(),
      replayed_by = $4,
      claimed_by = NULL,
      lease_expires_at = NULL
    WHERE event_id IN (
      SELECT event_id
      FROM finance_outbox_events
      WHERE status = 'QUARANTINED'
        AND quarantine_reason = $1
        AND tenant_id = $2
        AND (claimed_by IS NULL OR lease_expires_at < now())
      LIMIT $3
    )
    RETURNING event_id
  `, [quarantineReason, tenantId, clampedLimit, operatorId]);
  
  return {
    affected_count: result.rowCount,
    event_ids: result.rows.map(r => r.event_id)
  };
}
```

**C2 Clarification:**
- Not all replayed events will reach PROCESSED
- PERMANENT/POISON may remain QUARANTINED (valid outcome)
- Acceptance: All events processed through pipeline, not stuck

---

## 4. Observability (O7)

### 4.1 Health Metrics View

**File:** `src/platform/integration-hub/finance-outbox-observability.ts`

**Function:** `getOutboxHealth(tenantId?: string)`

```typescript
async function getOutboxHealth(tenantId?: string): Promise<OutboxHealth> {
  const tenantFilter = tenantId ? 'AND tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  
  const metrics = await db.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
      COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing_count,
      COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
      COUNT(*) FILTER (WHERE status = 'QUARANTINED') as quarantined_count,
      COUNT(*) FILTER (WHERE status = 'PROCESSED' AND processed_at > now() - interval '24 hours') as processed_count_24h,
      AVG(retry_count) FILTER (WHERE status IN ('FAILED', 'QUARANTINED')) as avg_retry_count,
      MIN(created_at) FILTER (WHERE status = 'PENDING') as oldest_pending_created_at,
      COUNT(*) FILTER (WHERE status = 'PROCESSING' AND lease_expires_at < now()) as stuck_processing_count,
      MAX(processed_at) as last_success,
      MAX(last_attempt_at) FILTER (WHERE status = 'FAILED') as last_failure
    FROM finance_outbox_events
    WHERE 1=1 ${tenantFilter}
  `, params);
  
  const row = metrics.rows[0];
  
  return {
    pending_count: parseInt(row.pending_count),
    processing_count: parseInt(row.processing_count),
    failed_count: parseInt(row.failed_count),
    quarantined_count: parseInt(row.quarantined_count),
    processed_count_24h: parseInt(row.processed_count_24h),
    avg_retry_count: parseFloat(row.avg_retry_count) || 0,
    oldest_pending_age_seconds: row.oldest_pending_created_at 
      ? (Date.now() - new Date(row.oldest_pending_created_at).getTime()) / 1000 
      : null,
    stuck_processing_count: parseInt(row.stuck_processing_count),
    last_success: row.last_success,
    last_failure: row.last_failure
  };
}
```

**O7: Observable facts, not dashboard UI (deferred)**

---

### 4.2 Dead Letter Queue Query (O5)

**Function:** `getQuarantinedEvents(tenantId: string, limit: number)`

```typescript
async function getQuarantinedEvents(
  tenantId: string, 
  limit: number = 100
): Promise<QuarantinedEvent[]> {
  const result = await db.query(`
    SELECT 
      event_id,
      tenant_id,
      event_type,
      status,
      quarantine_reason,
      failure_classification,
      retry_count,
      last_error,
      first_attempt_at,
      last_attempt_at,
      quarantined_at,
      created_at,
      payload
    FROM finance_outbox_events
    WHERE status = 'QUARANTINED'
      AND tenant_id = $1
    ORDER BY quarantined_at DESC
    LIMIT $2
  `, [tenantId, limit]);
  
  return result.rows;
}
```

---

## 5. Reconciliation (O10)

### 5.1 Detect Discrepancies (C3)

**File:** `src/platform/integration-hub/finance-outbox-reconciliation.ts`

**Security Context:** Uses `h1_2_reconciliation_readonly` role (SELECT-only)

**Function:** `reconcileOutboxLedger(tenantId: string)`

```typescript
async function reconcileOutboxLedger(tenantId: string): Promise<Discrepancy[]> {
  // C3: Connect with readonly role
  const readonlyDb = createReadonlyConnection(); // Uses h1_2_reconciliation_readonly
  
  const discrepancies = await readonlyDb.query(`
    SELECT 
      o.event_id,
      o.status AS outbox_status,
      o.tenant_id,
      o.idempotency_key,
      j.id AS journal_id,
      j.status AS journal_status,
      CASE 
        WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
        WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
        WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
        ELSE 'CONSISTENT'
      END AS discrepancy_type
    FROM finance_outbox_events o
    LEFT JOIN finance_transactions ft ON ft.idempotency_key = o.idempotency_key
    LEFT JOIN journal_entries j ON j.transaction_id = ft.id
    WHERE o.tenant_id = $1
      AND o.status IN ('PROCESSED', 'PENDING', 'FAILED')
    HAVING discrepancy_type != 'CONSISTENT'
  `, [tenantId]);
  
  return discrepancies.rows;
}
```

**O10: DETECT + FLAG only, NO auto-correction**

---

### 5.2 Reconciliation Report

**Function:** `generateReconciliationReport(tenantId: string)`

```typescript
async function generateReconciliationReport(tenantId: string): Promise<ReconciliationReport> {
  const discrepancies = await reconcileOutboxLedger(tenantId);
  
  return {
    tenant_id: tenantId,
    generated_at: new Date(),
    total_discrepancies: discrepancies.length,
    discrepancies_by_type: {
      missing_journal: discrepancies.filter(d => d.discrepancy_type === 'MISSING_JOURNAL').length,
      orphaned_journal: discrepancies.filter(d => d.discrepancy_type === 'ORPHANED_JOURNAL').length,
      tenant_mismatch: discrepancies.filter(d => d.discrepancy_type === 'TENANT_MISMATCH').length,
    },
    discrepancies: discrepancies,
    resolution_guidance: {
      MISSING_JOURNAL: 'Replay event (if Finance idempotency safe) OR manually create journal with evidence',
      ORPHANED_JOURNAL: 'Mark outbox PROCESSED (Finance already succeeded)',
      TENANT_MISMATCH: 'Data corruption detected — escalate to security team'
    }
  };
}
```

---

## 6. Security Boundary (A3, C3)

### 6.1 DB Roles

**Migration:** `migrations/xxx_create_h1_2_roles.sql`

```sql
-- H1.2 Worker Role
CREATE ROLE h1_2_worker LOGIN PASSWORD '<secure_password>';

-- Permissions
GRANT SELECT, INSERT, UPDATE ON finance_outbox_events TO h1_2_worker;
GRANT SELECT ON finance_transactions TO h1_2_worker; -- Idempotency check
REVOKE INSERT, UPDATE, DELETE ON finance_transactions FROM h1_2_worker;
REVOKE ALL ON journal_entries FROM h1_2_worker;
REVOKE ALL ON journal_lines FROM h1_2_worker;
REVOKE ALL ON accounts FROM h1_2_worker;
REVOKE ALL ON chart_of_accounts FROM h1_2_worker;

-- H1.2 Reconciliation Readonly Role
CREATE ROLE h1_2_reconciliation_readonly LOGIN PASSWORD '<secure_password>';

-- Permissions
GRANT SELECT ON finance_outbox_events TO h1_2_reconciliation_readonly;
GRANT SELECT ON finance_transactions TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_entries TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_lines TO h1_2_reconciliation_readonly;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES FROM h1_2_reconciliation_readonly;
```

**A3 Enforcement:** H1.2 role CANNOT mutate F1-F4 tables (DB-level enforcement)

---

### 6.2 Connection Configuration

**Worker:**
```typescript
// src/platform/integration-hub/db-connection.ts
export function createWorkerConnection() {
  return new Pool({
    user: 'h1_2_worker',
    password: process.env.H1_2_WORKER_DB_PASSWORD,
    database: 'bella_erp',
    // ...
  });
}
```

**Reconciliation:**
```typescript
export function createReadonlyConnection() {
  return new Pool({
    user: 'h1_2_reconciliation_readonly',
    password: process.env.H1_2_RECONCILIATION_DB_PASSWORD,
    database: 'bella_erp',
    // ...
  });
}
```

**C3 Verification:** Test mutation from readonly context → Permission denied

---

## 7. Compatibility Tests (A5)

### 7.1 NEW Test Suite (H1.1 Untouched)

**File:** `tests/integration/h1_2_backward_compatibility.test.ts`

**TC1: Old Event Format Compatibility**
```typescript
test('H1.2 worker handles H1.1-format events', async () => {
  // Create event without H1.2 columns
  const event = await createH1_1FormatEvent({
    tenant_id: TEST_TENANT,
    event_type: 'PATIENT_PAYMENT_RECEIVED',
    payload: { amount: 100, patient_id: 'P123' }
    // No retry_count, no failure_classification, etc.
  });
  
  // H1.2 worker processes event
  await h1_2_worker.processEvent(event);
  
  // Verify: Success (H1.2 handles missing columns with defaults)
  const result = await getOutboxEvent(event.event_id);
  expect(result.status).toBe('PROCESSED');
});
```

**TC2: Schema Additive Only**
```typescript
test('H1.2 schema extensions are non-breaking', async () => {
  // Verify new columns nullable or have defaults
  const schema = await getTableSchema('finance_outbox_events');
  const newColumns = ['retry_count', 'next_retry_at', 'failure_classification', ...];
  
  newColumns.forEach(col => {
    const column = schema.find(c => c.name === col);
    expect(column.nullable || column.hasDefault).toBe(true);
  });
  
  // Verify H1.1 queries still work
  const h1_1_query = 'SELECT event_id, tenant_id, event_type, status, created_at FROM finance_outbox_events';
  const result = await db.query(h1_1_query);
  expect(result.rows.length).toBeGreaterThan(0);
});
```

**TC3: Event Contract Stability**
```typescript
test('H1.1 event envelope unchanged', async () => {
  const h1_1_event = loadH1_1EventSample();
  const h1_2_event = createNewEvent();
  
  // Verify structure unchanged
  expect(h1_2_event).toHaveProperty('tenant_id');
  expect(h1_2_event).toHaveProperty('event_type');
  expect(h1_2_event).toHaveProperty('payload');
  expect(typeof h1_2_event.payload).toBe('object');
  
  // Verify Finance API contract unchanged
  const financeRequest = buildFinanceRequest(h1_2_event);
  expect(financeRequest).toMatchH1_1Contract();
});
```

**TC4: H1.1 Worker Compatibility** (if feasible)
```typescript
test.skip('H1.1 worker operates with H1.2 schema', async () => {
  // Deploy H1.2 schema
  await runMigrations();
  
  // Simulate H1.1 worker (SELECT without new columns)
  const h1_1_worker_query = `
    SELECT event_id, tenant_id, event_type, status, payload, created_at
    FROM finance_outbox_events
    WHERE status = 'PENDING'
    LIMIT 1
  `;
  const event = await db.query(h1_1_worker_query);
  
  // Verify H1.1 worker can process
  expect(event.rows.length).toBe(1);
});
```

**A5: H1.1 evidence untouched, NEW test suite proves compatibility**

---

## 8. Verification Gates (O1-O10)

### 8.1 Gate Test Mapping

| Gate | Test File | Key Scenarios |
|------|-----------|---------------|
| **O1** | `o1_retry_policy.test.ts` | Exponential backoff, max retry, quarantine after exhaustion, worker respects next_retry_at |
| **O2** | `o2_failure_classification.test.ts` | TRANSIENT (503), PERMANENT (422), POISON (crash cycles), UNKNOWN (novel error) |
| **O3** | `o3_poison_event.test.ts` | Deterministic crash detection, quarantine after threshold, healthy events not blocked |
| **O4** | `o4_lease_recovery.test.ts` | Worker crash, lease expiration, event returns to PENDING, next worker succeeds |
| **O5** | `o5_dead_letter.test.ts` | Quarantine visibility, metadata complete, filterable by tenant/reason |
| **O6** | `o6_manual_replay.test.ts` | Replay scenarios (orphaned, genuine, corrected), concurrency guard, idempotency |
| **O7** | `o7_observability.test.ts` | Metrics queries, counts accurate, tenant isolation, performance <1s |
| **O8** | `o8_alerting.test.ts` | Threshold detection (pending>1000, quarantine>100, stuck>10, lag>5min, failure_rate>50%) |
| **O9** | `o9_bulk_recovery.test.ts` | Bounded batch (100), mixed outcomes (PROCESSED, QUARANTINED valid), no duplicates, healthy events not blocked |
| **O10** | `o10_reconciliation.test.ts` | Detect discrepancies (orphaned, missing, duplicate, tenant mismatch), no auto-correct, readonly enforced |

---

### 8.2 Test Execution Order

**Phase 1: Foundation (O1, O2, O4)**
1. O1: Retry policy
2. O2: Failure classification
3. O4: Lease recovery

**Phase 2: Control (O5, O6, O9)**
4. O5: Dead letter visibility
5. O6: Manual replay
6. O9: Bulk recovery

**Phase 3: Intelligence (O7, O8, O10)**
7. O7: Observability metrics
8. O8: Alert thresholds
9. O10: Reconciliation

**Phase 4: Edge Cases (O3)**
10. O3: Poison event (requires crash simulation infrastructure)

---

### 8.3 Evidence Collection

**For each gate O1-O10:**
1. Execute test scenario
2. Capture state transitions (SQL queries before/after)
3. Capture worker logs (structured JSON)
4. Capture metrics snapshots
5. Verify acceptance criteria
6. Document evidence in `docs/testing/H1_2_Ox_EVIDENCE.md`

**Evidence Format:**
```markdown
# O1: Retry Policy Enforcement — Evidence

## Test Execution
- Date: 2026-08-XX
- Environment: Test
- Tenant: test-tenant-001

## Scenario: Exponential Backoff
### Before
```sql
SELECT event_id, status, retry_count, next_retry_at FROM finance_outbox_events WHERE event_id = '...';
-- event_id | status  | retry_count | next_retry_at
-- ...      | PENDING | 0           | NULL
```

### Action
Finance API returns 503 (TRANSIENT) → Worker handles failure

### After
```sql
-- event_id | status | retry_count | next_retry_at
-- ...      | FAILED | 1           | 2026-08-XX 10:00:01 (now + 1s)
```

### Subsequent Retries
- Retry 1: next_retry_at = now + 1s
- Retry 2: next_retry_at = now + 2s
- Retry 3: next_retry_at = now + 4s
- ...

### Acceptance
✅ Retry intervals follow exponential curve
✅ retry_count increments correctly
✅ Worker respects next_retry_at (no premature claims)
```

---

## 9. Deployment

### 9.1 Migration Sequence

1. **Schema Migration** (additive)
   ```bash
   npm run migrate:up -- migrations/xxx_h1_2_schema_extensions.sql
   ```

2. **DB Roles** (security boundary)
   ```bash
   npm run migrate:up -- migrations/xxx_create_h1_2_roles.sql
   ```

3. **Worker Deployment** (gradual rollout)
   - Deploy H1.2 worker alongside H1.1 worker (both can coexist)
   - H1.1 worker continues processing events without new columns
   - H1.2 worker processes events with retry/quarantine logic
   - Gradual traffic shift

4. **Lease Recovery Cron**
   ```bash
   kubectl apply -f k8s/h1-2-lease-recovery-cronjob.yaml
   ```

5. **Observability/Reconciliation Services** (read-only)

---

### 9.2 Rollback Plan

**If H1.2 fails:**
1. Stop H1.2 worker deployment
2. H1.1 worker continues (schema is backward compatible)
3. New columns ignored by H1.1
4. No data loss (outbox events remain intact)
5. Rollback code, NOT schema (schema is additive)

**Schema rollback NOT needed (additive extensions safe to keep)**

---

## 10. Success Criteria

**H1.2 is PROVEN when:**

1. ✅ All O1-O10 gates PASS with behavioral evidence
2. ✅ Five Core Questions answered:
   - Q1: No event loss (all in valid state)
   - Q2: No infinite retry (max enforced, quarantine works)
   - Q3: Worker crash recoverable (lease recovery proven)
   - Q4: Operator intervention works (replay successful, idempotency preserved)
   - Q5: No ledger duplicates/imbalance (idempotency + F1-F4 integrity intact)

3. ✅ H1.1 invariants still valid (P1-P5 not violated)
4. ✅ H1.2 invariants proven (I1-I3)
5. ✅ No F1-F4 Kernel modifications
6. ✅ Evidence collected and frozen
7. ✅ Backward compatibility tests PASS (TC1-TC4)

**Then:** H1.2 PROVEN + FROZEN → Unlock H1.3

---

## 11. Out of Scope

**NOT in H1.2 Implementation Plan:**
- Performance optimization (defer to H1.3)
- Load testing (defer to H1.3)
- Automatic poison event detection (requires crash tracking infrastructure)
- Dashboard UI (observability facts proven, UI is separate concern)
- Multi-region replication (future phase)
- Event versioning/migration (future phase)
- Processing 366 backlog (not test fixture)

---

## Approval Checklist

**Before coding:**
- [ ] Implementation Plan reviewed
- [ ] Plan implements Constitution v1.3 (no architecture changes)
- [ ] H1.1 baseline untouched
- [ ] F1-F4 Kernel untouched
- [ ] Security boundary enforceable
- [ ] Test strategy clear (O1-O10 mapped)
- [ ] Deployment strategy safe (gradual, rollback plan)
- [ ] Success criteria measurable

**If APPROVED:** Coding unlocked → Implement → Verify → Evidence → H1.2 PROVEN

---

**END OF IMPLEMENTATION PLAN**
