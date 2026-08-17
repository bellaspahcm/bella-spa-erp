# H1.2 Implementation Plan Review

**Date:** 2026-08-17  
**Constitution:** v1.3 FROZEN (APPROVED)  
**Implementation Plan:** v1.0  
**Review Type:** Final Gate Before Coding

---

## Review Objective

**NOT:** Review architecture (Constitution already FROZEN)

**ONLY:** Verify Implementation Plan executes Constitution v1.3 without inadvertent architecture changes

**Question:** "Does this plan implement frozen Constitution faithfully?"

**Outcome:** PASS → Coding UNLOCKED / REVISE → Fix plan

---

## Review Scope (6 Checkpoints)

1. Schema — Additive, H1.1 safe, F1-F4 untouched
2. Idempotency — SHA256 key, H1.1 reuse, no second mechanism
3. Worker/Recovery — Atomic claim, lease, retry, crash-after-commit
4. Replay/Bulk — Concurrency guard, hard cap, mixed outcomes
5. Security/Reconciliation — H1.2 no F1-F4 mutation, reconciliation SELECT-only
6. Verification — O1-O10 tests Constitution, TC1-TC4 NEW, H1.1 untouched

---

## Checkpoint 1: Schema

**Constitution Requirement (A2, A5):**
- Schema extensions additive only
- H1.1 compatibility preserved
- F1-F4 Kernel untouched

**Implementation Plan Review:**

**Schema Extensions:**
```sql
✅ All new columns: DEFAULT or NULLABLE
   - retry_count INTEGER DEFAULT 0 NOT NULL
   - next_retry_at TIMESTAMPTZ (nullable)
   - failure_classification TEXT (nullable)
   - quarantine_reason TEXT (nullable)
   - etc.

✅ No column removal
✅ No type changes
✅ Additive indexes only
```

**H1.1 Compatibility:**
```sql
✅ H1.1 queries work: SELECT event_id, tenant_id, event_type, status, created_at FROM finance_outbox_events
✅ H1.1 workers ignore new columns (not referenced)
```

**F1-F4 Kernel:**
```
✅ No modifications to:
   - finance_transactions (reuse H1.1 UNIQUE constraint)
   - journal_entries
   - journal_lines
   - accounts
   - chart_of_accounts
```

**Idempotency Key Column:**
```sql
✅ Optional: ALTER TABLE finance_outbox_events ADD COLUMN idempotency_key TEXT;
✅ For traceability only, not enforcement (enforcement at finance_transactions)
✅ H1.1 compatible (nullable, not required)
```

**Decision:** 🟢 **PASS**

**Reason:** Schema additive, H1.1 safe, F1-F4 untouched

---

## Checkpoint 2: Idempotency

**Constitution Requirement (A1, H1.1 Reuse):**
- Use H1.1 proven idempotency mechanism
- No second idempotency mechanism
- Idempotency key: Authoritative at finance_transactions table

**Implementation Plan Review:**

**Hash Algorithm:**
```typescript
✅ SHA256 specified
✅ Function: generate_idempotency_key(tenant_id, event_type, source_transaction_id)
✅ Immutable, deterministic
```

**H1.1 Reuse:**
```typescript
✅ Plan explicitly states: "Finance API idempotency check (H1.1 proven mechanism)"
✅ No new idempotency table created
✅ No duplicate idempotency logic in H1.2 worker
✅ Reuses existing finance_transactions(idempotency_key) UNIQUE constraint
```

**Enforcement Point:**
```
✅ Authoritative: finance_transactions table (H1.1)
✅ H1.2 worker: Passes idempotency_key to Finance API
✅ Finance API: Checks existing transaction, returns ALREADY_PROCESSED if exists
✅ Single enforcement point (not dual)
```

**Constitution Forbidden Change #7:**
```
"Change H1.1 idempotency behavior (P5 frozen — H1.2 reuses, not replaces)"
✅ Plan complies: Reuses, not replaces
```

**Decision:** 🟢 **PASS**

**Reason:** SHA256 appropriate, H1.1 mechanism reused, no second mechanism

---

## Checkpoint 3: Worker / Recovery

