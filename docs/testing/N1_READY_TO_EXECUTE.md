# N1 Failure Isolation — Ready to Execute

**Status:** ✅ **ALL PREREQUISITES MET**  
**Date:** 2026-08-17 09:00 UTC  
**Baseline:** H1.1 PARTIAL PASS (G1-G7 ✅, N2 ✅, N3 ✅, N1 🟡)

---

## ✅ Pre-Flight Checklist

| Item | Status | Details |
|------|--------|---------|
| Baseline clean | ✅ | 0 N1 test events, 0 idempotency records |
| Finance OS endpoint | ✅ | `http://localhost:3000/api/finance/v1/events` |
| Finance OS status | ✅ | UP (200 OK) |
| Worker isolation | ✅ | Test-mode worker created |
| 366 backlog protected | ✅ | Will not be touched |
| Test script | ✅ | `npm run test:n1` |
| Evidence template | ✅ | `docs/testing/N1_RAW_EVIDENCE.md` |

---

## 🎯 Test Execution Flow

### Phase 2: Finance DOWN (⏳ Manual)

**Simulate Finance unavailability:**

Since Finance OS is same Next.js app, cannot stop independently. Instead:

**Option A: Kill Next.js process (actual DOWN)**
```bash
# Terminal 1: Stop Next.js
# Ctrl+C to stop npm run dev

# Verify DOWN:
curl http://localhost:3000/api/finance/v1/events
# Expected: Connection refused
```

**Option B: Mock Finance failure (modify route temporarily)**
```typescript
// src/app/api/finance/v1/events/route.ts
export async function POST(request: NextRequest) {
  // TEMPORARY: Simulate Finance DOWN for N1 test
  if (request.headers.get('X-Test-N1-Failure')) {
    return NextResponse.json(
      { error: 'Finance OS unavailable (N1 test)' },
      { status: 503 }
    );
  }
  // ... rest of handler
}
```

**Recommendation:** Use Option A (actual process stop) for authentic failure test

---

### Phase 3: Hospital SUCCESS (⏳ Manual)

**While Finance is DOWN:**

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

✅ P1 EVIDENCE: Finance DOWN → Hospital SUCCESS

📌 Step 3: Verify finance_outbox_events (PENDING)
   Status: PENDING
   Retry Count: 0

✅ P2 EVIDENCE: Event durable in outbox (PENDING)
```

**Verify outbox:**
```sql
SELECT id, event_id, status, retry_count, created_at
FROM finance_outbox_events
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```

**Expected:** 1 row, status = PENDING

**📸 Collect P1 + P2 evidence**

---

### Phase 4: Finance UP → Recovery (⏳ Manual)

**Step 1: Start Next.js (if stopped)**
```bash
# Terminal 1:
npm run dev

# Verify UP:
curl http://localhost:3000/api/finance/v1/events
# Expected: 200 OK, {"status":"ok",...}
```

**Step 2: Run test-mode worker**
```bash
# Get event_id from previous step output
npx tsx src/platform/integration-hub/finance-outbox-worker-test.ts evt-n1-failure-isolation-[TIMESTAMP]
```

**Expected output:**
```
🧪 N1 Test Mode Worker
   Event Pattern: evt-n1-failure-isolation-[TIMESTAMP]
   Finance OS: http://localhost:3000/api/finance/v1/events

📌 Claiming event matching: evt-n1-failure-isolation-[TIMESTAMP]
   ✅ Claimed event: evt-n1-failure-isolation-[TIMESTAMP]
   Released 0 non-test events

📤 POSTing to Finance OS...
   ✅ Finance OS response: CREATED

✅ Marking event as PROCESSED...
   ✅ Outbox status updated to PROCESSED

