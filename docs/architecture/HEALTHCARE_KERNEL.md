# Healthcare Kernel & Vertical Extensions Specification

**Status:** 🔒 FROZEN BASELINE (K1 / H1)  
**Applicability:** Mandatory for all Healthcare Product Verticals (Hospital, Clinic, Dental, MedSpa, etc.)  

---

## 1. Domain Division & Layering

The Healthcare suite is architecturally layered into **Platform Core**, **Healthcare Kernel**, and **Vertical Extensions**. This layout prevents duplicate logic and guarantees consistent behavior across different healthcare applications.

```
┌────────────────────────────────────────────────────────┐
│ Platform Core (Tenant, Auth, RLS, Audit, Person)       │
└──────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 🟢 Healthcare Kernel (Generic, Cross-Vertical Primitives)│
│ Patient/MPI, Encounter, ClinicalObservation, CDS...     │
└──────────────────┬─────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│ 🔵 Hospital Extension   │ │ 🟣 Future Extensions    │
│ Inpatient Admission,    │ │ (Dental, Clinic,        │
│ Bed/Ward, ICU, OR, MAR  │ │ MedSpa, etc.)           │
└─────────────────────────┘ └─────────────────────────┘
```

---

## 2. Full Engine Classification & Entity Map (27 Engines)

The table below maps all 27 healthcare engines, classifying them into **Healthcare Kernel (K1)** vs. **Hospital Extension (H1/H2)** or **Unproven/Stubs**.

| Engine | Directory | Type | Status | Key Capabilities / Description |
| :--- | :--- | :--- | :--- | :--- |
| **mpi-engine** | `mpi-engine/` | 🟢 Kernel | Placeholder (Contract Only) | Master Patient Index. Integrates with Platform Person Center. |
| **encounter-engine** | `encounter-engine/` | 🟢 Kernel | Proven Kernel | Visit aggregate root. Essential for all clinical flows. |
| **cds-engine** | `cds-engine/` | 🟢 Kernel | Proven Kernel | Clinical Decision Support (safety checks). |
| **rule-engine** | `rule-engine/` | 🟢 Kernel | Active (Unexposed) | Core business and medical rules validation. |
| **temporal-engine** | `temporal-engine/` | 🟢 Kernel | Active (Unexposed) | Bitemporal tracking & historical state queries. |
| **audit-compliance-engine**| `audit-compliance-engine/` | 🟢 Kernel | Active (Unexposed) | Audit logs & evidence package generation. |
| **scheduling-engine** | `scheduling-engine/` | 🟢 Kernel | Placeholder (ADR-017 Pending) | Universal appointments & schedules. |
| **order-engine** | `order-engine/` | 🟢 Kernel | Proven Kernel | Clinical orders (Labs, Imaging, Meds). |
| **nursing-engine** | `nursing-engine/` | ⚡ Split | Active | **ClinicalObservation** is Kernel. **MAR** is Hospital Extension. |
| **admission-engine** | `admission-engine/` | 🔵 Hospital | Active | Inpatient admissions & discharge workflows. |
| **bed-engine** | `bed-engine/` | 🔵 Hospital | Active | Bed & Ward allocation and status management. |
| **emergency-engine** | `emergency-engine/` | 🔵 Hospital | Active (Unexposed) | Emergency Department triage & tracking. |
| **icu-engine** | `icu-engine/` | 🔵 Hospital | Active (Unexposed) | Intensive Care Unit flows. |
| **surgical-engine** | `surgical-engine/` | 🔵 Hospital | Active | OR scheduling, checklists & workflows. |
| **or-engine** | `or-engine/` | 🔵 Hospital | Active | Operating Room lifecycle management. |
| **or-readiness-engine** | `or-readiness-engine/` | 🔵 Hospital | Active (Unexposed) | Pre-operative verification & prep. |
| **anesthesia-engine** | `anesthesia-engine/` | 🔵 Hospital | Active | Anesthetic plan & records tracking. |
| **pacu-engine** | `pacu-engine/` | 🔵 Hospital | Active (Unexposed) | Post-Anesthesia Care Unit monitoring. |
| **cssd-engine** | `cssd-engine/` | 🔵 Hospital | Active (Unexposed) | Central Sterile Services Department tracking. |
| **laboratory-engine** | `laboratory-engine/` | 🔵 Hospital | Active | Laboratory Information System (LIS) integration. |
| **pharmacy-engine** | `pharmacy-engine/` | 🔵 Hospital | Active | Inpatient/Outpatient pharmacy dispensing workflows. |
| **blood-bank-engine** | `blood-bank-engine/` | 🔵 Hospital | Active (Unexposed) | Blood products request, inventory, & cross-matching (H7). |
| **billing-engine** | `billing-engine/` | 🔵 Hospital | Placeholder | Hospital-specific insurance & billing projections. |
| **imaging-engine** | `imaging-engine/` | 🔵 Hospital | Placeholder (ADR-016 Pending) | Radiology Information System (RIS) & PACS integration. |
| **insurance-engine** | `insurance-engine/` | 🔵 Hospital | Placeholder | BHYT & Private insurance integration. |
| **queue-engine** | `queue-engine/` | 🔵 Hospital | Placeholder | Clinic / Ward queue queue management. |
| **clinical-engine** | `clinical-engine/` | ⚪ Deprecated | Placeholder | Superseded by encounter-engine. |

---

## 3. Strict Rules Against Duplication

To maintain platform cohesion, the following rules are enforced:

### Rule 1: No Entity Duplication
Any new vertical (e.g., Dental, Clinic) **MUST NOT** create its own version of a kernel-owned entity.
*   ❌ **FORBIDDEN:** `dental_patients`, `clinic_encounters`, `hospital_doctors`
*   ✅ **MANDATORY:** Reference the core `hc_master_patient_index` or `hc_encounters` tables and extend via relation or metadata.

### Rule 2: No Service Duplication
Do not duplicate domain services or controllers.
*   ❌ **FORBIDDEN:** Creating a `DentalPatientService` or `ClinicEncounterService` to handle CRUD.
*   ✅ **MANDATORY:** Re-use the canonical `EncounterService` or `MPIService`. Extend specific workflows additively through specific hook integration in the product layer.

### Rule 3: Public Contracts Only
Product verticals must communicate with Kernel capabilities only via contracts defined in `src/platform/healthcare/contracts/`. Direct querying of kernel-internal databases is blocked.

### Rule 4: Clean Dependency Direction
Core Kernel engines (`mpi-engine`, `encounter-engine`, `temporal-engine`, etc.) must **NEVER** import or depend on Hospital-specific engines (`bed-engine`, `admission-engine`, `surgical-engine`, etc.).

---

## 4. Automated Architecture Guard Enforcement

The architectural boundaries defined in this document are automatically enforced by `scripts/healthcare/architecture-guard.ts` during the CI build process.

If any violation occurs (e.g. bypass of contracts, duplicate entity, import dependency direction violation, use of `any` types), the build will be aborted.

```bash
# Run the guard locally
npm run healthcare:guard
```
