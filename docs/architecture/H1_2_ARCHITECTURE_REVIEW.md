# H1.2 Architecture Review

**Date:** 2026-08-17  
**Constitution Version:** v1.2  
**Review Type:** Streamlined (PASS/REVISE)  
**Purpose:** Validate H1.2 Constitution is enforceable and testable before implementation

---

## Review Objective

**NOT proving H1.2 works** (that comes after implementation with behavioral evidence).

**ONLY proving:** H1.2 Constitution can be implemented and verified validly.

**Outcome:** APPROVE → Implementation Plan OR REVISE → Fix Constitution

---

## Review Questions

| # | Critical Question | Architecture Decision | Enforcement | Failure Scenario | How to Prove | Decision |
|---|-------------------|----------------------|-------------|------------------|--------------|----------|
| **Q1** | **I1 — No duplication?**<br>One idempotency key → At most one transaction | DB unique constraint + Finance API idempotency + Worker atomic claim | `UNIQUE(idempotency_key)` on ledger<br>`claimed_by` atomic update<br>Finance POST checks existing transaction | Concurrent delivery: 2 workers claim same event<br>Replay: Event replayed after partial success | Test: 2 workers race on same event → Only 1 journal created<br>Test: Replay after Finance success → `ALREADY_PROCESSED` | ⏳ |
| **Q2** | **I2 — No event loss?**<br>Accepted intent always traceable | Durable state machine: PENDING → PROCESSING → PROCESSED/QUARANTINED<br>No deletion | Outbox table never DELETE<br>Terminal states defined<br>All transitions logged | Worker crash mid-transition<br>DB connection loss during status update | Test: Audit all state transitions<br>Test: Crash at every transition point → Event always in valid state | ⏳ |
| **Q3** | **I3 — F1-F4 isolation?**<br>H1.2 failure cannot corrupt ledger | H1.2 never directly writes to F1-F4 tables<br>Only via Finance API | Architecture boundary: H1.2 → Finance API → F1-F4<br>No `journal_entries` INSERT from H1.2<br>DB transaction isolation | H1.2 worker crashes<br>Reconciliation job bugs out<br>Replay logic has bug | Test: Inject H1.2 failures → Query F1-F4 → Dr=Cr still valid<br>Test: Kill H1.2 processes → Ledger unchanged | ⏳ |
| **Q4** | **Retry/crash safe?**<br>No infinite loop, no stuck events | Exponential backoff with `next_retry_at`<br>Max retry → QUARANTINE<br>Lease expiration → Recovery | Worker respects `next_retry_at`<br>`retry_count` max threshold<br>`lease_expires_at` timeout | Finance DOWN 2 hours<br>Worker crash mid-processing | Test: Finance DOWN → Events retry with backoff → After max → QUARANTINED<br>Test: Kill worker → Lease expires → Event recovered | ⏳ |
| **Q5** | **Operator control?**<br>Safe intervention on failed events | QUARANTINE visible<br>Replay resets to PENDING (not direct ledger write)<br>Finance idempotency enforced | Dead letter query<br>`replay_event()` → status=PENDING<br>Normal pipeline (API) enforced | Operator replays already-processed event<br>Replay during active processing | Test: Event PROCESSED → Replay → Finance returns `ALREADY_PROCESSED`<br>Test: QUARANTINED → Replay → Worker processes → 1 journal | ⏳ |
| **Q6** | **Bulk recovery safe?**<br>No system overload | Batch size limit (e.g., 100)<br>Concurrency control<br>Healthy events NOT blocked | Hard limit in `replay_bulk()` function<br>Rate limiting<br>Queue isolation | Operator replays 10,000 events at once<br>Bulk during high traffic | Test: Replay 500 events (batched) → All succeed → No duplicates<br>Test: Bulk replay → Healthy events still processing | ⏳ |
| **Q7** | **Reconciliation safe?**<br>No auto-correct ledger | Detect + Flag only<br>Read-only queries<br>Operator approval required | Reconciliation has SELECT permission only<br>No INSERT/UPDATE on `journal_entries`<br>Discrepancy report → Manual review | Reconciliation finds "missing journal"<br>Bug tries to auto-create | Test: Create outbox/ledger mismatch → Reconciliation detects → Report generated → Ledger unchanged | ⏳ |
| **Q8** | **Backward compatible?**<br>H1.1 continues working | Schema extensions additive<br>H1.1 contract unchanged<br>H1.1 workers compatible | New columns nullable/default<br>No column removal<br>Event envelope unchanged | Deploy H1.2 → Old worker runs<br>Old event processed | Test: Run H1.1 regression (G1-G7, N1-N3) after H1.2 schema → All PASS<br>Test: H1.1 worker processes H1.2-extended event | ⏳ |

