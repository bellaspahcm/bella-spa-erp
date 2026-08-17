# H1.2 Operational Resilience Constitution

**Version:** v1.3 AMENDED  
**Date:** 2026-08-17  
**Status:** 🔄 AMENDED (Addressing Architecture Review)  
**Prerequisite:** H1.1 🔒 FROZEN

**Amendment History:**
- v1.2 (2026-08-17): Architecture Review → REVISE REQUIRED
- v1.3 (2026-08-17): AMENDED — Addresses A1-A5 + clarifies C1-C3

**Amendments Applied:**
- [x] A1: Idempotency enforcement chain specified
- [x] A2: State transition atomicity defined
- [x] A3: F1-F4 permission boundary enforced
- [x] A4: Replay lifecycle validity corrected
- [x] A5: Compatibility without H1.1 rerun
- [x] C1: Retry count transaction clarified
- [x] C2: Bulk recovery acceptance criteria clarified
- [x] C3: Reconciliation security context specified

**Review Status:**
- [ ] v1.3 reviewed by Architecture Lead
- [ ] All amendments verified (A1-A5)
- [ ] All clarifications verified (C1-C3)
- [ ] Q1-Q8 all PASS
- [ ] Constitution APPROVED

**Sign-off Required Before:** Implementation Plan creation

---

## Constitutional Authority

This document defines the architectural scope, boundaries, and verification requirements for H1.2. No implementation may proceed without this constitution being reviewed and approved.

**Change Control:** Any modification to H1.1 frozen baseline discovered during H1.2 work requires:
1. Architecture Review
2. Change Control approval
3. New evidence documentation
4. Re-freeze H1.1 with updated evidence

**Forbidden:** Silent fixes to H1.1 to support H1.2 requirements.

---

## H1.2 Objective

**Primary Goal:** Prove that the Hospital→Finance integration boundary remains **durable, recoverable, observable, and operationally controllable** under sustained Finance failures, worker failures, malformed/poison events, concurrency, and recovery scenarios, while **preserving all H1.1 guarantees** and **without modifying the F1-F4 financial kernel**.

**Four pillars of H1.2:**
1. **Durable:** Events survive failures without loss
2. **Recoverable:** Failed events can be retried and recovered
3. **Observable:** Operational state is queryable and visible
4. **Controllable:** Operators can intervene and manage failures

**Not in scope:** "Clean up technical debt" or "improve code quality." H1.2 must deliver a new architectural guarantee, not refactoring.

---

## Architectural Boundary

H1.2 builds on top of H1.1's proven foundation:

```
H1.1 Foundation (FROZEN)
├── Finance failure does NOT cause data loss
├── Durable intent capture (Outbox)
├── Automatic retry
├── Exactly-once financial effect
└── Idempotency guarantee

H1.2 Extension (NEW)
├── Sustained failure management
├── Retry policy enforcement
├── Operational observability
├── Recovery mechanisms
├── Poison event handling
└── Operational intervention support
```

**Boundary constraint:** H1.2 operates ABOVE H1.1. It may not modify:
- F1-F4 Kernel
- H1.1 contract semantic
- H1.1 outbox schema (may extend, not modify)
- H1.1 proven behavior

---

## H1.2 Scope

### In Scope

1. **Retry Policy**
   - Exponential backoff enforcement
   - Max retry limit
   - Retry exhaustion handling

2. **Failure Classification**
   - Transient vs permanent failure detection
   - Retry-eligible vs non-retry-eligible errors
   - Poison event identification

3. **Dead Letter / Quarantine**
   - Events exceeding max retry → quarantine
   - Manual review capability
   - Replay mechanism

4. **Stuck Processing Detection**
   - Lease expiration monitoring
   - Stuck PROCESSING recovery
   - Worker crash resilience

5. **Observability**
   - Outbox health metrics
   - Retry distribution
   - Failure rate tracking
   - SLA breach detection

6. **Operational Recovery**
   - Manual event replay
   - Bulk recovery tools
   - Reconciliation support

7. **Alerting**
   - Critical failure threshold
   - Stuck event detection
   - Dead letter accumulation

### Out of Scope (for H1.2)

- Load testing (separate phase)
- Performance optimization (not a guarantee)
- Multi-region replication (future phase)
- Event versioning/migration (future phase)
- Hospital HTTP endpoint creation (not H1.2 dependency)
- 366 backlog processing (not test fixture)

---

## Dependencies

### H1.1 Dependencies (FROZEN)

H1.2 assumes H1.1 guarantees remain valid:
- ✅ Outbox write succeeds when Finance unavailable
- ✅ Worker claims events atomically
- ✅ Finance idempotency prevents duplicates
- ✅ Journal posting is exactly-once
- ✅ Retry does not create duplicate journals

### New Dependencies

- Outbox schema extension (non-breaking):
  - `retry_policy` metadata
  - `failure_classification` enum
  - `quarantine_reason` text
  - `manual_intervention_required` boolean

- New tables/views (non-invasive):
  - `finance_outbox_dead_letters`
  - `finance_outbox_health_dashboard` (view)

- Monitoring infrastructure (external):
  - Alerting system integration
  - Dashboard tooling

---

## Invariants (Must Not Break)

### H1.1 Behavioral Guarantees
- Finance failure → Hospital success (P1)
- Durable outbox (P2)
- Failure delivery captured (P3)
- Financial recovery (P4)
- Duplicate protection (P5)

### H1.2 Core Invariants

**H1.2-I1: No Financial Duplication** *(AMENDED — A1)*

**Invariant:** One idempotency key → At most one financial transaction

**Enforcement Chain:**
```
1. Event Created
   ↓
2. Idempotency Key Derivation
   idempotency_key = hash(tenant_id || event_type || source_transaction_id)
   ↓
3. Worker Atomic Claim
   UPDATE finance_outbox_events
   SET claimed_by = :worker_id,
       claimed_at = now(),
       lease_expires_at = now() + interval '60 seconds',
       status = 'PROCESSING'
   WHERE event_id = :event_id
     AND status = 'PENDING'
     AND (lease_expires_at IS NULL OR lease_expires_at < now())
     AND claimed_by IS NULL
   RETURNING event_id
   -- Verify affected_rows = 1 (atomic claim success)
   ↓
4. Finance API POST with idempotency_key
   ↓
5. Finance Transaction Check
   SELECT id FROM finance_transactions WHERE idempotency_key = :key
   IF EXISTS → Return ALREADY_PROCESSED
   ↓
6. Finance Transaction Creation (Atomic)
   BEGIN;
   INSERT INTO finance_transactions (idempotency_key, ...) VALUES (:key, ...);
   INSERT INTO journal_entries (...) VALUES (...);
   INSERT INTO journal_lines (...) VALUES (...);
   COMMIT;
   -- DB UNIQUE constraint on finance_transactions(idempotency_key)
   ↓
7. Worker Marks PROCESSED
   UPDATE finance_outbox_events
   SET status = 'PROCESSED', processed_at = now()
   WHERE event_id = :event_id
```

