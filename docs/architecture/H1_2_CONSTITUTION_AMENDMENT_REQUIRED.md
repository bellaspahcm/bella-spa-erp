# H1.2 Constitution — Amendment Required

**Date:** 2026-08-17  
**Constitution Version:** v1.2  
**Review Status:** 🔴 REVISE REQUIRED  
**Next Version:** v1.3 AMENDED

---

## Architecture Review Verdict

**Constitution v1.2 NOT APPROVED**

**Reason:** Not architectural rejection — enforcement mechanisms need clarification

**Review Results:**
- ✅ 3/8 questions PASS (conditional)
- 🟡 5/8 questions REVISE
- 🔴 5 amendments required before approval

---

## Required Amendments Summary

| Amendment | Question | Issue | Severity |
|-----------|----------|-------|----------|
| **A1** | Q1 — I1 Enforcement | Idempotency enforcement chain incomplete | HIGH |
| **A2** | Q2 — I2 Atomicity | State transition atomicity undefined | HIGH |
| **A3** | Q3 — I3 Boundary | F1-F4 permission boundary unclear | HIGH |
| **A4** | Q5 — Replay | Invalid test lifecycle (PROCESSED → QUARANTINED) | MEDIUM |
| **A5** | Q8 — Compatibility | Contradicts H1.1 FROZEN rule | HIGH |

---

## A1: Idempotency Enforcement Chain

**Current (v1.2):**
```
"DB: UNIQUE(idempotency_key) on ledger"
"Worker: Atomic claimed_by update"
```

**Gap:**
- Which table? Which transaction is authoritative?
- Atomic claim incomplete: `WHERE claimed_by IS NULL` missing event_id, status, lease conditions
- Missing enforcement chain documentation
- Concurrent delivery + crash-after-commit scenarios not proven

**Required Amendment:**
1. Specify exact table: `finance_transactions` or `journal_entries` with `UNIQUE(idempotency_key)`
2. Define authoritative idempotency transaction
3. Complete atomic claim:
   ```sql
   UPDATE finance_outbox_events
   SET claimed_by = :worker_id,
       claimed_at = now(),
       lease_expires_at = now() + interval '60 seconds'
   WHERE event_id = :event_id
     AND status = 'PENDING'
     AND (lease_expires_at IS NULL OR lease_expires_at < now())
     AND claimed_by IS NULL
   RETURNING event_id
   -- Check affected_rows = 1
   ```
4. Document enforcement chain:
   ```
   Event created
       ↓
   Idempotency key = hash(tenant_id, event_type, source_transaction_id)
       ↓
   Worker atomic claim (affected_rows = 1)
       ↓
   Finance API POST with idempotency key
       ↓
   Finance checks UNIQUE constraint
       ↓
   If exists → ALREADY_PROCESSED
   If not exists → Create transaction + journal (atomic)
       ↓
   Worker marks PROCESSED
   ```
5. Prove scenarios:
   - Worker A and B race → Only 1 claims
   - Worker claims, Finance commits, worker crashes → Replay → Finance returns ALREADY_PROCESSED

---

## A2: State Transition Atomicity

**Current (v1.2):**
```
"Outbox table never DELETE"
"All transitions logged"
```

**Gap:**
- "No DELETE" does not prove no event loss
- State transition atomicity not defined
- Failure windows not covered:
  - Claim success → DB connection loss → Status update unknown
  - PENDING → QUARANTINE transition → Worker crash mid-transaction

**Required Amendment:**
1. Strengthen I2 invariant definition:
   ```
   OLD: "Accepted financial intent must remain in PENDING, PROCESSING, PROCESSED, or QUARANTINED"
   
   NEW: "Accepted intent must always remain in an authoritative, queryable state. 
         Every non-terminal state must have a deterministic recovery path."
   ```

2. Define state transition atomicity:
   ```
   All state transitions are atomic within database transaction:
   - PENDING → PROCESSING (claim)
   - PROCESSING → PROCESSED (success)
   - PROCESSING → FAILED (transient failure)
   - FAILED → QUARANTINED (exhaustion)
   - PROCESSING → PENDING (lease recovery)
   - QUARANTINED → PENDING (replay)
   ```

