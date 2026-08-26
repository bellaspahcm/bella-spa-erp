# Bella Kernel Baselines

**Last updated:** 2026-08-26 (K6.3 CLOSED — Clinic Pilot Candidate)
**Purpose:** Track Industry Kernel baseline versions and evolution

---

## What Is a Kernel Baseline?

A **baseline** means:
- ✅ Core business behavior is correct
- ✅ Reusable boundaries are stable
- ✅ Sufficient test coverage exists
- ✅ No known critical correctness issues

**Baseline does NOT mean:**
- ❌ Kernel is complete
- ❌ Kernel is perfect
- ❌ Kernel will never change
- ❌ Kernel has no gaps

**Kernels extend organically when real Industry demand appears.**

---

## Current Kernel Status

| Kernel | Status | Baseline Date | Purpose | Key Capabilities |
|--------|--------|---------------|---------|------------------|
| **Spa Kernel** | 🔒 BASELINE | 2026-Q2 | Service industry patterns | Appointment, service catalog, membership, package, commission, staff management, customer loyalty |
| **Finance Kernel** | 🔒 BASELINE | 2026-08-25 | Accounting & compliance | F1 Ledger, F2 Cash, TT133 compliance, opening balance, immutability, reconciliation, accounting invariants |
| **Healthcare Kernel (K1)** | 🔒 BASELINE | 2026-08-26 | Core clinical primitives | Patient/MPI registry, Encounter aggregate root, ClinicalObservation, CDS/Rules engine, Temporal tracking, Audit trail, Orders, Scheduling |
| **Hospital Extension (H1)** | 🔒 BASELINE | 2026-08-26 | Inpatient workflows | Inpatient Admissions, Bed & Ward allocation, Medication Administration Record (MAR) |
| **Logistics E7 Kernel** | 🟡 DOMAIN ONLY | 2026-08 | Supply chain primitives | Item, Inventory, Movement, Traceability domain layer (persistence not yet implemented) |

---

## Baseline Evolution Rules

### When to Extend a Kernel:

✅ **DO extend** when:
- New Industry OS requires capability
- Capability is reusable across multiple industries
- Extension maintains Kernel boundary integrity

❌ **DO NOT extend** for:
- Industry-specific edge cases
- Perfectionism or "what if" scenarios
- Framework building without demonstrated need
- Governance expansion

### Process:

```
Industry N+1 requirement
        ↓
Does Kernel already have it?
   ├── YES → Reuse existing
   │
   └── NO
        ↓
    Is it reusable?
   ├── YES → Extend Kernel baseline
   └── NO → Build in Product
```

**No approval ceremony required.** Architectural evidence of reuse need is sufficient.

---

## Platform Core (Not a Kernel)

Platform Core provides cross-industry capabilities used by ALL Industry OS:

| Capability | Status | Purpose |
|------------|--------|---------|
| **Tenant Management** | ✅ Stable | Multi-tenancy isolation |
| **Branch Management** | ✅ Stable | Multi-location support |
| **Identity & RBAC** | ✅ Stable | Authentication & authorization |
| **RLS Security** | ✅ Stable | Row-level security enforcement |
| **Audit Trail** | ✅ Stable | Change tracking & compliance |
| **Subscription & Quota** | ✅ Stable | Usage limits & billing |
| **Architecture Guard** | ✅ Active | Automated boundary enforcement |

Platform Core is **not frozen** — it evolves to support all Industries.

---

## Spa Kernel Baseline

**Status:** 🔒 Frozen at usable baseline  
**Domain:** Service industry (beauty spa, wellness, hospitality)

**Core Capabilities:**
- **Appointment Management:** Scheduling, resources, conflicts
- **Service Catalog:** Service definitions, durations, pricing
- **Membership & Packages:** Subscription models, session tracking
- **Commission Engine:** Staff incentives, tiered commission
- **Staff Management:** Availability, skills, performance
- **Customer Loyalty:** Points, rewards, tier progression

**Reuse Potential:** High for appointment-based service industries (salon, clinic, fitness, repair services)

**Next Extension:** When Industry #4+ demonstrates new reusable service pattern

---

## Finance Kernel Baseline

**Status:** 🔒 Frozen at usable baseline  
**Domain:** Accounting, financial compliance

**Core Capabilities:**
- **F1 Ledger:** Double-entry accounting, journal entries, posting
- **F2 Cash:** Cash flow tracking, bank reconciliation
- **Opening Balance:** Period initialization with provenance
- **TT133 Compliance:** Vietnam accounting regulation (Circular 133/2016/TT-BTC)
- **Immutability:** Financial record protection
- **Reconciliation:** Legacy system sync, variance detection
- **Accounting Invariants:** Correctness enforcement (debits = credits, etc.)

**Reuse Potential:** High for any Industry requiring financial accounting

**Next Extension:** When Industry #4+ needs additional accounting capability (e.g., AR/AP, inventory valuation, project accounting)

---

## Healthcare Kernel Baseline (K1)

**Status:** 🔒 Frozen at usable baseline  
**Domain:** Cross-vertical clinical care, patient management
**Verification:** H1.8 Real DB Integration (11/11 Passed, 2026-08-26)

**Core Capabilities:**
- **Patient Identity / MPI:** via Person Center (`party_parties`), NOT standalone patients table. Verified with real JOIN query.
- **Clinical Encounters:** Visit lifecycle and status transitions (`encounter-engine`). Aggregate root for all clinical events (Law 12).
- **Clinical Observation:** LOINC-style measurements (vitals, assessments, lab values). Extracted generic interface.
- **CDS & Rules Engine:** Safety validations and CDS alerts.
- **Bitemporal & Audit:** Timeline tracking (`temporal-engine`) and compliance logs (`audit-compliance-engine`).

