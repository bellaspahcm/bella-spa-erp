# N1 Failure Isolation — Raw Evidence

**Test Date:** 2026-08-17 08:45 UTC  
**Test Status:** 🟡 PENDING MANUAL EXECUTION  
**Baseline:** H1.1 PARTIAL PASS (G1-G7 ✅, N2 ✅, N3 ✅, N1 🟡)

---

## Pre-Test Configuration ✅

### Finance OS Endpoint

**Status:** ✅ **CONFIRMED**

**Endpoint:** `http://localhost:3000/api/finance/v1/events`

**Architecture:** Finance OS is same Next.js app (not separate service)
- Route: `src/app/api/finance/v1/events/route.ts`
- GET /api/finance/v1/events → Health check
- POST /api/finance/v1/events → Event ingestion

**Health Check:**
```bash
curl http://localhost:3000/api/finance/v1/events
```

**Result (2026-08-17 08:50 UTC):**
```json
{
  "status":"ok",
  "service":"Finance OS Event API",
  "version":"v1.0",
  "endpoints":{"post":"/api/finance/v1/events - Receive finance events"}
}
```

**Status:** ✅ Finance OS UP and operational

---

### Worker Event Isolation

**Issue:** Standard worker (`npm run worker:finance-outbox`) processes ALL PENDING events  
**Risk:** Would process 366 backlog events + N1 test event simultaneously

**Solution:** ✅ Created test-mode worker with event filtering

**File:** `src/platform/integration-hub/finance-outbox-worker-test.ts`

**Usage:**
```bash
npx tsx src/platform/integration-hub/finance-outbox-worker-test.ts evt-n1-failure-isolation-[TIMESTAMP]
```

**Behavior:**
1. Claims batch (up to 100 events)
2. Filters for event matching pattern
3. Releases non-matching events back to PENDING
4. Processes ONLY the test event
5. POSTs to Finance OS
6. Updates outbox status

**Isolation:** ✅ 366 backlog events remain untouched

---

## Phase 1: Baseline Verification ✅

**Timestamp:** 2026-08-17 08:45:00 UTC

**N1 Test Events:**
```sql
SELECT COUNT(*) as count FROM finance_outbox_events 
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```
**Result:** 0 ✅

**N1 Test Idempotency:**
```sql
SELECT COUNT(*) as count FROM finance_event_idempotency 
WHERE idempotency_key LIKE '%N1-TEST%';
```
**Result:** 0 ✅

**Baseline Status:** ✅ CLEAN (no existing N1 test data)

---

## Phase 2: Finance DOWN ⏳ MANUAL EXECUTION REQUIRED

### Step 1: Finance OS Status Check

**Command:**
```bash
curl http://localhost:3001/v1/health
```

**Expected (Finance DOWN):**
```
curl: (7) Failed to connect to localhost port 3001: Connection refused
```

**Expected (Finance UP - need to stop):**
```
HTTP 200 OK
{"status":"healthy"}
```

**Action if Finance UP:**
```bash
# Terminal 1: Stop Finance OS process
cd ../finance-os
# If running: Ctrl+C or kill process
```

**Verify DOWN:**
```bash
curl http://localhost:3001/v1/health
# Must show: Connection refused
```

**📸 Evidence P1a Required:**
- [ ] Timestamp of Finance OS stop
- [ ] curl output showing connection refused
- [ ] Screenshot or log of Finance OS process stopped

---

## Phase 3: Hospital SUCCESS (Finance DOWN) ⏳ MANUAL EXECUTION REQUIRED

### Step 1: Create Hospital Transaction

**Pre-requisite:** Finance OS must be DOWN (verified above)

**Command:**
```bash
npm run test:n1
```

**Expected Output:**
```
🧪 N1 Failure Isolation E2E Test

📌 Step 1: Check Finance OS status
   Finance OS: 🔴 DOWN

📌 Step 2: Create Hospital transaction (PATIENT_SERVICE_COMPLETED)
   ✅ Hospital transaction SUCCESS
   Outbox ID: [UUID]
   Event ID: evt-n1-failure-isolation-[TIMESTAMP]
   Idempotency Key: [tenant_id]_PATIENT_SERVICE_COMPLETED_encounter_[ID]

✅ P1 EVIDENCE: Finance DOWN → Hospital SUCCESS

📌 Step 3: Verify finance_outbox_events (PENDING)
   Status: PENDING
   Retry Count: 0
   Created At: [TIMESTAMP]

✅ P2 EVIDENCE: Event durable in outbox (PENDING)
```

**📸 Evidence P1b Required:**
- [ ] HTTP response: 200 or 201
- [ ] outboxId returned
- [ ] eventId: evt-n1-failure-isolation-[TIMESTAMP]
- [ ] Timestamp

---

### Step 2: Verify Outbox Entry