---

## Review Process

### Step 1: Read Constitution
- ✅ H1.2 Constitution v1.2 read

### Step 2: Review Each Question (Q1-Q8)

**For each question, answer:**

```
PASS — Because [reason]
```

**OR**

```
REVISE — Missing [gap]
```

**Format:**
```
Q1: I1 — No duplication?
Decision: PASS
Reason: Unique constraint on idempotency key + Finance API idempotency + Worker atomic claim covers all duplication vectors (concurrent, replay, recovery). Provable via race condition test.
```

**OR**

```
Q2: I2 — No event loss?
Decision: REVISE
Gap: State transition from PROCESSING → FAILED during DB connection loss not covered. Need explicit handling for partial UPDATE.
```

---

## Review Decisions

### Q1: I1 — No Financial Duplication

**Architecture Decision:**
- DB: `UNIQUE(idempotency_key)` on transaction table
- Finance API: Checks existing transaction before journal creation
- Worker: Atomic `claimed_by` update prevents concurrent claims

**Enforcement:**
- Idempotency key derived from event metadata (tenant + event_type + source_id)
- Finance API returns `ALREADY_PROCESSED` if idempotency key exists
- Worker claim: `UPDATE ... SET claimed_by = worker_id WHERE claimed_by IS NULL`

**Failure Scenario:**
- Worker A claims event, posts to Finance, crashes before marking PROCESSED
- Worker B claims same event after lease expiration, posts to Finance
- Finance checks idempotency key → Transaction already exists → Returns `ALREADY_PROCESSED`

**How to Prove:**
- Test: 2 workers simultaneously claim same event → Only 1 succeeds claim
- Test: Replay after Finance POST success → Finance returns `ALREADY_PROCESSED` → No duplicate journal

**Decision:** 🟡 REVISE

**Gap:** 
- `UNIQUE(idempotency_key) on ledger` — Need to specify exact table and authoritative transaction
- Atomic claim condition incomplete: `UPDATE ... SET claimed_by = worker_id WHERE claimed_by IS NULL` needs event_id, status, lease conditions and affected_rows=1 verification
- Missing enforcement chain: Event → Idempotency key → DB UNIQUE → Atomic claim → Finance transaction → Journal
- Need to prove concurrent delivery + crash-after-commit scenarios

---

### Q2: I2 — No Event Loss

**Architecture Decision:**
- Durable state machine: PENDING → PROCESSING → PROCESSED / QUARANTINED
- Outbox table never has DELETE operations
- Terminal states defined (PROCESSED, QUARANTINED)

**Enforcement:**
- All state transitions logged with timestamps
- No code path executes `DELETE FROM finance_outbox_events`
- Crash recovery via lease expiration returns event to PENDING

**Failure Scenario:**
- Worker updates status to PROCESSING, crashes before Finance POST
- Lease expires → Cleanup job returns event to PENDING
- Next worker claims and processes

**How to Prove:**
- Test: State transition audit (all events accounted for in PENDING/PROCESSING/PROCESSED/QUARANTINED)
- Test: Crash at each transition point → Event always in valid state (queryable, recoverable)

