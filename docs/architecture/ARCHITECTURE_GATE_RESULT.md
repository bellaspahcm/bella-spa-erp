# Architecture Gate Result: P9.0 Preschool Facilities & Asset Maintenance Domain Boundary & Safety Contract

> **Status**: `APPROVED + LOCKED` 🟢  
> **Effective Milestone**: P9.0 Facilities Domain Boundary & Safety Contract Lock  
> **Scope**: Bella Preschool Product Vertical (`src/products/bella-education/facilities/`)

---

## 1. Executive Summary & Operational Scope

Preschool Facilities & Asset Maintenance is a **domain-specific facility zone management, asset inventory, safety inspection, maintenance job lifecycle, out-of-service restriction, and safety defect escalation engine** tailored for preschool operations.

### Supreme Ownership Boundary Law
> **P9 Facilities owns facilities, operational zones, asset inventories, inspection schedules, safety inspection logs, restriction scopes (`ASSET_ONLY`, `ZONE`), maintenance job lifecycles (`SUBMITTED → IN_PROGRESS → COMPLETED → VERIFIED`), out-of-service restrictions, and safety compliance evidence.**  
> **P3 Classroom Engine owns classroom master records & student enrollment truth.**  
> **P8 Workforce Engine owns staff roster & shift assignments.**  
> **P7 Finance Engine owns financial ledger & purchasing transactions.**  
> **Reusable Exception Work Queue Candidate owns exception escalation lifecycles (`DETECTED → ACTIVE → ASSIGNED → RESOLVED`).**

```text
FAIL_CRITICAL Inspection / Safety Hazard Identified
                     │
                     ▼
          placeOutOfService(restrictionScope: ASSET_ONLY | ZONE)
                     │
                     ▼
          Status: OUT_OF_SERVICE
                     │
         ┌───────────┴───────────────────────────┐
         ▼                                       ▼
Project SAFETY_DEFECT DTO            Create Maintenance Job
───► Exception Work Queue            (SUBMITTED ➔ IN_PROGRESS ➔ COMPLETED)
         │                                       │
         ▼                                       ▼
Work Queue RESOLVED                 Job Verified by Manager: VERIFIED
         │                                       │
         └───────────┬───────────────────────────┘
                     ▼
           Independent Safety Re-Inspection
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
    Inspection PASS     Inspection FAIL
           │                   │
           ▼                   └───► Status strictly remains: OUT_OF_SERVICE
Status Restored: OPERATIONAL
```

---

## 2. Four Non-Negotiable Safety Refinements

1. **Supreme Invariant (Work Queue RESOLVED ≠ Maintenance VERIFIED ≠ Asset OPERATIONAL)**:
   > **Resolving `SAFETY_DEFECT` or `OVERDUE_INSPECTION` in the Exception Work Queue MUST NOT restore asset or zone status to `OPERATIONAL`.**  
   > Completing a maintenance job (`MaintenanceJob.VERIFIED`) MUST NOT directly restore status to `OPERATIONAL`.  
   > Status `OPERATIONAL` is **ONLY** restored when an independent P9 safety re-inspection returns `PASS` (`passRestorationInspection`).

2. **Domain-Driven Encapsulated State Transitions (No Generic Update API)**:
   > Transitioning operational state MUST be strictly encapsulated within domain operations:
   > - `markUnderInspection(entityType, entityId)`
   > - `failCriticalInspection(entityType, entityId, restrictionScope)`
   > - `placeOutOfService(entityType, entityId, reason, restrictionScope)`
   > - `passRestorationInspection(entityType, entityId, inspectorPartyId)`
   > **No generic `updateOperationalStatus(id, "OPERATIONAL")` method is permitted.**

3. **Read-Only `ZoneAvailabilityContract`**:
   > P9 Facilities ONLY publishes read-only availability DTOs (`ZoneAvailabilityDTO`). P9 NEVER modifies or cancels P3 classroom activity schedules. P3 owns scheduling truth and evaluates P9 availability constraints.

