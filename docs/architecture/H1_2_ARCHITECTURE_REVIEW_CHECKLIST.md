# H1.2 Architecture Review Checklist

**Document:** H1_2_CONSTITUTION.md v1.2  
**Review Date:** TBD  
**Status:** ⏳ PENDING REVIEW

---

## Review Purpose

Validate that H1.2 Constitution is **architecturally sound**, **enforceable**, **testable**, and **preserves all H1.1 guarantees** before proceeding to Implementation Plan.

**This review is NOT about implementation details.** It is about validating the constitutional framework.

---

## Critical Review Questions

### Q1: Invariant I1 Enforcement
**Question:** Can I1 (No Financial Duplication) be enforced at database, API, and worker layers?

**Review criteria:**
- [ ] Database constraints prevent duplicate journals for same idempotency key
- [ ] Finance API idempotency check occurs BEFORE ledger write
- [ ] Worker replay mechanism respects idempotency
- [ ] Bulk recovery operations preserve idempotency
- [ ] Concurrency scenarios analyzed (two workers replay same event)

**Evidence required:**
- Schema constraints documented
- Idempotency enforcement points identified
- Race condition analysis documented

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q2: Invariant I2 Traceability
**Question:** Can I2 (No Event Loss) be proven? "Accepted intent → always traceable"

**Review criteria:**
- [ ] All event states enumerated (PENDING, PROCESSING, PROCESSED, QUARANTINED)
- [ ] No code path allows event deletion
- [ ] QUARANTINED is terminal state (requires manual intervention)
- [ ] Event history/audit trail maintained
- [ ] Recovery mechanisms cannot lose events

**Evidence required:**
- State machine diagram (all transitions documented)
- No DELETE operations on finance_outbox_events
- Quarantine is append-only (no auto-deletion)

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q3: Invariant I3 Isolation
**Question:** Does I3 (F1-F4 Integrity) truly isolate H1.2 operational failures from Financial Kernel?

**Review criteria:**
- [ ] No H1.2 code directly modifies F1-F4 tables
- [ ] H1.2 failures (worker crash, retry bug, quarantine error) cannot corrupt ledger
- [ ] Recovery operations go through Finance API (not direct SQL to F1-F4)
- [ ] Replay/bulk recovery use Finance idempotency (not bypass)
- [ ] Observability queries are read-only

**Evidence required:**
- H1.2 code never imports F1-F4 table types
- All ledger writes go through Finance Event Handler
- Recovery = Finance API POST, not direct DB insert

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q4: Delivery & Recovery (O1-O4)
**Question:** Can O1-O4 handle retry, permanent failure, poison events, and worker crashes without busy-loop or blocking?

**Review criteria:**
- [ ] O1: Exponential backoff prevents busy-loop (next_retry_at enforced)
- [ ] O2: Permanent failures (400, 422) skip retry → immediate quarantine
- [ ] O3: Poison detection requires N crash cycles (not first crash)
- [ ] O3: Poison events do NOT block healthy events in queue
- [ ] O4: Lease expiration recovery tested (worker crash mid-processing)
- [ ] O4: Exactly-once guarantee after lease recovery