**Decision:** 🟡 REVISE

**Gap:**
- "Outbox table never DELETE" is not sufficient to prove no event loss
- Missing definition of state transition atomicity
- Failure windows not covered: claim success → DB connection loss → status update unknown
- PENDING → QUARANTINE transition with worker crash mid-transaction not addressed
- Need stronger definition: "Accepted intent must always remain in an authoritative, queryable state and every non-terminal state must have a deterministic recovery path"

---

### Q3: I3 — F1-F4 Isolation

**Architecture Decision:**
- H1.2 components never directly write to F1-F4 Kernel tables
- All financial effects via Finance API
- Architecture boundary enforced: H1.2 → Finance API → F1-F4

**Enforcement:**
- No `INSERT INTO journal_entries` from H1.2 code
- Worker posts to Finance HTTP endpoint (not direct DB)
- Replay/recovery respect same boundary
- Reconciliation queries are SELECT-only

**Failure Scenario:**
- H1.2 worker crashes mid-processing
- Reconciliation job has bug
- Replay logic corrupted

**How to Prove:**
- Test: Inject H1.2 worker crash → Query F1-F4 → Dr=Cr still valid, no orphaned entries
- Test: Kill all H1.2 processes → F1-F4 ledger unchanged
- Test: H1.2 observability queries cannot mutate F1-F4

**Decision:** 🟡 REVISE

**Gap:**
- Test "Dr=Cr still valid" insufficient to prove F1-F4 not mutated by H1.2
- System can maintain Dr=Cr but still create incorrect journals
- Need to prove: H1.2 failure → No unauthorized F1-F4 mutation → No orphan journal → No duplicate journal → Existing F1-F4 invariants intact
- Permission boundary needs enforcement mechanism (not just convention): "H1.2 has no INSERT/UPDATE permission on F1-F4 tables"
- Should enforce at DB permission/RPC boundary level, not code convention

---

### Q4: Retry/Crash Safe

**Architecture Decision:**
- Exponential backoff: `next_retry_at = now + (2^retry_count * base_interval)`
- Max retry limit (e.g., 10) → After exhaustion → QUARANTINE
- Lease expiration: `lease_expires_at` timeout (60s) → Stuck PROCESSING recovered
- Worker respects `next_retry_at` (does not claim before time)

**Enforcement:**
- Worker query: `WHERE status = PENDING AND (next_retry_at IS NULL OR next_retry_at <= now())`
- `retry_count` incremented on each failure
- After `retry_count >= max_retry` → status = QUARANTINED
- Cleanup job: `WHERE status = PROCESSING AND lease_expires_at < now()` → Reset to PENDING

**Failure Scenario:**
- Finance DOWN for 2 hours → 1000 events accumulate
- Worker crash mid-processing (before Finance POST)

**How to Prove:**
- Test: Finance DOWN → Events retry with exponential intervals (1s, 2s, 4s...) → After max → QUARANTINED
- Test: Kill worker mid-processing → Lease expires → Event returns to PENDING → Next worker succeeds

**Decision:** 🟢 PASS (with condition)

**Condition:**
- Architecture correct: exponential backoff, max retry, quarantine, lease expiration, next_retry_at
- Need to define where retry_count increments (which transaction)
- Worker crash scenario (claim → POST Finance → Finance commit → worker crash → lease expiration → retry) must reuse H1.1 proven idempotency guarantee
- Implementation Plan MUST NOT create second idempotency mechanism

---

### Q5: Operator Control

**Architecture Decision:**
- QUARANTINE state visible to operators (dead letter queue)
- Replay resets event to PENDING (not direct ledger write)
- Replay goes through normal Finance API (idempotency enforced)

**Enforcement:**
- Dead letter view: `SELECT * FROM finance_outbox_events WHERE status = 'QUARANTINED'`
- Replay function: `UPDATE ... SET status = 'PENDING', retry_count = 0 WHERE event_id = ?`
- Worker processes replayed event via normal pipeline
- Finance API idempotency prevents duplicates

