# N1 Failure Isolation — Controlled Test Execution Guide

**Objective:** Collect behavioral evidence for 5 N1 proofs using controlled test event

**Status:** Infrastructure ready, awaiting behavioral test execution

---

## 🚫 CRITICAL: Do NOT Drain 366 Event Backlog

**Existing state:**
- 366 PENDING events in `finance_outbox_events`
- Events from 2026-08-15/16 (production backlog)
- 27 tenants affected

**❌ DO NOT RUN:**
```bash
npm run worker:finance-outbox  # Would process all 366 events
```

**Reason:** Cannot distinguish N1 test evidence from backlog processing. Need controlled experiment with known event ID.

---

## ✅ Correct Execution Protocol

### Phase 0: Pre-Test Baseline

**1. Verify Finance OS is UP:**
```bash
curl http://localhost:3001/v1/health
```
Expected: `200 OK`

**2. Check baseline (no existing N1 test data):**
```sql
-- No N1 test events
SELECT COUNT(*) FROM finance_outbox_events 
WHERE event_id LIKE 'evt-n1-failure-isolation-%';
-- Expected: 0

-- No N1 test journals
SELECT COUNT(*) FROM finance_journal_entries 
WHERE idempotency_key LIKE '%N1-TEST%';
-- Expected: 0
```

**3. Document baseline in `docs/testing/N1_RAW_EVIDENCE.md`**

---

### Phase A: Finance DOWN → Hospital SUCCESS

**Step 1: STOP Finance OS**

**Terminal 1 (Finance OS):**
```bash
# If Finance OS is running, stop it
# Ctrl+C or kill process
```

**Verify Finance OS is DOWN:**
```bash
curl http://localhost:3001/v1/health
```
Expected: `curl: (7) Failed to connect to localhost port 3001: Connection refused`

**📸 Evidence P1a: Finance OS DOWN (timestamp + curl output)**

---

**Step 2: Create Hospital Transaction**

**Terminal 2 (Hospital OS):**
```bash
npm run test:n1
```

**Expected output:**
```
🧪 N1 Failure Isolation E2E Test

📌 Step 1: Check Finance OS status
   Finance OS: 🔴 DOWN

📌 Step 2: Create Hospital transaction (PATIENT_SERVICE_COMPLETED)
   ✅ Hospital transaction SUCCESS
   Outbox ID: [UUID]
   Event ID: evt-n1-failure-isolation-[TIMESTAMP]
   Idempotency Key: [KEY]

📌 Step 3: Verify finance_outbox_events (PENDING)
   Status: PENDING
   Retry Count: 0
   Created At: [TIMESTAMP]

✅ P1 EVIDENCE: Finance DOWN → Hospital SUCCESS

✅ P2 EVIDENCE: Event durable in outbox (PENDING)
```

**📸 Evidence P1b: Hospital SUCCESS (HTTP 200/201, outboxId returned)**

---

**Step 3: Verify Outbox Entry**

```sql
SELECT id, event_id, status, retry_count, created_at, payload
FROM finance_outbox_events
WHERE event_id LIKE 'evt-n1-failure-isolation-%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- status = 'PENDING'
- retry_count = 0
- payload contains encounter/service data

**📸 Evidence P2: Outbox PENDING (SQL query result + timestamp)**

---

**Step 4: Verify Atomic Commit**

```sql
-- Hospital business data committed
SELECT * FROM hc_encounters 
WHERE encounter_id LIKE 'ENC-N1-TEST-%'
ORDER BY created_at DESC
LIMIT 1;
-- Must exist

-- Outbox committed in same transaction
SELECT * FROM finance_outbox_events 
WHERE event_id LIKE 'evt-n1-failure-isolation-%'
LIMIT 1;
-- Must exist
```

**📸 Evidence: Both exist (atomic commit verified)**

---

### Phase B: Finance UP → Worker Recovery

**Step 1: START Finance OS**

**Terminal 1 (Finance OS):**
```bash
cd ../finance-os
npm run dev
```

**Verify Finance OS is UP:**
```bash
curl http://localhost:3001/v1/health
```
Expected: `200 OK`

**📸 Evidence P3a: Finance OS UP (timestamp + curl output)**

---

**Step 2: Run Worker (Controlled Duration)**

**Terminal 3 (Worker):**
```bash
# Option A: Run worker and watch logs
npm run worker:finance-outbox

# Option B: Run worker for specific duration, then stop
timeout 30s npm run worker:finance-outbox
# Or manually Ctrl+C after event processed
```

**Expected worker logs:**
```json
{
  "timestamp": "2026-08-17T08:30:00.000Z",
  "level": "info",
  "worker": "worker-12345",
  "message": "batch_claimed",
  "count": 1
}
{
  "timestamp": "2026-08-17T08:30:01.234Z",
  "level": "info",
  "worker": "worker-12345",
  "message": "event_processed",
  "outbox_id": "[UUID]",
  "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "event_type": "PATIENT_SERVICE_COMPLETED",
  "retry_count": 1,
  "duration_ms": 234
}
```

**📸 Evidence P3b: Worker processed async (worker logs + timestamp)**

---

**Step 3: Verify Outbox Status**

```sql
SELECT status, processed_at, retry_count, last_error
FROM finance_outbox_events
WHERE event_id LIKE 'evt-n1-failure-isolation-%';
```

**Expected:**
- status = 'PROCESSED'
- processed_at = [timestamp]
- retry_count = 1
- last_error = NULL

**📸 Evidence P4a: Outbox PROCESSED (SQL query result)**

---

**Step 4: Verify Finance Journal**

```sql
-- Count journals
SELECT COUNT(*) FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%';
-- Expected: 1

