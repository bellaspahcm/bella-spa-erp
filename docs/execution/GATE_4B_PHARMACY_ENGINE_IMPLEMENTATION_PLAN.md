# Implementation Plan: Gate 4B — Pharmacy Engine Integration

## 🎯 Goal Description
The goal of Gate 4B is to implement the core of the **Pharmacy Engine** and prove that a medication clinical workflow can traverse cross-engine boundaries from **Encounter -> Clinical Order -> Prescription -> MAR (Medication Administration Record)**.

Rather than building Pharmacy as a standalone, disconnected engine, we will build it as a contract-aligned component that consumes events/contracts from the Clinical Order Engine and Encounter Engine.

---

## 🛠️ Proposed Schema Changes

To support linking prescriptions to clinical orders, and to allow medication administration (MAR) to support both inpatients and outpatients (rather than being strictly locked to inpatient admissions), we will execute an additive migration:

### 1. [NEW] Database Migration
`20260812050000_extend_pharmacy_schema.sql`
- Add `clinical_order_id UUID REFERENCES public.hc_clinical_orders(id) ON DELETE SET NULL` to the `hc_prescriptions` table.
- Make `inpatient_admission_id` in `hc_medication_administration_records` **nullable** (allowing outpatient MAR tracking).
- Add `encounter_id UUID REFERENCES public.hc_encounters(id) ON DELETE CASCADE` to `hc_medication_administration_records`.
- Add performance indexes on `clinical_order_id` and `encounter_id`.

---

## 📂 Proposed Code Changes

### 1. Domain Layer
- **Prescription Aggregate Root (`Prescription`):**
  - Managed states: `PENDING_REVIEW` (when prescription is created from approved order), `DISPENSED` (medication given to patient), `ON_HOLD`, `CANCELLED`.
  - Invariants: Cannot transition to `DISPENSED` unless the clinical order status is active.
- **Medication Administration Entity (`MAREntry`):**
  - Tracks dose, route, site, scheduled time, actual administration time, nurse practitioner ID, and status (`scheduled`, `administered`, `refused`, `held`, `missed`).

### 2. Infrastructure & Repository Layer
- **[NEW] `SupabasePharmacyRepository`:**
  - Saves and loads `Prescription` and `MAREntry` aggregates to/from `hc_prescriptions` and `hc_medication_administration_records` tables.
- **[NEW] `ClinicalOrderReader` & `SupabaseClinicalOrderReader`:**
  - Provides a contract-based reader for the Pharmacy Engine to fetch the parent Clinical Order status (`PENDING`, `VALIDATED`, `APPROVED`, etc.) without direct compilation coupling to the `OrderEngineService` implementation.

### 3. Service Layer
- **`PharmacyEngineService`:**
  - Implement full service logic according to the `PharmacyEngineContract` interface.
  - Implement drug interaction check integration via `CdsEngineService` at dispense time (CDS Barrier 2).
  - Implement event handlers for `hos.order.approved.v1` to automatically create a `Prescription` record in status `PENDING_REVIEW` in the database.

### 4. Integration Tests
- **[NEW] `pharmacy-engine.integration.test.ts`:**
  - Verify that approving a Clinical Order of type `MEDICATION` successfully publishes `hos.order.approved.v1`.
  - Verify that the Pharmacy Engine consumes the event and creates a `Prescription` record.
  - Verify that dispensing a prescription performs CDS checks (allergies & DDIs) and transitions to `DISPENSED`.
  - Verify that administering a dose records the MAR entry in the database and publishes `MedicationAdministered` event.

---

## 📋 Verification Plan

### Automated Tests
- Implement unit tests for `Prescription` aggregate root state machine.
- Implement integration tests running on the real database to check end-to-end flow:
  ```powershell
  npm test -- src/platform/healthcare/engines/pharmacy-engine/
  ```
- Run full platform regression to verify 0 regressions:
  ```powershell
  npm test -- src/platform/healthcare/
  ```

### Manual Verification
- Verify database state transitions using SQL queries.
