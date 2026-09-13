# P2.3 UX Improvement — Empty Defaults

**Date:** 2026-09-11  
**Commit:** `f8439d38`  
**Rationale:** Prevent garbage data from convenience defaults

---

## Problem with Convenience Defaults

**Initial fix (fe56b014):**
```typescript
area: 100,         // Default 100m²
unit_price: 50000000, // Default 50M VND/m²
```

**Issue:** Risk of **garbage data** when user forgets to edit defaults.

**Example bad scenario:**
1. User creates product for 45m² unit priced at 65M VND/m²
2. User focuses on product_code and status
3. User forgets to check area/price fields
4. Submits with defaults: 100m², 50M → **WRONG but technically valid**
5. Database accepts (validation passes)
6. Business data now incorrect

---

## Better Approach: Empty Defaults

**Improved fix (f8439d38):**
```typescript
area: undefined,       // Empty - user MUST input
unit_price: undefined, // Empty - user MUST input
```

**Validation:**
```typescript
if (createForm.area === undefined || createForm.area <= 0) {
  toast.error("Vui lòng nhập diện tích lớn hơn 0");
  return;
}

if (createForm.unit_price === undefined || createForm.unit_price <= 0) {
  toast.error("Vui lòng nhập đơn giá lớn hơn 0");
  return;
}
```

---

## Benefits

### 1. Forces Explicit Input

```text
Empty field → User sees placeholder
             → User must type value
             → No accidental defaults
```

### 2. Prevents Garbage Data

```text
Forgot to edit area? → Cannot submit (validation blocks)
Forgot to edit price? → Cannot submit (validation blocks)
```

### 3. Better Business Logic

Real estate properties have highly variable:
- Area: 20m² studio to 300m² penthouse
- Price: 30M/m² to 200M/m² depending on location/quality

**No single "reasonable default" exists.** Better to force explicit input.

---

## User Experience

**Before (with defaults):**
```
Diện tích:   [100        ] m²    ← Pre-filled
Đơn giá:     [50,000,000 ] VND   ← Pre-filled
```
**Risk:** User might not notice and submit wrong values.

**After (empty):**
```
Diện tích:   [           ] m²    ← Empty, requires input
Đơn giá:     [           ] VND   ← Empty, requires input
```
**Safety:** User MUST input → Explicit decision → Correct data.

---

## Validation Coverage

**Required fields:**
- product_code: must not be empty ✅
- area: must be > 0 ✅
- unit_price: must be > 0 ✅

**Optional fields:**
- block: can be empty (null allowed)
- floor: can be empty (null allowed)
- product_type: has valid default (apartment)
- status: has valid default (available)

---

## Technical Changes

### State Definition

```typescript
const [createForm, setCreateForm] = useState({
  product_code: "",
  product_type: "apartment" as const,
  block: "",
  floor: "",
  area: undefined as number | undefined,      // Changed
  unit_price: undefined as number | undefined, // Changed
  status: "available" as const,
});
```

### Validation

```typescript
// Before
if (createForm.area <= 0) { ... }

// After
if (createForm.area === undefined || createForm.area <= 0) { ... }
```

### Action Call

```typescript
// Before
area: createForm.area > 0 ? createForm.area : null,

// After  
area: createForm.area || null,
```

### Form Reset

```typescript
setCreateForm({
  product_code: "",
  product_type: "apartment",
  block: "",
  floor: "",
  area: undefined,      // Changed
  unit_price: undefined, // Changed
  status: "available",
});
```

---

## Deployment Status

**Commits:**
1. `5413569a` — Initial implementation (no validation)
2. `fe56b014` — Add validation + convenience defaults (100, 50M)
3. `f8439d38` — **Empty defaults + validation (CURRENT)**

**Deployment:** ⏸️ AWAITING VERCEL (commit f8439d38)

---

## Re-Test Plan

**Since code changed again:**

```text
Await Vercel deployment (f8439d38)
        ↓
Execute FULL B1-B10
        ↓
Verify at B5:
├─ Area field empty (not 100)
├─ Unit price field empty (not 50M)
├─ Try submit without input → validation error
├─ Input area=85, price=42M → submit succeeds
└─ Product created with correct values
        ↓
If 10/10 PASS → P2.3 VERIFIED
If any fail → RCA + fix + re-test
```

**Do NOT reuse evidence from fe56b014 deployment.**

---

## Current Status

```text
Initial test (5413569a)      ❌ B5 FAIL (no validation)
Fix v1 (fe56b014)            ⏸️ DEPLOYED (convenience defaults)
Fix v2 (f8439d38)            ⏸️ AWAITING DEPLOYMENT (empty defaults)

Re-test required             ▶️ FULL B1-B10 on f8439d38
P2.3                         🟡 NOT VERIFIED
```

---

## Principle

**Convenience defaults ≠ Safety**

For critical business data (area, price in real estate):
- Empty + validation > Convenience defaults
- Explicit input > Implicit defaults
- Force decision > Assume reasonable value

**User must think → User inputs correct value → Business data accurate**

---

**Next:** Await deployment → Execute full B1-B10 on commit f8439d38