4. **Explicit Restriction Scope (`ASSET_ONLY` vs `ZONE`)**:
   > Inspection failures and assets contain an explicit `restriction_scope`:
   > - `ASSET_ONLY`: Only the specific asset is out of service (e.g. a single chair or broken toy).
   > - `ZONE`: The entire room/zone is out of service (e.g. electrical fault or fire hazard).

---

## 3. Product Table Ownership Map (`src/products/bella-education/facilities/`)

P9 creates additive tables in schema `public` prefixed with `edu_fac_`:

| Table Name | Primary Purpose | Domain Owner |
| :--- | :--- | :--- |
| `edu_fac_facilities` | Physical facility buildings & site masters | P9 Facilities |
| `edu_fac_zones` | Rooms, playgrounds, kitchens, restrooms, operational zones | P9 Facilities |
| `edu_fac_assets` | Equipment, furniture, appliances, fire safety, first-aid assets | P9 Facilities |
| `edu_fac_inspection_schedules` | Recurring safety inspection rules & frequencies | P9 Facilities |
| `edu_fac_inspection_logs` | Inspection audit executions with checklist results & attestations | P9 Facilities |
| `edu_fac_maintenance_jobs` | Maintenance work orders (`SUBMITTED → IN_PROGRESS → COMPLETED → VERIFIED`) | P9 Facilities |
| `edu_fac_out_of_service_logs` | Append-only audit history of out-of-service state transitions | P9 Facilities |

---

## 4. Phase Breakdown & Execution Milestones

```text
P9.0 — Boundary & Safety Contract (APPROVED + LOCKED)
────────────────────────────────────────────────────

P9.1 — Facilities + Safety Inspection Kernel (CURRENT MILESTONE)
────────────────────────────────────────────────────────────────
- Facilities, Zones, Assets master repository
- Inspection schedules & Checklist schemas
- Inspection evidence logging
- Explicit restriction scope (ASSET_ONLY vs ZONE)
- Encapsulated OUT_OF_SERVICE state transitions
- Read-only ZoneAvailabilityContract
- 12-Invariant Integration Suite (p91-facilities-inspection.integration.test.ts)

P9.2 — Maintenance Job Lifecycle & Work Queue Reuse #3
───────────────────────────────────────────────────────
- Maintenance jobs (SUBMITTED ➔ IN_PROGRESS ➔ COMPLETED ➔ VERIFIED)
- SAFETY_DEFECT & OVERDUE_INSPECTION Exception DTO projection
- Platform Candidate Reuse #3 (Exception Work Queue)
- Independent restoration re-inspection (PASS ➔ OPERATIONAL)
- 12-Invariant Integration Suite (p92-maintenance-job-exception.integration.test.ts)

P9.3 — UI Workspace + Browser Field E2E Verification
────────────────────────────────────────────────────
- Facilities Command Center UI (/dashboard/education/facilities)
- Playwright E2E Field Verification (spec 21 against real Supabase DB)
```

---

## 5. Canonical Verdict & Milestone Status

```text
P9.0 PRESCHOOL FACILITIES BOUNDARY & SAFETY CONTRACT
════════════════════════════════════════════════════════════════

P9 owns facilities, zones, assets, inspections, jobs       ✅ APPROVED + LOCKED
P9 does NOT own enrollment, staff HR, finance ledger        ✅ APPROVED + LOCKED
Work Queue RESOLVED ≠ Job VERIFIED ≠ Asset OPERATIONAL       ✅ APPROVED + LOCKED
No generic updateOperationalStatus API allowed               ✅ APPROVED + LOCKED
Read-only ZoneAvailabilityContract                          ✅ APPROVED + LOCKED
Explicit restriction_scope (ASSET_ONLY vs ZONE)             ✅ APPROVED + LOCKED

STATUS
🟢 P9.0 BOUNDARY & SAFETY CONTRACT: APPROVED + LOCKED
🟡 P9.1 FACILITIES & INSPECTION KERNEL: IN PROGRESS
```
