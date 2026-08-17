# H1.2 Coding Kickoff

**Date:** 2026-08-17  
**Status:** 🔓 CODING UNLOCKED  
**Authority:** Implementation Plan v1.0 APPROVED

---

## Coding Gate Status

**BEFORE:** 🚫 BLOCKED (pending reviews)  
**NOW:** 🔓 **UNLOCKED** (all gates passed)

**Timeline:**
```
Constitution v1.3       → 🔒 FROZEN (2026-08-17)
Architecture Review R2  → ✅ APPROVED
Implementation Plan     → ✅ APPROVED
Implementation Review   → ✅ APPROVED
Coding                  → 🔓 UNLOCKED ← WE ARE HERE
```

---

## Coding Authority

**Developer/Codex is authorized to implement:**

✅ **Source of Truth:** `docs/architecture/H1_2_IMPLEMENTATION_PLAN.md` (FROZEN)

**Implementation follows:**
1. Constitution v1.3 (FROZEN — no modifications)
2. Implementation Plan v1.0 (APPROVED — follow exactly)
3. Phased approach (7 phases documented below)

---

## Hard Boundaries (NON-NEGOTIABLE)

### ❌ FORBIDDEN During Coding

1. **❌ Modify Constitution v1.3**
   - Constitution is FROZEN
   - No architecture changes
   - No scope expansion

2. **❌ Redesign Architecture**
   - Implementation Plan is approved
   - Follow plan exactly
   - No "improvements" without approval

3. **❌ Touch H1.1 Baseline**
   - H1.1 is FROZEN
   - No code modifications
   - No evidence reopening
   - No test re-execution

4. **❌ Touch F1-F4 Kernel**
   - F1-F4 is FROZEN
   - No table modifications
   - No function changes
   - Reuse idempotency only

5. **❌ Open H1.3**
   - H1.3 not authorized
   - H1.2 must be PROVEN first
   - No performance optimization yet

6. **❌ Add Scope Beyond Plan**
   - O1-O10 only
   - No additional features
   - No "nice to have" additions

### ✅ ALLOWED During Coding

1. **✅ Implement Frozen Plan**
   - Follow H1_2_IMPLEMENTATION_PLAN.md exactly
   - All code traceable to O1-O10

2. **✅ Make Implementation Decisions**
   - Minor details (variable names, file structure, etc.)
   - Document decisions in code comments
   - Stay within plan boundaries

3. **✅ Fix Implementation Bugs**
   - Code errors: Fix immediately
   - Logic errors: Fix if within plan scope

4. **✅ Collect Evidence**
   - Each change traceable to gate (O1-O10)
   - Prepare for behavioral verification

---

## If Architecture Gap Found

**Scenario:** During coding, discover Constitution/Plan is unimplementable

**DO NOT:** Modify Constitution independently

**PROCEDURE:**

1. **Stop** coding related component
2. **Document** the gap clearly:
   - What cannot be implemented?
   - Why is it blocked?
   - What Constitution clause is affected?
3. **Escalate** to Architecture Lead
4. **Decision:**
   - Implementation bug → Fix code (proceed)
   - Constitution gap → Amendment required (stop, revise Constitution)

**Example:**
```
❌ WRONG: "Constitution says atomic claim, but I think batch claim is better" 
          → Change implementation to batch
          
✅ RIGHT: "Constitution specifies atomic claim, but database doesn't support 
          RETURNING with FOR UPDATE SKIP LOCKED"
          → Stop, document gap, escalate
```

---

## Implementation Phases (Recommended Order)

### Phase 1: Migration / Schema ⏱️ ~2 hours

**Deliverables:**
- `migrations/xxx_h1_2_schema_extensions.sql`
- `migrations/xxx_create_h1_2_roles.sql`

**Tasks:**
1. Create schema migration (additive columns)
2. Create indexes
3. Create DB roles (h1_2_worker, h1_2_reconciliation_readonly)
4. Grant/revoke permissions

**Verification:**
- Run migration on test database
- Verify H1.1 queries still work
- Verify new columns exist with correct types
- Verify roles created with correct permissions

**Checkpoint:** Schema deployed, H1.1 unaffected

---

### Phase 2: Worker Core ⏱️ ~8 hours

**Deliverables:**
- `src/platform/integration-hub/finance-outbox-worker.ts`
- `src/platform/integration-hub/finance-outbox-lease-recovery.ts`

**Tasks:**
1. `claimEvent()` — Atomic claim with full WHERE clause
2. `processEvent()` — POST to Finance API, handle response
3. `markProcessed()` — Success handling
4. `handleFailure()` — Classify failure, increment retry_count (C1)
5. `quarantineEvent()` — Move to QUARANTINED
6. `calculateNextRetry()` — Exponential backoff (O1)
7. `classifyFailure()` — TRANSIENT/PERMANENT/POISON/UNKNOWN (O2)
8. `recoverStaleLeases()` — Lease recovery cron (O4)