**Evidence required:**
- Retry schedule formula: `next_retry_at = now + 2^retry_count * base_interval`
- Failure classification logic documented
- Poison threshold configurable (default 3 cycles)
- Queue ordering preserves fairness (poison event doesn't block)

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q5: Operator Control (O5-O6)
**Question:** Do O5-O6 give operators control over quarantine/replay WITHOUT bypassing idempotency?

**Review criteria:**
- [ ] O5: Quarantine metadata sufficient for triage (event_id, failure_class, last_error, payload)
- [ ] O6: Replay resets event to PENDING (goes through normal worker pipeline)
- [ ] O6: Replay does NOT directly insert into ledger
- [ ] O6: Replay respects Finance idempotency (duplicate protection)
- [ ] O6: Replay respects tenant isolation (cannot replay Tenant B from Tenant A)

**Evidence required:**
- Quarantine query returns all required fields
- Replay = `UPDATE status=PENDING`, not `INSERT journal_entries`
- Replay POSTs to Finance API (not direct DB write)

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q6: Bulk Recovery (O9)
**Question:** Does O9 limit batch size and concurrency to prevent recovery storm?

**Review criteria:**
- [ ] Bulk operations have bounded batch size (e.g., 100 events/operation)
- [ ] Bulk replay does NOT claim all events at once (prevents worker starvation)
- [ ] Concurrent bulk operations safe (no race conditions)
- [ ] Healthy events continue processing during bulk recovery
- [ ] Tenant isolation enforced (bulk scoped to tenant)

**Evidence required:**
- Bulk replay API signature includes `limit` parameter
- Batch processing documented (not single transaction for 1000 events)
- Concurrency control mechanism identified

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q7: Reconciliation Control (O10)
**Question:** Does O10 reconciliation ONLY detect/flag discrepancies, NEVER auto-correct ledger?

**Review criteria:**
- [ ] Reconciliation = SELECT queries only (no UPDATE/DELETE on journal_entries)
- [ ] Discrepancies generate report (not automatic correction)
- [ ] Manual resolution guidance provided (not automated fixes)
- [ ] Reconciliation does NOT bypass Finance idempotency
- [ ] Financial truth requires human judgment (architectural principle)

**Evidence required:**
- Reconciliation queries documented (all read-only)
- Report format defined (includes context for manual resolution)
- No "auto-heal" or "self-correct" logic

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

### Q8: Backward Compatibility
**Question:** Are all schema extensions backward-compatible with H1.1?

**Review criteria:**
- [ ] New columns use DEFAULT or NULLABLE (not breaking existing writers)
- [ ] H1.1 writers can insert without knowing new columns
- [ ] H1.1 workers can read events with new columns (ignored gracefully)
- [ ] No H1.1 column modifications (only additions)
- [ ] Migration strategy additive (no data loss)

**Evidence required:**
- Schema diff shows only ADD COLUMN (no ALTER/DROP)
- H1.1 frozen code continues working after H1.2 migration
- Rollback strategy documented

**Verdict:** ☐ PASS / ☐ FAIL / ☐ NEEDS CLARIFICATION

---

## Behavioral Testability

For each gate (O1-O10), reviewers must confirm:

- [ ] **O1:** Exponential backoff testable (retry timestamps verifiable)
- [ ] **O2:** Failure classification testable (503 → retry, 400 → quarantine)
- [ ] **O3:** Poison detection testable (N crash cycles → quarantine)
- [ ] **O4:** Lease recovery testable (worker crash → PENDING → success)
- [ ] **O5:** Quarantine visibility testable (query returns metadata)
- [ ] **O6:** Replay testable (QUARANTINED → PENDING → PROCESSED)
- [ ] **O7:** Observability testable (metrics match ground truth)
- [ ] **O8:** Alerting testable (threshold breach detected)
- [ ] **O9:** Bulk recovery testable (50 events → all PROCESSED)
- [ ] **O10:** Reconciliation testable (discrepancies detected)

**NOT acceptable:** "Code looks correct", "Schema supports this"

**Required:** Behavioral test scenario documented for each gate

---

## Five Core Questions (Acceptance Framework)

Reviewers must confirm these questions are answerable with behavioral evidence:

- [ ] **Q1:** Does system lose events? → NO (evidence strategy clear)
- [ ] **Q2:** Does system retry infinitely? → NO (max retry enforced)
- [ ] **Q3:** Worker crash recovery? → Event recoverable (lease expiration)
- [ ] **Q4:** Operator control? → YES (quarantine + replay)
- [ ] **Q5:** Ledger duplicates after failures? → NO (idempotency preserved)

---

## H1.1 Protection

Reviewers must confirm H1.1 guarantees remain intact:

- [ ] **P1:** Finance DOWN → Hospital SUCCESS (not broken by H1.2)
- [ ] **P2:** Durable outbox (schema extension doesn't break writes)
- [ ] **P3:** Failure delivery captured (H1.2 extends, not replaces)
- [ ] **P4:** Financial recovery (H1.2 adds resilience, not changes)
- [ ] **P5:** Duplicate protection (idempotency still enforced)

---

## F1-F4 Isolation

Reviewers must confirm Financial Kernel remains isolated:

- [ ] No H1.2 code imports F1-F4 table types
- [ ] No direct SQL to `chart_of_accounts`, `accounts`, `journal_entries`, `journal_lines`, `accounting_periods`
- [ ] All ledger operations go through Finance Event Handler API
- [ ] H1.2 operational failures cannot corrupt F1-F4 state

---

## Review Outcomes

### PASS
- [ ] All 8 critical questions answered satisfactorily
- [ ] All gates behaviorally testable
- [ ] Five Core Questions answerable
- [ ] H1.1 protection verified
- [ ] F1-F4 isolation verified

**Action:** Approve constitution → Proceed to Implementation Plan

---

### FAIL
- [ ] One or more critical questions unanswerable
- [ ] Gates not testable with behavioral evidence
- [ ] H1.1 guarantees at risk
- [ ] F1-F4 isolation violated

**Action:** Revise constitution → Schedule re-review

---

### NEEDS CLARIFICATION
- [ ] Questions answerable but require additional detail
- [ ] Test scenarios need refinement
- [ ] Implementation approach needs documentation

**Action:** Amend constitution → Re-submit for review

---

## Review Sign-off

**Architecture Lead:** _________________________ Date: _________

**Finance OS Owner:** _________________________ Date: _________

**Decision:**
- [ ] ✅ APPROVED — Proceed to Implementation Plan
- [ ] ❌ REJECTED — Revise constitution
- [ ] ⚠️ CONDITIONAL APPROVAL — Address clarifications before plan

**Notes:**

---

## Post-Review Next Steps

**If APPROVED:**
1. Create `H1_2_IMPLEMENTATION_PLAN.md`
2. Define schema changes, retry engine, failure classifier, quarantine model
3. Document O1-O10 verification sequence
4. Schedule Implementation Review
5. After plan approval → Begin coding

**If REJECTED:**
1. Address architectural concerns
2. Revise constitution (new version)
3. Re-submit for review
4. No coding until approval

**If CONDITIONAL:**
1. Address clarifications in constitution
2. Submit amendment
3. Architecture lead confirms
4. Proceed to Implementation Plan

---

**Review focus:** Is the constitution sound? NOT: How will we implement it?

**Implementation details belong in Implementation Plan, not this review.**

---

**END OF REVIEW CHECKLIST**