**Authoritative Idempotency:**
- Table: `finance_transactions` 
- Constraint: `UNIQUE(idempotency_key)`
- This is the single source of truth for idempotency

**Recovery Scenarios:**
1. **Concurrent Claim:** Worker A and B race on same event
   - Only 1 succeeds atomic claim (affected_rows = 1)
   - Other fails claim, moves to next event

2. **Crash After Finance Commit:** Worker claims → Finance commits → Worker crashes before marking PROCESSED
   - Lease expires → Event returns to PENDING
   - Next worker claims → Posts to Finance
   - Finance checks idempotency_key → Already exists → Returns ALREADY_PROCESSED
   - Worker marks PROCESSED
   - Result: Exactly one transaction, no duplicate

3. **Manual Replay:** Event QUARANTINED → Operator replays
   - Event reset to PENDING
   - Worker claims → Posts to Finance
   - If Finance already processed: ALREADY_PROCESSED
   - If not: Creates transaction (idempotency enforced)
   - Result: At most one transaction

**Proof Requirements:**
- Test: 2 workers simultaneously claim same event → Only 1 claim succeeds
- Test: Worker crashes after Finance commit → Replay → Finance returns ALREADY_PROCESSED → No duplicate journal
- Test: Bulk replay 100 events (some already processed) → No duplicates
- Evidence: Query `SELECT idempotency_key, COUNT(*) FROM finance_transactions GROUP BY idempotency_key HAVING COUNT(*) > 1` → 0 rows

---

**H1.2-I2: No Event Loss** *(AMENDED — A2)*

**Invariant (Strengthened):** Accepted financial intent must always remain in an authoritative, queryable state. Every non-terminal state must have a deterministic recovery path.

**State Machine:**
```
PENDING → PROCESSING → PROCESSED (terminal)
   ↓          ↓
   ↓      FAILED (transient, will retry)
   ↓          ↓
   └──────→ QUARANTINED (terminal, requires manual intervention)
```

**State Transition Atomicity:**

All state transitions occur within database transactions:

1. **PENDING → PROCESSING (Claim)**
   ```sql
   UPDATE finance_outbox_events
   SET status = 'PROCESSING',
       claimed_by = :worker_id,
       claimed_at = now(),
       lease_expires_at = now() + interval '60 seconds'
   WHERE event_id = :event_id AND status = 'PENDING' ...
   -- Atomic, single transaction
   ```

2. **PROCESSING → PROCESSED (Success)**
   ```sql
   UPDATE finance_outbox_events
   SET status = 'PROCESSED',
       processed_at = now()
   WHERE event_id = :event_id AND status = 'PROCESSING'
   ```

3. **PROCESSING → FAILED (Transient Failure)** *(C1 CLARIFICATION)*
   ```sql
   UPDATE finance_outbox_events
   SET status = 'FAILED',
       retry_count = retry_count + 1,
       next_retry_at = now() + (power(2, retry_count) * interval '1 second'),
       last_error = :error_message,
       last_attempt_at = now()
   WHERE event_id = :event_id AND status = 'PROCESSING'
   -- retry_count increments in THIS transaction, after Finance failure response
   ```

4. **FAILED → QUARANTINED (Exhaustion)**
   ```sql
   UPDATE finance_outbox_events
   SET status = 'QUARANTINED',
       quarantine_reason = 'MAX_RETRY_EXCEEDED',
       quarantined_at = now()
   WHERE event_id = :event_id
     AND status = 'FAILED'
     AND retry_count >= :max_retry
   ```

5. **PROCESSING → PENDING (Lease Recovery)**
   ```sql
   UPDATE finance_outbox_events
   SET status = 'PENDING',
       claimed_by = NULL,
       claimed_at = NULL,
       lease_expires_at = NULL
   WHERE status = 'PROCESSING'
     AND lease_expires_at < now()
   -- Cleanup job, atomic transaction
   ```

6. **QUARANTINED → PENDING (Replay)** *(A4 AMENDMENT — Concurrency Guard)*
   ```sql
   UPDATE finance_outbox_events
   SET status = 'PENDING',
       retry_count = 0,
       replayed_at = now(),
       replayed_by = :operator_id,
       claimed_by = NULL,
       lease_expires_at = NULL
   WHERE event_id = :event_id
     AND status = 'QUARANTINED'
     AND (claimed_by IS NULL OR lease_expires_at < now())
   RETURNING event_id
   -- Verify affected_rows = 1 (prevents concurrent replay)
   ```

**Recovery Paths:**

| Current State | Recovery Path | Trigger |
|---------------|---------------|---------|
| PENDING | Normal processing | Worker claims |
| PROCESSING | Lease expires → PENDING | Cleanup job |
| FAILED | Retry with backoff → PENDING/QUARANTINED | Worker retry logic |
| QUARANTINED | Manual replay → PENDING | Operator action |
| PROCESSED | None (terminal) | N/A |

**Failure Windows Addressed:**

1. **Claim Success → DB Connection Loss → Status Update Unknown**
   - Transaction rollback → State unchanged (remains PENDING)
   - Event queryable, recoverable by next worker

2. **PENDING → QUARANTINE Transition → Worker Crash Mid-Transaction**
   - Transaction rollback → State remains at previous valid state
   - Lease recovery or retry logic restores to PENDING

3. **Worker Crash Any Time**
   - If before claim commit: Event remains PENDING
   - If after claim commit: Lease protection → Expires → Returns to PENDING
   - Event always in valid, queryable state

**Proof Requirements:**
- Test: State transition audit — All events accounted for in PENDING/PROCESSING/FAILED/PROCESSED/QUARANTINED
- Test: Crash at every transition point → Event always in valid state
- Test: DB connection loss during transition → Query event → State consistent → Recoverable
- Evidence: No events with NULL status, no events outside state machine

---

**H1.2-I3: Failure Must Not Corrupt F1-F4** *(AMENDED — A3)*

**Invariant:** Any failure in H1.2 components (worker, retry engine, quarantine, replay, observability) MUST NOT cause F1-F4 ledger to enter accounting-invalid state.

**Permission Boundary Enforcement:**

**H1.2 Service Role:** `h1_2_worker`

**Permissions:**
```sql
-- H1.2 Worker Permissions
GRANT SELECT, INSERT, UPDATE ON finance_outbox_events TO h1_2_worker;
GRANT SELECT ON finance_transactions TO h1_2_worker; -- Idempotency check only
REVOKE INSERT, UPDATE, DELETE ON finance_transactions FROM h1_2_worker;
REVOKE ALL ON journal_entries FROM h1_2_worker;
REVOKE ALL ON journal_lines FROM h1_2_worker;
REVOKE ALL ON accounts FROM h1_2_worker;
REVOKE ALL ON chart_of_accounts FROM h1_2_worker;
-- All F1-F4 Kernel tables: SELECT only or NO ACCESS
```