3. Map recovery paths:
   ```
   PENDING: Normal state, worker will claim
   PROCESSING: Lease protection → Expires → PENDING (recoverable)
   FAILED: Retry with backoff → Max retry → QUARANTINED (recoverable)
   QUARANTINED: Manual intervention → Replay → PENDING (recoverable)
   PROCESSED: Terminal (no recovery needed)
   ```

4. Address failure windows:
   - DB connection loss during transition → Transaction rollback → State unchanged → Queryable → Recoverable
   - Worker crash mid-transaction → Lease expires → Cleanup job returns to PENDING

5. Prove: Event always in valid, queryable state regardless of failure timing

---

## A3: F1-F4 Permission Boundary

**Current (v1.2):**
```
"H1.2 components never directly write to F1-F4"
"Test: Dr=Cr still valid after H1.2 failure"
```

**Gap:**
- Convention-based boundary (not enforced)
- "Dr=Cr valid" insufficient (can maintain balance but create wrong journals)
- Permission boundary not enforced at DB/RPC level

**Required Amendment:**
1. Define enforced permission boundary:
   ```
   H1.2 service role: h1_2_worker
   Permissions:
   - finance_outbox_events: SELECT, INSERT, UPDATE
   - finance_transactions: SELECT only (idempotency check)
   - journal_entries: NO ACCESS
   - journal_lines: NO ACCESS
   - accounts: NO ACCESS
   - All F1-F4 tables: SELECT only or NO ACCESS
   
   Only Finance API service role can INSERT/UPDATE F1-F4
   ```

2. Architecture boundary enforcement:
   ```
   H1.2 Worker
       ↓
   HTTP POST Finance API (boundary)
       ↓
   Finance API (different service role)
       ↓
   F1-F4 Kernel
   ```

3. Strengthen I3 test criteria:
   ```
   OLD: "Dr = Cr still valid"
   
   NEW: H1.2 failure scenarios must prove:
   - No unauthorized F1-F4 table mutation
   - No orphan journal entries
   - No duplicate journals
   - No journal lines without parent journal
   - All F1-F4 invariants intact:
     * Dr = Cr per journal
     * Journal status valid
     * Account balances correct
     * Tenant isolation
   ```

4. Prove permission enforcement:
   ```sql
   -- Test: H1.2 worker attempts direct F1-F4 write
   INSERT INTO journal_entries (...) VALUES (...);
   -- Expected: Permission denied
   ```

5. Security context isolation documented and tested

---

## A4: Replay Lifecycle Validity

**Current (v1.2):**
```
Test: "Event PROCESSED → manually mark QUARANTINED → Replay"
```

**Gap:**
- PROCESSED is terminal state
- Artificial test fixture (invalid lifecycle)
- Should not transition PROCESSED → QUARANTINED for testing purposes

**Required Amendment:**
1. Remove invalid test scenario:
   ```
   ❌ REMOVE: Event PROCESSED → manually QUARANTINED → Replay
   ```

2. Valid replay test scenarios:
   ```
   ✅ Scenario 1: Orphaned event
   Event: PENDING or FAILED
   Finance: Already committed (worker crashed after Finance POST but before marking PROCESSED)
   Replay: QUARANTINED → PENDING → Worker claims → Finance API → ALREADY_PROCESSED → Mark PROCESSED
   Result: No duplicate
   
   ✅ Scenario 2: Genuine quarantine
   Event: QUARANTINED (after max retry exceeded)
   Root cause: Fixed (Finance restored)
   Replay: QUARANTINED → PENDING → Worker claims → Finance API → Success → Journal created → Mark PROCESSED
   Result: Exactly-once delivery
   
   ✅ Scenario 3: Permanent failure
   Event: QUARANTINED (422 Unprocessable Entity)
   Payload: Corrected
   Replay: QUARANTINED → PENDING → Worker claims → Finance API → Success → Mark PROCESSED
   Result: Exactly-once delivery
   ```