**Verification:**
- Worker can claim event
- Worker respects next_retry_at
- Retry count increments correctly (C1)
- Exponential backoff working (O1)
- Lease recovery returns stuck events to PENDING (O4)

**Checkpoint:** Worker processes events end-to-end

---

### Phase 3: Replay & Bulk ⏱️ ~4 hours

**Deliverables:**
- `src/platform/integration-hub/finance-outbox-replay.ts`

**Tasks:**
1. `replayEvent()` — Manual replay with concurrency guard (A4)
2. `replayBulk()` — Bulk replay with hard cap 100 (O9, C2)

**Verification:**
- Replay transitions QUARANTINED → PENDING
- Concurrency guard prevents double replay (A4)
- Bulk respects 100-event limit
- Mixed outcomes accepted (not all PROCESSED) (C2)

**Checkpoint:** Operator can replay quarantined events safely

---

### Phase 4: Security Boundary ⏱️ ~2 hours

**Deliverables:**
- `src/platform/integration-hub/db-connection.ts` (role-based connections)

**Tasks:**
1. `createWorkerConnection()` — Uses h1_2_worker role
2. `createReadonlyConnection()` — Uses h1_2_reconciliation_readonly role
3. Verify Finance API uses separate role (not h1_2_worker)

**Verification:**
- H1.2 worker attempts direct journal_entries INSERT → Permission denied (A3)
- Reconciliation attempts UPDATE journal_entries → Permission denied (C3)
- Worker can only POST to Finance API (boundary enforced)

**Checkpoint:** Security boundary enforced at DB level

---

### Phase 5: Observability & Reconciliation ⏱️ ~4 hours

**Deliverables:**
- `src/platform/integration-hub/finance-outbox-observability.ts`
- `src/platform/integration-hub/finance-outbox-reconciliation.ts`

**Tasks:**
1. `getOutboxHealth()` — Metrics queries (O7)
2. `getQuarantinedEvents()` — Dead letter queue (O5)
3. `reconcileOutboxLedger()` — Detect discrepancies with readonly role (O10, C3)
4. `generateReconciliationReport()` — Format discrepancies, resolution guidance

**Verification:**
- Metrics queries return correct counts
- Metrics respect tenant isolation
- Queries execute in <1s (O7)
- Reconciliation uses readonly connection (C3)
- Reconciliation detects orphaned/missing journals (O10)
- No auto-correction (detect-only)

**Checkpoint:** Observability functional, reconciliation detect-only

---

### Phase 6: Compatibility Tests ⏱️ ~3 hours

**Deliverables:**
- `tests/integration/h1_2_backward_compatibility.test.ts`

**Tasks:**
1. TC1: Old event format compatibility
2. TC2: Schema additive only
3. TC3: Event contract stability
4. TC4: H1.1 worker compatibility (if feasible)

**Verification:**
- TC1-TC4 all PASS
- H1.1 evidence documents UNTOUCHED
- No G1-G7, N1-N3 re-execution

**Checkpoint:** Backward compatibility proven (A5)

---

### Phase 7: O1-O10 Verification ⏱️ ~12 hours

**Deliverables:**
- `tests/integration/o1_retry_policy.test.ts` through `o10_reconciliation.test.ts`
- Evidence documents: `docs/testing/H1_2_O1_EVIDENCE.md` through `H1_2_O10_EVIDENCE.md`

**Tasks:**
1. Write behavioral test for each gate O1-O10
2. Execute test scenarios
3. Capture state transitions (SQL before/after)
4. Capture worker logs
5. Capture metrics snapshots
6. Document evidence

**Verification:**
- All O1-O10 tests PASS
- Evidence includes:
  - State transitions (SQL queries)
  - Worker logs (structured)
  - Metrics (counts, timings)
  - Acceptance criteria verified

**Checkpoint:** All gates proven with behavioral evidence

---

## Total Estimated Time

**~35 hours** across 7 phases

**Timeline:**
- Week 1: Phases 1-3 (Migration, Worker, Replay)
- Week 2: Phases 4-5 (Security, Observability)
- Week 3: Phases 6-7 (Compatibility, Verification)

---

## Success Criteria

**Coding phase is COMPLETE when:**

1. ✅ All 7 phases implemented
2. ✅ All O1-O10 gates PASS with behavioral tests
3. ✅ All compatibility tests PASS (TC1-TC4)
4. ✅ Evidence collected for each gate
5. ✅ No H1.1 modifications
6. ✅ No F1-F4 modifications
7. ✅ Security boundary verified (permission denied tests PASS)
8. ✅ Five Core Questions answered with evidence

**Then:** H1.2 PROVEN + FROZEN → Unlock H1.3

---

## Evidence Requirements

**For each gate O1-O10, evidence MUST include:**