**Architecture Boundary:**
```
H1.2 Worker (h1_2_worker role)
    ↓
HTTP POST to Finance API (boundary enforcement)
    ↓
Finance API (finance_api_service role)
    ↓
F1-F4 Kernel (full permissions)
```

**Only Finance API service role can INSERT/UPDATE/DELETE F1-F4 tables.**

**Enforcement Mechanisms:**
1. **DB Permission:** H1.2 role physically cannot mutate F1-F4 tables
2. **API Boundary:** All financial effects via Finance HTTP endpoint (not direct DB)
3. **Worker Code:** No `INSERT INTO journal_entries` statements in H1.2 codebase
4. **Replay/Recovery:** Must POST to Finance API, cannot bypass to direct ledger write
5. **Reconciliation:** SELECT-only permissions *(C3 CLARIFICATION below)*

**F1-F4 Integrity Proof (Strengthened):**

H1.2 failure must NOT cause:
1. **Unauthorized F1-F4 mutation:** No INSERT/UPDATE/DELETE outside Finance API
2. **Orphan journal entries:** No journal_entries without outbox event
3. **Duplicate journals:** Idempotency enforced (I1)
4. **Journal lines without parent:** Foreign key constraints intact
5. **All F1-F4 invariants:**
   - Dr = Cr per journal
   - Journal status valid
   - Account balances correct
   - Tenant isolation (N2)
   - COA integrity

**Recovery Scenarios:**
1. **H1.2 Worker Crashes:** 
   - Lease expires → Event returns to PENDING
   - No direct F1-F4 access → F1-F4 unchanged
   - Proof: Query F1-F4 invariants → All intact

2. **Reconciliation Job Has Bug:**
   - SELECT-only permission → Cannot mutate ledger
   - Bug causes query failure → F1-F4 unchanged
   - Proof: Attempt INSERT from reconciliation context → Permission denied

3. **Replay Logic Corrupted:**
   - Replay must POST to Finance API (enforced by lack of direct DB permission)
   - Finance API enforces idempotency
   - Proof: Replay event → Finance returns ALREADY_PROCESSED if duplicate

**Proof Requirements:**
- Test: Kill H1.2 worker mid-processing → Query F1-F4 → Dr=Cr valid, no orphans, no duplicates
- Test: H1.2 worker attempts `INSERT INTO journal_entries` → Permission denied
- Test: Reconciliation attempts `UPDATE journal_entries` → Permission denied
- Test: Inject H1.2 failures → All F1-F4 invariants remain intact
- Evidence: F1-F4 integrity checks pass after all H1.2 failure scenarios

**C3 CLARIFICATION: Reconciliation Security Context**

**Reconciliation Service Role:** `h1_2_reconciliation_readonly`

**Permissions:**
```sql
-- Reconciliation Read-Only Permissions
GRANT SELECT ON finance_outbox_events TO h1_2_reconciliation_readonly;
GRANT SELECT ON finance_transactions TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_entries TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_lines TO h1_2_reconciliation_readonly;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES FROM h1_2_reconciliation_readonly;
```

**Enforcement:**
- Reconciliation service connects with `h1_2_reconciliation_readonly` role
- DB enforces SELECT-only (cannot execute INSERT/UPDATE/DELETE)
- Reconciliation function is read-only by permission, not just convention

**Proof:**
```sql
-- Test: Reconciliation context attempts mutation
SET ROLE h1_2_reconciliation_readonly;
INSERT INTO journal_entries (...) VALUES (...);
-- Expected: ERROR: permission denied for table journal_entries

UPDATE journal_entries SET status = 'POSTED' WHERE id = '...';
-- Expected: ERROR: permission denied for table journal_entries
```

### Other Constraints

1. **F1-F4 Kernel Isolation**
   - No Kernel modifications
   - No direct Kernel table access from H1.2 code

2. **Tenant Isolation**
   - N2 guarantee preserved
   - Tenant A cannot access Tenant B quarantine

3. **Contract Stability**
   - N3 guarantee preserved
   - Hospital→Finance envelope unchanged

4. **Schema Backward Compatibility**
   - Schema extensions must be additive and backward-compatible with H1.1 writers, readers, workers, and frozen event contracts
   - H1.2 migrations MUST NOT break H1.1 baseline

---

## Verification Gates

### Gate Structure

Gates are organized into four operational groups:

```
Group A: Delivery Reliability (O1, O2)
    ↓
Group B: Failure Recovery (O3, O4)
    ↓
Group C: Operator Control (O5, O6, O9)
    ↓
Group D: Operational Intelligence (O7, O8, O10)
```

**Dependency flow:**
```
                 H1.1 FROZEN
                      │
                      ▼
                 H1.2 Baseline
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
         O1                      O2
     Retry Policy        Failure Classification
          │                       │
          └───────────┬───────────┘
                      ▼
                     O3
                Poison Event
                      │
                      ▼
                     O4
              Lease Recovery
                      │
             ┌────────┴────────┐
             ▼                 ▼
            O5                 O6
        Quarantine           Replay
             │                 │
             └────────┬────────┘
                      ▼
                     O9
                 Bulk Recovery
                      │
             ┌────────┴────────┐
             ▼                 ▼
            O7                 O8
      Observability         Alerting
             │                 │
             └────────┬────────┘
                      ▼
                    O10
               Reconciliation
```

---

### Group A: Delivery Reliability

### O1: Retry Policy Enforcement
**Requirement:** Events must follow exponential backoff retry schedule without busy-looping or duplicate claims.

**Test scenario:**
1. Create event with failing Finance endpoint
2. Worker attempts delivery
3. Verify retry intervals follow exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s
4. Verify `next_retry_at` set correctly after each failure
5. Verify worker does NOT re-claim before `next_retry_at`
6. Verify max retry limit enforced (e.g., 10 attempts)
7. Verify event moved to quarantine after exhaustion

**Evidence required:**
- Event retry timestamps follow exponential curve (not linear, not random)
- `retry_count` increments correctly (0 → 1 → 2 → ... → max)
- `next_retry_at` computed correctly: `now + (2^retry_count * base_interval)`
- Worker respects `next_retry_at` (no premature claims)
- Event status = QUARANTINED after max retry exceeded
- No retry attempts after quarantine
- Healthy events (not failing) are NOT blocked by retrying events

---

### O2: Failure Classification
**Requirement:** System must distinguish transient vs permanent failures and apply correct retry policy.

**Failure Taxonomy:**

| Classification | Definition | Examples | Retry Behavior |
|----------------|------------|----------|----------------|
| **TRANSIENT** | Temporary condition, likely to resolve | 503, timeout, network failure, worker crash (non-deterministic) | Retry with backoff |
| **PERMANENT** | Event/payload invalid, will never succeed | 400 Bad Request, 422 Unprocessable Entity, schema violation | Quarantine immediately (no retry) |
| **POISON** | Event causes deterministic repeated failure | Same event → multiple worker crashes, infinite loop, memory exhaustion | Quarantine after poison threshold (e.g., 3 crash cycles) |
| **UNKNOWN** | Unclassified error | Novel error codes, unexpected exceptions | Retry with backoff (safe default) |