**Architecture Note:** Healthcare uses Person Center for patient identity to align with platform-wide identity model. See `docs/architecture/HEALTHCARE_KERNEL.md` for entity mappings.

**Reuse Potential:** High (reusable by Clinic, Dental, MedSpa, and Veterinary verticals).

### K6.3 Product Verification — PASS (2026-08-26)

The Product Layer (Server Actions, Seeding scripts, and E2E appointment integrations) has been hardened against real database constraint rules and is certified as a **Clinic Pilot Candidate / Ready for Pilot Validation**:

```
Bella Medical UI
      ↓
Server Actions (healthcare-actions.ts, appointments-actions.ts)
      ↓
┌───────────────────────────────┐
│ Healthcare Kernel v1 🔒       │
│ EncounterEngine               │
│ NursingEngine                 │
│ OrderEngine (+ CDS)           │
└───────────────────────────────┘
      ↓
Real Supabase (tenant-isolated)
```

**Acceptance:** 11/11 tests PASS on live DB — 0 mocks/fallbacks.

### Known Workarounds & Technical Debt

1. **Doctor Fallback (Pilot-grade, not production clinical assignment):**
   In `createPrescriptionAction`, when `encounter.doctor_party_id` is null, the action falls back to the first person in `party_parties` for the tenant. This is **acceptable for pilot proof** but not final clinical semantics. A real pilot must enforce role-based authorization verification (`attending doctor_party_id`). This is a **Product Layer identity concern** — not a Kernel concern. Healthcare Kernel v1 must NOT be extended for this.

2. **Test Cleanup RPCs (Test Infrastructure Debt only):**
   Two RPCs (`cleanup_k3_sentinel_encounter` and `cleanup_k6_test_party`) exist to bypass the strict auditing delete trigger `timeline_events_no_delete`. These are strictly **test-only technical debt of the test infrastructure**. They must **never** be executed in production application flows or used as a standard business data deletion method. For production deployment, they must be removed or restricted.

### Freeze Advisory

> Do NOT reopen Healthcare Kernel v1 for requirements arising from pilot feedback unless there is clear evidence the requirement is a **cross-vertical clinical invariant** (i.e., reusable across Hospital, Clinic, Dental, and future verticals). Pilot-specific needs belong in the Product Layer.


## Hospital Extension Baseline (H1)

**Status:** 🔒 Frozen at usable baseline  
**Domain:** Inpatient healthcare operations

**Core Capabilities:**
- **Inpatient Admissions:** Inpatient stay lifecycle (`admission-engine`), patient transfer, and discharge.
- **Bed & Ward Resources:** Physical bed and ward scheduling, status checks (available, cleaning, reserved), and room layouts.
- **Medication Administration (MAR):** Timed medication records and status tracking by nursing staff.

**Reuse Potential:** Low-to-medium (limited to inpatient settings like acute care hospitals).

---

## Logistics E7 Kernel (Domain Only)

**Status:** 🟡 Domain layer implemented, persistence NOT yet created  
**Domain:** Supply chain, inventory, movement

**Core Domain Entities:**
- **Item:** SKU master data
- **Inventory:** Balance tracking by location/lot/serial
- **Movement:** Inventory transactions (receipts, issues, transfers, adjustments)
- **Traceability:** Lot tracking, chain of custody
- **UOM:** Unit of measure conversions

**Missing:** Database migrations for E7 tables (lg_movements, inventory)

**Reuse Potential:** High for any Industry managing physical goods

**Next Extension:** When Industry #4+ needs E7 persistence layer

---

## Kernel Growth Metrics

**Target:** Each Industry OS should be faster than previous

| Industry | Time-to-OS | Reuse Rate | New Kernel Capability |
|----------|------------|------------|----------------------|
| Spa | 100% (baseline) | 0% (first) | Created Spa Kernel |
| Healthcare | ~65% | Platform Core + partial Spa patterns | Created Healthcare Kernel |
| Finance | ~55% | Platform Core + accounting from scratch | Created Finance Kernel |
| Industry #4 | Target: <50% | Platform + 3 Kernels | TBD |

**If time does NOT decrease → Kernel abstraction needs improvement**

---

## Frozen vs Sealed vs Active

| Status | Meaning | Modification Rules |
|--------|---------|-------------------|
| **🔒 BASELINE (Frozen)** | Kernel is reusable, modifications only when real Industry need appears | No modifications unless justified by Industry requirement |
| **🔒 SEALED** | Critical Kernel with Architecture Guard enforcement (H1-H12, E7) | Modifications require Architecture Change Request (ACR) |
| **🟡 DOMAIN ONLY** | Domain layer exists, persistence/infrastructure incomplete | Can complete missing layers when Industry needs them |
| **✅ ACTIVE** | Platform Core, continuously evolving to support all Industries | Standard development process |

---

## References

- **Development Principles:** `/AGENTS.md`
- **Healthcare Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
- **Education Constitution:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`
- **Logistics E7 Plan:** `docs/E7_LOGISTICS_OS_CONSTRUCTION_PLAN.md`
- **Architecture Guard:** `scripts/healthcare/architecture-guard.ts`, `scripts/architecture/architecture-guard.ts`

---

**Kernel baselines are living assets that grow from real Industry demand, not architectural perfectionism.**
