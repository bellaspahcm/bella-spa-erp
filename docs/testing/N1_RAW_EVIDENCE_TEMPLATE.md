# N1 Failure Isolation — Raw Evidence Collection

**Test Event ID:** evt-n1-failure-isolation-[TIMESTAMP]  
**Test Date:** [YYYY-MM-DD HH:MM UTC]  
**Tester:** [Name]  
**Baseline:** H1.1 PARTIAL PASS (G1-G7 ✅, N2 ✅, N3 ✅, N1 🟡)

---

## Pre-Test Baseline Verification

**Finance OS Status (before test):**
```bash
$ curl http://localhost:3001/v1/health
# Expected: 200 OK OR Connection refused (if already stopped)
```

**Outbox Baseline:**
```sql
SELECT COUNT(*) FROM finance_outbox_events 
WHERE event_id LIKE 'evt-n1-failure-isolation-%';
```
**Result:** [0]

**Journal Baseline:**
```sql
SELECT COUNT(*) FROM finance_journal_entries 
WHERE idempotency_key LIKE '%N1-TEST%';
```
**Result:** [0]

---

## Phase A: Finance DOWN → Hospital SUCCESS

### Step 1: STOP Finance OS

**Action:**
```bash
# Kill Finance OS process
# Verify unavailable:
curl http://localhost:3001/v1/health
```

**Finance OS Status:**
```
[PASTE OUTPUT]
Expected: curl: (7) Failed to connect to localhost port 3001: Connection refused
```

**Timestamp:** [YYYY-MM-DD HH:MM:SS UTC]

---

### Step 2: Create Hospital Transaction

**Action:**
```bash
npm run test:n1
```

**Hospital Response:**
```json
[PASTE OUTPUT]
Expected:
{
  "outboxId": "...",
  "eventId": "evt-n1-failure-isolation-...",
  "idempotencyKey": "..."
}
HTTP Status: 200/201
```

**Timestamp:** [YYYY-MM-DD HH:MM:SS UTC]

---

### P1 Evidence: Hospital SUCCESS (Finance DOWN)

**✅ PASS** | ❌ FAIL

**Evidence:**
- HTTP Status: [200/201]
- Response includes outboxId: [YES/NO]
- Finance OS was DOWN: [CONFIRMED]
- Hospital transaction completed: [CONFIRMED]

**Raw Data:**
```
[PASTE Hospital response + timestamp]
```

---

### Step 3: Verify Outbox Entry

**Query:**
```sql
SELECT id, event_id, status, retry_count, created_at, tenant_id, payload
FROM finance_outbox_events
WHERE event_id LIKE 'evt-n1-failure-isolation-%'
ORDER BY created_at DESC
LIMIT 1;
```

**Result:**
```
[PASTE QUERY RESULT]
Expected:
- status = 'PENDING'
- retry_count = 0
- event_id = evt-n1-failure-isolation-[TIMESTAMP]
```

---

### P2 Evidence: Event Durable in Outbox

**✅ PASS** | ❌ FAIL

**Evidence:**
- Outbox entry exists: [YES/NO]
- Status = PENDING: [YES/NO]
- retry_count = 0: [YES/NO]
- tenant_id correct: [YES/NO]

**Raw Data:**
```
[PASTE outbox row]
```

---

### Step 4: Verify Atomic Commit

**Hospital Business Data:**
```sql
SELECT * FROM hc_encounters 
WHERE encounter_id LIKE 'ENC-N1-TEST-%'
ORDER BY created_at DESC
LIMIT 1;
```

**Result:**
```
[PASTE RESULT]
Expected: Encounter exists
```

**Outbox Event:**
```sql
SELECT * FROM finance_outbox_events 
WHERE event_id LIKE 'evt-n1-failure-isolation-%'
LIMIT 1;
```

**Result:**
```
[PASTE RESULT]
Expected: Outbox entry exists
```

**✅ ATOMIC COMMIT VERIFIED** | ❌ NOT ATOMIC

---

## Phase B: Finance UP → Worker Recovery

### Step 1: START Finance OS

**Action:**
```bash
cd ../finance-os && npm run dev
# Verify available:
curl http://localhost:3001/v1/health
```

**Finance OS Status:**
```
[PASTE OUTPUT]
Expected: 200 OK
```

**Timestamp:** [YYYY-MM-DD HH:MM:SS UTC]

---

### Step 2: Run Worker (One Batch)

**Action:**
```bash
npm run worker:finance-outbox
# Or run for controlled duration, then stop
```

**Worker Logs:**
```
[PASTE WORKER OUTPUT]
Expected:
{
  "level": "info",
  "message": "batch_claimed",
  "count": 1,
  "worker_id": "..."
}
{
  "level": "info",
  "message": "event_processed",
  "outbox_id": "...",
  "event_id": "evt-n1-failure-isolation-...",
  "duration_ms": ...
}
```

**Timestamp:** [YYYY-MM-DD HH:MM:SS UTC]

---

### P3 Evidence: Worker Async Processing

**✅ PASS** | ❌ FAIL