**Important distinction:**
- **Worker crash (transient):** Worker process failure, event may succeed on retry with different worker
- **Poison event:** Specific event payload causes repeatable failure across different worker instances
- **Test:** If event succeeds after worker restart → TRANSIENT. If event fails deterministically → POISON.

**Test scenarios:**

| Scenario | Finance Response | Classification | Expected Behavior |
|----------|------------------|----------------|-------------------|
| Network timeout | Timeout after 30s | TRANSIENT | Retry with backoff |
| Service unavailable | 503 Service Unavailable | TRANSIENT | Retry with backoff |
| Worker crash (non-deterministic) | Process killed, OOM, signal 9 | TRANSIENT | Lease recovery → Retry |
| Invalid event schema | 400 Bad Request | PERMANENT | Quarantine immediately, no retry |
| Schema violation | 422 Unprocessable Entity | PERMANENT | Quarantine immediately, no retry |
| Malformed payload causing crash | Circular JSON, infinite loop | POISON | Crash detection → After N cycles → Quarantine |
| Internal error | 500 Internal Server Error | TRANSIENT | Retry with backoff |

**Evidence required:**
- 503 / timeout / worker crash (transient) → `failure_class = TRANSIENT` → `retry_count` increments → retry occurs via O4 lease recovery
- 400 / 422 → `failure_class = PERMANENT` → QUARANTINED immediately → `retry_count = 0`
- Deterministic repeated worker crash → `failure_class = POISON` → QUARANTINED after poison threshold
- Retry policy NOT applied to PERMANENT failures
- `last_error` captured with classification metadata

---

### Group B: Failure Recovery

### O3: Poison Event Handling
**Requirement:** Events causing deterministic repeated failures must be quarantined without blocking healthy events.

**Critical distinction:** Worker crash is handled by O4 (Lease Recovery) as TRANSIENT. POISON classification applies when the SAME event causes REPEATED DETERMINISTIC failures across different worker instances.

**Poison Detection Logic:**
```
Event processed by Worker A → Crash
    ↓
Lease expires → O4 recovery
    ↓
Event processed by Worker B → Crash
    ↓
Lease expires → O4 recovery
    ↓
Event processed by Worker C → Crash
    ↓
Poison threshold exceeded (e.g., 3 crash cycles)
    ↓
Classification: POISON
    ↓
QUARANTINE
```

**Test scenario:**
1. Create event with malformed payload causing deterministic crash (e.g., circular JSON reference, infinite loop trigger)
2. Worker A claims event → crashes
3. Lease expires → O4 recovery → Event returns to PENDING
4. Worker B claims event → crashes (same root cause)
5. Lease expires → O4 recovery
6. Worker C claims event → crashes (deterministic pattern confirmed)
7. After N crash cycles (e.g., 3), system detects poison pattern
8. Event moved to QUARANTINED with `failure_class = POISON`
9. Verify subsequent workers do NOT claim quarantined event
10. **Critical:** Verify healthy events behind poison event are NOT blocked

**Evidence required:**
- Worker crash detection logged for each cycle (exit code, signal, unexpected termination)
- Event recovered via O4 between each crash (PROCESSING → PENDING)
- Crash count tracked: `poison_crash_count` incremented each cycle
- After threshold: Event moved to QUARANTINED with `failure_class = POISON` and `quarantine_reason = "DETERMINISTIC_REPEATED_FAILURE"`
- Subsequent workers skip quarantined event
- **Poison event does NOT block processing of healthy events in queue**
- Processing continues for non-poison events

---

### O4: Stuck Processing Recovery
**Requirement:** Events stuck in PROCESSING due to worker crash must be recoverable without data loss or duplicate financial transactions.

**Test scenario:**
1. Worker claims event → status = PROCESSING, `claimed_at` set, `lease_expires_at` = now + 60s
2. Simulate worker crash (kill process mid-processing, before Finance POST)
3. Wait for lease expiration (60 seconds)
4. Cleanup job runs: `cleanup_stale_finance_outbox_leases()`
5. Verify event returned to PENDING
6. Next worker claims and successfully processes event
7. Verify exactly one journal created (no duplicate from failed attempt)

**Evidence required:**
- Event status: PROCESSING → PENDING after lease expiration
- `claimed_by`, `claimed_at`, `lease_expires_at` reset to NULL
- Next worker successfully completes delivery
- Finance idempotency check passes (no duplicate if worker crashed AFTER Finance POST but BEFORE marking PROCESSED)
- Exactly one journal in F1-F4 ledger

---

### Group C: Operator Control

### O5: Dead Letter Visibility
**Requirement:** Quarantined events must be visible to operators with sufficient metadata for triage and decision-making.

**Test scenario:**
1. Create events that hit max retry or permanent failures
2. Verify events moved to QUARANTINED
3. Query dead letter queue: `SELECT * FROM finance_outbox_dead_letters` (or filtered view)
4. Verify operator can retrieve:
   - `event_id`
   - `tenant_id`
   - `event_type`
   - `failure_class` (TRANSIENT, PERMANENT, POISON)
   - `quarantine_reason` (e.g., "MAX_RETRY_EXCEEDED", "INVALID_EVENT", "POISON_EVENT")
   - `retry_count`
   - `last_error` (full error message)
   - `first_attempt_at`
   - `last_attempt_at`
   - `quarantined_at`
   - Event payload (for inspection)

**Evidence required:**
- Dead letter query returns all quarantined events
- All metadata fields populated correctly
- Events filterable by `tenant_id`, `failure_class`, `quarantine_reason`
- Payload accessible for debugging

---

### O6: Manual Replay *(AMENDED — A4)*
**Requirement:** Operators must be able to replay quarantined events after fixing root cause, preserving idempotency and producing exactly-once financial effect.

**Critical constraint:** Replay MUST NOT bypass normal outbox pipeline or Finance idempotency. Replay is NOT a "manual journal creation."

**Valid Replay Scenarios:**

**Scenario 1: Orphaned Event (Finance Already Committed)**
```
Event: QUARANTINED (marked incorrectly or crashed after Finance POST)
Finance: Transaction already exists (idempotency_key present)
Replay: QUARANTINED → PENDING → Worker claims → Finance API → ALREADY_PROCESSED → Mark PROCESSED
Result: No duplicate, event properly reconciled
```

**Scenario 2: Genuine Quarantine After Max Retry**
```
Event: QUARANTINED (retry_count >= max_retry, transient failure)
Root cause: Fixed (Finance service restored)
Replay: QUARANTINED → PENDING → Worker claims → Finance API → Success → Journal created → Mark PROCESSED
Result: Exactly-once delivery
```