**Failure Scenario:**
- Operator replays event that was already processed (marked QUARANTINED incorrectly)
- Replay during active processing (race condition)

**How to Prove:**
- Test: Event PROCESSED → Manually mark QUARANTINED → Replay → Finance returns `ALREADY_PROCESSED` → No duplicate
- Test: Event QUARANTINED → Replay → Worker claims → Finance POST → Journal created → Exactly once

**Decision:** 🟡 REVISE

**Gap:**
- Test "Event PROCESSED → manually mark QUARANTINED → Replay" is artificial test fixture, not valid lifecycle
- Event PROCESSED is semantically terminal, should not transition to QUARANTINED for testing
- Should test: QUARANTINED → Replay → PENDING → Worker → Finance → ALREADY_PROCESSED with event where Finance already committed but outbox not marked PROCESSED
- Missing replay concurrency guard: Operator A replay + Operator B replay + Worker claiming → Race condition not addressed

---

### Q6: Bulk Recovery Safe

**Architecture Decision:**
- Batch size hard limit (e.g., 100 events per operation)
- Concurrency control (prevent race conditions)
- Healthy event processing NOT blocked during bulk recovery
- Idempotency preserved for all events in batch

**Enforcement:**
- `replay_bulk(reason, tenant_id, limit=100)` enforces max batch
- Transaction isolation per event (not single transaction for all)
- Worker pool continues processing healthy events (not blocked by bulk)

**Failure Scenario:**
- Operator attempts to replay 10,000 quarantined events
- Bulk replay during high traffic

**How to Prove:**
- Test: Replay 500 events in batches of 100 → All transition QUARANTINED → PENDING → PROCESSED → No duplicates
- Test: Start bulk replay → Submit new healthy event → Healthy event processed (not blocked)

**Decision:** 🟢 PASS (with condition)

**Condition:**
- Batch limit + concurrency control correct
- Acceptance should NOT be "All 500 succeed" (some may be PERMANENT/POISON and remain quarantined)
- Correct acceptance: 500 events → bounded batches → no overload → healthy events unaffected → each event reaches valid terminal/recoverable state → no duplication
- Not all events must reach PROCESSED

---

### Q7: Reconciliation Safe

**Architecture Decision:**
- Reconciliation DETECTS inconsistencies (outbox vs ledger)
- Does NOT automatically correct ledger
- Read-only queries only
- Discrepancy report → Operator review → Manual resolution

**Enforcement:**
- Reconciliation function has SELECT permission only (no INSERT/UPDATE/DELETE on ledger)
- Query: LEFT JOIN outbox with journal_entries, detect mismatches
- Report generated with discrepancy type (ORPHANED_JOURNAL, MISSING_JOURNAL, DUPLICATE_JOURNAL)
- Resolution requires explicit operator action with evidence

**Failure Scenario:**
- Reconciliation finds "missing journal" (outbox PROCESSED but no journal)
- Bug in reconciliation tries to auto-create journal

**How to Prove:**
- Test: Create outbox/ledger mismatch manually → Run reconciliation → Discrepancy detected → Report generated → Ledger unchanged
- Test: Attempt INSERT from reconciliation context → Permission denied

**Decision:** 🟢 PASS (with condition)

**Condition:**
- Principle excellent: DETECT → FLAG → INVESTIGATE → OPERATOR (no auto-correct)
- "Reconciliation function has SELECT permission only" needs clarity on security context
- If using SECURITY DEFINER, RPC, or service role, "SELECT-only" on paper insufficient
- Must prove: Reconciliation CAN SELECT, CANNOT INSERT/UPDATE/DELETE, F1-F4 protected
- Need enforcement mechanism verification, not just code convention

---

### Q8: Backward Compatibility

