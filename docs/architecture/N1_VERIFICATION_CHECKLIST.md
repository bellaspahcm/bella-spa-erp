# N1 Failure Isolation — Infrastructure Verification

**Date:** 2026-08-17  
**Status:** ✅ Infrastructure Verified | ❌ Behavioral Proof PENDING

**IMPORTANT:** This document verifies N1 **infrastructure only**. N1 behavioral proof (5 proofs) has NOT been tested yet. This is NOT an N1 PASS certificate.

---

## Current Status Lock

**N1:** 🟡 **PARTIAL** (Infrastructure ready, behavioral proof pending)  
**H1.1:** 🟡 **PARTIAL**  
**H1.2:** 🔒 **LOCKED**

---

## ✅ Schema Verification

### Table: `finance_outbox_events`

**Columns Added:**
- ✅ `max_retries` (integer, default 5)
- ✅ `next_retry_at` (timestamptz, default NOW())
- ✅ `last_error` (text, nullable)
- ✅ `claimed_by` (text, nullable) — Worker ID
- ✅ `claimed_at` (timestamptz, nullable)
- ✅ `lease_expires_at` (timestamptz, nullable)
- ✅ `processed_at` (timestamptz, nullable)

**Payload Type:**
- ✅ Changed from TEXT → JSONB

**Status Constraint:**
- ✅ Updated to include: PENDING, PROCESSING, PROCESSED, FAILED, DISPATCHED

---

## ✅ Functions Verification

**Created Functions:**
1. ✅ `claim_finance_outbox_batch(p_worker_id, p_lease_duration_seconds, p_limit)`
   - Returns: id, tenant_id, event_type, payload, retry_count, event_id
   - Uses FOR UPDATE SKIP LOCKED ✅
   - Sets lease (claimed_by, claimed_at, lease_expires_at) ✅
   
2. ✅ `mark_finance_outbox_processed(p_outbox_id)`
   - Sets status = PROCESSED ✅
   - Sets processed_at = NOW() ✅
   - Clears lease (claimed_by, claimed_at, lease_expires_at = NULL) ✅
   
3. ✅ `mark_finance_outbox_failed(p_outbox_id, p_error)`
   - Increments retry_count ✅
   - Calculates exponential backoff (next_retry_at) ✅
   - Sets status = FAILED if max_retries exceeded ✅
   - Sets status = PENDING if retry eligible ✅
   - Clears lease ✅
   
4. ✅ `cleanup_stale_finance_outbox_leases()`
   - Resets PROCESSING → PENDING where lease_expires_at < NOW() ✅
   - Returns count of cleaned records ✅

---

## ✅ Indexes Verification

**Created Indexes:**
1. ✅ `idx_finance_outbox_pending` 
   - (status, tenant_id, next_retry_at) 
   - WHERE status IN ('PENDING', 'FAILED')
   - Purpose: Worker polling optimization
   
2. ✅ `idx_finance_outbox_stale_leases`
   - (status, lease_expires_at)
   - WHERE status = 'PROCESSING'
   - Purpose: Stale lease cleanup
   
3. ✅ `idx_finance_outbox_processed`
   - (tenant_id, processed_at)
   - WHERE status = 'PROCESSED'
   - Purpose: Observability queries

**Existing Indexes (preserved):**
- ✅ `finance_outbox_events_pkey` (id) — Primary key
- ✅ `idx_finance_outbox_event_id` (tenant_id, event_id)

---

## ✅ View Verification

**Created View:**
- ✅ `finance_outbox_health_metrics`
  - Columns: tenant_id, pending_count, processing_count, failed_count, processed_count, avg_processing_latency_seconds, oldest_pending_at
  - Purpose: Per-tenant observability

---

## ✅ Function Execution Tests

### Test 1: claim_finance_outbox_batch()
```sql
SELECT * FROM claim_finance_outbox_batch('test-worker', 60, 10);
```
**Result:** ✅ Returned 10 events (batch limit respected)
- ✅ Status updated to PROCESSING
- ✅ claimed_by = 'test-worker'
- ✅ lease_expires_at set to NOW() + 60s
- ✅ retry_count incremented