**Scenario 3: Permanent Failure, Payload Corrected**
```
Event: QUARANTINED (422 Unprocessable Entity, bad payload)
Payload: Manually corrected or root cause fixed
Replay: QUARANTINED → PENDING → Worker claims → Finance API → Success → Mark PROCESSED
Result: Exactly-once delivery
```

**INVALID Scenario (REMOVED from v1.2):**
```
❌ Event: PROCESSED → Manually mark QUARANTINED → Replay
This is artificial test fixture, not valid lifecycle.
PROCESSED is terminal, should not transition to QUARANTINED for testing.
```

**Replay Concurrency Safety:**

Replay operation must be atomic with concurrency guard:

```sql
UPDATE finance_outbox_events
SET status = 'PENDING',
    retry_count = 0,
    replayed_at = now(),
    replayed_by = :operator_id,
    claimed_by = NULL,
    lease_expires_at = NULL
WHERE event_id = :event_id
  AND status = 'QUARANTINED'  -- Cannot replay PROCESSED/PROCESSING
  AND (claimed_by IS NULL OR lease_expires_at < now())  -- Not currently being processed
RETURNING event_id;
-- Verify affected_rows = 1 (atomic, prevents concurrent replay)
```

**Race Conditions Protected:**
1. **Operator A + Operator B replay same event:** Only 1 succeeds UPDATE (affected_rows = 1), other fails
2. **Operator replay + Worker claiming:** Atomic state transition prevents race
3. **Replay during active processing:** Blocked by `claimed_by IS NOT NULL AND lease_expires_at >= now()` condition

**Test scenarios:**
1. Event QUARANTINED (max retry) → Root cause fixed → Replay → Worker processes → Finance API → Success → PROCESSED
2. Event QUARANTINED (orphaned) → Replay → Worker processes → Finance API → ALREADY_PROCESSED → PROCESSED (no duplicate)
3. Operator A and B simultaneously replay same event → Only 1 succeeds, other gets affected_rows = 0
4. Replay event currently being processed by worker → Replay fails (concurrent processing guard)

**Evidence required:**
- QUARANTINED → PENDING transition logged with operator_id
- `retry_count` reset to 0
- Worker processes via normal Finance API (not direct ledger write)
- Finance idempotency prevents duplicate (orphaned case)
- Exactly one journal in ledger (no duplicate from replay)
- Concurrent replay operations serialized (only 1 succeeds per event)
- Replay respects tenant isolation (cannot replay Tenant B event from Tenant A context)

---

### O7: Observability Metrics
**Requirement:** Operational state must be queryable deterministically. System must expose facts about current outbox health, NOT build a complete dashboard platform.

**Scope:** H1.2 proves operational facts are observable. UI dashboard implementation is out of scope (future phase).

**Metrics required:**

| Metric | Definition | Query Method |
|--------|------------|--------------|
| `pending_count` | Events in PENDING state | `SELECT COUNT(*) FROM finance_outbox_events WHERE status = 'PENDING'` |
| `processing_count` | Events in PROCESSING state | Count PROCESSING |
| `failed_count` | Events in FAILED state (retrying) | Count FAILED |
| `quarantined_count` | Events in QUARANTINED state | Count QUARANTINED |
| `processed_count_24h` | Successfully processed in last 24h | Count PROCESSED WHERE processed_at > now() - 24h |
| `avg_retry_count` | Average retry count for failed events | AVG(retry_count) WHERE status IN ('FAILED', 'QUARANTINED') |
| `p95_delivery_latency` | 95th percentile PENDING → PROCESSED time | Percentile calculation |
| `oldest_pending_age` | Age of oldest PENDING event | now() - MIN(created_at) WHERE status = 'PENDING' |
| `stuck_processing_count` | Events with expired leases | Count WHERE status = 'PROCESSING' AND lease_expires_at < now() |
| `last_success` | Timestamp of last successful delivery | MAX(processed_at) |
| `last_failure` | Timestamp of last failure | MAX(updated_at) WHERE status = 'FAILED' |

**Test scenario:**
1. Create mix of events (successful, retrying, quarantined, stuck)
2. Query health metrics view or execute individual queries
3. Verify counts match actual event states
4. Verify metrics filterable by `tenant_id`

**Evidence required:**
- All metrics return correct values
- Metrics match ground truth (actual event counts)
- Queries execute in reasonable time (<1s for 10k events)
- Tenant isolation enforced (Tenant A cannot see Tenant B metrics)

**NOT required for H1.2:**
- Real-time dashboard UI
- Historical trend graphs
- Anomaly detection algorithms
- Predictive analytics

---

### Group D: Operational Intelligence

### O8: Operational Alert Thresholds
**Requirement:** System must detect operational anomalies via threshold checks. Scope limited to threshold-based detection, NOT anomaly detection algorithms.

**Scope:** H1.2 proves threshold breaches are detectable. Alert notification platform implementation is out of scope (future phase).

**Alert triggers:**

| Alert | Condition | Severity | Detection Method |
|-------|-----------|----------|------------------|
| High Pending Backlog | `pending_count > 1000` | WARNING | Query count |
| Quarantine Accumulation | `quarantined_count > 100` | CRITICAL | Query count |
| Stuck Events | `stuck_processing_count > 10` | WARNING | Query lease expiration |
| Processing Lag | `oldest_pending_age > 5 minutes` | WARNING | Query oldest event |
| High Failure Rate | `(failed_count / total_count) > 0.5` in last 1h | CRITICAL | Ratio calculation |

**Test scenario:**
1. Simulate high failure rate (e.g., Finance DOWN for 1 hour, 500+ events fail)
2. Query alert conditions
3. Verify threshold breached: `quarantined_count > 100` → CRITICAL
4. Resolve condition (Finance UP, replay events)
5. Verify threshold no longer breached

**Evidence required:**
- Threshold breach detected via query
- Alert condition includes metric values and threshold (e.g., "quarantined_count = 150 > threshold 100")
- Alert cleared when condition resolves
- Tenant-specific thresholds supported

**NOT required for H1.2:**
- Real-time alert notification system
- Machine learning anomaly detection
- Predictive alerting
- Alert escalation workflows

---

### O9: Bulk Recovery *(CLARIFIED — C2)*
**Requirement:** Operators must be able to recover multiple quarantined events in bulk after fixing systemic root cause.

**Critical constraints:**
- Bounded batch size (e.g., 100 events per operation)
- Concurrency control (prevent race conditions)
- Idempotency preserved (no duplicate journals)
- Tenant isolation (bulk operation scoped to tenant)
- Healthy event processing NOT blocked during bulk recovery
- **366 backlog MUST NOT be used as test fixture**

**C2 CLARIFICATION: Acceptance Criteria**

**OLD (v1.2 — INCORRECT):**
```
"Replay 500 events → All 500 succeed → All reach PROCESSED"
```

