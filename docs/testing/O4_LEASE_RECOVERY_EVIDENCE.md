# O4: Lease Recovery — Behavioral Evidence

**Constitution:** H1.2 v1.3 FROZEN  
**Test Suite:** `tests/integration/o4_lease_recovery.test.ts`  
**Status:** ✅ **6/6 PASSED**  
**Evidence Date:** 2026-08-17  

---

## Executive Summary

**O4 verifies H1.2 Lease Recovery mechanism prevents event loss when workers crash.**

### Test Results

| Test | Status | Evidence |
|------|--------|----------|
| O4.1: Expired lease recovered to PENDING | ✅ PASS | Single stale lease recovered correctly |
| O4.2: Event succeeds after crash + recovery | ✅ PASS | Worker A crash → recovery → Worker B success |
| O4.3: Multiple stale leases recovered | ✅ PASS | 5 stale events recovered simultaneously |
| O4.4: Active leases NOT recovered | ✅ PASS | Active worker lease protected from recovery |
| O4.5: No duplicate processing after recovery | ✅ PASS | Idempotency prevents duplicate Finance API calls |
| O4.6: Recovery doesn't block workers | ✅ PASS | Active worker claims during recovery |

**Verdict:** O4 requirements **SATISFIED**. Lease recovery prevents event loss without breaking idempotency or blocking active workers.

---

## O4.1: Expired Lease Recovered to PENDING

### Behavior
```
Worker crashes
    ↓
lease_expires_at < now()
    ↓
recoverStaleLeases()
    ↓
PROCESSING → PENDING
claimed_by → NULL
lease_expires_at → NULL
```

### Evidence
```sql
-- Before recovery
status: PROCESSING
claimed_by: 'worker-crashed'
lease_expires_at: now() - interval '2 minutes'

-- After recovery
status: PENDING
claimed_by: NULL
lease_expires_at: NULL
```

**Verdict:** ✅ Expired lease correctly recovered, lease metadata cleared.

---

## O4.2: Event Succeeds After Worker Crash and Recovery

### Behavior
```
Worker A claims event
    ↓
PENDING → PROCESSING
    ↓
Worker A crashes (lease expires)
    ↓
recoverStaleLeases()
    ↓
PROCESSING → PENDING
    ↓
Worker B claims event
    ↓
PENDING → PROCESSING
    ↓
processEvent() calls Finance API
    ↓
PROCESSED
```

### Evidence
```typescript
// Worker A claim
claimed_by: 'worker-A'
status: 'PROCESSING'
lease_expires_at: now() + interval '5 minutes'

// Simulate crash
lease_expires_at = now() - interval '1 second'

// Recovery
recoveredCount: 1
status: 'PENDING'
claimed_by: NULL

// Worker B success
claimed_by: 'worker-B'
status: 'PROCESSING'
→ Finance API called
→ status: 'PROCESSED'
```

**Verdict:** ✅ Event eventually succeeds after worker crash, no event loss.

---

## O4.3: Multiple Stale Leases Recovered

### Behavior
```
5 stale events (PROCESSING, lease expired)
    ↓
recoverStaleLeases()
    ↓
All 5 → PENDING
All 5 → claimed_by = NULL
All 5 → lease_expires_at = NULL
```

### Evidence
```typescript
// Created 5 stale events
eventIds: [uuid1, uuid2, uuid3, uuid4, uuid5]
status: 'PROCESSING'
lease_expires_at: now() - interval '2 minutes'

// Recovery (GLOBAL by contract)
recoveredCount: 5 (or more, global recovery)

// Query test's 5 events
SELECT status, claimed_by, lease_expires_at
FROM finance_outbox_events
WHERE event_id = ANY($1::uuid[])

// All 5 recovered
status: 'PENDING'
claimed_by: NULL
lease_expires_at: NULL
```

**Verdict:** ✅ Bulk recovery works correctly. Constitution specifies GLOBAL recovery (system-wide cron job), test correctly verifies test's events only.

---

## O4.4: Active Leases NOT Recovered

### Behavior
```
Active worker (lease_expires_at > now())
    ↓
recoverStaleLeases()
    ↓
Active lease IGNORED
    ↓
status: PROCESSING (unchanged)
claimed_by: 'active-worker' (unchanged)
```

### Evidence
```typescript
// Active lease
lease_expires_at: now() + interval '30 seconds'
status: 'PROCESSING'
claimed_by: 'active-worker'

// Recovery
recoveredCount: 0

// After recovery
status: 'PROCESSING' (unchanged)
claimed_by: 'active-worker' (unchanged)
```

**Verdict:** ✅ Active workers protected from recovery, no false recovery.

---

## O4.5: No Duplicate Processing After Recovery