3. Add replay concurrency safety:
   ```
   Replay operation must be atomic with concurrency guard:
   
   UPDATE finance_outbox_events
   SET status = 'PENDING',
       retry_count = 0,
       replayed_at = now(),
       replayed_by = :operator_id
   WHERE event_id = :event_id
     AND status = 'QUARANTINED'  -- Cannot replay PROCESSED/PROCESSING
     AND (claimed_by IS NULL OR lease_expires_at < now())  -- Not currently being processed
   RETURNING event_id
   -- Check affected_rows = 1
   
   Race scenarios protected:
   - Operator A + Operator B replay same event → Only 1 succeeds
   - Operator replay + Worker claiming → Atomic state transition prevents race
   ```

4. Document replay safety mechanisms
5. Prove concurrent replay operations are safe

---

## A5: Compatibility Without H1.1 Rerun

**Current (v1.2):**
```
"Run H1.1 regression tests (G1-G7, N1-N3) after H1.2 schema migration"
```

**Gap:**
- Contradicts H1.1 FROZEN rule
- H1.1 evidence is frozen (must not reopen or rerun)

**Required Amendment:**
1. Remove requirement to rerun H1.1 frozen gates:
   ```
   ❌ REMOVE: "Run H1.1 regression tests (G1-G7, N1-N3) after H1.2 schema"
   ```

2. H1.1 evidence protection:
   ```
   H1.1 FROZEN means:
   - G1-G7 evidence: FROZEN (not rerun)
   - N1-N3 evidence: FROZEN (not rerun)
   - Evidence documents: IMMUTABLE
   - Behavioral proof: ARCHIVED
   
   H1.2 MUST NOT:
   - Reopen H1.1 evidence
   - Re-execute H1.1 tests
   - Modify H1.1 baseline
   ```

3. Define H1.2 compatibility verification:
   ```
   H1.2 compatibility proven via NEW compatibility tests:
   
   Test Suite: H1.2 Backward Compatibility (separate from H1.1)
   
   TC1: Old Event Format Compatibility
   - Create event with H1.1 schema (no new columns)
   - H1.2 worker processes event
   - Verify: Success (H1.2 handles missing columns gracefully)
   
   TC2: Old Worker Compatibility (if feasible)
   - Deploy H1.2 schema extensions
   - Simulate H1.1 worker (SELECT without new columns)
   - Verify: H1.1 worker can still claim and process
   
   TC3: Event Contract Stability
   - Verify H1.1 event envelope unchanged
   - tenant_id, event_type, payload structure same
   - Finance API contract unchanged
   
   TC4: Schema Additive Only
   - Verify new columns: DEFAULT or NULLABLE
   - Verify no column removal
   - Verify no type changes
   - Verify H1.1 queries still execute
   ```

4. H1.1 evidence remains untouched:
   ```
   H1.1 Evidence (FROZEN)
       ↓
   Immutable archive
       ↓
   NOT modified by H1.2
   
   H1.2 Compatibility Evidence (NEW)
       ↓
   Separate test suite
       ↓
   Proves H1.2 backward compatible with H1.1 contract
   ```

5. Document compatibility without H1.1 rerun

---

## Conditional Approvals (Clarifications for Implementation Plan)

### C1: Q4 — Retry Count Transaction

**Approved with condition:** Define where `retry_count` increments

**Required clarification in Implementation Plan:**
```
retry_count increment transaction:

Option A: Worker transaction (before Finance POST)
UPDATE finance_outbox_events
SET status = 'FAILED',
    retry_count = retry_count + 1,
    next_retry_at = now() + (2^retry_count * interval '1 second'),
    last_error = :error_message
WHERE event_id = :event_id

Option B: After Finance failure response
(Same as Option A, triggered after Finance returns error)

Decision: Document in Implementation Plan
```

**Confirm:** H1.2 reuses H1.1 idempotency (Finance API level), no second mechanism

---