**NEW (v1.3 — CORRECT):**
```
"Replay 500 events → All 500 reach valid terminal/recoverable state"
```

**Valid Outcomes Per Event:**
| Outcome | Status | Meaning | Valid? |
|---------|--------|---------|--------|
| Success | PROCESSED | Event delivered successfully | ✅ Valid |
| Permanent Failure | QUARANTINED (PERMANENT) | Payload invalid, will never succeed | ✅ Valid |
| Poison Event | QUARANTINED (POISON) | Deterministic repeated failure | ✅ Valid |
| Transient Failure | FAILED | Temporary issue, will retry | ✅ Valid |

**Bulk recovery does NOT require all events to reach PROCESSED.**

Some events may legitimately remain QUARANTINED (PERMANENT/POISON) after bulk replay.

**Acceptance Criteria:**
1. ✅ All 500 events processed through replay pipeline
2. ✅ No system overload (bounded batches)
3. ✅ Healthy events NOT blocked
4. ✅ Each event reaches valid terminal/recoverable state
5. ✅ No duplicates (idempotency preserved)
6. ❌ NOT required: All 500 reach PROCESSED

**Test scenario:**
1. Create 500 quarantined events:
   - 450 events: Transient failure (FINANCE_503_TIMEOUT) — Should succeed after replay
   - 30 events: Permanent failure (422 Unprocessable) — Should remain QUARANTINED
   - 20 events: Poison event — Should remain QUARANTINED after poison threshold

2. Root cause fixed for transient failures (Finance service restored)

3. Operator issues bulk replay: `replay_quarantined_events_by_reason('FINANCE_503_TIMEOUT', tenant_id='<TENANT>', limit=500)`

4. Verify outcomes:
   - 450 transient: QUARANTINED → PENDING → PROCESSED
   - 30 permanent: QUARANTINED → PENDING → QUARANTINED (immediate, no retry)
   - 20 poison: QUARANTINED → PENDING → FAILED → QUARANTINED (after poison threshold)

5. Verify:
   - All 500 events processed (not stuck)
   - 450 journals created (transient success)
   - No duplicates (idempotency enforced)
   - Healthy events continue processing
   - System not overloaded (batched: 5 batches of 100)

**Evidence required:**
- Bulk operation `affected_count` matches query (500 events reset to PENDING)
- 450 events: QUARANTINED → PENDING → PROCESSED (journals created, no duplicates)
- 30 events: Remain QUARANTINED (PERMANENT, validly not processed)
- 20 events: Remain QUARANTINED (POISON, validly not processed)
- No duplicate journals (verify via idempotency key uniqueness)
- Tenant isolation enforced
- Concurrent processing safe
- Healthy events NOT blocked

---

### O10: Reconciliation Support
**Requirement:** System must support reconciliation between outbox state and Finance ledger state. Reconciliation DETECTS inconsistencies; it does NOT automatically correct the ledger.

**Scope:** H1.2 proves discrepancies are detectable. Automatic correction is out of scope (requires manual review and approval).

**Discrepancy types to detect:**

| Discrepancy | Definition | Possible Cause |
|-------------|------------|----------------|
| Orphaned Journal | Outbox = PENDING/FAILED but Journal exists | Worker crashed after Finance POST but before marking PROCESSED |
| Missing Journal | Outbox = PROCESSED but Journal does NOT exist | Finance idempotency failed; Race condition |
| Duplicate Journal | One idempotency key → Multiple journals | Idempotency bypass; Replay bug |
| Tenant Mismatch | Outbox tenant ≠ Journal tenant | Data corruption; Security breach |

**Test scenario:**
1. Create normal events: Outbox PROCESSED ↔ Journal exists (consistent)
2. Simulate orphaned journal: Manually create journal without updating outbox
3. Simulate missing journal: Mark outbox PROCESSED without creating journal
4. Run reconciliation query:
   ```sql
   SELECT 
     o.event_id,
     o.status AS outbox_status,
     o.tenant_id,
     j.id AS journal_id,
     j.status AS journal_status,
     CASE 
       WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
       WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
       ELSE 'CONSISTENT'
     END AS discrepancy_type
   FROM finance_outbox_events o
   LEFT JOIN journal_entries j ON j.id = o.transaction_id
   WHERE discrepancy_type != 'CONSISTENT';
   ```
5. Generate reconciliation report

**Evidence required:**
- Reconciliation query identifies all discrepancies
- Report includes: `event_id`, `outbox_status`, `journal_status`, `discrepancy_type`
- Consistent events NOT flagged
- Discrepancies actionable (includes enough context for manual resolution)
- Tenant-scoped reconciliation supported

**NOT required for H1.2:**
- Automatic ledger correction
- Automated rollback/replay
- Self-healing reconciliation

**Manual resolution guidance:**
- `ORPHANED_JOURNAL`: Mark outbox PROCESSED (Finance already succeeded)
- `MISSING_JOURNAL`: Replay event (if Finance idempotency safe) OR manually create journal with evidence
- `DUPLICATE_JOURNAL`: Archive duplicate, investigate idempotency bug

---

## Behavioral Evidence Requirements

For each gate (O1-O10), evidence must include:

1. **Test execution log:** Timestamped steps with actual commands/queries
2. **State transitions:** Event status before/after each operation
3. **Database evidence:** SQL query results showing actual data
4. **Worker logs:** Structured logs from worker execution
5. **Metric snapshots:** Health dashboard state during test
6. **Failure injection:** How failure was simulated
7. **Recovery proof:** Successful delivery after intervention

**NOT acceptable:**
- "The code looks correct"
- "Schema supports this feature"
- "Worker has retry logic"

**Required:**
- "Event `<ID>` transitioned PENDING → FAILED (retry 3) → QUARANTINED"
- "Replay command executed → Event `<ID>` → PROCESSED → Journal `<TXN_ID>` POSTED"

---

## Failure Scenarios

H1.2 must prove resilience under:

1. **Sustained Finance downtime** (1+ hours)
2. **Intermittent Finance failures** (flaky 503)
3. **Invalid event payloads** (malformed JSON, schema violation)
4. **Worker crashes** (mid-processing, during claim)
5. **Database connection loss** (transient)
6. **Lease expiration** (stuck PROCESSING)
7. **Poison events** (causing worker crashes)
8. **High event volume** (backlog accumulation)
9. **Concurrent worker operations** (race conditions)
10. **Manual intervention** (operator replay during active processing)

**Evidence required:** Each scenario tested with documented state transitions and recovery proof.

---

## Acceptance Criteria

H1.2 is considered **PROVEN** when all **Five Core Questions** are answered with behavioral evidence:

### Five Core Questions

**Q1: Does the system lose events?**
- **Answer Required:** NO
- **Evidence:** All accepted financial intents remain in PENDING, PROCESSING, PROCESSED, or QUARANTINED (never disappear)