**Constitution Requirement (A1, A2, O4):**
- Atomic claim with full WHERE clause
- Lease recovery after expiration
- Retry transaction after Finance failure (C1)
- Crash-after-commit recovery via idempotency

**Implementation Plan Review:**

**Atomic Claim:**
```typescript
✅ Full WHERE clause:
   WHERE status IN ('PENDING', 'FAILED')
     AND (next_retry_at IS NULL OR next_retry_at <= now())
     AND (lease_expires_at IS NULL OR lease_expires_at < now())
     AND claimed_by IS NULL
   FOR UPDATE SKIP LOCKED
   LIMIT 1

✅ Verification: if (result.rowCount !== 1) throw error
✅ Atomic: Single UPDATE transaction
```

**Lease Recovery:**
```typescript
✅ Cron job: Every 30 seconds
✅ Logic: WHERE status = 'PROCESSING' AND lease_expires_at < now()
✅ Transition: PROCESSING → PENDING (claimed_by = NULL)
✅ O4 compliance
```

**Retry Transaction (C1):**
```typescript
✅ handleFailure function:
   - Increments retry_count in PROCESSING → FAILED transition
   - Same transaction as status update
   - After Finance failure response
✅ C1 clarification implemented correctly
```

**Crash-After-Commit:**
```
✅ Scenario documented:
   - Worker crashes after Finance commits but before marking PROCESSED
   - Lease expires → Event returns to PENDING
   - Next worker claims → Posts to Finance
   - Finance checks idempotency_key → ALREADY_PROCESSED
   - Worker marks PROCESSED
✅ A1 Recovery Scenario 2 implemented
```

**Decision:** 🟢 **PASS**

**Reason:** Atomic claim correct, lease recovery safe, retry transaction matches C1, crash-after-commit handled

---

## Checkpoint 4: Replay / Bulk

**Constitution Requirement (A4, O6, O9, C2):**
- Replay concurrency guard (atomic, affected_rows = 1)
- Replay only QUARANTINED (not PROCESSED/PROCESSING)
- Bulk hard cap 100 events
- Mixed outcomes acceptable (not all must reach PROCESSED)

**Implementation Plan Review:**

**Replay Concurrency Guard (A4):**
```typescript
✅ WHERE event_id = $1
     AND status = 'QUARANTINED'
     AND (claimed_by IS NULL OR lease_expires_at < now())
   RETURNING event_id

✅ Check: if (result.rowCount === 0) return failure
✅ Atomic: Only 1 replay succeeds per event
✅ Cannot replay PROCESSED/PROCESSING (WHERE status = 'QUARANTINED')
```

**Valid Replay Scenarios:**
```
✅ Scenario 1: Orphaned event (Finance committed, outbox not PROCESSED)
✅ Scenario 2: Genuine quarantine (transient failure, root cause fixed)
✅ Scenario 3: Permanent failure, payload corrected
✅ Invalid scenario removed: PROCESSED → QUARANTINED (A4 compliance)
```

**Bulk Hard Cap (O9):**
```typescript
✅ limit: number = 100 (default)
✅ const clampedLimit = Math.min(limit, 100); (hard cap)
✅ Cannot exceed 100 events per operation
```

**Mixed Outcomes (C2):**
```typescript
✅ Plan explicitly states:
   "Not all replayed events will reach PROCESSED"
   "PERMANENT/POISON may remain QUARANTINED (valid outcome)"
   "Acceptance: All events processed through pipeline, not stuck"
✅ Test scenario: 450 transient (succeed), 30 permanent (quarantined), 20 poison (quarantined)
✅ C2 clarification implemented
```

**Decision:** 🟢 **PASS**

**Reason:** Replay concurrency guard atomic, bulk capped at 100, mixed outcomes accepted (C2 compliant)

---

## Checkpoint 5: Security / Reconciliation

**Constitution Requirement (A3, C3):**
- H1.2 role cannot mutate F1-F4 tables (DB permission enforcement)
- Reconciliation role SELECT-only (cannot INSERT/UPDATE/DELETE)
- Security context enforced, not just convention

**Implementation Plan Review:**

