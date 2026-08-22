# E7.3 Rules & Traceability — Design Lock

**Milestone:** E7.3 Rules & Traceability  
**Design Lock Date:** 2026-08-22  
**Status:** 🔒 **DESIGN LOCKED** (Ready for Implementation)

---

## Executive Summary

**E7.3 extends E7.1/E7.2 with:**
- **Generic Rule Contract:** Deterministic evaluation + typed violations + evidence
- **Automatic Custody Events:** Movement → CustodyEvent generation
- **Lineage Query:** Upstream/downstream lot/serial traceability
- **Compliance Evaluation:** Expiry/compliance status without workflow triggers

**Critical Boundary:**
> **"E7.3 evaluates and enforces rules; Products interpret rule outcomes and execute workflows."**

**Design Result:** E7.3 provides rule/traceability primitives WITHOUT becoming a workflow engine.

---

## Design Phase Summary

| Phase | Deliverable | Status |
|-------|-------------|--------|
| E7.3.1 | Capability Inventory | ✅ Complete |
| E7.3.2 | Boundary Definition | ✅ Complete |
| E7.3.3 | Traceability Model | ✅ Complete |
| E7.3.4 | Generic Rule Model | ✅ Complete |
| E7.3.5 | Invariants + Negative-Path | ✅ Complete |
| **E7.3.6** | **ADR + Design Lock** | **⏳ Current** |

**Design Time:** 3 hours  
**Documents Created:** 6 design documents

---

## Core Architecture Principle

### The Boundary That Prevents Workflow Engine Contamination:

```
E7.3 Layer (Rules + Traceability)
         │
         ├─ evaluate()      → RuleResult (data)
         ├─ isExpired()     → ExpiryEvaluation (data)
         ├─ traceLineage()  → Movement[] (data)
         └─ generateEvent() → CustodyEvent (data)
         │
         ▼
    Result / Evidence
         │
         ▼
    Product Layer
         │
         ├─ Interpret result
         ├─ Execute workflow
         └─ Orchestrate actions
```

**One-way dependency:** E7.3 → Product (no reverse control)

---

## E7.3 Ownership (What E7.3 Provides)

### 1. Generic Rule Contract

**Rule Interface (< 100 LOC):**
```typescript
interface Rule<TContext> {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  evaluate(context: TContext): RuleResult;
}

type RuleResult = RulePass | RuleViolation;
```

**Key Properties:**
- Deterministic (same input → same output)
- Side-effect-free (no mutation)
- Evidence-backed (audit trail)
- Product-agnostic (uses E7.1/E7.2 entities only)

### 2. Generic Rules (P0)

| Rule | ID | Context | Violation Code |
|------|----|---------| ---------------|
| Expiry check | INVENTORY_EXPIRY_CHECK | inventory, evaluationDate | INVENTORY_EXPIRED |
| Quantity positive | QUANTITY_POSITIVE_CHECK | quantity | QUANTITY_MUST_BE_POSITIVE |
| Quantity available | QUANTITY_AVAILABLE_CHECK | requested, available | INSUFFICIENT_AVAILABLE_QUANTITY |
| Lot valid | TRACEABILITY_LOT_VALID | item, lot_number | LOT_NUMBER_REQUIRED |
| Serial valid | TRACEABILITY_SERIAL_VALID | item, serial_number | SERIAL_NUMBER_REQUIRED |
| Chain integrity | TRACEABILITY_CHAIN_INTEGRITY | traceability | BROKEN_TRACEABILITY_CHAIN |
| Compliance status | TRACEABILITY_COMPLIANCE_STATUS | traceability | COMPLIANCE_VIOLATION |

**Total:** 7 generic rules

### 3. Traceability Operations

**Custody Event Generation:**
- `generateCustodyEvent(movement)` → CustodyEvent
- Maps MovementType → CustodyAction (E7.1 enums)
- Validates movement status (COMPLETED only)

**Lineage Queries:**
- `traceUpstream(tenantId, lotNumber)` → Movement[] (source chain)
- `traceDownstream(tenantId, lotNumber)` → Movement[] (destination chain)
- `getLotHistory(tenantId, lotNumber)` → Movement[] (complete history)
- `getSerialHistory(tenantId, serialNumber)` → Movement[] (serial tracking)