**Q2: Does the system retry infinitely?**
- **Answer Required:** NO
- **Evidence:** Max retry enforced → Events quarantine after exhaustion

**Q3: If worker crashes mid-processing, what happens?**
- **Answer Required:** Event becomes recoverable
- **Evidence:** Lease expiration → Event returns to PENDING → Next worker succeeds → Exactly-once journal

**Q4: Can operators intervene on failed events?**
- **Answer Required:** YES
- **Evidence:** Quarantined events visible → Operator replay → Event processes successfully → Exactly-once journal

**Q5: After all failures, retries, and replays, does the ledger have duplicates or imbalance?**
- **Answer Required:** NO
- **Evidence:** One idempotency key → At most one journal → Dr = Cr → F1-F4 integrity intact

---

### Gate Acceptance

H1.2 is **PROVEN** when:

1. ✅ All 10 gates (O1-O10) pass with behavioral evidence
2. ✅ Five Core Questions answered with evidence
3. ✅ No H1.1 invariants violated (P1-P5 still pass)
4. ✅ H1.2 invariants proven (I1-I3)
5. ✅ No F1-F4 Kernel modifications
6. ✅ Failure scenarios documented with recovery proof
7. ✅ Observability metrics validated
8. ✅ Dead letter workflow end-to-end tested
9. ✅ Manual intervention procedures documented
10. ✅ Reconciliation report generated for test events

**Failure criteria:**
- ❌ Any O1-O10 gate fails
- ❌ Any of Five Core Questions answered incorrectly
- ❌ H1.1 behavioral guarantee violated (P1-P5)
- ❌ H1.2 invariant violated (I1-I3)
- ❌ Duplicate journal created during retry/replay/recovery
- ❌ Event loss detected
- ❌ Tenant isolation breached
- ❌ F1-F4 Kernel modified or corrupted
- ❌ Schema change breaks H1.1 compatibility

---

## Forbidden Changes *(AMENDED — A5)*

H1.2 implementation **MUST NOT**:

1. Modify F1-F4 Kernel tables or functions
2. Change H1.1 outbox core columns (may extend with additive schema only)
3. **Rerun G1-G7, N1-N3 tests (H1.1 evidence FROZEN — Amendment A5)**
4. **Reopen H1.1 evidence documents (IMMUTABLE — Amendment A5)**
5. Process 366 backlog as test fixture
6. Modify Finance event contract (N3 frozen)
7. Change H1.1 idempotency behavior (P5 frozen — H1.2 reuses, not replaces)
8. Bypass tenant isolation (N2 frozen)
9. Create duplicate journals during replay
10. Modify H1.1 failure injection mechanism (test-only)
11. Introduce synchronous Finance calls from Hospital

**A5 AMENDMENT: Backward Compatibility Without H1.1 Rerun**

**Protection Rule:**
```
H1.1 FROZEN = H1.1 evidence IMMUTABLE

H1.1 evidence:
- G1-G7 test results: FROZEN
- N1-N3 test results: FROZEN
- H1_1_FINAL_EVIDENCE_FREEZE.md: IMMUTABLE
- Behavioral proof documents: ARCHIVED

H1.2 MUST NOT:
- Rerun frozen H1.1 tests
- Modify frozen H1.1 evidence
- Reopen H1.1 baseline
```

**H1.2 Backward Compatibility Verification:**

H1.2 proves compatibility via **NEW compatibility test suite** (separate from H1.1):

**Test Suite:** `H1.2 Backward Compatibility Tests` (NEW, not H1.1 rerun)

**TC1: Old Event Format Compatibility**
```
Purpose: Verify H1.2 worker handles H1.1-format events
Test:
1. Create event with H1.1 schema (no H1.2-extended columns)
2. H1.2 worker claims and processes event
3. Verify: Success (H1.2 handles missing columns gracefully with defaults)
Evidence: Event with NULL H1.2 columns → PROCESSED successfully
```

**TC2: Schema Additive Only**
```
Purpose: Verify H1.2 schema extensions are non-breaking
Test:
1. Deploy H1.2 schema migration
2. Verify new columns: NULLABLE or have DEFAULT values
3. Verify no column removal, no type changes
4. Verify H1.1 queries still execute (SELECT without new columns)
Evidence: H1.1-style queries → Execute without error
```

**TC3: Event Contract Stability**
```
Purpose: Verify H1.1 event envelope unchanged
Test:
1. Compare H1.1 event envelope with H1.2
2. Verify: tenant_id, event_type, payload structure unchanged
3. Verify: Finance API contract unchanged (same endpoint, same request/response)
Evidence: Event contract diff → No breaking changes
```

**TC4: H1.1 Worker Compatibility (if feasible)**
```
Purpose: Verify old H1.1 worker can operate with H1.2 schema
Test:
1. Deploy H1.2 schema extensions
2. Simulate H1.1 worker (code without H1.2 extensions)
3. H1.1 worker claims event → Processes → Marks PROCESSED
4. Verify: H1.1 worker ignores new columns (SELECT without new columns)
Evidence: H1.1 worker → Success with H1.2 schema
Note: May not be feasible if H1.1 code no longer deployed
```

**H1.1 Evidence Remains Untouched:**
```
H1.1 Evidence (FROZEN, IMMUTABLE)
    ↓
NOT modified by H1.2
NOT reopened for H1.2
NOT re-executed for H1.2
    ↓
Archived as historical proof

H1.2 Compatibility Evidence (NEW)
    ↓
Separate test suite
    ↓
Proves H1.2 backward compatible with H1.1 contract
    ↓
Does NOT modify H1.1 frozen evidence
```

**Proof Requirements:**
- TC1-TC4 execute successfully
- No H1.1 evidence documents modified
- No G1-G7, N1-N3 re-execution
- H1.2 compatibility proven via NEW tests
- H1.1 baseline remains frozen and untouched

---

## Unlock Conditions for Next Phase

H1.2 **UNLOCKS** next phase when:

1. Constitution reviewed and approved ✅
2. Implementation plan reviewed ✅
3. All O1-O10 gates pass ✅
4. Evidence documented and frozen ✅
5. No architectural violations detected ✅

**Next phase candidates:**
- H1.3: Performance & Scale (load testing, optimization)
- H1.4: Multi-Region Resilience (replication, failover)
- H1.5: Event Versioning & Migration (contract evolution)

**Each phase requires its own Constitution.**

---

## Implementation Sequence

**Before coding:**
1. ✅ This Constitution reviewed and approved
2. Architecture Review meeting
3. Implementation Plan drafted
4. Plan reviewed and approved

**During coding:**
1. Extend outbox schema (non-breaking)
2. Implement retry policy enforcement
3. Implement failure classification
4. Implement dead letter queue
5. Implement observability metrics
6. Implement manual intervention tools
7. Implement reconciliation support

**After coding:**
1. Execute O1-O10 verification gates
2. Document behavioral evidence
3. Generate evidence freeze document
4. Architecture sign-off

