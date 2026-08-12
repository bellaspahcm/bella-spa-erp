# Implementation Plan: Gate 4B — Pharmacy Engine Integration (Updated)

**Status:** 🟡 PLANNED  
**Owner:** Healthcare Platform Team  
**Goal:** Establish and verify the Pharmacy Engine as an event-driven aggregate coordinating with Encounter and Clinical Order Engines.

---

## 📋 Gate 4B Step-by-Step Roadmap

### 4B.1 — Pharmacy Schema & Domain
Before writing service logic, we must inventory the database schema and execute a secure, additive migration.

#### Schema & Structural Inventory (Prescription ↔ Clinical Order 1:1 Proof):
- In the database schema, `hc_clinical_orders` contains a single `orderDetails` payload. When `order_type = 'MEDICATION'`, the payload is typed as `MedicationOrderDetails`, containing exactly **one** drug (`drugCode`, `drugName`, `dose`, etc.).
- Thus, one `ClinicalOrder` of type `MEDICATION` represents exactly one medication item.
- Approved medication orders map 1-to-1 to a prescription document in `hc_prescriptions` (which stores the single drug in its `drugs` JSONB array). 
- To enforce this, we will add a `UNIQUE(clinical_order_id)` constraint on the `hc_prescriptions` table.

#### Database Migration: `20260812050000_extend_pharmacy_schema.sql`
- **Prescription Table (`hc_prescriptions`):**
  - Add `clinical_order_id UUID NOT NULL UNIQUE REFERENCES public.hc_clinical_orders(id) ON DELETE RESTRICT`.
  - Ensures clinical order linkages cannot be orphan-deleted.
- **MAR Table (`hc_medication_administration_records`):**
  - Make `inpatient_admission_id` nullable to support outpatient MAR.
  - Add `encounter_id UUID REFERENCES public.hc_encounters(id) ON DELETE RESTRICT`.
  - Enforce check constraint: `CHECK (inpatient_admission_id IS NOT NULL OR encounter_id IS NOT NULL)`.
  - Blocks deletions of encounters that have active MAR logs to preserve historical audit records.
  - Create a database trigger function `verify_mar_encounter_consistency` and attach it as `BEFORE INSERT OR UPDATE` on `hc_medication_administration_records`:
    - Checks that if both `inpatient_admission_id` and `encounter_id` are provided, the `encounter_id` on the MAR matches the `encounter_id` of the referenced `hc_inpatient_admissions` row.

#### Prescription Domain Model (`Prescription`)
Implement the domain aggregate root and value objects enforcing the following clinical state machine with strict terminal states:
```
PENDING_REVIEW ──→ APPROVED ──→ READY_FOR_DISPENSE ──→ PARTIALLY_DISPENSED ──→ DISPENSED (terminal)
      │              │                  │
      └──→ REJECTED  └──→ ON_HOLD       └──→ ON_HOLD
            (terminal)       │
                             └──→ APPROVED / CANCELLED (terminal)
```
- **Terminal States Constraint:**
  - `DISPENSED` (terminal; cannot transition back to `ON_HOLD` or `CANCELLED`).
  - `REJECTED` (terminal; cannot transition back to `APPROVED`).
  - `CANCELLED` (terminal; cannot transition back to `APPROVED`).

---

### 4B.2 — Pharmacy Repository
Implement `SupabasePharmacyRepository` to load, save, and manage `Prescription` and `MAREntry` records.
Verify proper database mapping and RLS policy compatibility (enforcing tenant isolation at the repository level).

---

### 4B.3 — Event-Driven Integration (OrderApproved -> Prescription)
Rather than calling the Pharmacy Engine from the Order Service, we will prove **event-driven decoupling** (ADR-011).

```
Order Engine (ClinicalOrderService)
      ↓
[Event: hos.order.approved.v1]
      ↓
Platform Event Bus (HostEventBus)
      ↓
Pharmacy Subscriber (OrderApprovedSubscriber)
      ↓
Prescription (PENDING_REVIEW)
```

#### Subscriber Requirements & Invariant Checks:
- **Type Filtering:** Pharmacy Subscriber will only handle `hos.order.approved.v1` events where the payload `orderType === 'MEDICATION'`. All other types (`LAB`, `IMAGING`, `PROCEDURE`) will be ignored.
- **Tenant Match:** Reject event if metadata tenant ID mismatches database target.
- **Idempotency:** Enforce idempotency using `tenantId + clinicalOrderId`. If a prescription already exists for `clinicalOrderId` in the database, it returns success immediately without duplicating records.
- **Metadata Safety:** Reject event if correlation/causation metadata is missing.
- **Transactional Consistency:** Database insertion errors must abort gracefully without emitting downstream events.

---

### 4B.4 — 3-Engine Medication Workflow
After the subscriber is verified, implement end-to-end integration tests linking all 3 engines:
```
Encounter Engine (arrived/in-progress)
      ↓
Clinical Order Engine (order created & approved)
      ↓
Event Bus (hos.order.approved.v1)
      ↓
Pharmacy Engine (prescription created & dispensed)
      ↓
MAR Record (administration recorded & MedicationAdministered emitted)
```

---

## 🎯 Gate 4B Acceptance Checklist

- [x] **Prescription 1:1/1:N Semantics:** Verified via database schema audit showing MedicationOrderDetails contains exactly 1 drug, mapping 1-to-1 to a prescription.
- [ ] **Contract Tests:** Ensure `PharmacyEngineContract` is registered and discoverable.
- [ ] **Domain Tests:** Unit tests for Prescription state machine transitions and invariants (including terminal states).
- [ ] **MAR Domain Tests:** Unit tests for medication administration invariants.
- [ ] **Repository Integration Tests:** Verify real database persistence with RLS.
- [ ] **Event Subscriber Integration Tests:** Verify `OrderApprovedSubscriber` is decoupled, filters by orderType, and handles idempotency correctly via `tenantId + clinicalOrderId`.
- [ ] **3-Engine Workflow Tests:** Verify end-to-end flow from encounter up to medication administration.
- [ ] **Audit Preservation:** Verify database constraints block deletes of encounters and orders that have MAR logs.
- [ ] **No Circular Dependency:** Static analysis verifies no imports from `order-engine` in the `pharmacy-engine` codebase.