1. **Test Scenario Description**
   - What is being tested?
   - Initial state
   - Action performed
   - Expected outcome

2. **SQL Queries (Before/After)**
   ```sql
   -- Before
   SELECT event_id, status, retry_count FROM finance_outbox_events WHERE event_id = '...';
   -- Result: PENDING, 0
   
   -- Action: Worker processes, Finance returns 503
   
   -- After
   SELECT event_id, status, retry_count, next_retry_at FROM finance_outbox_events WHERE event_id = '...';
   -- Result: FAILED, 1, now() + 1s
   ```

3. **Worker Logs (Structured)**
   ```json
   {
     "timestamp": "2026-08-XX 10:00:00",
     "worker_id": "worker-001",
     "event_id": "evt-123",
     "action": "process_failure",
     "failure_classification": "TRANSIENT",
     "retry_count": 1,
     "next_retry_at": "2026-08-XX 10:00:01"
   }
   ```

4. **Metrics Snapshot**
   ```
   pending_count: 10
   processing_count: 2
   failed_count: 5
   quarantined_count: 0
   ```

5. **Acceptance Criteria Verification**
   ```
   ✅ Retry interval = 1s (exponential backoff working)
   ✅ retry_count incremented (0 → 1)
   ✅ Worker did not re-claim before next_retry_at
   ✅ Event in FAILED state (not stuck)
   ```

**Evidence is NOT:** "Code looks correct" or "Schema supports it"

**Evidence IS:** Actual system behavior captured with data

---

## Development Guidelines

### Code Organization

```
src/platform/integration-hub/
├── finance-outbox-worker.ts          (Phase 2)
├── finance-outbox-lease-recovery.ts  (Phase 2)
├── finance-outbox-replay.ts          (Phase 3)
├── finance-outbox-observability.ts   (Phase 5)
├── finance-outbox-reconciliation.ts  (Phase 5)
├── db-connection.ts                  (Phase 4)
└── types/
    └── outbox.types.ts               (Type definitions)

tests/integration/
├── h1_2_backward_compatibility.test.ts  (Phase 6)
├── o1_retry_policy.test.ts              (Phase 7)
├── o2_failure_classification.test.ts    (Phase 7)
├── ...
└── o10_reconciliation.test.ts           (Phase 7)

docs/testing/
├── H1_2_O1_EVIDENCE.md                  (Phase 7)
├── H1_2_O2_EVIDENCE.md                  (Phase 7)
├── ...
└── H1_2_O10_EVIDENCE.md                 (Phase 7)

migrations/
├── xxx_h1_2_schema_extensions.sql       (Phase 1)
└── xxx_create_h1_2_roles.sql            (Phase 1)
```

### Commit Messages

**Format:** `[H1.2-Ox] Component: Description`

**Examples:**
```
[H1.2-O1] Worker: Implement exponential backoff retry policy
[H1.2-O4] Lease Recovery: Add cron job for stuck event recovery
[H1.2-A3] Security: Add h1_2_worker DB role with restricted permissions
[H1.2-O6] Replay: Add concurrency guard for manual replay
```

**Traceability:** Every commit references a gate or amendment

---

## Quality Checklist (Pre-Evidence)

**Before claiming a gate is complete:**

- [ ] Test scenario executed successfully
- [ ] SQL queries captured (before/after)
- [ ] Worker logs captured (structured JSON)
- [ ] Metrics snapshot captured
- [ ] Acceptance criteria verified
- [ ] Evidence documented in `H1_2_Ox_EVIDENCE.md`
- [ ] Code reviewed for Constitution compliance
- [ ] No H1.1 modifications introduced
- [ ] No F1-F4 modifications introduced

---

## Communication During Coding

**If implementation goes smoothly:**
- Proceed phase by phase
- Commit regularly with traceable messages
- Collect evidence as you go

**If gap discovered:**
- Stop related component
- Document gap clearly
- Escalate immediately
- Do NOT make architecture decisions independently

**If ambiguity in plan:**
- Minor detail (variable naming, file structure): Decide and document
- Major architecture (state machine change, new failure type): Escalate

---

## Final Milestone

**Coding phase ends when:**
```
H1.2 Implementation
        ↓
O1-O10 All PASS
        ↓
Evidence Collected
        ↓
Five Core Questions Answered
        ↓
H1.2 PROVEN
        ↓
Evidence Freeze Document Created
        ↓
🔒 H1.2 PROVEN + FROZEN
        ↓
🔓 H1.3 UNLOCKED
```

**Not before.**

---

## Current Status

**Coding Gate:** 🔓 **UNLOCKED**  
**Developer:** Authorized to begin Phase 1 (Migration / Schema)  
**Timeline:** 3 weeks estimated  
**Authority:** H1_2_IMPLEMENTATION_PLAN.md (FROZEN)

**Begin implementation now.**

---

**END OF CODING KICKOFF**
