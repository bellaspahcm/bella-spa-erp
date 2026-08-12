# Healthcare Kernel Maturity Review & Architecture Constitution v4

This document conducts a rigorous structural audit after the completion of four vertical slices (**H1 Inpatient**, **H2 Emergency**, **H3 ICU**, and **H4 Surgery/Perioperative**) and establishes the **Healthcare Architecture Constitution v4** to guide future scale.

---

## Part 1: Healthcare Kernel Maturity Review (H1 → H2 → H3 → H4)

### 1. Capability Boundary Evaluation & Taxonomy Classification
After executing four distinct clinical vertical slices, we have established a strict taxonomy of capabilities to prevent Kernel bloat:

*   **Healthcare Kernel Capabilities (Shared Core)**:
    - **MPI Engine**: Patient and Practitioner clinical identity records (`Person`, `Patient`, `Practitioner`).
    - **Encounter Engine**: Core clinical session lifecycle management (`Encounter`).
    - **Order Engine**: Clinical order initiation and validation (`ClinicalOrder`).
    - **Infrastructure Primitives**: Asynchronous event publishing and subscriber routing (`EventBus`), idempotency keys (`hc_idempotency_keys` table), and database connection brokers.
*   **Vertical-Specific Capabilities (Isolated Modules)**:
    - **Inpatient Care**: Ward location allocation (`bed-engine`).
    - **Emergency Care**: Triage protocols, disposition, and Bay allocation (`emergency-engine`).
    - **Critical Care**: Ventilator sessions, SOFA scoring strategy, and ICU stays (`icu-engine`).
    - **Perioperative Care**: Operating Room scheduling, WHO checklists, and Anesthesia record tracking (`surgical-engine`).
*   **Technical Primitives**:
    - Serializer and parser mapping helpers (e.g. dual-mode database status serializing).
    - Database-level isolation techniques (optimistic locking, exclusion constraints).
*   **Denied Abstractions (Preserved Bounded Isolation)**:
    - **Resource Allocation Primitive**: We deny a shared `PlatformResourceAllocationPrimitive`. Although Bed, Emergency Bay, ICU Bay, and Operating Room all use exclusion checks to prevent concurrent double-booking, they carry entirely different business lifecycles, states, and domain invariants. We preserve domain-isolated models.

### 2. Contract Sizing Analysis & Encounter Freezing
- **Is the Encounter model growing too wide?**
  - **No.** We have officially frozen the core `Encounter` contract. It must only contain clinical session lifecycle metadata (patient, class, start/end timestamps, admission status).
  - **Enforcer Rule**: No vertical-specific fields (e.g. surgical procedures, triage ESI scores, ventilator indicators) are allowed to be appended to the shared `Encounter` model. All domain-specific data must reside inside their respective domain entities (e.g., `SurgicalCase`, `Triage`, `IcuStay`).

### 3. Implicit Coupling & Event Contracts
- **Pay-per-Event Payload**: All cross-engine events must carry only flat identifiers (`tenantId`, `encounterId`, `surgicalCaseId`) rather than embedding serialized rich domain objects. This keeps subscribers decoupled from publisher aggregate schemas.

### 4. Transaction Boundary Verification
- **SQL Transaction Bounds**: No database transactions span across multiple domain engines. Inter-engine workflows (e.g., admitting a patient from Emergency to ICU, or checking equipment sterility from Surgery to CSSD) are orchestrated sequentially via service layers or asynchronously via the `EventBus`.

---

## Part 2: Healthcare Architecture Constitution v4 (Enforced Rules)

Every clinical vertical slice must pass through the following strict architectural gate:

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
   [5] Concurrency Defense (Verify atomic conditional locks / DB constraints)
                                │
   [6] Event-After-Persistence (Domain events only emit AFTER DB success)
                                │
   [7] Rule Against Premature Abstraction (Rule of Three Business Semantics)
                                │
   [8] Internal Entity Constraint (Inner records kept in Aggregate Root)
                                │
   [9] Static Zero-any Invariant (Constitution Law 11: 0 'any' types)
                                │
   [10] Zero Regression Check (All 435/435 existing tests PASS)
```

### Constitutional Rule Specifications

1.  **Capability Reuse**:
    - Do not clone existing Kernel capabilities (e.g., do not create `surgical-medication-engine` or `surgical-bed-engine`). Re-use the kernel engines (`pharmacy-engine`, `bed-engine`) via decoupled contracts.
2.  **Boundary Isolation**:
    - No direct imports of other engines' `domain/` or `repositories/` directories. Cross-engine communications must go 100% through defined contracts and read-only interfaces.
3.  **Decision Ownership $\neq$ Lifecycle Ownership**:
    - An engine can make a disposition decision (e.g., admitting to Surgery), but the target engine controls the actual admission lifecycle.
4.  **Safety Barriers + HARD BLOCK**:
    - Safety checks must be aggregate invariants. Failing checks must throw hard exceptions that abort transactions, rather than just emitting warnings.
5.  **Concurrency Defense**:
    - Every resource allocation must prove database-level double-booking protection (conditional updates or database constraints) via concurrent `Promise.all` tests.
6.  **Event-After-Persistence**:
    - Events must only be published *after* successful repository persistence. If database save fails, no events are emitted.
7.  **Rule Against Premature Abstraction**:
    - Do not drag technical patterns into the Kernel as shared abstractions until at least three verticals prove identical *business semantics and lifecycles* (not just technical syntax similarity).
8.  **Internal Entity Constraint**:
    - Vertical-specific sub-records (e.g., `AnesthesiaRecord`, `SurgicalSafetyChecklist`) must remain internal entities inside the parent Aggregate Root (`SurgicalCase`) to prevent repository and domain model bloat.
9.  **Zero-any Invariant**:
    - Strictly zero instances of the `any` keyword are allowed in product and test code.
10. **Zero Regression**:
    - 100% green rate across all existing regression test suites on the CI gate.

---

## Part 3: Architecture Baseline v4 Status & Ratification

- **Status**: ✅ APPROVED & RATIFIED (Architecture Constitution)
- **Total Executable Tests:** **`435`** across **`42`** Jest test suites.
- **Enforced CI Gate:** `node scripts/ci-healthcare-architecture-gate.js` with exit code 0.
- **Diagnostics vs Treatment Domain Verification**:
  - Baseline v4 has successfully verified the complete clinical workflow chain of treatment verticals.
  - **H5 Filter**: Any future vertical slice selection must be evaluated against the Constitution. The **Laboratory Engine** is selected as the candidate for **H5** to test the integration of diagnostic domains (Order $\rightarrow$ Specimen $\rightarrow$ Processing $\rightarrow$ Result $\rightarrow$ Clinical Interpretation) into the Healthcare Kernel, proving that the Kernel can absorb diagnostic schemas without violating treating workflow boundaries.
