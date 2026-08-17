# N1 Failure Isolation — Implementation Summary

**Status:** ✅ Implementation Complete (Testing Pending)  
**Baseline:** H1.1 PARTIAL PASS → N1 Hardening  
**Date:** 2026-08-17

---

## Overview

N1 Failure Isolation ensures Hospital OS can complete business transactions even when Finance OS is unavailable, with guaranteed eventual delivery of financial events.

**Pattern:** Transactional Outbox + Async Worker

---

## Architecture

```
Hospital Business Transaction
    ↓
┌────────────────────────────────┐
│ BEGIN TRANSACTION              │
│                                │
│ 1. Hospital Business Data      │
│    (hc_encounters, etc.)       │
│                                │
│ 2. finance_outbox_events       │
│    INSERT (PENDING)            │
│                                │
│ COMMIT ✅                       │
└────────────────────────────────┘
    ↓
Hospital returns 200/201
(Finance availability irrelevant)
    ↓
┌────────────────────────────────┐
│ Async Worker (separate process)│
│                                │
│ 1. SELECT PENDING events       │
│ 2. Claim batch (lease)         │
│ 3. POST Finance OS             │
│ 4. UPDATE status               │
│    - Success → PROCESSED       │
│    - Failure → retry_count++   │
│ 5. Exponential backoff         │
└────────────────────────────────┘
```

---

## Implementation Files

### 1. Database Schema & Functions

**File:** `supabase/migrations/20260817000001_n1_finance_outbox_hardening.sql`

**Schema Extensions:**
- `finance_outbox_events` table extended with:
  - `max_retries`, `next_retry_at`, `last_error` (retry logic)
  - `claimed_by`, `claimed_at`, `lease_expires_at` (lease mechanism)
  - `processed_at` (completion tracking)
  - Status: PENDING → PROCESSING → PROCESSED/FAILED
  - Payload: TEXT → JSONB (structured envelope)

**Functions:**
- `claim_finance_outbox_batch(p_worker_id, p_lease_duration_seconds, p_limit)`
  - Atomically claims batch with FOR UPDATE SKIP LOCKED
  - Returns: id, tenant_id, event_type, payload, retry_count, event_id
  
- `mark_finance_outbox_processed(p_outbox_id)`
  - Marks event as PROCESSED, clears lease
  
- `mark_finance_outbox_failed(p_outbox_id, p_error)`
  - Increments retry_count
  - Calculates exponential backoff: 10s → 20s → 40s → 80s → 160s
  - FAILED (permanent) if max_retries exceeded
  
- `cleanup_stale_finance_outbox_leases()`
  - Resets PROCESSING events with expired leases → PENDING
  - Worker crash recovery

**Indexes:**
- `idx_finance_outbox_pending` (status, tenant_id, next_retry_at) WHERE status IN ('PENDING', 'FAILED')
- `idx_finance_outbox_stale_leases` (status, lease_expires_at) WHERE status = 'PROCESSING'
- `idx_finance_outbox_processed` (tenant_id, processed_at) WHERE status = 'PROCESSED'

**View:**
- `finance_outbox_health_metrics` (per-tenant observability)

---

### 2. Outbox Writer

**File:** `src/platform/integration-hub/finance-outbox-writer.ts`

**Class:** `FinanceOutboxWriter`

**Responsibilities:**
- Generate FinanceEventEnvelope (same logic as FinanceEventPublisher)
- Write to `finance_outbox_events` (PENDING status)
- Validate event parameters
- Generate idempotency key

**Usage:**
```typescript
const writer = new FinanceOutboxWriter(supabase, {
  sourceSystem: 'HOSPITAL_OS',
  sourceVersion: '1.0.0',
  maxRetries: 5
});

const result = await writer.writeToOutbox({
  eventType: 'PATIENT_SERVICE_COMPLETED',
  tenantId: 'tenant_a',
  amount: '500000',
  currency: 'VND',
  businessContext: {...},
  businessReferences: [...]
});

// Returns: { outboxId, eventId, idempotencyKey }
```

**Key Difference from FinanceEventPublisher:**
- ✅ Writes to outbox (durable)
- ✅ Returns immediately (no HTTP call)
- ❌ Does NOT POST to Finance OS (worker does that)

---

### 3. Async Worker

**File:** `src/platform/integration-hub/finance-outbox-worker.ts`

**Class:** `FinanceOutboxWorker`

**Responsibilities:**
- Poll `finance_outbox_events` for PENDING/FAILED events
- Claim batch with lease (concurrency control)
- POST to Finance OS `/v1/events`
- Update status based on response
- Exponential backoff on failure
- Cleanup stale leases on startup