### Test 2: cleanup_stale_finance_outbox_leases()
```sql
SELECT cleanup_stale_finance_outbox_leases();
```
**Result:** ✅ Returned 0 (no stale leases, all leases still valid)

### Test 3: Manual lease reset
```sql
UPDATE finance_outbox_events 
SET status = 'PENDING', claimed_by = NULL, claimed_at = NULL, lease_expires_at = NULL 
WHERE status = 'PROCESSING';
```
**Result:** ✅ 10 records reset from PROCESSING → PENDING

---

## ✅ Data Verification

### Current State (2026-08-17 08:00 UTC)

**Total Events:** 366

**Status Breakdown:**
- PENDING: 366 (100%)
- PROCESSING: 0 (after cleanup)
- PROCESSED: 0 (no successful deliveries yet)
- FAILED: 0 (no permanent failures)

**Tenant Distribution:** 27 tenants with pending events

**Health Metrics Sample (tenant: de6b89b2-5731-43da-9055-6567cf80c50b):**
- pending_count: 36
- processing_count: 0
- failed_count: 0
- processed_count: 0
- avg_processing_latency_seconds: NULL (no processed events yet)
- oldest_pending_at: 2026-08-15 23:16:59.51454+00 (24+ hours old)

---

## ⏳ Pending Verification

### 1. Worker Execution Test
**Status:** NOT YET TESTED

**Test Steps:**
```bash
# Start Finance OS
cd ../finance-os && npm run dev

# Run worker
npm run worker:finance-outbox

# Expected:
# - Worker claims batch (10 events)
# - POSTs to Finance OS /v1/events
# - Finance OS returns 201 or ALREADY_PROCESSED
# - Outbox status → PROCESSED
# - Worker logs show processing
```

### 2. Failure Scenario Test
**Status:** NOT YET TESTED

**Test Steps:**
```bash
# STOP Finance OS
# Run worker
npm run worker:finance-outbox

# Expected:
# - Worker claims batch
# - POST fails (connection refused)
# - Outbox status → PENDING (retry eligible)
# - retry_count incremented
# - next_retry_at calculated (exponential backoff)
# - Worker logs show failure
```

### 3. E2E Integration Test
**Status:** NOT YET TESTED

**Test Steps:**
```bash
# Run E2E test
npm run test:n1

# Expected:
# - Hospital transaction creates outbox entry
# - Returns outboxId (not Finance OS response)
# - Outbox entry PENDING
# - Worker processes (if Finance OS UP)
# - Journal created in Finance OS
# - Outbox status → PROCESSED
```

### 4. Idempotency Test
**Status:** NOT YET TESTED

**Test Steps:**
```bash
# Process same event twice
# 1. Worker processes event → PROCESSED
# 2. Force status back to PENDING
# 3. Worker processes again
# Expected: Finance OS returns ALREADY_PROCESSED, no duplicate journal
```

### 5. Exponential Backoff Test
**Status:** NOT YET TESTED

**Test Steps:**
```bash
# Verify retry timing
# retry_count 0 → next_retry_at = NOW() + 10s
# retry_count 1 → next_retry_at = NOW() + 20s
# retry_count 2 → next_retry_at = NOW() + 40s
# retry_count 3 → next_retry_at = NOW() + 80s
# retry_count 4 → next_retry_at = NOW() + 160s
# retry_count 5 → status = FAILED (permanent)
```

---

## ✅ Code Implementation Verification

### Files Created:
1. ✅ `supabase/migrations/20260817000001_n1_finance_outbox_hardening.sql`
2. ✅ `src/platform/integration-hub/finance-outbox-writer.ts`
3. ✅ `src/platform/integration-hub/finance-outbox-worker.ts`
4. ✅ `src/platform/integration-hub/finance-outbox-worker.cli.ts`
5. ✅ `scripts/test-n1-failure-isolation.ts`
6. ✅ `docs/architecture/N1_FAILURE_ISOLATION_IMPLEMENTATION.md`