═══════════════════════════════════════
✅ N1 Test Event Processed Successfully
═══════════════════════════════════════
Event ID: evt-n1-failure-isolation-[TIMESTAMP]
Outbox ID: [UUID]
Finance Status: CREATED
Transaction ID: [UUID]
Duration: [X]ms
═══════════════════════════════════════
```

**Verify outbox:**
```sql
SELECT status, processed_at, retry_count FROM finance_outbox_events
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```

**Expected:** status = PROCESSED, retry_count = 1

**Verify Finance idempotency:**
```sql
SELECT COUNT(*) FROM finance_event_idempotency
WHERE idempotency_key LIKE '%N1-TEST%';
```

**Expected:** 1

**📸 Collect P3 + P4 evidence**

---

### Phase 5: Duplicate Retry (⏳ Manual)

**Step 1: Force event back to PENDING**
```sql
UPDATE finance_outbox_events
SET status = 'PENDING',
    retry_count = 0,
    next_retry_at = NOW(),
    claimed_by = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    processed_at = NULL
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```

**Step 2: Run worker again**
```bash
npx tsx src/platform/integration-hub/finance-outbox-worker-test.ts evt-n1-failure-isolation-[TIMESTAMP]
```

**Expected output:**
```
✅ N1 Test Event Processed Successfully
Finance Status: ALREADY_PROCESSED (or similar idempotency response)
Transaction ID: [SAME UUID as before]
```

**Verify idempotency count:**
```sql
SELECT COUNT(*) FROM finance_event_idempotency
WHERE idempotency_key LIKE '%N1-TEST%';
```

**Expected:** 1 (NOT 2 - no duplicate created)

**📸 Collect P5 evidence**

---

## 📸 Evidence Collection

Update `docs/testing/N1_RAW_EVIDENCE.md` with:

**P1:** Finance DOWN + Hospital 200/201 response + outboxId  
**P2:** Outbox entry (status = PENDING, retry_count = 0)  
**P3:** Worker logs showing async processing  
**P4:** Outbox PROCESSED + Finance idempotency record created + transaction_id  
**P5:** ALREADY_PROCESSED response + idempotency count = 1

---

## 🎯 Decision Tree

```
P1 ─┐
P2 ─┤
P3 ─┤── ALL PASS? ──→ N1 🟢 FULL PASS
P4 ─┤                      ↓
P5 ─┘                 H1.1 🟢 PROVEN
                           ↓
                      H1.2 UNLOCKED

ANY FAIL? ──→ N1 🟡 PARTIAL (diagnose and fix)
```

---

## 🔒 Current Status Lock

**N1:** 🟡 PARTIAL (awaiting behavioral proof)  
**H1.1:** 🟡 PARTIAL  
**H1.2:** 🔒 LOCKED  
**366 Backlog:** ✋ Protected (test-mode worker ignores them)

---

## 📋 Commands Reference

**Test Hospital transaction (Finance must be DOWN first):**
```bash
npm run test:n1
```

**Process N1 test event (Finance must be UP):**
```bash
npx tsx src/platform/integration-hub/finance-outbox-worker-test.ts evt-n1-failure-isolation-[TIMESTAMP]
```

**Query outbox:**
```sql
SELECT * FROM finance_outbox_events 
WHERE event_id::text LIKE 'evt-n1-failure-isolation-%';
```

**Query idempotency:**
```sql
SELECT * FROM finance_event_idempotency 
WHERE idempotency_key LIKE '%N1-TEST%';
```

**Check Finance health:**
```bash
curl http://localhost:3000/api/finance/v1/events
```

---

## ⚠️ Important Notes

**Finance OS Architecture:**
- Finance OS is SAME Next.js app (not separate service)
- Endpoint: `POST /api/finance/v1/events`
- Cannot independently stop Finance OS without stopping Hospital OS
- For authentic failure test: Stop entire Next.js process

**Worker Isolation:**
- Standard worker (`npm run worker:finance-outbox`) processes ALL events
- Test-mode worker processes ONLY specified event_id
- 366 backlog events remain PENDING (untouched)

**Evidence Standards:**
- Raw SQL query results (not summarized)
- Raw HTTP responses (not paraphrased)
- Raw worker logs (not interpreted)
- Timestamps for all phases
- Observed facts only (no inferences)

---

**Ready:** ✅ ALL PREREQUISITES MET  
**Action:** Execute 5-phase test protocol  
**Expected Duration:** 15-20 minutes  
**Next:** Collect evidence → Audit 5 proofs → N1 FULL PASS or diagnose failures