**Configuration:**
```typescript
const worker = new FinanceOutboxWorker(supabase, {
  financeOsEndpoint: 'http://localhost:3001',
  workerId: 'worker-12345',
  batchSize: 10,
  leaseDurationSeconds: 60,
  pollIntervalMs: 5000,
  timeoutMs: 30000,
  verbose: true
});
```

**Modes:**
1. **Continuous:** `await worker.start()` (runs forever)
2. **One-shot:** `await worker.processOnce()` (for cron jobs)

**Concurrency:**
- Multiple workers supported via lease mechanism
- `FOR UPDATE SKIP LOCKED` prevents duplicate processing
- Lease duration: 60 seconds (configurable)

**Recovery:**
- Stale lease cleanup on startup
- Exponential backoff: 10s → 20s → 40s → 80s → 160s (max 1 hour)
- Max retries: 5 (configurable)

---

### 4. Worker CLI

**File:** `src/platform/integration-hub/finance-outbox-worker.cli.ts`

**Usage:**
```bash
# Run worker continuously
npm run worker:finance-outbox

# Or directly
npx tsx src/platform/integration-hub/finance-outbox-worker.cli.ts
```

**Environment Variables:**
- `FINANCE_OS_URL` or `NEXT_PUBLIC_FINANCE_OS_URL` (required)
- `NEXT_PUBLIC_SUPABASE_URL` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (required)
- `WORKER_BATCH_SIZE` (default: 10)
- `WORKER_POLL_INTERVAL_MS` (default: 5000)
- `WORKER_VERBOSE` (default: false)

**Graceful Shutdown:**
- Handles SIGINT/SIGTERM
- Stops polling, completes current batch

---

### 5. Hospital Finance Adapter (Modified)

**File:** `src/platform/healthcare/finance-integration/hospital-finance-adapter.ts`

**Changes:**
- Constructor: `HospitalFinanceAdapter(supabase, outboxWriter)` (was `financeEventPublisher`)
- Return type: `Promise<FinanceOutboxWriteResult>` (was `Promise<FinanceEventResult>`)
- All methods now call `outboxWriter.writeToOutbox()` instead of `publisher.publish()`

**Impact:**
- Hospital transactions no longer block on Finance OS availability ✅
- Events written to durable outbox ✅
- Async worker handles Finance OS POST ✅

**Methods Updated:**
- `publishPatientServiceCompleted()`
- `publishPatientPaymentReceived()`
- `publishPatientRefundIssued()`
- `publishMedicationDispensed()`
- `publishMedicationStockReceived()`
- `publishSupplierPrepaymentMade()`
- `publishSupplierPaymentMade()`
- `publishInsuranceServiceCompleted()`
- `publishInsuranceSettlementReceived()`

---

### 6. E2E Test Script

**File:** `scripts/test-n1-failure-isolation.ts`

**Usage:**
```bash
npm run test:n1
```

**Test Sequence:**
1. Check Finance OS status (should be DOWN for full test)
2. Create Hospital transaction (PATIENT_SERVICE_COMPLETED)
3. Verify Hospital returns 200/201 ✅ (P1 evidence)
4. Verify `finance_outbox_events` has PENDING entry ✅ (P2 evidence)
5. Run worker once
6. Verify outbox status (PROCESSED if Finance UP, FAILED/PENDING if Finance DOWN)
7. Verify journal count = 1 ✅ (P4 evidence)
8. Retry worker (should skip PROCESSED events)
9. Verify journal count still = 1 ✅ (P5 evidence)

**Evidence Collection:**
- P1: Finance DOWN → Hospital SUCCESS
- P2: Event durable in outbox (PENDING)
- P3: Worker async processing
- P4: Finance recovery → Journal POSTED
- P5: Retry → ALREADY_PROCESSED, 1 journal

---

## NPM Scripts

**Added to `package.json`:**
```json
{
  "scripts": {
    "worker:finance-outbox": "npx tsx src/platform/integration-hub/finance-outbox-worker.cli.ts",
    "test:n1": "npx tsx scripts/test-n1-failure-isolation.ts"
  }
}
```

---

## Deployment

### Development

**Terminal 1: Hospital OS**
```bash
npm run dev
```

**Terminal 2: Finance OS**
```bash
cd ../finance-os
npm run dev
```

**Terminal 3: Worker**
```bash
npm run worker:finance-outbox
```

### Production

**Option A: Standalone Worker Process**
```bash
# systemd service or Docker container
node dist/platform/integration-hub/finance-outbox-worker.cli.js
```

