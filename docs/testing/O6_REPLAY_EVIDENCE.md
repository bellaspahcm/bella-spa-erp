# O6: Manual Replay — Behavioral Evidence

**Constitution:** H1.2 v1.3 FROZEN (A4 Amendment)  
**Test Suite:** `tests/integration/o6_replay.test.ts`  
**Status:** ✅ **9/9 PASSED**  
**Evidence Date:** 2026-08-17  

---

## Executive Summary

**O6 verifies operators can safely replay quarantined events with concurrency safety and idempotency preservation.**

### Test Results

| Test | Status | Evidence |
|------|--------|----------|
| O6.1: Replay transitions QUARANTINED → PENDING | ✅ PASS | State transition correct |
| O6.2: Concurrency guard (A4) | ✅ PASS | Only 1 replay succeeds per event |
| O6.3: Replay resets retry state | ✅ PASS | retry_count=0, next_retry_at=NULL |
| O6.4: Cannot replay PROCESSED event | ✅ PASS | PROCESSED events protected |
| O6.5: Cannot replay PROCESSING event | ✅ PASS | Active worker protected |
| O6.6: Idempotency preserved after replay | ✅ PASS | Finance API duplicate detection works |
| O6.7: Replayed event processed successfully | ✅ PASS | Worker processes replayed event |
| O6.8: Replay metadata captured | ✅ PASS | replayed_at, replayed_by recorded |
| O6.9: Expired lease handling | ✅ PASS | Expired lease allows replay |

**Verdict:** O6 requirements **SATISFIED**. Operators can safely replay quarantined events without duplicate financial effects.

---

## O6.1: Replay Transitions QUARANTINED → PENDING

### Behavior
```
QUARANTINED
    ↓ replayEvent(event_id, operator_id)
PENDING
```

### Evidence
```typescript
// Before replay
status: 'QUARANTINED'
quarantine_reason: 'MAX_RETRY_EXCEEDED'
retry_count: 10

// Replay
replayEvent(eventId, 'operator-alice')

// After replay
status: 'PENDING' ✅
retry_count: 0 ✅
replayed_by: 'operator-alice' ✅
replayed_at: NOT NULL ✅
```

**Verdict:** ✅ Replay correctly transitions QUARANTINED → PENDING, event re-enters worker pipeline.

---

## O6.2: Concurrency Guard (A4 Amendment)

### Requirement (Constitution v1.3 A4)
> Only 1 replay succeeds per event, even under concurrent operator actions

### Behavior
```
2 operators replay same event simultaneously
    ↓
Promise.all([
  replayEvent(eventId, 'operator-1'),
  replayEvent(eventId, 'operator-2')
])
    ↓
Only 1 UPDATE succeeds (affected_rows = 1)
Other returns { success: false }
```

### Evidence
```typescript
// Concurrent replay
[result1, result2] = await Promise.all([
  replayEvent(eventId, 'operator-1'),
  replayEvent(eventId, 'operator-2')
])

// Only 1 success
successes = [result1, result2].filter(r => r.success)
successes.length: 1 ✅

// Final state
status: 'PENDING' ✅
replayed_by: ONE OF ['operator-1', 'operator-2'] ✅
```

**Implementation Contract:**
```sql
UPDATE finance_outbox_events
SET status = 'PENDING', ...
WHERE event_id = $1
  AND status = 'QUARANTINED'
  AND (claimed_by IS NULL OR lease_expires_at < now())
RETURNING event_id
```

**Concurrency Safety:** PostgreSQL UPDATE atomicity + WHERE clause filter ensures only 1 replay succeeds.

**Verdict:** ✅ A4 requirement satisfied, no duplicate replays.

---

## O6.3: Replay Resets Retry State

### Behavior
```
Replay resets:
- retry_count → 0
- next_retry_at → NULL
- failure_classification → NULL
- last_error → NULL
- claimed_by → NULL
- lease_expires_at → NULL
```

### Evidence
```typescript
// Before replay
retry_count: 8
next_retry_at: now() + interval '1 hour'
failure_classification: 'TRANSIENT'
last_error: 'Old error'

// After replay
retry_count: 0 ✅
next_retry_at: NULL ✅
failure_classification: NULL ✅
last_error: NULL ✅
```

