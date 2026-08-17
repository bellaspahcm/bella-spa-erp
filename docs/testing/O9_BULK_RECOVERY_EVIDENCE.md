# O9: Bulk Recovery — Behavioral Evidence

**Constitution:** v1.3 FROZEN  
**Test Suite:** `tests/integration/o9_bulk_recovery.test.ts`  
**Status:** ✅ **7/7 PASS**  
**Verified:** 2026-08-17

---

## Test Results

```
√ O9.1: Bulk replay processes multiple events (3922 ms)
√ O9.2: Bounded batch size enforced (10709 ms)
√ O9.3: Tenant isolation enforced (1677 ms)
√ O9.4: Concurrency control (no duplicate replays) (1800 ms)
√ O9.5: Active events NOT affected by bulk replay (1206 ms)
√ O9.6: Retry state reset for bulk replayed events (920 ms)
√ O9.7: Empty result when no events match criteria (164 ms)
```

**Total:** 7/7 PASS (100%)

---

## Behavioral Evidence

### O9.1: Bulk replay processes multiple events
**Verified:**
- Created 50 QUARANTINED events with same `quarantine_reason`
- `replayBulk(reason, tenant, operator, 100)` returned `affected_count = 50`
- All 50 events transitioned: `QUARANTINED → PENDING`
- All events have `retry_count = 0`, `replayed_by = operator`

**Constitution compliance:** ✅ Bulk replay capability (C2)

---

### O9.2: Bounded batch size enforced
**Verified:**
- Created 150 QUARANTINED events
- `replayBulk(reason, tenant, operator, 100)` returned `affected_count = 100`
- Only 100 events processed (50 remain QUARANTINED)
- Hard limit enforced: `Math.min(limit, 100)`

**Constitution compliance:** ✅ System not overloaded (O9)

---

### O9.3: Tenant isolation enforced
**Verified:**
- Created 10 events for `tenant1`, 10 for `tenant2` (same reason)
- `replayBulk(reason, tenant1, operator, 100)` returned `affected_count = 10`
- Tenant1 events: `QUARANTINED → PENDING`
- Tenant2 events: remain `QUARANTINED` (unchanged)

**Constitution compliance:** ✅ Tenant isolation (P0 Gate 0)

---

### O9.4: Concurrency control (no duplicate replays)
**Verified:**
- Created 20 QUARANTINED events
- Ran 2 concurrent `replayBulk()` calls (operator-1, operator-2)
- Total affected: 20 (not 40)
- All 20 events transitioned to PENDING once
- Implementation uses `FOR UPDATE SKIP LOCKED` to prevent race

**Constitution compliance:** ✅ No duplicate processing (A4 concurrency)

---

### O9.5: Active events NOT affected
**Verified:**
- Created 10 QUARANTINED + 5 PROCESSING (with active lease)
- `replayBulk(reason, tenant, operator, 100)` returned `affected_count = 10`
- QUARANTINED events: `→ PENDING`
- PROCESSING events: unchanged (still `PROCESSING`, `claimed_by = worker-active`)

**Constitution compliance:** ✅ Healthy processing not blocked (O9)

---

### O9.6: Retry state reset
**Verified:**
- Created QUARANTINED events with:
  - `retry_count = 8`
  - `next_retry_at = now() + 1 hour`
  - `failure_classification = 'TRANSIENT'`
  - `last_error = 'Old error'`
- After `replayBulk()`:
  - `retry_count = 0`
  - `next_retry_at = NULL`
  - `failure_classification = NULL`
  - `last_error = NULL`

**Constitution compliance:** ✅ Clean slate for replayed events (O6, A4)

---

### O9.7: Empty result handling
**Verified:**
- No events match `quarantine_reason = 'NON_EXISTENT'`
- `replayBulk()` returned:
  - `affected_count = 0`
  - `event_ids = []`
- No errors, graceful empty result

**Constitution compliance:** ✅ Robust error handling

---

## Implementation Defects Fixed During O9

### Defect 1: `last_error` not cleared
**Location:** `finance-outbox-replay.ts` line ~79  
**Severity:** Medium  
**Impact:** Replayed events retained old error messages

**Fix:**
```typescript
// BEFORE
failure_classification = NULL

// AFTER
failure_classification = NULL,
last_error = NULL
```

**Status:** ✅ FIXED

---

### Defect 2: Concurrent replay duplication
**Location:** `finance-outbox-replay.ts` `replayBulk()` subquery  
**Severity:** High  
**Impact:** Concurrent `replayBulk()` calls could process same events twice

**Fix:**
```typescript
// BEFORE
SELECT event_id
FROM finance_outbox_events
WHERE ...
LIMIT $3

// AFTER
SELECT event_id
FROM finance_outbox_events
WHERE ...
LIMIT $3
FOR UPDATE SKIP LOCKED
```

**Status:** ✅ FIXED

---

## Constitution Compliance Summary

| Requirement | Status |
|------------|--------|
| O9: Bulk replay processes multiple events | ✅ |
| O9: Bounded batch size (≤100) | ✅ |
| O9: Tenant isolation | ✅ |
| O9: Concurrency control | ✅ |
| O9: Active events NOT blocked | ✅ |
| O9: Retry state reset | ✅ |
| O9: System not overloaded | ✅ |
| A4: Replay concurrency guard | ✅ |
| C2: Valid terminal states | ✅ |
| P0: Tenant isolation | ✅ |

---

## Verification Status

**O9: VERIFIED** ✅  
**Evidence: FROZEN** 🔒  
**Implementation defects:** 2 found, 2 fixed  
**Open defects:** 0

---

## Next Gate

**O10:** Final operational verification  
**Then:** I1-I3 → Q1-Q5 → F1-F4 Integrity → Fix O1 defect → Full regression → **H1.2 PROVEN + FROZEN**