**Option B: Serverless Cron (Vercel/AWS Lambda)**
```typescript
// api/cron/finance-outbox.ts
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }
  
  const worker = new FinanceOutboxWorker(supabase, {...});
  await worker.processOnce();
  
  res.status(200).json({ success: true });
}
```

---

## Testing Plan

### Step 1: Schema Verification
```bash
npx supabase db query --linked "SELECT * FROM finance_outbox_events LIMIT 1"
npx supabase db query --linked "SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%finance_outbox%'"
```

### Step 2: Unit Test (Outbox Write)
```bash
npm run test:n1
# Should create outbox entry even if Finance OS is down
```

### Step 3: Worker Test (Finance UP)
```bash
# Start Finance OS
cd ../finance-os && npm run dev

# Run worker
npm run worker:finance-outbox

# Check logs for event processing
```

### Step 4: Failure Test (Finance DOWN)
```bash
# Stop Finance OS
# Run test
npm run test:n1

# Should see:
# - Hospital SUCCESS ✅
# - Outbox PENDING ✅
# - Worker retry scheduled ✅

# Start Finance OS
# Run worker again
npm run worker:finance-outbox

# Should see:
# - Outbox PROCESSED ✅
# - Journal created ✅
```

### Step 5: Evidence Collection

**Query 1: Outbox entry**
```sql
SELECT * FROM finance_outbox_events 
WHERE id = '<outbox_id>';
```

**Query 2: Journal entry**
```sql
SELECT * FROM finance_journal_entries 
WHERE tenant_id = '<tenant_id>' 
  AND idempotency_key = '<idempotency_key>';
```

**Query 3: Outbox health**
```sql
SELECT * FROM finance_outbox_health_metrics 
WHERE tenant_id = '<tenant_id>';
```

---

## Success Criteria (5 Proofs)

| Proof | Requirement | Evidence |
|-------|-------------|----------|
| **P1** | Finance DOWN → Hospital SUCCESS | HTTP 200/201 response |
| **P2** | Event durable in Outbox | `finance_outbox_events` row (PENDING) |
| **P3** | Worker processes async | Worker logs + timestamp gap |
| **P4** | Finance recovery → Journal POSTED | `finance_journal_entries` count = 1 |
| **P5** | Retry → ALREADY_PROCESSED, 1 journal | Finance OS response + journal count |

---

## Next Steps

1. ✅ **Implementation Complete**
2. ⏳ **Execute E2E Test** (Finance DOWN → Hospital SUCCESS)
3. ⏳ **Collect Raw Evidence** (5 proofs)
4. ⏳ **Audit Evidence** (confirm 5/5 PASS)
5. ⏳ **Update H1_1_E2E_TEST_RESULTS.md** (N1 section)
6. ⏳ **N1 🟡 → 🟢 FULL PASS**
7. ⏳ **H1.1 🟡 PARTIAL → 🟢 PROVEN**
8. ⏳ **Unlock H1.2**

---

## Files Modified

**Created:**
- `supabase/migrations/20260817000001_n1_finance_outbox_hardening.sql`
- `src/platform/integration-hub/finance-outbox-writer.ts`
- `src/platform/integration-hub/finance-outbox-worker.ts`
- `src/platform/integration-hub/finance-outbox-worker.cli.ts`
- `scripts/test-n1-failure-isolation.ts`
- `docs/architecture/N1_FAILURE_ISOLATION_IMPLEMENTATION.md`

**Modified:**
- `src/platform/healthcare/finance-integration/hospital-finance-adapter.ts`
- `package.json` (added npm scripts)
- `src/types/database.types.ts` (regenerated with new schema)

**NOT Modified:**
- ❌ `src/platform/finance/*` (F1-F4 Kernel frozen)
- ❌ Any Accounting Kernel files
- ❌ `docs/testing/H1_1_E2E_TEST_RESULTS.md` (update after evidence collected)

---

## Architecture Compliance

✅ **N1 boundary = Integration/Resilience layer** (NOT Kernel)  
✅ **F1-F4 Kernel unchanged**  
✅ **Tenant isolation enforced** (foreign key + RLS-ready)  
✅ **Atomic commit** (outbox + business data same transaction)  
✅ **Idempotency preserved** (Finance OS G7 handles duplicate events)  
✅ **Exponential backoff** (10s → 20s → 40s → 80s → 160s)  
✅ **Concurrency control** (FOR UPDATE SKIP LOCKED + lease)  
✅ **Observability** (structured logs + health metrics view)  
✅ **Recovery** (stale lease cleanup + max retries)

---

**Status:** ✅ Ready for E2E testing and evidence collection
