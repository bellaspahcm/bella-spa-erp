# Healthcare OS H5 → H6 Architecture Transition Review

**Status:** 📝 PENDING REVIEW  
**Scope:** Architecture Transition & Governance Strategy (Laboratory $\rightarrow$ Pharmacy)  
**Effective Target:** Architecture Baseline v5 (451 Tests $\rightarrow$ H6 Phase)  

---

## 1. Ratification of Baseline v5 (451 Tests)

We formally lock **Healthcare OS Baseline v5** with the following metrics:
*   **Total Executable Tests**: **451 PASS**
*   **Regression Impact**: **0%** (All H1-H4 unit and integration tests are fully green)
*   **Architecture Compliance**: **100%** (Static imports, Zero `any`, Event-After-Persistence, and Concurrency gates pass automatically)

### Baseline v5 Distribution:
```text
┌──────────────────────────────────────────┐
│      BELLA HEALTHCARE OS BASELINE v5    │
├──────────────────────────────────────────┤
│ H1  Inpatient          383 tests        │
│ H2  Emergency           27 tests        │
│ H3  ICU                 18 tests        │
│ H4  Surgery              7 tests        │
│ H5  Laboratory          16 tests        │
├──────────────────────────────────────────┤
│ TOTAL                  451 PASS          │
│ CI                     EXIT 0            │
└──────────────────────────────────────────┘
```

---

## 2. Post H1-H5 Kernel Audit & Anti-Bloat Guardrails

After implementing 5 clinical slices, we audit the Healthcare Kernel (`src/platform/healthcare/shared-kernel/` and core engines) to guard against **Kernel Bloat**.

### Invariant Status Check:
*   **No Premature Abstraction**: We confirm that no new shared classes (e.g. `ClinicalResultEngine`, `UniversalVerificationEngine`) were created. Laboratory's verification lifecycle resides strictly within `laboratory-engine`.
*   **Encounter Interface Lock**: The static lock on `Encounter` interface in `shared-kernel/types.ts` remains 100% intact. No surgery or laboratory fields were leaked into the core `Encounter` aggregate root.
*   **Verdict**: The Kernel remains slim, highly cohesive, and isolated.

---

## 3. H6 Pharmacy Boundary Definition & Capability Reuse

To enforce the **Law of Capability Reuse**, we define the exact boundary between the frozen Kernel/verticals and the new `pharmacy-engine`:

### A. Reused Capabilities (Kernel & Vertical Read-Only)
*   **ClinicalOrder (Kernel)**: Read-only access to doctor-ordered medications via `IClinicalOrderReader` snapshot. Pharmacy does NOT create `ClinicalOrder` records.
*   **Patient / Encounter (Kernel)**: General context information.
*   **EventBus (Kernel)**: Publish and subscribe to events (`OrderApproved`, `PrescriptionVerified`).
*   **MAR (Inpatient Vertical)**: Pharmacy will produce a `Prescription` that links directly to the MAR (Medication Administration Record) lifecycle for nursing execution.

### B. Owned Capabilities (Specific to `pharmacy-engine`)
*   **Prescription Aggregate Root**: Represents the pharmacist's validation lifecycle and the actual dispensing instructions.
*   **MedicationDispense Entity**: Tracks physical pharmacy inventory operations (batch, expiry, quantity dispensed, pharmacist).
*   **Clinical Verification Decision Engine**: Pharmacist's validation decision based on Clinical Checks (Allergies, Interactions, Contraindications, Dose range checks).
*   **Pharmacist Verification Registry**: Audit trail recording pharmacist credentials and clinical checks metadata.

```text
    Kernel Bounded Context                 Pharmacy Bounded Context
 ┌───────────────────────────┐          ┌──────────────────────────────────┐
 │   ClinicalOrder (Frozen)  │          │   Prescription (Aggregate Root)  │
 └─────────────┬─────────────┘          └────────────────┬─────────────────┘
               │ (Event / Reader)                        │
               ▼                                         ▼
 ┌───────────────────────────┐          ┌──────────────────────────────────┐
 │   OrderApproved Event     │ ────────→│   Medication Dispense & Checks   │
 └───────────────────────────┘          └──────────────────────────────────┘
```

---

## 4. H6 Golden Path & Architectural Gates

The `pharmacy-engine` will follow the standard 11-step pipeline. In addition, we establish the specific **Architectural Gates** that H6 must satisfy during execution:

### Gate 1: Pharmacy Verification Lifecycle State Machine
Strict progression:
`PENDING_VERIFICATION` $\rightarrow$ `VERIFIED` $\rightarrow$ `DISPENSED` $\rightarrow$ `MAR_READY`  
*   State skips (e.g., direct dispense without pharmacist verification) must trigger a hard error at the aggregate root level.
*   State cannot be reverted once verified or dispensed.

### Gate 2: Clinical Screening Safety Barrier (Hard Block)
The validation must run four checks before verification is permitted:
1.  **Allergy Screen**: Compare ordered drug against patient allergy registry. If conflict, block verification.
2.  **Drug Interaction**: Cross-reference against existing active prescriptions for the same patient.
3.  **Dosing Safety Limit**: Enforce max limits per dose and per day (e.g. Paracetamol > 4g/day = hard block).
4.  **Duplicate Therapy Check**: Detect same therapeutic class drugs ordered concurrently.

### Gate 3: Pharmacist Clinical Override & Acknowledgment Safety
*   If a non-fatal clinical check warning (e.g., mild interaction) is detected, verification is blocked unless a pharmacist explicitly enters a **Clinical Override Rationale**.
*   The rationale must be audited with pharmacist user ID, timestamp, and explanation.

### Gate 4: Event-After-Persistence Sequence
*   `PrescriptionVerified` and `MedicationDispensed` events must only be fired after database transaction commit.
*   If database save fails, the events are completely suppressed.

### Gate 5: Double Verification / High-Alert Medications (Gate 6)
*   For High-Alert Medications (e.g., Insulin, Heparin, Chemotherapy), the aggregate root must require a **second pharmacist verification** (`dualVerificationCompleted`).
*   Verification must block transition to `DISPENSED` until two distinct pharmacist IDs have signed off.

### Gate 6: Dispensing Concurrency & Inventory Defense
*   Parallel dispensing requests on the same batch or prescription must use optimistic concurrency control (OCC).
*   Under concurrent execution (`Promise.all`), exactly one transaction must succeed, preventing duplicate dispensing of the same item.
