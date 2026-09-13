# P2.3 B5 Failure — Root Cause Analysis

**Date:** 2026-09-11  
**Test:** B5 — Form Fields Bind Correctly  
**Result:** 🔴 **FAIL**

---

## Failure Evidence

**Error message:**
```
null value in column "area" of relation "real_estate_products" 
violates not-null constraint
```

**Screenshot:** User-provided image showing form with:
- Mã căn: `P2.3-PREVIEW-20260911-001`
- Loại căn: Căn hộ
- Block: A
- Tầng: 1
- **Diện tích: 0.00** ← PROBLEM
- **Đơn giá: 0** ← PROBLEM
- Trạng thái: Khả dụng

**Submission:** Failed with database constraint violation

---

## Root Cause

### Database Constraint

**Schema:** `supabase/migrations/20260802150000_real_estate_core_schema.sql`

```sql
area NUMERIC(10, 2) NOT NULL CHECK (area > 0),
unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price > 0),
```

**Constraints:**
- `area` must be NOT NULL
- `area` must be > 0
- `unit_price` must be NOT NULL  
- `unit_price` must be > 0

### Form Behavior

**Initial state:** `src/app/dashboard/real-estate/apartments/page.tsx`

```typescript
const [createForm, setCreateForm] = useState({
  product_code: "",
  product_type: "apartment" as const,
  block: "A",
  floor: "1",
  area: 0,           // ❌ Violates DB constraint (area > 0)
  unit_price: 0,     // ❌ Violates DB constraint (unit_price > 0)
  status: "available" as const,
});
```

**Validation missing:**
- No client-side validation for area > 0
- No client-side validation for unit_price > 0
- Form allowed submission with default 0 values

### Contract Mismatch

**Defect class:** UI / VALIDATION CONTRACT MISMATCH

```text
Form state:       area = 0 allowed
Form validation:  None
Database contract: area > 0 required
Result:           Constraint violation on submission
```

**Observed chain:**
1. User submits form with area=0 (or default)
2. No client validation blocks submission
3. Action/service passes area=0 to database
4. Database rejects: violates NOT NULL and CHECK (area > 0)
5. User sees database error (poor UX)

---

## Fix Applied

**Commit:** `fe56b014`  
**Branch:** `feat/bella-land-p2-3-production-create-ui`

### Changes

**1. Add validation before submission (PRIMARY FIX):**

```typescript
if (createForm.area <= 0) {
  toast.error("Vui lòng nhập diện tích lớn hơn 0");
  return;
}

if (createForm.unit_price <= 0) {
  toast.error("Vui lòng nhập đơn giá lớn hơn 0");
  return;
}
```

**Acceptance:** Validation blocks invalid submission, not just defaults.

**2. Improve form defaults (UX CONVENIENCE):**

```typescript
const [createForm, setCreateForm] = useState({
  product_code: "",
  product_type: "apartment" as const,
  block: "A",
  floor: "1",
  area: 100,         // ✅ Default 100m² (convenience)
  unit_price: 50000000, // ✅ Default 50M VND/m² (convenience)
  status: "available" as const,
});
```

**Note:** Defaults are UX convenience only. If user changes to 0, validation (fix #1) will catch it.

---

## Verification

**New deployment:** Commit `fe56b014` pushed  
**Trigger:** Vercel redeployment via PR #74 update  
**Expected:** Form validation prevents submission with area ≤ 0 or unit_price ≤ 0

---

## Re-test Plan

**Since code changed after initial B5 failure:**

```text
Await new Vercel deployment (commit fe56b014)
        ↓
Execute FULL B1-B10 on new deployment
        ↓
Verify form now prevents area=0 submission
        ↓
10/10 PASS required for P2.3 VERIFIED
```

**Do NOT use combined evidence** — fresh deployment requires full re-test.

---

## Impact Assessment

**Severity:** Medium

**User impact:**
- Cannot create products without area/price
- Error message unclear to user (database error, not validation error)

**Data integrity:**
- No data corruption
- No products created with invalid data
- Constraint worked as designed

**Security:**
- No security impact
- RLS still enforced (validated in P2.2)

---

## Lessons Learned

1. **Form validation must match DB constraints** — Check schema before implementing forms
2. **Client-side validation is PRIMARY fix** — Block invalid state before submission
3. **Defaults are convenience, not validation** — User can change defaults; validation must catch violations
4. **Database errors are poor UX** — Validation errors should show before DB rejects
5. **Test with boundary values** — Using 0 exposed the contract mismatch

---

## Current Status

```text
P2.3 Browser Runtime

Initial B1-B4         ✅ PASS (prior test)
B5                    ❌ FAIL (validation mismatch)
Defect                ✅ CONFIRMED (UI/validation contract)
Class                 UI / VALIDATION CONTRACT MISMATCH

Fix applied:
├─ area > 0 validation       ✅ (PRIMARY)
├─ unit_price > 0 validation ✅ (PRIMARY)
└─ valid defaults            ✅ (UX CONVENIENCE)

Fix commit            fe56b014
New deployment        ⏸️ AWAITING VERCEL
Re-test               ▶️ FULL B1-B10 REQUIRED
P2.3                  🟡 NOT VERIFIED
```

**Critical:** Code changed → Must run FULL B1-B10 on new deployment (commit fe56b014)

**Do NOT:**
- Continue from B6 with old deployment
- Combine prior B1-B4 PASS with new deployment
- Assume fix works without re-testing

**Must do:**
- Await Vercel deployment of fe56b014
- Execute full B1-B10 on new deployment
- 10/10 PASS required for P2.3 VERIFIED

**Next:** Await new deployment → Execute full B1-B10 → Document results