**Architecture Decision:**
- Schema extensions additive (new columns with DEFAULT or NULLABLE)
- H1.1 event contract unchanged (envelope structure same)
- Existing H1.1 workers can process events with extended schema

**Enforcement:**
- New columns: `retry_policy JSONB DEFAULT '{}'`, `failure_classification TEXT`
- No column removal, no column type change
- Event envelope unchanged (tenant_id, event_type, payload structure same)
- H1.1 workers ignore new columns (backward compatible SELECT)

**Failure Scenario:**
- Deploy H1.2 schema → Old H1.1 worker runs
- Old H1.1 event processed by new H1.2 worker

**How to Prove:**
- Test: Run H1.1 regression tests (G1-G7, N1-N3) after H1.2 schema migration → All PASS
- Test: H1.1 worker (without H1.2 code) processes event with extended schema → Success
- Test: H1.2 worker processes H1.1-format event (without new fields) → Success

**Decision:** 🟡 REVISE

**Gap:**
- Contradiction with H1.1 FROZEN protection rule
- H1.1 is FROZEN (do not rerun G1-G7/N1-N3), but Q8 states "Run H1.1 regression tests after H1.2 schema migration"
- Should NOT modify protection rule to serve H1.2
- Should change to: "H1.2 compatibility verification must use dedicated compatibility fixture/contract test that does NOT modify or reopen frozen H1.1 evidence"
- H1.1 evidence remains FROZEN, no reopen, no rerun
- H1.2 proves compatibility via NEW compatibility tests, not by re-executing H1.1 gates

---

## Final Review Decision

**Status:** � REVISE REQUIRED

**Review Results:**

| # | Question | Decision | Status |
|---|----------|----------|--------|
| Q1 | I1 — No duplication? | 🟡 REVISE | Enforcement chain incomplete |
| Q2 | I2 — No event loss? | 🟡 REVISE | State atomicity undefined |
| Q3 | I3 — F1-F4 isolation? | 🟡 REVISE | Permission boundary unclear |
| Q4 | Retry/crash safe? | 🟢 PASS* | Conditional approval |
| Q5 | Operator control? | 🟡 REVISE | Invalid test scenario |
| Q6 | Bulk recovery safe? | 🟢 PASS* | Conditional approval |
| Q7 | Reconciliation safe? | 🟢 PASS* | Conditional approval |
| Q8 | Backward compatible? | 🟡 REVISE | Conflicts with H1.1 freeze |

**Summary:**
- ✅ 3 questions PASS (with conditions)
- 🟡 5 questions REVISE
- 🔴 Constitution v1.2 NOT APPROVED

**Outcome:**

```
[X] REVISE — 5 questions flagged
    → Constitution v1.2 returned for amendment
    → Address 5 identified gaps (Q1, Q2, Q3, Q5, Q8)
    → Clarify 3 conditional approvals (Q4, Q6, Q7)
    → Re-submit for Architecture Review
    
[ ] APPROVE — Not yet
    → Will proceed to Implementation Plan after amendments approved
```

---

## Required Amendments

**5 amendments required before approval:**

### A1: Q1 — Idempotency Enforcement Chain
**Problem:** Enforcement mechanism incomplete, atomic claim conditions missing

**Required:**
1. Specify exact table with `UNIQUE(idempotency_key)` constraint
2. Define authoritative transaction for idempotency
3. Complete atomic claim: `UPDATE ... SET claimed_by = ? WHERE event_id = ? AND status = 'PENDING' AND (lease_expires_at IS NULL OR lease_expires_at < now()) AND claimed_by IS NULL` with `affected_rows = 1` check
4. Document enforcement chain: Event → Idempotency key derivation → DB UNIQUE constraint → Atomic claim → Finance transaction → Journal creation
5. Prove concurrent delivery + crash-after-commit scenarios

---

### A2: Q2 — State Transition Atomicity
**Problem:** "No DELETE" insufficient, state atomicity undefined