-- Journal details
SELECT id, tenant_id, idempotency_key, status, created_at
FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%'
ORDER BY created_at;
```

**Expected:** 1 row (ONE journal entry)

**📸 Evidence P4b: Journal POSTED (SQL query result showing 1 entry)**

---

### Phase C: Duplicate Retry

**Step 1: Force Event Back to PENDING**

```sql
-- Reset specific N1 test event only
UPDATE finance_outbox_events
SET status = 'PENDING',
    retry_count = 0,
    next_retry_at = NOW(),
    claimed_by = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    processed_at = NULL
WHERE event_id LIKE 'evt-n1-failure-isolation-%';
```

**Expected:** 1 row updated

---

**Step 2: Run Worker Again**

**Terminal 3 (Worker):**
```bash
npm run worker:finance-outbox
# Or timeout 30s npm run worker:finance-outbox
```

**Expected worker logs:**
```json
{
  "timestamp": "2026-08-17T08:35:00.000Z",
  "level": "info",
  "worker": "worker-12345",
  "message": "event_processed",
  "outbox_id": "[UUID]",
  "event_id": "evt-n1-failure-isolation-[TIMESTAMP]",
  "duration_ms": 123
}
```

**📸 Evidence P5a: Worker retry (worker logs)**

---

**Step 3: Verify Finance OS Response**

**Check Finance OS logs for:**
```
POST /v1/events
Status: 200 OK (or ALREADY_PROCESSED response)
```

**Or check worker logs for Finance OS response**

**📸 Evidence P5b: ALREADY_PROCESSED (Finance OS logs or worker logs)**

---

**Step 4: Verify Journal Count**

```sql
-- Count journals
SELECT COUNT(*) FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%';
-- Expected: 1 (NOT 2)

-- All journals
SELECT id, idempotency_key, status, created_at
FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%'
ORDER BY created_at;
```

**Expected:** Still 1 row (no duplicate created)

**📸 Evidence P5c: Journal count = 1 (SQL query result)**

---

## Evidence Collection Checklist

Create file: `docs/testing/N1_RAW_EVIDENCE.md` (use template from `N1_RAW_EVIDENCE_TEMPLATE.md`)

**Required Evidence:**

- [ ] P1a: Finance OS DOWN (curl output + timestamp)
- [ ] P1b: Hospital SUCCESS (HTTP 200/201 response + outboxId)
- [ ] P2: Outbox PENDING (SQL query result)
- [ ] Atomic commit verified (Hospital data + outbox both exist)
- [ ] P3a: Finance OS UP (curl output + timestamp)
- [ ] P3b: Worker processed async (worker logs)
- [ ] P4a: Outbox PROCESSED (SQL query result)
- [ ] P4b: Journal POSTED (SQL query showing 1 entry)
- [ ] P5a: Worker retry (worker logs)
- [ ] P5b: ALREADY_PROCESSED (Finance OS response)
- [ ] P5c: Journal count = 1 (SQL query result)

---

## Post-Test Verification

**If all 5 proofs PASS:**

1. **Update `docs/testing/H1_1_E2E_TEST_RESULTS.md`:**
   - Add N1 section with raw evidence
   - N1: 🟡 PARTIAL → 🟢 FULL PASS
   - H1.1: 🟡 PARTIAL → 🟢 PROVEN

2. **Status transition:**
   ```
   N1   🟡 → 🟢 FULL PASS
   H1.1 🟡 → 🟢 PROVEN
   H1.2 🔒 → 🔓 UNLOCKED
   ```

3. **Notify for H1.2 planning**

---

**If ANY proof FAILS:**

1. **Diagnose failure:**
   - Which proof failed?
   - What was expected vs actual?
   - Which component failed? (outbox write, worker, Finance OS, idempotency)

2. **Fix implementation**

3. **Rerun full test protocol**

4. **N1 remains 🟡 PARTIAL until 5/5 PASS**

---

## Important Notes

**Controlled Test Requirements:**
- ✅ Single test event with known ID pattern
- ✅ Finance OS actually DOWN (not mocked)
- ✅ Hospital transaction actually succeeds
- ✅ Worker actually processes asynchronously
- ✅ Finance OS actually receives POST
- ✅ Idempotency actually prevents duplicate

**Do NOT Accept:**
- ❌ Mocked Finance failure
- ❌ Synchronous execution
- ❌ Inferred success without evidence
- ❌ Schema existence as behavioral proof
- ❌ Function execution without end-to-end flow
- ❌ Processing 366 backlog events as N1 test

**Evidence Standards:**
- ✅ Raw SQL query results (not summarized)
- ✅ Raw HTTP responses (not paraphrased)
- ✅ Raw worker logs (not interpreted)
- ✅ Timestamps for all phases
- ✅ Observed facts only (no inferences)

---

**Ready to execute:** ✅ Infrastructure prepared  
**Awaiting:** 👤 User execution of controlled test  
**Next:** Collect 5 behavioral proofs → N1 FULL PASS or diagnose failures