### C2: Q6 — Bulk Recovery Acceptance

**Approved with condition:** Clarify acceptance criteria

**Required clarification:**
```
OLD: "Replay 500 events → All succeed"

NEW: "Replay 500 events → All reach valid terminal/recoverable state"

Valid outcomes per event:
- PROCESSED: Success (healthy event)
- QUARANTINED: PERMANENT/POISON (validly remains quarantined)
- FAILED: Transient (will retry with backoff)

Acceptance criteria:
- ✅ All 500 events processed through replay pipeline
- ✅ No system overload
- ✅ Healthy events not blocked
- ✅ No duplicates (idempotency preserved)
- ✅ Bounded batches (e.g., 5 batches of 100)
- ❌ NOT required: All 500 reach PROCESSED
```

---

### C3: Q7 — Reconciliation Permission

**Approved with condition:** Clarify security context enforcement

**Required clarification in Implementation Plan:**
```
Reconciliation security context:

Option A: Dedicated read-only DB role
CREATE ROLE h1_2_reconciliation_readonly;
GRANT SELECT ON finance_outbox_events TO h1_2_reconciliation_readonly;
GRANT SELECT ON finance_transactions TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_entries TO h1_2_reconciliation_readonly;
-- NO GRANT INSERT/UPDATE/DELETE

Option B: Application-level RPC with read-only connection
Reconciliation service connects with read-only DB user
Cannot execute INSERT/UPDATE/DELETE (enforced by DB permissions)

Option C: SECURITY DEFINER function with SELECT-only
CREATE FUNCTION reconcile_outbox_ledger() SECURITY DEFINER
  RETURNS TABLE (...) AS $$
  -- Only SELECT queries
  -- No mutations
$$;
GRANT EXECUTE ON FUNCTION reconcile_outbox_ledger TO h1_2_operator;

Decision: Document in Implementation Plan
```

**Prove:** Reconciliation CANNOT mutate F1-F4 (test: attempt INSERT → Permission denied)

---

## Amendment Process

### Step 1: Review Amendments (CURRENT)
- ✅ Architecture Review completed
- ✅ 5 amendments identified (A1-A5)
- ✅ 3 conditional approvals flagged (C1-C3)

### Step 2: Amend Constitution
- [ ] Address A1: Idempotency enforcement chain
- [ ] Address A2: State transition atomicity
- [ ] Address A3: F1-F4 permission boundary
- [ ] Address A4: Replay lifecycle validity
- [ ] Address A5: Compatibility without H1.1 rerun
- [ ] Create H1.2 Constitution v1.3 AMENDED

### Step 3: Re-submit for Review
- [ ] Submit v1.3 for Architecture Review
- [ ] Verify all 5 amendments addressed
- [ ] If APPROVED → Proceed to Implementation Plan
- [ ] If REVISE again → Iterate

### Step 4: Implementation Plan (After Approval)
- [ ] Clarify C1 (retry_count transaction)
- [ ] Clarify C2 (bulk acceptance criteria)
- [ ] Clarify C3 (reconciliation security context)
- [ ] Create H1_2_IMPLEMENTATION_PLAN.md

---

## Status Summary

**Constitution v1.2:** 🔴 NOT APPROVED  
**Required:** 5 amendments (A1-A5)  
**Conditional:** 3 clarifications (C1-C3) for Implementation Plan  
**Next Version:** v1.3 AMENDED  
**Coding Status:** 🚫 BLOCKED (until v1.3 approved)

**Timeline:**
```
v1.2 Review → REVISE (2026-08-17)
    ↓
v1.3 Amendment (in progress)
    ↓
v1.3 Review → ?
    ↓
If APPROVED → Implementation Plan
    ↓
Implementation Review
    ↓
Coding Unlocked
```

---

**Key Principle:**

> Architecture Review found enforcement gaps, not architectural flaws.  
> Constitution is sound — enforcement mechanisms need documentation.  
> 5 amendments required before approval.  
> No full rewrite needed.

---

**END OF AMENDMENT DOCUMENT**
