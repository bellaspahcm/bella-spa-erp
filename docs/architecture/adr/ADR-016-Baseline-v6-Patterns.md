# ADR-016: Healthcare OS Architecture Baseline v6 & Pharmacy Verification Pattern Ratification

**Status:** ✅ APPROVED & RATIFIED (Architecture Constitution)  
**Effective Date:** 2026-08-12  
**Deciders:** ARB (Architecture Review Board), Core Platform Team  
**Scope:** Healthcare OS Kernel & All Bounded Contexts (Inpatient, Emergency, ICU, Surgery, Laboratory, Pharmacy)  

---

## 1. Context & Architecture Baseline Evolution

With the successful completion of the **H6 Pharmacy Verification Vertical Slice** (460 Executable Tests PASS across 46 Test Suites, Exit 0), we officially ratify **Architecture Baseline v6**.

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
       │
       ▼
Baseline v6 (H1 + H2 + H3 + H4 + H5 + H6 Pharmacy: 460 Guardian Tests)
```

Baseline v6 represents a critical milestone in clinical decision support and medication safety enforcement. The system now enforces clinical screening (allergies, interactions, safety limits), human override audit logs, dual verification sign-off, and concurrent inventory deduction. All of this was accomplished with **zero mutations to the core model of H1–H5 and zero regression**.

---

## 2. Ratified Pharmacy Verification Patterns (Bằng Chứng Thực Nghiệm)

H6 demonstrates and locks 5 key patterns in the architecture:

### Pattern 1: Clinical Safety Screening Engine (CDS Policy Integration)
- **Scope**: Executing and matching clinical safety rules against patient records without polluting aggregate model logic.
- **Invariant**: Screening rules (Allergy, Interaction, Dosing, Duplicate Therapy) are encapsulated in dedicated stateless policy classes (`AllergyPolicy`, `InteractionPolicy`, etc.). The aggregate ingests a unified `ScreeningResult` to transition safety state (`NO_BLOCK`, `ABNORMAL`, `BLOCKED`).
- **Evidence**: `IScreeningPolicy` and implementations in `screening-policies.ts` applied during `verifyPrescription()`.

### Pattern 2: Human Override & Audit Provenance Pattern
- **Scope**: Recording clinician decision accountability when safety warnings are bypassed.
- **Invariant**: Safety warnings can be overridden by authorized pharmacists, but every override must append an immutable `OverrideAuditEntry` containing the warning code, decision, rationale, practitioner ID, and timestamp. The aggregate blocks editing or deletion of this audit history.
- **Evidence**: `Prescription.overrideBlock` and `overrideHistory` read-only field in the domain aggregate.

### Pattern 3: High-Alert Dual Verification Safety Gate
- **Scope**: Double-authorization checks for high-risk operations.
- **Invariant**: Medications categorized as high-alert are flagged upon bootstrapping. The aggregate prevents transition to `DISPENSED` or `MAR_READY` until sign-offs are recorded from two distinct authorized users (`pharmacistA !== pharmacistB`).
- **Evidence**: `Prescription.dualVerify` method and the transition rules in `prescription.entity.ts`.

### Pattern 4: Decoupled Inventory Allocation & Deductions Pattern
- **Scope**: Coordinating physical resource allocation alongside clinical lifecycles without coupling aggregate roots.
- **Invariant**: Inventory stock levels are managed independently of the clinical prescription lifecycle. The `Prescription` aggregate remains oblivious to stock level details; the repository coordinates the transactional validation and allocation/deduction during dispensation.
- **Evidence**: Decoupled stock methods (`deductStock()`, `getCurrentStock()`) and transactional guards in `SupabasePharmacyRepository`.

### Pattern 5: Event-After-Persistence Ordering (Golden Path)
- **Scope**: Enforcing event consistency and eliminating out-of-order state side effects.
- **Invariant**: Domain events (`PrescriptionVerified`, `MedicationDispensed`, etc.) are only published to the global `eventBus` after the database transaction has successfully committed. If database write fails or is rolled back, no events are sent.
- **Evidence**: `PharmacyEngineService` orchestration sequences.

---

## 3. Crucial Architectural Principle: Pattern Proven $\neq$ Abstraction Created

Bella Healthcare OS continues to enforce its strict stance against premature shared abstraction:

> [!IMPORTANT]
> **Pattern Proven $\neq$ Abstraction Created**
> - Proving that Laboratory (H5) and Pharmacy (H6) both require clinical verification and safety blocks does NOT justify combining them into a single `UniversalSafetyEngine` or `UniversalVerificationEngine`.
> - The business rules and lifecycle of checking laboratory diagnostics (critical result escalations) are completely different from medication safety validations (drug interaction override provenance).
> - Keep domain boundaries isolated. Do not merge abstractions until at least 3 vertical modules share identical lifecycles and business semantics.

---

## 4. Constitutional Rules Added in Baseline v6

1. **Strict Regression Invariant (460 Test Guardian)**:
   - The CI Gate `npm run ci:healthcare-gate` must maintain a **100% green rate across all 460 tests** before any code changes can be merged.
2. **No Mutation of Frozen Core (Kernel Mutation = 0)**:
   - Integrating the Pharmacy context must not require changes to H1–H5 code. Decoupling is enforced via read-only contracts (`IClinicalOrderReader`) and event subscriptions.
3. **No Cross-Engine Imports (Boundary Isolation)**:
   - Giao tiếp giữa các Engine bắt buộc thực hiện thông qua interfaces/contracts. Cấm nhập trực tiếp domain entity của phân hệ khác.