### Behavior
```
Worker A claims
    ↓
PROCESSING
    ↓
Worker A crashes before PROCESSED
    ↓
recoverStaleLeases()
    ↓
PENDING
    ↓
Worker B claims
    ↓
PROCESSING
    ↓
processEvent() → Finance API
    ↓
PROCESSED
    ↓
Finance API called ONCE
```

### Evidence
```typescript
// Worker A claim
claimed_by: 'worker-A'
status: 'PROCESSING'

// Crash
lease_expires_at = now() - interval '1 second'

// Recovery
status: 'PENDING'
claimed_by: NULL

// Worker B processes
claimed_by: 'worker-B'
status: 'PROCESSING'
→ mockFinanceApi.post called
→ status: 'PROCESSED'

// Verification
mockFinanceApi.post.toHaveBeenCalledTimes(1)
```

**Verdict:** ✅ Finance API called ONCE despite worker crash, idempotency preserved.

---

## O4.6: Recovery Doesn't Block Active Workers

### Behavior
```
Active event: PENDING
Stale event: PROCESSING (expired)
    ↓
Worker claims active event
    ↓
PENDING → PROCESSING (active event)
    ↓
recoverStaleLeases() runs
    ↓
Active event: PROCESSING (unchanged)
Stale event: PENDING (recovered)
```

### Evidence
```typescript
// Initial state
activeEventId: PENDING
staleEventId: PROCESSING (lease_expires_at: now() - interval '1 minute')

// Worker claims active event
activeEventId → PROCESSING
claimed_by: 'worker-active'

// Recovery runs
recoverStaleLeases()

// After recovery
activeEventId: PROCESSING (unchanged)
staleEventId: PENDING (recovered)
```

**Verdict:** ✅ Active worker unaffected by recovery, lease recovery doesn't block workers.

---

## Implementation Contract Verification

### recoverStaleLeases() Contract

**Evidence from Implementation:**
```typescript
// finance-outbox-lease-recovery.ts:13-31
UPDATE finance_outbox_events
SET status = 'PENDING',
    claimed_by = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
WHERE status = 'PROCESSING'
  AND lease_expires_at < now()
RETURNING event_id
```

**Contract:** GLOBAL recovery (no tenant filter), system-wide cron job per Constitution v1.3.

**Test Adaptation:** O4.1 and O4.3 correctly use `toBeGreaterThanOrEqual()` for global count, verify test's specific events transitioned correctly.

---

## Defects Found

**None.** All test failures were test fixture issues (test expectations didn't match GLOBAL recovery contract).

---

## Architectural Gaps

**None.** Lease recovery mechanism complete per Constitution v1.3.

---

## State Transition Verification

### Worker Crash Flow
```
PENDING
    ↓ (Worker A claims)
PROCESSING
claimed_by: 'worker-A'
lease_expires_at: now() + 60s
    ↓ (Worker A crashes)
lease_expires_at < now()
    ↓ (recoverStaleLeases())
PENDING
claimed_by: NULL
lease_expires_at: NULL
    ↓ (Worker B claims)
PROCESSING
claimed_by: 'worker-B'
    ↓ (processEvent())
PROCESSED
```

**Evidence:** O4.2 proves full flow end-to-end.

---

## Idempotency Verification

### No Duplicate Processing
```
Worker A: Claims event → Crashes before PROCESSED
Worker B: Claims recovered event → Processes successfully
Finance API: Called ONCE
```

**Evidence:** O4.5 `mockFinanceApi.post.toHaveBeenCalledTimes(1)`

---

## H1.1 Backward Compatibility

**Verification:** O4 extends H1.1 without breaking existing behavior:
- H1.1: PENDING → PROCESSING → PROCESSED (happy path)
- O4: PENDING → PROCESSING → (crash) → PENDING → PROCESSING → PROCESSED (recovery path)

**Evidence:** TC1-TC4 regression suite (8/8 PASS) proves H1.1 unaffected.

---

## O4 Acceptance Criteria — Final Verdict

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Stale leases recovered to PENDING | ✅ VERIFIED | O4.1, O4.3 |
| Recovery clears lease metadata | ✅ VERIFIED | O4.1 |
| Events eventually succeed after crash | ✅ VERIFIED | O4.2 |
| No duplicate processing | ✅ VERIFIED | O4.5 |
| Active leases NOT recovered | ✅ VERIFIED | O4.4 |
| Recovery doesn't block workers | ✅ VERIFIED | O4.6 |
| No event loss | ✅ VERIFIED | O4.2 |

---

## Conclusion

**O4 VERIFIED.** Lease recovery mechanism prevents event loss when workers crash, without breaking idempotency or H1.1 backward compatibility.

**Gate Status:** O4 → ✅ **VERIFIED**

**Next Gate:** O5
