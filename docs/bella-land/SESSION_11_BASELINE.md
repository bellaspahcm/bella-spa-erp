# Session 11 — Baseline

**Date:** 2026-09-11  
**Phase:** Phase 3 Customers — C3.4 Regression  
**Status:** Ready to Start  
**Prior Session:** 10 (C3.3 VERIFIED + Governance Correction)

---

## 📊 Clean Baseline Status

```
Projects        🔒 CLOSED — 10 verified gates
Products        🔒 CLOSED — 35 verified gates

Customers       🟡 IN PROGRESS
├─ C3.0         ✅ COMPLETE
├─ C3.1         🔒 VERIFIED — 5/5
├─ C3.2         🔒 VERIFIED — 9/9
├─ C3.3         🔒 VERIFIED — 11/11
├─ C3.4         ▶️ NEXT
└─ C3.5         ⏸️ PENDING

Customer verified gates: 25
Known verified total:     70

Customer denominator:     NOT FROZEN
Overall denominator:      NOT FROZEN
Percentage claims:        NOT ALLOWED
```

---

## 🎯 Session 11 Execution Plan

### Critical Path
```
Canonical Customer Lifecycle Check
        ↓
Determine supported operations
        ↓
Freeze C3.4 regression scope
        ↓
Execute regression
        ↓
ANY FAIL?
 ├─ YES → Freeze → RCA → Fix → Full rerun
 └─ NO
      ↓
C3.4 🔒 VERIFIED
      ↓
C3.5 Customers Seal Review
      ↓
Customers 🔒 CLOSED
```

---

## 🔍 Step 1: Canonical Customer Lifecycle Check

**Objective:** Determine which operations canonical design supports

**DO NOT assume delete is a capability.** With real estate customer data, canonical lifecycle may be:
```
Active → Inactive/Archived (preserve transaction history)
NOT: Active → Deleted (physical delete may be forbidden)
```

### Verification Points
1. **Check CustomerService:**
   - What lifecycle methods exist?
   - `create()` ✓ confirmed
   - `read()` / `list()` ?
   - `update()` ?
   - `delete()` / `softDelete()` / `archive()` / `deactivate()` ?

2. **Check Database Schema:**
   - `re_customers` table structure
   - `deleted_at` field exists?
   - `archived_at` field exists?
   - `status` field exists? (Active/Inactive/Archived)
   - `is_active` boolean?

3. **Check Business Rules:**
   - Can customers be deleted?
   - Must transaction history be preserved?
   - What happens to customer's reservations if customer removed?

### Outcome
Document exactly which operations canonical design supports:
```
✓ Create    — VERIFIED (C3.1)
✓ Read      — to verify
✓ Update    — to verify
✓ Archive   — to verify (if supported)
✗ Delete    — if NOT supported, DO NOT TEST
```

---

## 🧪 Step 2: C3.4 Regression Scope

**Based on Step 1 findings, freeze scope:**

### Mandatory Regression
- C3.1 Write Flow (5 gates) — must re-PASS
- C3.2 Authenticated Security (9 gates) — must re-PASS

### Additional Coverage (if canonical allows)
- Read operations (fetch single customer, list customers)
- Update operations (edit customer fields)
- Archive/deactivate operations (if canonical supports)
- **NO delete tests** unless canonical explicitly supports physical delete

### Browser Smoke
- Subset of B1-B11 (verify no regressions in UI)

### Expected Total Gates
**TBD** — depends on canonical lifecycle check

---

## ⚠️ Failure Protocol

If ANY gate fails during regression:

```
1. STOP execution
2. Document failure
3. Root cause analysis
4. Fix issue
5. FULL regression rerun (all gates)
6. Document fix + verification
```

**Do NOT proceed with partial PASS.** All gates must PASS.

---

## 📋 Success Criteria — C3.4

✅ C3.1 regression: 5/5 gates PASS  
✅ C3.2 regression: 9/9 gates PASS  
✅ Additional operations: X/X gates PASS (based on canonical)  
✅ Browser smoke: PASS  
✅ No new defects introduced  
✅ All evidence documented

**Then:** C3.4 🔒 VERIFIED

---

## 🎯 After C3.4: C3.5 Customers Seal

### Seal Criteria
- All C3 sub-phases complete (C3.0–C3.4)
- All gates verified
- Evidence audit complete
- No open defects
- Documentation complete

### Deliverable
- `C3_5_CUSTOMERS_SEAL.md`
- Updated RC status: **Customers 🔒 CLOSED**

---

## 🚀 After Customers: Phase 5

**Phase 5 Cross-Capability Integration**

This is where Projects, Products, Customers, and Reservations must prove they work together as **one complete Bella Land workflow**.

### Expected Coverage
- End-to-end workflow: Project → Product → Customer → Reservation
- Cross-capability integration points
- User journey testing
- Performance smoke test
- Production deployment verification

### Critical Difference
Phase 5 is NOT about testing individual CRUDs again.  
Phase 5 is about proving **the system works as a whole**.

---

## 🛡️ Governance Guardrails Active

✅ **No fake percentages** — only verified numerators  
✅ **Canonical-first** — check lifecycle before testing  
✅ **Evidence-only claims** — no projections without data  
✅ **Lifecycle-driven scope** — test design, not coverage goals  
✅ **No time estimates** — evidence matters, not duration

---

## 📦 Ready State

### Verified Evidence (Session 1-10)
- ✅ Projects closed (10/10)
- ✅ Products closed (35/35)
- ✅ Customers partial (25 gates)
- ✅ Governance corrections applied
- ✅ Canonical discipline enforced

### Documentation Complete
- ✅ RC status baseline
- ✅ Session 10 complete
- ✅ Governance correction documented
- ✅ Session 11 baseline prepared

### Code Ready
- ✅ Customer actions implemented
- ✅ Customer UI functional
- ✅ RLS policies deployed
- ✅ Test scripts available

---

## ⏭️ First Action: Canonical Check

**Do NOT:**
- Assume delete exists
- Test operations without verification
- Add coverage for coverage sake

**Do:**
- Read `CustomerService` code
- Check database schema
- Document supported operations
- Freeze scope based on evidence

---

**Session 11 Baseline: ✅ CLEAN**

_Governance discipline maintained — ready for canonical-first execution_