**Do NOT:**
- Code before constitution approval
- Skip gate verification
- Merge without evidence
- Modify H1.1 baseline silently

---

## Review Checklist

Before H1.2 implementation begins, reviewers must confirm:

- [ ] Constitution scope clear and achievable
- [ ] Gates O1-O10 are verifiable with behavioral tests
- [ ] No H1.1 invariants at risk
- [ ] No F1-F4 Kernel modifications required
- [ ] Outbox schema extensions non-breaking
- [ ] Failure scenarios comprehensive
- [ ] Evidence requirements clear
- [ ] Acceptance criteria measurable
- [ ] Forbidden changes list complete
- [ ] Implementation sequence logical

**Approval required from:** Architecture lead, Finance OS owner

---

## Architectural Philosophy

H1.2 follows the principle:

> **Build architectural guarantees, not just features.**

Each gate must prove a **behavioral guarantee** under failure conditions, not just "code exists" or "schema supports it."

The progression is:

```
H1.1: Failure isolation      → Finance DOWN does not cause data loss
H1.2: Operational resilience  → System survives sustained operational stress
H1.3: Performance & scale     → System performs under load
H1.4: Multi-region resilience → System survives datacenter failure
```

Each phase builds on the previous, never breaking prior guarantees.

---

## Version History

| Version | Date | Changes | Reviewer |
|---------|------|---------|----------|
| v1.0 | 2026-08-17 | Initial constitution | Pending review |
| v1.1 | 2026-08-17 | **Amendments based on architectural review:** | Pending approval |
|  |  | - Objective refined: Durable/Recoverable/Observable/Controllable |  |
|  |  | - Added H1.2-I1, I2, I3 core invariants |  |
|  |  | - O1: Added no-busy-loop, healthy-event-continuity requirements |  |
|  |  | - O2: Defined failure taxonomy (TRANSIENT/PERMANENT/POISON/UNKNOWN) |  |
|  |  | - O3: Added "poison event must not block healthy events" requirement |  |
|  |  | - O4: Clarified worker crash safety and duplicate prevention |  |
|  |  | - O5: Expanded metadata requirements for dead letter visibility |  |
|  |  | - O6: Added critical constraint - replay must preserve idempotency |  |
|  |  | - O7: Scoped to operational facts, removed dashboard platform scope |  |
|  |  | - O8: Renamed to "Operational Alert Thresholds", removed anomaly detection |  |
|  |  | - O9: Added bounded batch, concurrency control, healthy event protection |  |
|  |  | - O10: Clarified reconciliation detects only, does not auto-correct |  |
|  |  | - Added gate dependency graph (Group A→B→C→D structure) |  |
|  |  | - Added Five Core Questions as acceptance framework |  |
|  |  | - Added schema backward compatibility requirement |  |

---

**Status:** 📋 DRAFT v1.1 — Ready for architecture review and approval

**Next step:** Schedule constitution review meeting

**Do NOT proceed with implementation until this constitution is approved.**

---

---

## Amendment Summary (v1.2 → v1.3)

**Architecture Review Date:** 2026-08-17  
**Review Verdict:** v1.2 REVISE REQUIRED  
**Amendment Date:** 2026-08-17  
**Amendment Version:** v1.3

**Amendments Applied:**

### A1: Idempotency Enforcement Chain (I1)
**Location:** Invariants section, I1
**Changes:**
- Specified authoritative transaction: `finance_transactions` table
- Documented DB constraint: `UNIQUE(idempotency_key)`
- Completed atomic claim SQL with full WHERE clause and affected_rows check
- Documented enforcement chain: Event → Key → Claim → Finance → Transaction → Journal
- Added recovery scenarios: Concurrent claim, crash-after-commit, manual replay
- Added proof requirements with specific tests

### A2: State Transition Atomicity (I2)
**Location:** Invariants section, I2
**Changes:**
- Strengthened invariant definition: "Every non-terminal state must have deterministic recovery path"
- Defined state machine with all transitions
- Documented atomicity for each transition (SQL examples)
- Addressed failure windows: DB connection loss, crash mid-transition
- Mapped recovery paths for all states
- Clarified C1: retry_count increments in worker transaction after Finance failure response

### A3: F1-F4 Permission Boundary (I3)
**Location:** Invariants section, I3
**Changes:**
- Defined H1.2 service role: `h1_2_worker` with explicit DB permissions
- Enforced permission boundary: H1.2 role CANNOT INSERT/UPDATE/DELETE F1-F4 tables
- Documented architecture boundary: H1.2 → Finance API → F1-F4
- Strengthened F1-F4 integrity proof: No unauthorized mutation, no orphans, no duplicates, all F1-F4 invariants intact
- Added recovery scenarios with permission enforcement
- Clarified C3: Reconciliation role `h1_2_reconciliation_readonly` with SELECT-only permissions

### A4: Replay Lifecycle Validity (O6)
**Location:** Verification Gates, O6
**Changes:**
- Removed invalid test scenario: PROCESSED → QUARANTINED (artificial)
- Added valid replay scenarios: Orphaned event, genuine quarantine, corrected payload
- Added replay concurrency safety: Atomic UPDATE with affected_rows verification
- Protected race conditions: Concurrent replay, replay during processing
- Updated test scenarios to use valid lifecycles only

### A5: Compatibility Without H1.1 Rerun (Forbidden Changes)
**Location:** Forbidden Changes section
**Changes:**
- Strengthened protection: "Rerun G1-G7, N1-N3 tests (H1.1 evidence FROZEN)"
- Added: "Reopen H1.1 evidence documents (IMMUTABLE)"
- Defined H1.2 backward compatibility verification via NEW test suite (TC1-TC4)
- H1.1 evidence remains untouched: Not modified, not reopened, not re-executed
- H1.2 proves compatibility without modifying H1.1 frozen baseline

### C1: Retry Count Transaction (I2)
**Location:** Invariants section, I2 state transition #3
**Clarification:**
- `retry_count` increments in worker transaction AFTER Finance failure response
- Documented in PROCESSING → FAILED transition SQL

### C2: Bulk Recovery Acceptance (O9)
**Location:** Verification Gates, O9
**Clarification:**
- Changed acceptance: NOT all events must reach PROCESSED
- Valid outcomes: PROCESSED (success), QUARANTINED (permanent/poison), FAILED (transient)
- Updated test scenario: 450 transient (succeed), 30 permanent (remain quarantined), 20 poison (remain quarantined)

### C3: Reconciliation Security Context (I3)
**Location:** Invariants section, I3
**Clarification:**
- Defined reconciliation role: `h1_2_reconciliation_readonly`
- Explicit permissions: SELECT only, no INSERT/UPDATE/DELETE
- Proof: Attempt mutation from reconciliation context → Permission denied

**All amendments preserve H1.1 FROZEN baseline and F1-F4 Kernel protection.**

---

**END OF H1.2 CONSTITUTION v1.3 AMENDED**