**Compliance Evaluation:**
- `evaluateExpiry(inventory, date)` → ExpiryEvaluation
- `evaluateCompliance(traceability)` → ComplianceEvaluation
- `findExpiringSoon(tenantId, thresholdDays)` → Inventory[]

### 4. Traceability Safety

**Traversal Rules:**
- Cycle detection (warn, don't crash)
- Depth limit (100 movements default)
- Broken chain handling (report, don't fabricate)
- Deterministic ordering (movement_date → created_at → id)
- Tenant isolation enforced

---

## E7.3 Non-Ownership (What E7.3 MUST NOT Do)

### ❌ Product Workflows:
- Warehouse receiving/QA/putaway
- Sales order approval
- Finance posting
- Task orchestration
- Approval routing

### ❌ Automatic Actions:
- Auto-quarantine expired inventory
- Send notifications
- Create tasks
- Execute recalls
- Mutate entities based on time

### ❌ Business Decisions:
- "If expired → do X"
- "If supplier VIP → route to Y"
- "If lot contaminated → initiate Z"

**E7.3 provides facts. Products make decisions.**

---

## 20 Locked Invariants

### P0 — Rule Safety (1-5):
1. ✅ Rule evaluation must not mutate entity
2. ✅ Rule evaluation must not call Product services
3. ✅ Rule must be deterministic (explicit time context)
4. ✅ Rule must not depend on Product-specific concepts
5. ✅ Rule must have stable ID + version

### P0 — Violation Integrity (6-10):
6. ✅ Every VIOLATION must have machine-readable code
7. ✅ Every violation must have evidence
8. ✅ Evaluation time must be explicit (no hidden clock)
9. ✅ No fabricated violations (evidence must be sufficient)
10. ✅ No silent entity fixes (no auto-correction)

### P0 — Traceability Safety (11-16):
11. ✅ Tenant isolation is mandatory
12. ✅ Lineage traversal must be deterministic
13. ✅ Cycles must not crash or create fabricated lineage
14. ✅ Broken chains must be reported (no fabrication)
15. ✅ Depth limit is mandatory
16. ✅ Lineage query must not mutate entities

### P0 — Boundary Integrity (17-20):
17. ✅ RuleResult contains facts, not commands
18. ✅ E7.3 must not decide workflow next step
19. ✅ Product must not force E7.3 to execute workflow
20. ✅ E7.1/E7.2 frozen artifacts must not be modified

---

## Dependencies on E7.1/E7.2 (READ-ONLY 🔒)

### E7.3 READS (does not modify):

**From E7.1 (FROZEN):**
- ✅ `Inventory` entity (expiry_date, lot_number, serial_number)
- ✅ `Item` entity (lot_tracked, serial_tracked, expiry_tracked flags)
- ✅ `Movement` entity (immutable log, lot/serial fields)
- ✅ `TraceabilityRecord` entity (custody_events, compliance_status)
- ✅ `CustodyEvent` structure (timestamp, action, location)
- ✅ Status enums (InventoryStatus, ComplianceStatus, RecallStatus)
- ✅ `Result<T>` pattern

**From E7.2 (FROZEN):**
- ✅ `OperationContext` pattern (reason + actor)
- ✅ `MovementRepository.list(filters)` interface
- ✅ Domain Service pattern (entity tuple returns)

**No Modifications to E7.1/E7.2:**
- ✅ No new fields added to frozen entities
- ✅ No enum modifications
- ✅ No signature changes
- ✅ 439 regression tests must pass

**If E7.3 reveals E7.1/E7.2 defects:**
1. **STOP** implementation
2. Document gap
3. Create ACR (Architecture Change Request)
4. Architecture review
5. ADR if approved
6. Re-baseline E7.1/E7.2
7. Re-run 439 tests

---

## Implementation Scope

### Phase 1: Rule Contract (30 LOC estimate)

**Deliverables:**
- `Rule<TContext>` interface
- `RuleResult` type (PASS | VIOLATION)
- `ViolationDetail` structure
- `RuleEvidence` structure

**Success:** Contract types compile, < 100 LOC

### Phase 2: Generic Rules (200 LOC estimate)

**Deliverables:**
- 7 P0 rules implemented
- Each rule < 30 LOC
- All rules deterministic
- All rules side-effect-free

**Success:** 7 rules pass architectural tests

### Phase 3: Traceability Operations (300 LOC estimate)

**Deliverables:**
- `generateCustodyEvent()` implementation
- `traceUpstream()` / `traceDownstream()` implementations
- `getLotHistory()` / `getSerialHistory()` implementations
- Cycle detection logic
- Broken chain detection logic
- Depth limit enforcement

**Success:** Lineage queries deterministic, tenant-isolated

### Phase 4: Compliance Evaluation (150 LOC estimate)

**Deliverables:**
- `evaluateExpiry()` implementation
- `evaluateCompliance()` implementation
- `findExpiringSoon()` implementation

**Success:** Evaluation functions side-effect-free

### Phase 5: Rule Composition (50 LOC estimate)

**Deliverables:**
- `evaluateAll(rules, context)` implementation
- Collect all violations
- Preserve all evidence

**Success:** Composite evaluation works

### Phase 6: Tests (600 LOC estimate)

**Deliverables:**
- 20 invariant tests
- 6 negative-path tests
- 7 rule tests (positive + negative)
- 4 lineage tests (upstream, downstream, cycle, broken)
- 3 compliance tests
- E7.1/E7.2 regression (439 tests)

**Success:** All tests pass

### Total Estimate:

| Phase | LOC | Tests |
|-------|-----|-------|
| 1. Contract | 30 | 5 |
| 2. Rules | 200 | 21 |
| 3. Traceability | 300 | 15 |
| 4. Compliance | 150 | 9 |
| 5. Composition | 50 | 5 |
| 6. Tests | 600 | 439 (regression) |
| **Total** | **~1,330 LOC** | **~494 tests** |

**Planned Duration:** 6-8 hours implementation + 2 hours verification

---

## Verification Gates

### Gate 1: Contract Integrity
- ✅ Rule interface defined
- ✅ RuleResult type complete
- ✅ < 100 LOC for contract
- ✅ No workflow command fields

### Gate 2: Rule Safety
- ✅ All 7 rules deterministic
- ✅ No mutations detected
- ✅ No Product service calls
- ✅ Explicit time context

### Gate 3: Traceability Correctness
- ✅ Custody events generated correctly
- ✅ Lineage queries deterministic
- ✅ Cycles handled safely
- ✅ Broken chains reported (not fabricated)
- ✅ Tenant isolation enforced

### Gate 4: Boundary Enforcement
- ✅ No workflow execution from E7.3
- ✅ RuleResult is data, not command
- ✅ Products interpret results
- ✅ E7.1/E7.2 unchanged (439 tests pass)

### Gate 5: Negative-Path Integrity
- ✅ Expired inventory → violation + no mutation
- ✅ Broken chain → warning + no fabrication
- ✅ Cyclic lineage → terminates + reports cycle
- ✅ Missing lot → violation + no mutation
- ✅ Same context → identical result
- ✅ Rule violation → no workflow execution

### Gate 6: Evidence Quality
- ✅ All violations have typed codes
- ✅ All violations have evidence
- ✅ Evidence includes input/output
- ✅ Audit trail complete

---

## Success Criteria

E7.3 implementation is successful if:

### Criterion 1: E7.1/E7.2 Unchanged
- ✅ 439 regression tests pass
- ✅ No frozen file modifications
- ✅ No new fields on frozen entities

### Criterion 2: Rules Are Generic
- ✅ 7 rules implemented
- ✅ All rules Product-agnostic
- ✅ Context uses E7.1/E7.2 entities only

### Criterion 3: Rules Are Safe
- ✅ Deterministic (20 invariant tests pass)
- ✅ Side-effect-free (no mutations detected)
- ✅ No workflow execution (6 negative-path tests pass)

### Criterion 4: Traceability Works
- ✅ Custody events generated from movements
- ✅ Lineage queries return deterministic results
- ✅ Cycles and broken chains handled safely
- ✅ Tenant isolation enforced

### Criterion 5: Boundary Preserved
- ✅ E7.3 → Product flow (one-way)
- ✅ RuleResult is data, not command
- ✅ Products execute workflows, not E7.3

### Criterion 6: Products Can Extend
- ✅ Products can add rules using E7.3 contract
- ✅ Products can interpret violations
- ✅ Products execute workflows based on results
- ✅ No kernel modifications required

---

## Architectural Decisions (ADR)

### ADR-E7.3-001: Rule Contract Pattern

**Decision:** Use minimal `Rule<TContext>` interface, not complex DSL.

**Rationale:**
- Prove pattern with simple AND composition first
- Avoid over-engineering before Product needs known
- Clearer boundary (rules vs workflows)

**Tradeoff:** Less flexibility, but lower complexity and clearer architecture.

**Alternative Rejected:** Generic rule expression language (too complex, too early)

---

### ADR-E7.3-002: Deterministic Time Handling

**Decision:** All time-dependent rules require explicit `evaluationDate` in context.

**Rationale:**
- Determinism critical for testing and compliance
- Hidden `new Date()` breaks reproducibility
- Audit trail requires fixed evaluation time

**Tradeoff:** More verbose context, but reproducible results.

**Alternative Rejected:** Hidden clock inside rules (non-deterministic)

---

### ADR-E7.3-003: Evidence as First-Class

**Decision:** All violations include `RuleEvidence` with input/output/metadata.

**Rationale:**
- Regulatory compliance requires complete audit trail
- Debugging requires understanding evaluation context
- Compliance reporting needs evidence

**Tradeoff:** More data to store, but better auditability.

**Alternative Rejected:** Violations without evidence (insufficient for compliance)

---

### ADR-E7.3-004: Broken Chain Reporting (No Fabrication)

**Decision:** Missing movements reported as broken chain warning. No inference or reconstruction.

**Rationale:**
- Data integrity: E7.3 must not create false lineage
- Reality: Broken chains reflect actual data state
- Transparency: Products need to know about gaps

**Tradeoff:** Incomplete lineage, but accurate representation of reality.

**Alternative Rejected:** Fabricate missing movements (violates data integrity)

---

### ADR-E7.3-005: RuleResult is Data, Not Command

**Decision:** `RuleResult` contains facts/evidence, not workflow commands or actions.

**Rationale:**
- Preserve E7.3 → Product unidirectional flow
- Prevent E7.3 from becoming workflow engine
- Products must interpret results and decide actions

**Tradeoff:** Products must map violations to workflows, but boundary preserved.

**Alternative Rejected:** Include workflow commands in RuleResult (violates boundary)

---

### ADR-E7.3-006: Generic Codes Only

**Decision:** Violation codes are generic (INVENTORY_EXPIRED), not Product-specific (WAREHOUSE_QA_FAILED).

**Rationale:**
- E7.3 must not know Product semantics
- Kernel independence maintained
- Products map generic codes to workflows

**Tradeoff:** Products must interpret codes, but kernel stays clean.

**Alternative Rejected:** Product-specific codes (violates kernel independence)

---

### ADR-E7.3-007: No TraceabilityRepository in E7.3

**Decision:** E7.3 provides domain operations. Products provide persistence.

**Rationale:**
- E7.3 generates custody events; Products persist them
- Repository is infrastructure concern, not domain
- Products have different persistence needs

**Tradeoff:** Products must implement repository, but E7.3 stays pure.

**Alternative Rejected:** E7.3-owned TraceabilityRepository (mixes domain and infrastructure)

---

## Risk Assessment

### Risk 1: Scope Creep (E7.3 → Workflow Engine)

**Probability:** Medium  
**Impact:** High (violates architecture)

**Mitigation:**
- 20 invariants enforced
- 6 negative-path tests
- Boundary tests (workflow execution forbidden)
- Design review before implementation

**Indicator:** If E7.3 code contains `createTask()`, `sendNotification()`, `quarantine()` → STOP

---

### Risk 2: E7.1/E7.2 Modification Needed

**Probability:** Low  
**Impact:** High (breaks frozen boundary)

**Mitigation:**
- E7.3.1 capability inventory verified E7.1/E7.2 sufficient
- Frozen boundary enforcement active
- ACR process for defects

**Indicator:** If E7.3 needs new field on frozen entity → ACR required

---

### Risk 3: Rule Complexity Growth

**Probability:** Medium  
**Impact:** Medium (maintenance burden)

**Mitigation:**
- Start with 7 simple rules
- Target < 30 LOC per rule
- No complex DSL in phase 1
- Defer advanced features until proven needed

**Indicator:** If rule > 50 LOC → refactor or split

---

### Risk 4: Product Pushback on Interpretation Burden

**Probability:** Low  
**Impact:** Low (expected tradeoff)

**Mitigation:**
- Clear documentation of interpretation pattern
- Example Product code provided
- Violation codes machine-readable
- Evidence complete for decision-making

**Indicator:** If Products request E7.3 execute workflows → boundary violation, reject

---

## Design Lock Checklist

Before implementation begins:

- [x] E7.3.1 Capability Inventory complete
- [x] E7.3.2 Boundary Definition locked
- [x] E7.3.3 Traceability Model defined
- [x] E7.3.4 Generic Rule Model defined
- [x] E7.3.5 Invariants documented (20 total)
- [x] E7.3.6 ADR complete (7 decisions)
- [x] Implementation scope defined (~1,330 LOC)
- [x] Verification gates defined (6 gates)
- [x] Success criteria measurable
- [x] Risk assessment complete
- [x] No E7.1/E7.2 modifications required
- [x] Boundary tests specified (prevent workflow engine)
- [x] Negative-path tests specified (6 tests)

**All checkboxes checked:** ✅ **DESIGN IS LOCKED**

---

## Implementation Roadmap

**Phase Order:**

1. **Phase 1:** Rule Contract (foundation) — 1 hour
2. **Phase 2:** Generic Rules (7 rules) — 2 hours
3. **Phase 3:** Traceability Operations — 2 hours
4. **Phase 4:** Compliance Evaluation — 1 hour
5. **Phase 5:** Rule Composition — 0.5 hour
6. **Phase 6:** Tests + Verification — 2 hours

**Total Estimate:** 8.5 hours

**Verification:** 2 hours (run all gates)

**Total:** ~10.5 hours

---

## Post-Implementation

### Freeze Process:

After implementation complete and all gates pass:

1. ✅ Run full test suite (494 tests)
2. ✅ Verify all 20 invariants
3. ✅ Verify 6 negative-path tests
4. ✅ E7.1/E7.2 regression (439 tests pass)
5. ✅ Create E7_3_FINAL_ANALYSIS.md
6. ✅ Update E7_3_WORK_LOG.md
7. ✅ Commit with message "feat: E7.3 Rules & Traceability 🔒 FROZEN"
8. ✅ Lock E7.3

### Change Process (Post-Freeze):

To modify E7.3 frozen artifacts:
1. Create ACR (Architecture Change Request)
2. Document rationale + impact
3. Architecture review
4. Create ADR if approved
5. Re-run 494 tests (must pass)
6. Update frozen manifest
7. Create new baseline

**No silent modifications permitted.**

---

## Next Milestone After E7.3

**Roadmap:**

```
E7.1 Domain Kernel 🔒 FROZEN
  ↓
E7.2 Operational Kernel 🔒 FROZEN
  ↓
E7.3 Rules & Traceability → (lock after implementation)
  ↓
E7.4 Finance Integration
  ↓
E7.5 Warehouse Integration
  ↓
E8 Product #2
```

**E7.3 Success Enables:**
- Products can add rules without kernel modification
- Regulatory compliance (audit trail + traceability)
- Recall orchestration (Products use lineage)
- Expiry management (Products interpret status)

---

## Final Design Lock Statement

**Design Lock Date:** 2026-08-22  
**Design Lock Commit:** (pending)  
**Status:** 🔒 **DESIGN LOCKED**

**E7.3 Design is complete and locked.**

Implementation may begin following this design.

**Key Constraint:**
> Implementation MUST follow locked design. Deviations require design unlock, review, and re-lock.

**Verification:**
> All 6 gates must pass before E7.3 can be frozen.

---

**END OF E7.3 DESIGN LOCK DOCUMENT**