**Query:**
```sql
SELECT 
  id,
  event_id,
  event_type,
  status,
  retry_count,
  created_at,
  next_retry_at,
  tenant_id
FROM finance_outbox_events
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- event_type: PATIENT_SERVICE_COMPLETED
- status: PENDING
- retry_count: 0
- tenant_id: f47ac10b-58cc-4372-a567-0e02b2c3d479

**📸 Evidence P2 Required:**
- [ ] SQL query result
- [ ] Status = PENDING
- [ ] retry_count = 0
- [ ] Timestamp

---

### Step 3: Verify Atomic Commit

**Hospital Business Data:**
```sql
SELECT * FROM hc_encounters 
WHERE encounter_id LIKE 'ENC-N1-TEST-%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** Encounter exists ✅

**Outbox Event:**
```sql
SELECT * FROM finance_outbox_events 
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%'
LIMIT 1;
```

**Expected:** Outbox entry exists ✅

**📸 Evidence: Atomic Commit Required:**
- [ ] Both Hospital data AND outbox exist (or both fail)
- [ ] Same transaction boundary

---

## P1 Summary: Finance DOWN → Hospital SUCCESS

**Status:** ⏳ PENDING

**Required Evidence:**
- [ ] Finance OS DOWN (connection refused)
- [ ] Hospital HTTP 200/201
- [ ] outboxId returned
- [ ] No synchronous Finance call blocked Hospital

**Result:** ✅ PASS | ❌ FAIL | ⏳ NOT TESTED

---

## P2 Summary: Event Durable in Outbox

**Status:** ⏳ PENDING

**Required Evidence:**
- [ ] Outbox entry exists
- [ ] status = PENDING
- [ ] retry_count = 0
- [ ] Payload contains business context

**Result:** ✅ PASS | ❌ FAIL | ⏳ NOT TESTED

---

## Phase 4: Finance UP → Worker Recovery ⏳ MANUAL EXECUTION REQUIRED

### Step 1: START Finance OS

**Command:**
```bash
# Terminal 1: Finance OS
cd ../finance-os
npm run dev
```

**Verify UP:**
```bash
curl http://localhost:3001/v1/health
```

**Expected:**
```
HTTP 200 OK
{"status":"healthy"}
```

**📸 Evidence P3a Required:**
- [ ] Timestamp of Finance OS start
- [ ] curl output showing 200 OK
- [ ] Finance OS ready to receive events

---

### Step 2: Run Worker (Controlled - N1 Test Event Only)

**⚠️ CRITICAL:** Worker must process ONLY N1 test event, not 366 backlog

**Option A: Manual event claim (SQL)**
```sql
-- Manually claim N1 test event
WITH claimed AS (
  SELECT id
  FROM finance_outbox_events
  WHERE event_id::text LIKE 'evt-n1-failure-isolation-%'
    AND status = 'PENDING'
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE finance_outbox_events e
SET 
  status = 'PROCESSING',
  claimed_by = 'manual-n1-test',
  claimed_at = NOW(),
  lease_expires_at = NOW() + INTERVAL '60 seconds',
  retry_count = retry_count + 1
FROM claimed
WHERE e.id = claimed.id
RETURNING e.id, e.event_id, e.payload;
```

**Then POST to Finance OS manually:**
```bash
curl -X POST http://localhost:3001/v1/events \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: f47ac10b-58cc-4372-a567-0e02b2c3d479" \
  -d '[PASTE payload from query above]'
```

**Option B: Worker with filter (if available)**
```bash
# Only if worker supports event filtering
npm run worker:finance-outbox --event-filter='evt-n1-failure-isolation-%'
```

**Option C: Isolate 366 backlog temporarily**
```sql
-- Mark backlog as PROCESSING with far-future lease (temporary isolation)
UPDATE finance_outbox_events
SET 
  status = 'PROCESSING',
  claimed_by = 'isolated-for-n1-test',
  lease_expires_at = NOW() + INTERVAL '1 hour'
WHERE status = 'PENDING'
  AND event_id::text NOT LIKE 'evt-n1-failure-isolation-%';
-- Returns: 366 rows updated

-- Now run worker (will only see N1 test event)
npm run worker:finance-outbox

-- After N1 test, restore backlog
UPDATE finance_outbox_events
SET 
  status = 'PENDING',
  claimed_by = NULL,
  lease_expires_at = NULL
WHERE claimed_by = 'isolated-for-n1-test';
```

**📸 Evidence P3b Required:**
- [ ] Worker logs showing batch claimed
- [ ] Worker logs showing event processed
- [ ] POST to Finance OS /v1/events
- [ ] Finance OS response (201 or 200)
- [ ] Duration/latency

---

### Step 3: Verify Outbox Status

**Query:**
```sql
SELECT 
  status,
  processed_at,
  retry_count,
  last_error,
  claimed_by
FROM finance_outbox_events
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```

**Expected:**
- status: PROCESSED
- processed_at: [timestamp]
- retry_count: 1
- last_error: NULL

**📸 Evidence P4a Required:**
- [ ] status = PROCESSED
- [ ] processed_at exists
- [ ] retry_count = 1
- [ ] No error

---

### Step 4: Verify Finance Idempotency Record

**Query:**
```sql
SELECT 
  idempotency_key,
  transaction_id,
  status,
  created_at
FROM finance_event_idempotency
WHERE idempotency_key LIKE '%N1-TEST%';
```