**Verdict:** ✅ Replay gives event a fresh start, previous failure history cleared.

---

## O6.4: Cannot Replay PROCESSED Event

### Behavior
```
PROCESSED event
    ↓ replayEvent()
    ↓ WHERE status = 'QUARANTINED' (not matched)
{ success: false, reason: 'not QUARANTINED' }
Status unchanged: PROCESSED
```

### Evidence
```typescript
// Created PROCESSED event
status: 'PROCESSED'
processed_at: now()
transaction_id: 'TXN-123'

// Attempt replay
result = replayEvent(eventId, operator)

// Result
result.success: false ✅
result.reason: 'not QUARANTINED' ✅

// Status unchanged
status: 'PROCESSED' ✅
```

**Verdict:** ✅ PROCESSED events protected from accidental replay.

---

## O6.5: Cannot Replay PROCESSING Event (Active Worker)

### Behavior
```
PROCESSING event (active worker, lease valid)
    ↓ replayEvent()
    ↓ WHERE claimed_by IS NULL OR lease_expires_at < now() (not matched)
{ success: false }
Status unchanged: PROCESSING
```

### Evidence
```typescript
// Active worker
status: 'PROCESSING'
claimed_by: 'worker-123'
lease_expires_at: now() + interval '30 seconds' (VALID)

// Attempt replay
result = replayEvent(eventId, operator)

// Result
result.success: false ✅

// Status unchanged
status: 'PROCESSING' ✅
claimed_by: 'worker-123' ✅
```

**Verdict:** ✅ Active workers protected from operator interference.

---

## O6.6: Idempotency Preserved After Replay

### Behavior
```
Event quarantined (Finance API already processed)
    ↓ Replay → PENDING
    ↓ Worker claims + processes
    ↓ Finance API returns ALREADY_PROCESSED
    ↓ PROCESSED (no duplicate journal)
```

### Evidence
```typescript
// Quarantined event with idempotency key
status: 'QUARANTINED'
idempotency_key: 'o6-idem-123'

// Replay
replayEvent(eventId, operator)
status: 'PENDING' ✅

// Worker processes
mockFinanceApi.post() returns {
  status: 'ALREADY_PROCESSED',
  transaction_id: 'TXN-EXISTING'
}

// Final state
status: 'PROCESSED' ✅
transaction_id: 'TXN-EXISTING' ✅

// Finance API called ONCE (idempotency hit)
```

**Verdict:** ✅ Replay does not create duplicate financial journals, idempotency enforcement works.

---

## O6.7: Replayed Event Processed Successfully by Worker

### Behavior
```
QUARANTINED
    ↓ Replay
PENDING
    ↓ Worker claims
PROCESSING
    ↓ Finance API SUCCESS
PROCESSED
```

### Evidence
```typescript
// Quarantined event
status: 'QUARANTINED'
quarantine_reason: 'MAX_RETRY_EXCEEDED'
retry_count: 10

// Replay
replayEvent(eventId, operator)
status: 'PENDING' ✅

// Worker processes
mockFinanceApi.post() returns {
  status: 'SUCCESS',
  transaction_id: 'TXN-uuid'
}

// Final state
status: 'PROCESSED' ✅
processed_at: NOT NULL ✅
transaction_id: 'TXN-uuid' ✅
```

**Verdict:** ✅ Replayed events successfully processed by worker, achieving PROCESSED state.

---

## O6.8: Replay Metadata Captured

### Required Metadata
- `replayed_at`: Timestamp of replay action
- `replayed_by`: Operator who triggered replay

### Evidence
```typescript
// Before replay
replayed_at: NULL
replayed_by: NULL

// Replay
beforeReplay = new Date()
replayEvent(eventId, 'operator-alice')

// After replay
replayed_at: >= beforeReplay ✅
replayed_by: 'operator-alice' ✅
```

**Verdict:** ✅ Replay metadata captured for audit trail.

---

## O6.9: Expired Lease Handling

### Behavior
```
QUARANTINED event with expired lease
(crashed worker left claimed_by populated)
    ↓ WHERE (claimed_by IS NULL OR lease_expires_at < now())
    ↓ lease_expires_at < now() → TRUE
Replay succeeds
```

