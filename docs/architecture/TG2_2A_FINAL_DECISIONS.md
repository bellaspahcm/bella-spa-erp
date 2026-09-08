# TG-2.2A Final Ownership Decisions

**Date:** September 7, 2026  
**Status:** ✅ **DECISIONS COMPLETE**

---

## Decision 1: Appointments Ownership

**Capability:** Appointment scheduling  
**Source:** `src/services/healthcare/appointments-actions.ts`

**Investigation:**
- ✅ Used by Medical Clinic (`/dashboard/healthcare/appointments/page.tsx`)
- ❌ NO Dental consumer detected (searched `**/dental/**` for appointment usage)
- ✅ Semantics: Outpatient clinic scheduling

**Decision:** **MEDICAL CLINIC-OWNED**

**Rationale:**
- Only Medical Clinic uses this appointment system
- Dental may have separate scheduling (or uses different system)
- No evidence of cross-product reuse

**Condition:** If Dental later adopts same appointment semantics → reclassify to Shared

---

## Decision 2: Clinical Alerts Ownership

**Capability:** Clinical decision support alerts  
**Source:** `src/services/healthcare/clinical-alerts-service.ts`

**Investigation:**
- ✅ Used by Hospital dashboard
- ✅ Used by general Healthcare context
- ✅ Patient safety alert infrastructure
- ✅ Semantics: Clinical decision support (cross-product)

**Decision:** **SHARED HEALTHCARE**

**Rationale:**
- Alert infrastructure is cross-product safety system
- Semantics identical (patient safety alerts)
- Used beyond single product context
- Core healthcare capability, not product-specific

---

## Final Ownership Matrix (13/13 Confirmed)

| # | Capability | Owner | Confidence |
|---|------------|-------|------------|
| 1 | Emergency | HOSPITAL | High |
| 2 | ICU | HOSPITAL | High |
| 3 | Nursing | HOSPITAL | High |
| 4 | CSSD | HOSPITAL | High |
| 5 | **Appointments** | **MEDICAL CLINIC** | **High** ✅ |
| 6 | **Clinical Alerts** | **SHARED HEALTHCARE** | **High** ✅ |
| 7 | Pharmacy | SHARED HEALTHCARE | High |
| 8 | Laboratory | SHARED HEALTHCARE | High |
| 9 | Billing | SHARED HEALTHCARE | High |
| 10 | BHYT | SHARED HEALTHCARE | High |
| 11 | Healthcare Service | SHARED HEALTHCARE | High |
| 12 | Healthcare Actions | SHARED HEALTHCARE | High |
| 13 | LIS/RIS | SHARED HEALTHCARE | High |

---

## Ownership Summary

```text
HOSPITAL:           4 capabilities
MEDICAL CLINIC:     1 capability
DENTAL:             0 capabilities (in service layer)
SHARED HEALTHCARE:  8 capabilities

Total: 13/13 canonical owners confirmed
```

---

## TG-2.2A Status

```text
Repository investigation             ✅ COMPLETE
13 capabilities traced               ✅ COMPLETE
High-confidence recommendations      11/13 → 13/13
Medium-confidence decisions          2/2 RESOLVED

Appointments ownership               ✅ MEDICAL CLINIC
Clinical Alerts ownership            ✅ SHARED HEALTHCARE

Canonical ownership confirmed        13/13 ✅
TG-2.2A Healthcare Ownership         🔒 COMPLETE
```

---

## Next: TG-2.2B Governed Scope Architecture

**With 13/13 owners confirmed, proceed to:**

1. Determine which scopes need to exist
2. Which scopes already exist
3. Which scopes need expansion
4. Create qualified executable governance scopes

**Do NOT blindly create 4 tsconfigs** — use ownership to guide architecture.

---

**Decisions made by:** Evidence + architectural judgment  
**Evidence quality:** High (repository tracing)  
**Status:** Ready for TG-2.2B