**Expected:** 1 row (event processed by Finance OS)

**📸 Evidence P4b Required:**
- [ ] Idempotency record created
- [ ] transaction_id exists
- [ ] status indicates successful processing

---

## P3 Summary: Worker Async Processing

**Status:** ⏳ PENDING

**Required Evidence:**
- [ ] Worker claimed event
- [ ] Worker POSTed to Finance OS
- [ ] Processing completed asynchronously
- [ ] No blocking on Hospital request path

**Result:** ✅ PASS | ❌ FAIL | ⏳ NOT TESTED

---

## P4 Summary: Finance Recovery → Journal POSTED

**Status:** ⏳ PENDING

**Required Evidence:**
- [ ] Outbox status = PROCESSED
- [ ] Finance idempotency record created
- [ ] Finance transaction recorded
- [ ] No duplicate processing

**Result:** ✅ PASS | ❌ FAIL | ⏳ NOT TESTED

---

## Phase 5: Duplicate Retry ⏳ MANUAL EXECUTION REQUIRED

### Step 1: Force Event Back to PENDING

**Query:**
```sql
-- Reset ONLY N1 test event
UPDATE finance_outbox_events
SET 
  status = 'PENDING',
  retry_count = 0,
  next_retry_at = NOW(),
  claimed_by = NULL,
  claimed_at = NULL,
  lease_expires_at = NULL,
  processed_at = NULL
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```

**Expected:** 1 row updated

---

### Step 2: Run Worker Again

**Use same worker approach as Phase 4 Step 2**

**Expected Finance OS Response:**
```json
{
  "status": "ALREADY_PROCESSED",
  "transaction_id": "[same as before]",
  "message": "Event already processed via idempotency key"
}
```

**📸 Evidence P5a Required:**
- [ ] Worker processed event again
- [ ] Finance OS returned ALREADY_PROCESSED
- [ ] Same transaction_id as first processing

---

### Step 3: Verify Idempotency Record Count

**Query:**
```sql
SELECT COUNT(*) as count
FROM finance_event_idempotency
WHERE idempotency_key LIKE '%N1-TEST%';
```

**Expected:** 1 (NOT 2)

**Detailed Query:**
```sql
SELECT 
  idempotency_key,
  transaction_id,
  status,
  created_at,
  updated_at
FROM finance_event_idempotency
WHERE idempotency_key LIKE '%N1-TEST%'
ORDER BY created_at;
```

**Expected:** Single row (no duplicate)

**📸 Evidence P5b Required:**
- [ ] Idempotency count = 1
- [ ] Same transaction_id
- [ ] No duplicate record created

---

## P5 Summary: Retry → ALREADY_PROCESSED

**Status:** ⏳ PENDING

**Required Evidence:**
- [ ] Finance OS returned ALREADY_PROCESSED
- [ ] Idempotency record count = 1
- [ ] No duplicate transaction
- [ ] G7 idempotency working correctly

**Result:** ✅ PASS | ❌ FAIL | ⏳ NOT TESTED

---

## Final Summary

| Proof | Requirement | Status | Result |
|-------|-------------|--------|--------|
| **P1** | Finance DOWN → Hospital SUCCESS | ⏳ NOT TESTED | - |
| **P2** | Event durable in outbox (PENDING) | ⏳ NOT TESTED | - |
| **P3** | Worker async processing | ⏳ NOT TESTED | - |
| **P4** | Finance recovery → Transaction recorded | ⏳ NOT TESTED | - |
| **P5** | Retry → ALREADY_PROCESSED, no duplicate | ⏳ NOT TESTED | - |

---

## N1 Final Result

**Current Status:** 🟡 **PARTIAL** (Awaiting manual execution)

**If 5/5 PASS:**
- N1: 🟡 PARTIAL → 🟢 **FULL PASS**
- H1.1: 🟡 PARTIAL → 🟢 **PROVEN**
- H1.2: 🔒 LOCKED → 🔓 **UNLOCKED**

**If ANY FAIL:**
- N1: 🟡 **PARTIAL** (remains)
- H1.1: 🟡 **PARTIAL** (remains)
- H1.2: 🔒 **LOCKED** (remains)

---

## Execution Notes

**Prerequisites:**
1. Finance OS running and accessible
2. Finance OS endpoint configured in environment
3. F1-F4 Kernel operational in Finance OS
4. G7 idempotency working in Finance OS

**Critical Constraints:**
- ✅ Use ONLY controlled N1 test event
- ❌ Do NOT process 366 backlog events
- ✅ Finance OS must be actually DOWN (not mocked)
- ✅ Collect raw evidence for all phases
- ✅ No inferred success without observed facts

**Worker Isolation Options:**
1. Manual SQL claim + curl POST
2. Worker with event filter (if available)
3. Temporary isolation of 366 backlog (safest)

---

**Next Action:** Manual execution by user following this guide  
**Expected Duration:** 15-30 minutes  
**Blocker:** Finance OS endpoint configuration required