**Evidence:**
- Worker claimed batch: [YES/NO]
- Worker processed event: [YES/NO]
- Processing duration: [... ms]
- Worker did NOT block Hospital transaction: [CONFIRMED]

**Raw Data:**
```
[PASTE worker logs]
```

---

### Step 3: Verify Outbox Status

**Query:**
```sql
SELECT status, processed_at, retry_count, claimed_by, last_error
FROM finance_outbox_events
WHERE event_id LIKE 'evt-n1-failure-isolation-%';
```

**Result:**
```
[PASTE RESULT]
Expected:
- status = 'PROCESSED'
- processed_at = [timestamp]
- retry_count = 1
- last_error = NULL
```

---

### Step 4: Verify Finance Journal

**Query:**
```sql
SELECT id, tenant_id, idempotency_key, status, created_at
FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%'
ORDER BY created_at DESC;
```

**Result:**
```
[PASTE RESULT]
Expected: 1 row (ONE journal entry)
```

**Journal Count:**
```sql
SELECT COUNT(*) FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%';
```
**Result:** [1]

---

### P4 Evidence: Finance Recovery → Journal POSTED

**✅ PASS** | ❌ FAIL

**Evidence:**
- Outbox status = PROCESSED: [YES/NO]
- Journal created: [YES/NO]
- Journal count = 1: [YES/NO]
- Finance OS received POST: [CONFIRMED]

**Raw Data:**
```
[PASTE outbox row + journal row]
```

---

## Phase C: Duplicate Retry

### Step 1: Force Event to PENDING

**Action:**
```sql
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

**Result:** [1 row updated]

---

### Step 2: Run Worker Again

**Action:**
```bash
npm run worker:finance-outbox
```

**Worker Logs:**
```
[PASTE WORKER OUTPUT]
Expected:
{
  "level": "info",
  "message": "event_processed",
  "event_id": "evt-n1-failure-isolation-...",
  "duration_ms": ...
}
```

**Timestamp:** [YYYY-MM-DD HH:MM:SS UTC]

---

### Step 3: Verify Finance OS Response

**Finance OS Logs (or worker logs):**
```
[PASTE Finance OS response]
Expected:
{
  "status": "ALREADY_PROCESSED",
  "message": "Event already processed via idempotency key"
}
```

---

### Step 4: Verify Journal Count

**Query:**
```sql
SELECT COUNT(*) FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%';
```

**Result:** [1]  
**Expected:** 1 (NOT 2)

**Detailed Query:**
```sql
SELECT id, idempotency_key, status, created_at
FROM finance_journal_entries
WHERE idempotency_key LIKE '%N1-TEST%'
ORDER BY created_at;
```

**Result:**
```
[PASTE RESULT]
Expected: 1 row only (no duplicate)
```

---

### P5 Evidence: Retry → ALREADY_PROCESSED, 1 Journal

**✅ PASS** | ❌ FAIL

**Evidence:**
- Finance OS returned ALREADY_PROCESSED: [YES/NO]
- Journal count still = 1: [YES/NO]
- No duplicate journal created: [CONFIRMED]
- Idempotency working: [CONFIRMED]

**Raw Data:**
```
[PASTE Finance response + journal query result]
```

---

## Summary

| Proof | Requirement | Status |
|-------|-------------|--------|
| **P1** | Finance DOWN → Hospital SUCCESS | [✅ PASS / ❌ FAIL] |
| **P2** | Event durable in outbox (PENDING) | [✅ PASS / ❌ FAIL] |
| **P3** | Worker async processing | [✅ PASS / ❌ FAIL] |
| **P4** | Finance recovery → Journal POSTED | [✅ PASS / ❌ FAIL] |
| **P5** | Retry → ALREADY_PROCESSED, 1 journal | [✅ PASS / ❌ FAIL] |

---

## N1 Final Result

**If 5/5 PASS:**
- N1: 🟡 PARTIAL → 🟢 **FULL PASS**
- H1.1: 🟡 PARTIAL → 🟢 **PROVEN**
- H1.2: 🔒 LOCKED → 🔓 **UNLOCKED**

**If ANY FAIL:**
- N1: 🟡 **PARTIAL** (remains)
- H1.1: 🟡 **PARTIAL** (remains)
- H1.2: 🔒 **LOCKED** (remains)
- **Action:** Fix failed proof, rerun test

---

## Notes

**Important Distinctions:**
- ✅ Infrastructure verification ≠ Behavioral proof
- ✅ Function execution ≠ End-to-end recovery
- ✅ Schema existence ≠ N1 PASS
- ✅ 366 PENDING events ≠ Controlled test

**Controlled Test Requirements:**
- Single test event with known ID
- Finance OS actually DOWN (not mocked)
- Hospital transaction actually SUCCESS
- Worker actually processes async
- Finance OS actually receives POST
- Idempotency actually prevents duplicate

**Evidence Requirements:**
- Raw SQL query results
- Raw HTTP responses
- Raw worker logs
- Timestamps for all phases
- No inferred claims, only observed facts
