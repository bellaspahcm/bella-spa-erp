# Bella Kernel Baselines

**Last updated:** 2026-08-25  
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
| **Healthcare Kernel** | 🔒 BASELINE | 2026-08 | Clinical & patient care | Patient identity (via Person Center), clinical encounters, prescriptions, appointments, H1-H12 engines |
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

## Healthcare Kernel Baseline

**Status:** 🔒 Frozen at usable baseline  
**Domain:** Clinical care, patient management

**Core Capabilities:**
- **Patient Identity:** via Person Center (party_parties), NOT standalone hc_patients table
- **Clinical Encounters:** Visit lifecycle, SOAP notes, vital signs
- **Prescriptions:** Medication orders, pharmacy integration
- **Appointments:** Clinical scheduling
- **H1-H12 Engines:** PersonEngine, EncounterEngine, ClinicalEngine, etc.

**Architecture Note:** Healthcare uses Person Center for patient identity to align with platform-wide identity model. See Healthcare Constitution for boundaries.

**Reuse Potential:** Medium (clinical workflows may apply to veterinary, dental)

**Next Extension:** When Industry #4+ demonstrates reusable clinical pattern

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