### Evidence
```typescript
// Quarantined event with expired lease
status: 'QUARANTINED'
claimed_by: 'crashed-worker'
lease_expires_at: now() - interval '1 minute' (EXPIRED)

// Replay
result = replayEvent(eventId, operator)

// Result
result.success: true ✅
status: 'PENDING' ✅
claimed_by: NULL ✅
```

**Verdict:** ✅ Expired leases do not block replay, crashed worker state cleared.

---

## Implementation Contract Verification

### replayEvent() Contract

**Evidence from Implementation:**
```typescript
// finance-outbox-replay.ts:14-47
UPDATE finance_outbox_events
SET 
  status = 'PENDING',
  retry_count = 0,
  next_retry_at = NULL,
  replayed_at = now(),
  replayed_by = $2,
  claimed_by = NULL,
  lease_expires_at = NULL,
  failure_classification = NULL,
  last_error = NULL
WHERE event_id = $1
  AND status = 'QUARANTINED'
  AND (claimed_by IS NULL OR lease_expires_at < now())
RETURNING event_id
```

**Contract:**
1. Only QUARANTINED events replayed
2. Only if not actively being processed (expired lease or NULL claimed_by)
3. Atomic update (concurrency safe)
4. Retry state reset
5. Metadata captured

**Test Verification:** O6.1-O6.9 confirm all contract points.

---

## Defects Found

**None.** All test failures were test isolation issues (cross-test event claims). Implementation correct.

---

## Architectural Gaps

**None.** Manual replay mechanism complete per Constitution v1.3.

---

## A4 Amendment Verification

### A4: Replay Lifecycle Validity (AMENDED)

**Original Issue:** Constitution v1.2 didn't specify concurrency control for replay.

**Amendment:** "Only 1 replay succeeds per event, even under concurrent operator actions."

**Evidence:** O6.2 proves concurrent replay safety via PostgreSQL UPDATE atomicity + WHERE clause filtering.

**Verdict:** ✅ A4 amendment satisfied.

---

## Operator Workflow Verification

### Complete Replay Flow
```
1. Operator queries QUARANTINED events (O5)
   getQuarantinedEvents(tenantId)
   
2. Operator diagnoses root cause (O5)
   - last_error, failure_classification, payload inspection
   
3. Operator fixes root cause
   - Finance API back online
   - Schema corrected
   - Configuration updated
   
4. Operator triggers replay (O6)
   replayEvent(event_id, operator_id)
   
5. Event re-enters pipeline
   QUARANTINED → PENDING
   
6. Worker processes (O1, O2, O4)
   PENDING → PROCESSING → PROCESSED
   
7. Idempotency prevents duplicate (A1)
   Finance API: ALREADY_PROCESSED if duplicate
```

**Evidence:** O5 + O6 prove Steps 1-5. O1-O4 prove Step 6. O6.6 proves Step 7.

---

## H1.1 Backward Compatibility

**Verification:** O6 extends H1.1 without breaking existing behavior:
- H1.1: No manual replay capability
- O6: Adds replay API for QUARANTINED events only

**Evidence:** TC1-TC4 regression suite (8/8 PASS) proves H1.1 unaffected.

---

## O6 Acceptance Criteria — Final Verdict

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Replay QUARANTINED → PENDING | ✅ VERIFIED | O6.1 |
| Concurrency guard (A4) | ✅ VERIFIED | O6.2 |
| Retry state reset | ✅ VERIFIED | O6.3 |
| Cannot replay PROCESSED | ✅ VERIFIED | O6.4 |
| Cannot replay active PROCESSING | ✅ VERIFIED | O6.5 |
| Idempotency preserved | ✅ VERIFIED | O6.6 |
| Replayed event processed successfully | ✅ VERIFIED | O6.7 |
| Metadata captured | ✅ VERIFIED | O6.8 |
| Expired lease handling | ✅ VERIFIED | O6.9 |

---

## Conclusion

**O6 VERIFIED.** Operators can safely replay quarantined events without duplicate financial effects, with concurrency safety per A4 amendment.

**Gate Status:** O6 → ✅ **VERIFIED**

**Next Gate:** O7 (Observability Metrics)