### Files Modified:
1. ✅ `src/platform/healthcare/finance-integration/hospital-finance-adapter.ts`
   - Return type changed: `Promise<FinanceEventResult>` → `Promise<FinanceOutboxWriteResult>`
   - All methods now call `outboxWriter.writeToOutbox()` instead of `publisher.publish()`
   
2. ✅ `package.json`
   - Added: `"worker:finance-outbox": "npx tsx src/platform/integration-hub/finance-outbox-worker.cli.ts"`
   - Added: `"test:n1": "npx tsx scripts/test-n1-failure-isolation.ts"`
   
3. ✅ `src/types/database.types.ts`
   - Regenerated with new `finance_outbox_events` schema

---

## Type Safety Verification

**Import Paths Fixed:**
- ✅ All files use relative imports (no `@/` in platform/integration-hub)
- ✅ `Database` type imported as `type { Database }` (not value import)
- ✅ `uuid` package imported correctly

**TypeScript Compilation:**
- ⏳ NOT YET TESTED (requires `npm run build` or `tsc --noEmit`)

---

## Architecture Compliance

✅ **N1 boundary = Integration/Resilience layer**
- Outbox and worker implemented in `src/platform/integration-hub/`
- NOT in `src/platform/finance/` (F1-F4 Kernel frozen)

✅ **Tenant Isolation**
- `tenant_id` foreign key enforced
- All functions respect tenant_id
- Health metrics per-tenant

✅ **Atomic Commit**
- Outbox write uses same Supabase client transaction
- Hospital business data + outbox event in single COMMIT

✅ **Idempotency Preserved**
- Finance OS G7 gate handles duplicate events
- Worker doesn't re-process PROCESSED events
- idempotency_key passed through to Finance OS

✅ **Exponential Backoff**
- Formula: `10 * 2^retry_count` seconds (capped at 3600s)
- Implemented in `mark_finance_outbox_failed()`

✅ **Concurrency Control**
- FOR UPDATE SKIP LOCKED in `claim_finance_outbox_batch()`
- Lease mechanism (claimed_by, lease_expires_at)
- Multiple workers supported

✅ **Observability**
- Structured JSON logs in worker
- `finance_outbox_health_metrics` view
- Worker ID tracking (claimed_by)

✅ **Recovery**
- `cleanup_stale_finance_outbox_leases()` on worker startup
- Status transition: PROCESSING → PENDING for expired leases
- Max retries: 5 (configurable)

---

## Next Steps

1. ⏳ **Run Worker Against Existing 366 PENDING Events**
   ```bash
   # Terminal 1: Finance OS
   cd ../finance-os && npm run dev
   
   # Terminal 2: Worker
   npm run worker:finance-outbox
   ```
   
2. ⏳ **Monitor Processing**
   ```sql
   -- Watch status changes
   SELECT status, COUNT(*) FROM finance_outbox_events GROUP BY status;
   
   -- Watch health metrics
   SELECT * FROM finance_outbox_health_metrics ORDER BY pending_count DESC;
   ```
   
3. ⏳ **Verify Finance OS Journals Created**
   ```sql
   -- Check journal entries created
   SELECT COUNT(*) FROM finance_journal_entries 
   WHERE created_at > '2026-08-17 08:00:00';
   ```
   
4. ⏳ **Test Failure Scenario**
   ```bash
   # STOP Finance OS
   # Run worker
   # Verify retry logic + exponential backoff
   ```
   
5. ⏳ **Collect Evidence for 5 Proofs**
   - P1: Finance DOWN → Hospital SUCCESS
   - P2: Event durable in outbox
   - P3: Worker async processing
   - P4: Finance recovery → Journal POSTED
   - P5: Retry → ALREADY_PROCESSED, 1 journal
   
6. ⏳ **Update H1_1_E2E_TEST_RESULTS.md**
   - Add N1 section with raw evidence
   - Status: N1 🟡 → 🟢 FULL PASS
   - Status: H1.1 🟡 PARTIAL → 🟢 PROVEN

---

**Schema & Infrastructure:** ✅ **VERIFIED**  
**Worker Execution:** ⏳ **PENDING**  
**E2E Test:** ⏳ **PENDING**  
**Evidence Collection:** ⏳ **PENDING**