**H1.2 Worker Role:**
```sql
✅ Role: h1_2_worker
✅ GRANT SELECT, INSERT, UPDATE ON finance_outbox_events
✅ GRANT SELECT ON finance_transactions (idempotency check only)
✅ REVOKE INSERT, UPDATE, DELETE ON finance_transactions
✅ REVOKE ALL ON journal_entries, journal_lines, accounts, chart_of_accounts
✅ A3 enforcement: H1.2 physically cannot mutate F1-F4
```

**Reconciliation Role (C3):**
```sql
✅ Role: h1_2_reconciliation_readonly
✅ GRANT SELECT ON finance_outbox_events, finance_transactions, journal_entries, journal_lines
✅ REVOKE INSERT, UPDATE, DELETE ON ALL TABLES
✅ C3 enforcement: Reconciliation physically cannot mutate ledger
```

**Connection Configuration:**
```typescript
✅ createWorkerConnection(): Uses h1_2_worker role
✅ createReadonlyConnection(): Uses h1_2_reconciliation_readonly role
✅ Separate connection pools, separate roles
```

**Architecture Boundary:**
```
✅ H1.2 Worker → HTTP POST Finance API → Finance API (different role) → F1-F4
✅ Boundary enforced: H1.2 cannot bypass to direct DB write
```

**Verification Test:**
```sql
✅ Plan includes: Test mutation from readonly context → Permission denied
✅ C3 proof testable
```

**Decision:** 🟢 **PASS**

**Reason:** Security boundary enforced at DB level (not convention), reconciliation SELECT-only proven, A3 + C3 compliant

---

## Checkpoint 6: Verification

**Constitution Requirement (O1-O10, A5):**
- Each gate O1-O10 has behavioral test
- Tests prove Constitution guarantees
- Compatibility uses NEW test suite (TC1-TC4)
- H1.1 evidence untouched

**Implementation Plan Review:**

**O1-O10 Test Mapping:**
```
✅ O1: o1_retry_policy.test.ts — Exponential backoff, max retry, quarantine
✅ O2: o2_failure_classification.test.ts — TRANSIENT, PERMANENT, POISON, UNKNOWN
✅ O3: o3_poison_event.test.ts — Deterministic crash, quarantine after threshold
✅ O4: o4_lease_recovery.test.ts — Worker crash, lease expiration, recovery
✅ O5: o5_dead_letter.test.ts — Quarantine visibility, metadata, tenant filter
✅ O6: o6_manual_replay.test.ts — Replay scenarios, concurrency guard, idempotency
✅ O7: o7_observability.test.ts — Metrics queries, counts, tenant isolation, performance
✅ O8: o8_alerting.test.ts — Threshold detection (pending, quarantine, stuck, lag, failure_rate)
✅ O9: o9_bulk_recovery.test.ts — Bounded batch, mixed outcomes, no duplicates
✅ O10: o10_reconciliation.test.ts — Detect discrepancies, no auto-correct, readonly enforced
✅ All gates mapped to specific tests
```

**Evidence Collection:**
```
✅ Plan specifies evidence format:
   - SQL queries before/after
   - Worker logs (structured JSON)
   - Metrics snapshots
   - State transitions documented
✅ Evidence template provided
✅ Each gate requires behavioral proof (not "code looks correct")
```

**Compatibility Tests (A5):**
```typescript
✅ NEW Test Suite: h1_2_backward_compatibility.test.ts
✅ TC1: Old event format compatibility (H1.2 worker handles H1.1 events)
✅ TC2: Schema additive only (verify nullable/default, H1.1 queries work)
✅ TC3: Event contract stability (envelope unchanged, Finance API unchanged)
✅ TC4: H1.1 worker compatibility (if feasible)
✅ Separate from H1.1 frozen tests
```

**H1.1 Protection:**
```
✅ Plan explicitly states: "A5: H1.1 evidence untouched, NEW test suite proves compatibility"
✅ No rerun of G1-G7, N1-N3
✅ No modification of H1_1_FINAL_EVIDENCE_FREEZE.md
✅ Compatibility proven via TC1-TC4, not H1.1 re-execution
```

