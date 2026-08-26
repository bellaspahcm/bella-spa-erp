# BELLA HEALTHCARE — K4 PROMOTION DECISION RECORD

## 1. Objective

This document registers the official classification and promotion decisions for the Healthcare Kernel based on cross-vertical clinical journey evidence gathered in **K2 (Hospital Inpatient)** and **K3 (Clinic Outpatient)**.

---

## 2. Inpatient & Outpatient Evidence Matrix

| Core capability | Inpatient Evidence (K2 Hospital) | Outpatient Evidence (K3 Clinic) | Reusability Verdict |
|---|---|---|---|
| **Encounter** | Reused for Inpatient stay (`IMP`) anchored to admission and beds | Reused for Outpatient check-in (`AMB`) and queues | 🟢 **Proven Kernel**: Core aggregate root is stable and works across both settings. |
| **Clinical Observation** | Recorded patient vitals linked to `inpatient_admission_id` | Recorded vitals linked directly to `encounter_id` | 🟢 **Proven Kernel**: Database model supports both inpatient and outpatient observation flows. |
| **Order Engine** | Validated and persisted inpatient Cefazolin medication order | Validated and persisted Metoprolol order, blocked Amiodarone | 🟢 **Promoted Proven Kernel**: Ready for official Kernel status. Cross-vertical compatibility verified. |
| **CDS & Rules Engine** | Ran safety checks on orders | Intercepted and blocked unsafe drug-drug interaction (Warfarin + Amiodarone) | 🟢 **Capability Proven / Promotion Candidate**: Rules validation operates correctly in both verticals. Boundaries are secure. |
| **Patient / MPI** | Verified patient existence and MRN mappings in MPI | Queried `party_parties` directly for patient details | 🟡 **Kernel Contract — Implementation Pending**: Contract is defined. No canonical service engine exists yet. |
| **Scheduling** | Walk-in and planned encounter booking | Simulated booking via direct insert to `hc_appointments` | 🟡 **Candidate**: No scheduling engine implementation exists yet. |

---

## 3. Semantic Classifications & Promotion Decisions

As of Milestone K4, the official classification of Healthcare engines is updated as follows:

1. **`order-engine` → Promoted to Proven Kernel 🟢**
   * *Justification*: Verified active usage in both Hospital inpatient prescribing and Clinic outpatient prescribing. Contracts are stable.
2. **`cds-engine` → Classified as Capability Proven / Promotion Candidate 🟢**
   * *Justification*: CDS logic works correctly across both verticals. However, before it is promoted to a fully independent Proven Kernel, its boundary, tenant-scoped configuration, and rule registry ownership must be verified in a dedicated verification pass.
3. **`mpi-engine` → Classified as Kernel Contract — Implementation Pending 🟡**
   * *Justification*: The `IMPIContract` is locked and verified. However, since no canonical service implementation exists yet (both Hospital and Clinic resolved patient details via direct database queries), the implementation remains pending.
4. **`scheduling-engine` → Classified as Candidate 🟡**
   * *Justification*: No service implementation exists. Bypassed via direct `hc_appointments` table inserts.

---

## 4. Semantic Promotion Invariants

To maximize development velocity and minimize regression risk, K4 enforces the following invariant:

> [!IMPORTANT]
> **K4 Promotion is Semantic, Not Structural**:
> Promoting an engine from Candidate to Kernel is a classification and contract lock decision. It does **NOT** require di chuyển (moving) code directories, updating consumer-side imports, creating new tables, or refactoring client-side code. This protects the existing stable baselines of Hospital and Clinic.

---

## 5. Security & Test Infrastructure Boundary

* **Test-Only RPC Exception**:
  The `cleanup_k3_sentinel_encounter` database function bypasses the `hc_clinical_decisions` immutable trigger. 
  * *Boundary Policy*: This RPC exists **strictly** for test cleanup to prevent database sentinel pollution. It must never be consumed by any production application code or user-facing action.

---

## 6. Contract Lock & Duplication Audit

1. **Contract Stability**: 
   * `order-engine.contract.ts` and `cds-engine.contract.ts` have been reviewed and verified as stable. They cover the necessary inputs, outputs, and validation rules without requiring any consumer-side changes.
2. **Zero Duplication**:
   * Audit verifies that **zero duplicate database entities** (e.g. `dental_patients`, `clinic_encounters`) or duplicate domain services have been created across H1, K2, and K3, ensuring perfect vertical extension alignment.