**Required:**
1. Define state transition atomicity guarantees
2. Address failure windows: claim success → DB connection loss → status update unknown
3. Address PENDING → QUARANTINE with worker crash mid-transaction
4. Strengthen I2 definition: "Accepted intent must always remain in an authoritative, queryable state and every non-terminal state must have a deterministic recovery path"
5. Map all state transitions with recovery paths

---

### A3: Q3 — F1-F4 Permission Boundary
**Problem:** Convention-based boundary, no enforcement mechanism

**Required:**
1. Define permission boundary enforcement (not just code convention)
2. Prove H1.2 failure scenarios: No unauthorized F1-F4 mutation, no orphan journal, no duplicate journal, F1-F4 invariants intact
3. "Dr=Cr still valid" insufficient — need stronger F1-F4 integrity proof
4. Specify DB permission/RPC boundary enforcement: H1.2 role has NO INSERT/UPDATE/DELETE on F1-F4 tables
5. Document security context isolation

---

### A4: Q5 — Replay Lifecycle Validity
**Problem:** Test uses invalid lifecycle (PROCESSED → QUARANTINED artificial)

**Required:**
1. Remove test scenario "Event PROCESSED → manually mark QUARANTINED → Replay"
2. PROCESSED is terminal, should not transition to QUARANTINED for testing
3. Valid test: QUARANTINED → Replay → PENDING → Worker → Finance → ALREADY_PROCESSED (event where Finance committed but outbox not marked PROCESSED)
4. Add replay concurrency guard: Operator A + Operator B + Worker claiming → No race condition
5. Document replay concurrency safety mechanism

---

### A5: Q8 — Compatibility Without H1.1 Rerun
**Problem:** Contradicts H1.1 FROZEN rule

**Required:**
1. Remove requirement "Run H1.1 regression tests (G1-G7, N1-N3) after H1.2 schema migration"
2. H1.1 evidence is FROZEN, must not reopen or rerun
3. Define H1.2 compatibility verification: "Dedicated compatibility fixture/contract test that does NOT modify or reopen frozen H1.1 evidence"
4. H1.2 proves compatibility via NEW compatibility tests (not re-executing H1.1 gates)
5. H1.1 evidence remains untouched

---

## Conditional Approvals (Clarifications Needed)

### C1: Q4 — Retry Count Transaction
**Approved with:** Define where `retry_count` increments (which transaction) and confirm reuse of H1.1 idempotency (no second mechanism)

### C2: Q6 — Bulk Recovery Acceptance
**Approved with:** Clarify acceptance criteria — not all events must reach PROCESSED (PERMANENT/POISON remain quarantined validly)

### C3: Q7 — Reconciliation Permission Enforcement
**Approved with:** Clarify security context enforcement (SECURITY DEFINER, RPC, service role) — prove CANNOT INSERT/UPDATE/DELETE F1-F4

---

## Sign-Off

**Reviewed by:** Architecture Lead  
**Date:** 2026-08-17  
**Decision:** [X] REVISE

**Notes:**
- Not rejecting architecture fundamentally
- Enforcement mechanisms need clarification
- 5 gaps must be addressed before approval
- 3 conditional approvals need implementation plan clarification
- Constitution v1.2 requires AMENDMENT (not rewrite)

---

## Next Steps

1. **Address 5 Amendments (A1-A5)**
2. **Clarify 3 Conditional Approvals (C1-C3)**
3. **Create H1.2 Constitution v1.3 AMENDED**
4. **Re-submit for Architecture Review**
5. **If APPROVED → Create Implementation Plan**

---

---

**Key Principle:**

> This review validates that H1.2 Constitution is **implementable and verifiable**.  
> It does NOT prove H1.2 works (behavioral evidence comes after coding).  
> 
> If all 8 questions PASS → Constitution is sound → Implementation can proceed.

---

**END OF ARCHITECTURE REVIEW**