**Success Criteria:**
```
✅ All O1-O10 gates PASS with behavioral evidence
✅ Five Core Questions answered (no loss, no infinite retry, crash recoverable, operator control, no duplicates)
✅ H1.1 invariants still valid (P1-P5)
✅ H1.2 invariants proven (I1-I3)
✅ No F1-F4 modifications
✅ Evidence frozen
✅ Backward compatibility PASS (TC1-TC4)
```

**Decision:** 🟢 **PASS**

**Reason:** All gates mapped to tests, evidence collection structured, compatibility uses NEW suite (A5), H1.1 untouched

---

## Final Review Decision

**Checkpoints:**

| # | Checkpoint | Decision | Rationale |
|---|------------|----------|-----------|
| 1 | Schema | 🟢 PASS | Additive, H1.1 safe, F1-F4 untouched |
| 2 | Idempotency | 🟢 PASS | SHA256 appropriate, H1.1 reused, no second mechanism |
| 3 | Worker/Recovery | 🟢 PASS | Atomic claim, lease recovery, retry transaction (C1), crash-after-commit |
| 4 | Replay/Bulk | 🟢 PASS | Concurrency guard (A4), hard cap 100, mixed outcomes (C2) |
| 5 | Security/Reconciliation | 🟢 PASS | DB-level enforcement (A3), reconciliation SELECT-only (C3) |
| 6 | Verification | 🟢 PASS | O1-O10 tests Constitution, TC1-TC4 NEW (A5), H1.1 untouched |

**Summary:**
- ✅ 6/6 checkpoints PASS
- ✅ Plan implements Constitution v1.3 faithfully
- ✅ No inadvertent architecture changes
- ✅ H1.1 baseline protected
- ✅ F1-F4 Kernel protected
- ✅ All amendments (A1-A5, C1-C3) addressed in plan

**No revisions needed.**

---

## Verdict

**Status:** ✅ **APPROVED**

**H1.2 Implementation Plan v1.0 is APPROVED for implementation.**

**Authorization:** 🔓 **CODING UNLOCKED**

**Next Steps:**
1. ✅ Implementation Plan APPROVED
2. 🔓 Coding unlocked (developer may begin implementation)
3. → Implement according to plan (schema → worker → operations → security → tests)
4. → Execute O1-O10 verification gates
5. → Collect behavioral evidence
6. → Generate evidence freeze document
7. → H1.2 PROVEN + FROZEN
8. → Unlock H1.3

---

## Implementation Guidelines

**Developer must:**
- ✅ Follow Implementation Plan v1.0 (frozen)
- ✅ Implement Constitution v1.3 (frozen)
- ✅ Do NOT modify H1.1 baseline
- ✅ Do NOT modify F1-F4 Kernel
- ✅ Do NOT expand scope beyond O1-O10
- ✅ Collect evidence for each gate (behavioral proof required)

**If ambiguity found during coding:**
- Clarify with Architecture Lead
- Do NOT make architecture decisions independently
- Minor implementation details: Document decision, proceed
- Major architecture gap: STOP, escalate for Constitution amendment

---

## Sign-Off

**Reviewed by:** Architecture Lead  
**Date:** 2026-08-17  
**Decision:** ✅ **APPROVE — CODING UNLOCKED**

**Notes:**
- All 6 checkpoints PASS
- Plan implements frozen Constitution faithfully
- No inadvertent architecture changes detected
- H1.1 and F1-F4 protection verified
- Developer authorized to begin implementation
- Evidence collection required before H1.2 PROVEN

---

**END OF IMPLEMENTATION PLAN REVIEW**

---

## Coding Gate Status

**Before this review:** 🚫 BLOCKED  
**After this review:** 🔓 **UNLOCKED**

**Timeline:**
```
Constitution v1.3      → FROZEN (2026-08-17)
Architecture Review R2 → APPROVED (2026-08-17)
Implementation Plan    → APPROVED (2026-08-17)
Implementation Review  → APPROVED (2026-08-17)
Coding                 → 🔓 UNLOCKED (2026-08-17)
```

**Next milestone:** O1-O10 verification → H1.2 PROVEN + FROZEN

---
