# ADR-015: Healthcare OS Architecture Baseline v5 & Laboratory Diagnostic Pattern Ratification

**Status:** ✅ APPROVED & RATIFIED (Architecture Constitution)  
**Effective Date:** 2026-08-12  
**Deciders:** ARB (Architecture Review Board), Core Platform Team  
**Scope:** Healthcare OS Kernel & All Bounded Contexts (Inpatient, Emergency, ICU, Surgery, Laboratory)  

---

## 1. Context & Architecture Baseline Evolution

With the successful completion of the **H5 Laboratory Vertical Slice** (451 Executable Tests PASS across 45 Test Suites, Exit 0), we officially ratify **Architecture Baseline v5**.

```text
Baseline v1 (H1 Inpatient: 383 Guardian Tests)
       │
       ▼
Baseline v2 (H1 + H2 Emergency: 410 Guardian Tests)
       │
       ▼
Baseline v3 (H1 + H2 + H3 ICU: 428 Guardian Tests)
       │
       ▼
Baseline v4 (H1 + H2 + H3 + H4 Surgery: 435 Guardian Tests)
       │
       ▼
Baseline v5 (H1 + H2 + H3 + H4 + H5 Laboratory: 451 Guardian Tests)
```

Baseline v5 marks a strategic evolution of the Healthcare OS, expanding its capability from clinical operations and critical care safety into **clinical results interpretation, critical safety escalation, and decision signal tracking**. All of this was accomplished with zero mutations to the core model of H1–H4 and zero regression.

---

## 2. Ratified Diagnostic & Acknowledgment Patterns (Bằng Chứng Thực Nghiệm)

H5 demonstrates and locks 5 specific patterns in the architecture:

### Pattern 1: Domain State Machine Sequence Pattern
- **Scope**: Clinical lifecycles with strict, non-reversible, non-skippable progress sequences.
- **Invariant**: The `LabOrder` aggregate root strictly enforces state machine progress: `ORDERED` $\rightarrow$ `COLLECTED` $\rightarrow$ `RECEIVED` $\rightarrow$ `PROCESSING` $\rightarrow$ `RESULTED` $\rightarrow$ `VERIFIED`. Any attempt to skip states (e.g. going from `ORDERED` straight to `VERIFIED`) or revert states throws an error.
- **Evidence**: `LabOrder.collectSpecimen`, `LabOrder.receiveSpecimen`, `LabOrder.startProcessing`, `LabOrder.recordResult`, and `LabOrder.verify` enforce this sequence in code.

### Pattern 2: Diagnostic Interpretation and Range Assessment Pattern
- **Scope**: Mapping raw numeric/text results into clinical severity categories using configurable reference ranges.
- **Invariant**: Range assessments are evaluated using an external configuration policy (`TestDefinition`), keeping diagnostic range rules decoupled from aggregate logic. The aggregate maps the raw value to a clinical category: `NORMAL`, `ABNORMAL`, or `CRITICAL`.
- **Evidence**: `TestDefinition` interface and its application in `LabOrder.recordResult` via range strategies.

### Pattern 3: Clinical Safety Acknowledgment Pattern
- **Scope**: Ensuring critical patient alerts are acted upon and documented as outstanding obligations until explicitly closed by human action.
- **Invariant**: When a result is classified as `CRITICAL`, the safety state is set to `ESCALATION_REQUIRED`. This state remains locked and cannot be cleared until an authorized practitioner calls `acknowledgeCritical()`, which logs the practitioner UUID and timestamp, transitioning the state to `ACKNOWLEDGED`.
- **Evidence**: `LabOrder.acknowledgeCritical` method and state fields in `LabOrder` properties.

### Pattern 4: Decoupled Subscriber and Anti-Corruption Layer (ACL) Integration Pattern
- **Scope**: Bootstrapping vertical module records from generic kernel events without importing external aggregates.
- **Invariant**: The subscriber listens for `OrderApproved` and maps the payload to local orders by using a read-only reader (`IClinicalOrderReader`). The repository (`SupabaseLaboratoryRepository`) translates status and results to/from the database, hiding the legacy database fields and keeping the domain model pure.
- **Evidence**: `LabOrderApprovedSubscriber` and `SupabaseClinicalOrderReader`.

### Pattern 5: Optimistic Concurrency Control (OCC) for State Transitions
- **Scope**: Preventing concurrent update race conditions during results entry or verification.
- **Invariant**: The repository checks that fields are null before updating state transitions (`verified_at` for `VERIFIED`, `result_value` for `RESULTED`), ensuring only one parallel execution succeeds.
- **Evidence**: `SupabaseLaboratoryRepository.save` concurrency checks and `laboratory-engine.integration.test.ts` concurrent tests.

---

## 3. Crucial Architectural Principle: Pattern Proven $\neq$ Abstraction Created

Bella Healthcare OS retains its rule against premature abstraction:

> [!IMPORTANT]
> **Pattern Proven $\neq$ Abstraction Created**
> - Proving that the Laboratory and Surgery engines both follow verification safety gates and optimistic concurrency control does NOT mean we extract them into a single `UniversalVerificationEngine`.
> - The business context and semantics of verifying a laboratory result (a diagnostic value interpretation) are entirely different from verifying a surgical case checklist (a physical safety check of the patient).
> - Keep domain models isolated. Do not merge abstractions until at least 3 vertical modules share identical lifecycles and business meanings.

---

## 4. Constitutional Rules Added in Baseline v5

1.  **Strict Regression Invariant (451 Test Guardian)**:
    - The CI Gate `npm run ci:healthcare-gate` must maintain a **100% green rate across all 451 tests** before any code changes can be merged.
2.  **No Mutation of Frozen Core**:
    - Adding new diagnostic or clinical modules must not mutate existing H1–H4 code. All integration must occur through event subscribers and decoupled read-only readers.
