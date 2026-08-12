# Healthcare Kernel Maturity Review & Architecture Constitution v3

This document conducts a rigorous structural audit after the completion of three vertical slices (**H1 Inpatient**, **H2 Emergency**, and **H3 ICU**) and establishes the **Healthcare Architecture Constitution v3** to guide future scale.

---

## Part 1: Healthcare Kernel Maturity Review (H1 → H2 → H3)

### 1. Capability Boundary Evaluation
- **Is any capability misaligned?** 
  - **No.** Vertical domains are strictly bounded. The `emergency-engine` owns triage/disposition, the `icu-engine` owns continuous critical stays and device barriers, and the `bed-engine` owns ward locations.
  - Core identities (`Person`) and lifecycle sessions (`Encounter`) are owned strictly by their respective kernel engines (`mpi-engine`, `encounter-engine`).
- **Potential Risk**: `Nursing Engine` is currently handling care plan and care task execution, consuming MAR read-only contracts from `Pharmacy Engine`. We must ensure no write-level logic for medications leaks into `Nursing Engine`.

### 2. Contract Sizing Analysis
- **Are contracts growing too wide?**
  - The shared `Encounter` interface in `shared-kernel/types.ts` is beginning to show signs of bloating (carrying diagnoses, reason codes, departments, etc.).
  - **Remediation**: Establish a strict limit on the core `Encounter` model. Domain-specific extensions must use a metadata map or be stored in decoupled sub-entities (e.g., `EmergencyAssessment`, `IcuStay`) rather than appending fields directly to the shared `Encounter` interface.

### 3. The Abstraction "Rule of Three" Check
- **Do we have abstractions with $\ge 3$ implementations ready for promote?**
  - **Yes. Resource Allocation & Concurrency Defense.**
    1. Inpatient Bed (`Bed` in `bed-engine`)
    2. Emergency Bay (`EmergencyBay` in `emergency-engine`)
    3. ICU Bay (`IcuBay` in `icu-engine`)
  - **Action (Gatekeeping Nuance)**: Do NOT immediately abstract or implement `PlatformResourceAllocationPrimitive`. We must first conduct a thorough **Architecture Evidence Review** to verify if Bed, Emergency Bay, and ICU Bay share the same business semantics, lifecycles, and invariants (beyond just technical conditional lock queries). If they differ in lifecycle or ownership, domain isolation must be preserved to prevent premature abstraction.

### 4. Implicit Coupling & Event Contracts
- **Are domain models implicitly coupled via events?**
  - Event payloads currently carry flat lists of IDs (e.g., `tenantId`, `encounterId`, `orderId`). This is the correct pattern.
  - **Anti-pattern to prevent**: Passing rich domain objects inside the event payload (which forces the subscriber to couple with the publisher's internal DB entity schema).

### 5. Transaction Boundary Verification
- **Are database transactions correctly scoped?**
  - Yes. No clinical workflow spans across multiple engines inside a single SQL transaction.
  - Cross-engine flows (e.g., `Admission` $\rightarrow$ `Bed`, `Order` $\rightarrow$ `Pharmacy`) are achieved via asynchronous events (`eventBus.publish`) or sequential, independent service calls.

---

## Part 2: Healthcare Architecture Constitution v3 (Enforced Rules)

Every new clinical vertical (e.g., **H4 Surgery/Perioperative**, **H5 Laboratory**, **H6 Pharmacy**, etc.) must pass through the following strict architectural gate:

```text
               NEW VERTICAL MODULE / ENGINE GATEWAY
                                │
   [1] Boundary Isolation (No direct domain/repository imports)
                                │
   [2] Capability Reuse (Inherit Encounter/Admission, do not clone)
                                │
   [3] Ownership Division (Decision Ownership ≠ Lifecycle Ownership)
                                │
   [4] Safety Barriers (Assert clinical boundaries & HARD BLOCK)
                                │
   [5] Concurrency Defense (Verify atomic conditional locks via Promise.all)
                                │
   [6] Event-After-Persistence (Domain events only emit AFTER DB success)
                                │
   [7] Static Zero-any Invariant (Law 11: 0 instances of 'any')
                                │
   [8] Zero Regression Check (All 428/428 existing tests PASS)
```

---

## Part 3: Architecture Baseline v3 Status & Ratification

- **Status**: ✅ APPROVED & RATIFIED (Architecture Constitution)
- **Architecture Evidence Review**: Completed on 2026-08-12.
  - *Resource Allocation*: Denied generic abstraction. Kept domain isolation per [Architecture Evidence Review](file:///C:/Users/DELL/.gemini/antigravity-ide/brain/27dfb19f-ce08-4eb0-b0c9-d3676dcb31ca/architecture_evidence_review.md) (technically locked but semantically isolated).
  - *Encounter Contract*: Strict scope boundaries locked to prevent God Object bloating.
- **Total Executable Tests:** **`428`** across **`41`** Jest test suites.
- **Enforced CI Gate:** `node scripts/ci-healthcare-architecture-gate.js` with exit code 0.
- **Rule of Internal Entities:** Ventilator sessions and other device states must remain internal entities of `IcuStay` to prevent domain model inflation.
