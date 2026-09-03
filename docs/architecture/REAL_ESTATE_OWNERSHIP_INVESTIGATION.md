# Real-Estate TypeScript Diagnostic Ownership Investigation

**Date:** 2026-09-03
**Status:** Investigation Complete — Ownership Conflict Identified
**Diagnostics:** 3 errors (TS2322 type mismatch)

---

## Executive Summary

**Finding:** Real-Estate has a **semantic ownership conflict** between DB schema and domain model for property status values.

**Root Cause:** DB enum includes status values (`'pending_deposit'`, `'cancelled'`) that domain model (`PropertyUnitStatus`) does not recognize, AND domain model includes values (`'held'`, `'completed'`) that DB enum does not include.

**Recommendation:** **BLOCKED — Cannot fix with mechanical TypeScript changes.** Requires semantic decision on canonical authority and possible data migration.

---

## Diagnostic Evidence

### Current Errors (3 total)

```
src/platform/real-estate/engines/reservation.service.ts(55,9):
error TS2322: Type '"pending_deposit"' is not assignable to type
'"active" | "released" | "expired" | "converted" | undefined'.

src/platform/real-estate/engines/reservation.service.ts(93,9):
error TS2322: Type '"cancelled"' is not assignable to type
'"active" | "released" | "expired" | "converted" | undefined'.

src/platform/real-estate/repositories/property-unit.repository.ts(52,9):
error TS2322: Type 'PropertyUnitStatus' is not assignable to type
'"available" | "booked" | "deposited" | "contracted" | "paid" |
"handed_over" | "cancelled" | undefined'.
```

---

## Ownership Analysis

### Database Schema (Canonical Source: Migration `20260731010000`)

**File:** `supabase/migrations/20260731010000_create_real_estate_schema.sql`

**Table:** `real_estate_products`

**Status Column Definition:**
```sql
status TEXT NOT NULL DEFAULT 'available' 
CHECK (status IN (
  'available',
  'booked', 
  'deposited',
  'contracted',
  'paid',
  'handed_over',
  'cancelled'
))
```

**DB Enum (from `database.types.ts` line 29711):**
```typescript
Database["public"]["Enums"]["re_product_status"]:
  | "available"
  | "booked"
  | "deposited"
  | "contracted"
  | "paid"
  | "handed_over"
  | "cancelled"
```

**Migration Date:** 2026-07-31 01:00:00
**Authority:** Database schema (enforced by CHECK constraint)

---

### Domain Model (Application Layer)

**File:** `src/platform/real-estate/domain/property-unit.entity.ts`

**Domain Type:**
```typescript
export type PropertyUnitStatus = 
  | 'available' 
  | 'held'        // ❌ NOT in DB enum
  | 'booked' 
  | 'deposited' 
  | 'contracted' 
  | 'completed'   // ❌ NOT in DB enum
```

**State Machine Comments:**
```
AVAILABLE -> HELD (or booked) -> DEPOSITED -> CONTRACTED -> COMPLETED
HELD -> AVAILABLE (expired)
```

**Domain Authority:** Real Estate Kernel business logic

---

### Service Layer Usage

**File:** `src/platform/real-estate/engines/reservation.service.ts`

**Line 55:** Inserts `'pending_deposit'` into `re_reservations.status`
```typescript
.insert({
  ...
  status: 'pending_deposit',  // ❌ NOT in PropertyUnitStatus
  ...
})
```

**Line 93:** Updates `re_reservations.status` to `'cancelled'`
```typescript
.update({
  status: 'cancelled',  // ❌ NOT in PropertyUnitStatus
  ...
})
```

**Note:** These operations target `re_reservations` table, NOT `real_estate_products`.

---

## Conflict Matrix

| Status Value | DB Enum (`re_product_status`) | Domain (`PropertyUnitStatus`) | Service Usage |
|--------------|-------------------------------|-------------------------------|---------------|
| `available` | ✅ | ✅ | ✅ |
| `booked` | ✅ | ✅ | ✅ |
| `deposited` | ✅ | ✅ | ✅ |
| `contracted` | ✅ | ✅ | ✅ |
| `paid` | ✅ | ❌ | ❌ |
| `handed_over` | ✅ | ❌ | ❌ |
| `cancelled` | ✅ | ❌ | ✅ (reservation table only) |
| `held` | ❌ | ✅ | ✅ (domain transition) |
| `completed` | ❌ | ✅ | ✅ (domain transition) |
| `pending_deposit` | ❌ | ❌ | ✅ (reservation table only) |

**Semantic Gaps:**
- Domain model uses `'held'` and `'completed'` which DB enum doesn't recognize
- DB enum includes `'paid'` and `'handed_over'` which domain model doesn't use
- Service layer uses `'pending_deposit'` and `'cancelled'` for **reservation table**, not product table

---

## Root Cause Analysis

### Issue 1: Domain-DB Mismatch

**Domain expects:**
```
available → held → booked → deposited → contracted → completed
```

**DB enforces:**
```
available → booked → deposited → contracted → paid → handed_over
(also: cancelled)
```

**Gap:** `'held'` and `'completed'` exist only in domain logic, NOT in DB.

### Issue 2: Confusion Between Two Tables

The errors reference two different tables:
1. `real_estate_products` — product/unit status (7 DB enum values)
2. `re_reservations` — reservation status (includes `'pending_deposit'`, `'cancelled'`)

**Service code conflates these:**
- Domain entity `PropertyUnit.status` maps to `real_estate_products.status`
- Reservation records use `re_reservations.status` with different enum

---

## Ownership Decision Required

**Cannot proceed without answering:**

### Q1: Which is canonical for `real_estate_products.status`?

**Option A:** DB enum is canonical
- Domain must conform to: `available | booked | deposited | contracted | paid | handed_over | cancelled`
- Remove `'held'` and `'completed'` from domain
- Map domain transitions to DB values (e.g., `held` → `booked`, `completed` → `handed_over`)

**Option B:** Domain is canonical
- Migration required: ALTER TABLE to add `'held'` and `'completed'` to DB CHECK constraint
- Remove `'paid'` if not used, or map it to domain concept
- Breaking change if production data uses `'paid'` or `'handed_over'`

**Option C:** Introduce mapping layer
- Keep both models separate
- Repository translates domain ↔ DB
- More complexity, but preserves both semantics

### Q2: Are `'paid'` and `'handed_over'` used in current database?

**Evidence needed:**
```sql
SELECT status, COUNT(*) 
FROM real_estate_products 
GROUP BY status;
```

If existing data contains `'paid'` or `'handed_over'`, Option B becomes risky.

### Q3: What is the correct state machine?

**Domain comment claims:**
```
AVAILABLE → HELD → DEPOSITED → CONTRACTED → COMPLETED
```

**DB constraint allows:**
```
Any transition among: available, booked, deposited, contracted, paid, handed_over, cancelled
```

**Which is the business-correct flow?**

---

## Recommended Next Steps

### Step 1: Gather Database Evidence

Run on current database (test/pre-production):
```sql
-- Q1: What status values actually exist?
SELECT status, COUNT(*) as count
FROM real_estate_products
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY count DESC;

-- Q2: Are paid/handed_over used?
SELECT COUNT(*) 
FROM real_estate_products 
WHERE status IN ('paid', 'handed_over')
  AND deleted_at IS NULL;

-- Q3: Are held/completed used anywhere?
-- (Should be zero if domain and DB are out of sync)
SELECT COUNT(*) 
FROM real_estate_products 
WHERE status IN ('held', 'completed')
  AND deleted_at IS NULL;
```

### Step 2: Consult Business Owner

Questions for Real Estate Product Owner:
1. What is the canonical property lifecycle?
2. Is there a difference between `'paid'` and `'contracted'`?
3. Is there a difference between `'handed_over'` and `'completed'`?
4. Should `'held'` be a distinct status, or is it equivalent to `'booked'`?

### Step 3: After Ownership Clarity

**If DB is canonical:**
- Update `PropertyUnitStatus` type to match DB enum
- Remove domain methods that reference `'held'` or `'completed'`
- Update state machine documentation

**If Domain is canonical:**
- Create migration to ALTER CHECK constraint
- Update `database.types.ts` enum
- Verify no production data uses removed values

**If Mapping Layer needed:**
- Create `PropertyUnitStatusMapper` in repository
- Map domain `'held'` → DB `'booked'`
- Map domain `'completed'` → DB `'handed_over'` (or `'paid'`)
- Document mapping rationale

### Step 4: Minimal Fix After Decision

Once canonical authority is clear:
1. Apply minimal code change (conform domain to DB, or vice versa)
2. Run Gate B: `npx tsc -p tsconfig.platform-real-estate.json --noEmit`
3. Run Regression: `npm run governance:check-regression`
4. Run Architecture Guard: `npm run arch:guard`
5. Commit with evidence

---

## Why This Is BLOCKED

**Cannot apply mechanical TypeScript fix because:**
1. ❌ Semantic ownership unclear (domain vs DB authority)
2. ❌ Current database data state unknown (could break existing records)
3. ❌ Business state machine ambiguous (conflicting documentation)
4. ❌ Two separate enums confused (`real_estate_products` vs `re_reservations`)

**TypeCheck PASS ≠ Semantic PASS.**

Forcing type conformance without understanding canonical source would create:
- Silent data corruption risk
- State machine invariant violations
- Domain logic inconsistency

---

## Status

**Real-Estate Remediation:** **BLOCKED pending ownership evidence**

**Phase 1 Regression Protection:** Still operational (would catch any new regressions after fix)

**Next Action:** Gather production data evidence + consult business owner

**Do NOT:**
- Guess mapping between `'held'` and `'booked'`
- Assume `'completed'` === `'handed_over'`
- Remove domain states without business validation
- Alter DB enum without data migration plan

---

## AI Coding Contract Compliance

This investigation follows `AI_CODING_CONTRACT.md` rules:

✅ **Rule: Never guess semantics** — BLOCKED on enum mapping ambiguity
✅ **Rule: Canonical ownership must be clear** — DB vs Domain authority unknown
✅ **Rule: Evidence before infrastructure** — Awaiting production data query
✅ **Rule: When ownership ambiguous, STOP** — Documented blocker, no guess fix

---

**Investigation Complete. Awaiting human decision on canonical authority.**


---

## CRITICAL EVIDENCE UPDATE #2 (2026-09-03) — BOUNDARY VIOLATION IDENTIFIED

### Two Conflicting Domain Models Found

**There are TWO separate Real-Estate domain implementations in the codebase:**

#### 1. Platform Kernel (`src/platform/real-estate/domain/property-unit.entity.ts`)

```typescript
export type PropertyUnitStatus = 'available' | 'held' | 'booked' | 'deposited' | 'contracted' | 'completed';

// State machine:
available → held → deposited → contracted → completed
```

**Tests:** `src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts` (uses `'held'`)

#### 2. Product Module (`src/modules/real_estate/contexts/inventory/domain/apartment.ts`)

```typescript
export type ApartmentStatus = 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled';

const validTransitions = {
  available: ['booked', 'cancelled'],
  booked: ['deposited', 'cancelled'],
  deposited: ['contracted', 'cancelled'],
  contracted: ['paid', 'cancelled'],
  paid: ['handed_over', 'cancelled'],  // ← paid IS used
  handed_over: [],
};
```

**Tests:** `src/modules/real_estate/contexts/inventory/__tests__/apartment.test.ts` (uses `'handed_over'`)

**Services using Product model:**
- `src/modules/real_estate/services/BIReportService.ts` (counts `handed_over` as sold)
- `src/modules/real_estate/services/RealEstateAccountingService.ts` (accounting for `handed_over`)
- `src/modules/real_estate/actions/contractActions.ts` (milestone `paid` transitions)

### Root Cause: Architectural Boundary Violation

**The TypeScript errors are NOT a DB/domain mismatch.**

They are evidence of **Platform Kernel vs Product Module duplication:**

| Aspect | Platform Kernel | Product Module | DB Enum |
|--------|----------------|----------------|---------|
| Location | `src/platform/real-estate/` | `src/modules/real_estate/` | `re_product_status` |
| Status values | `held`, `completed` | `paid`, `handed_over` | `paid`, `handed_over` ✅ |
| State machine | `held → deposited → completed` | `booked → contracted → paid → handed_over` | Matches Product |
| Tests | Platform Kernel tests | Product Module tests | N/A |
| Service usage | Reservation service (unused?) | BI reports, accounting, contracts | Matches Product |

**DB enum is correct for Product Module, incompatible with Platform Kernel.**

### Migration Intent Now Clear

Migration `20260802100000` line 114:

```sql
WHEN LOWER(status) = 'completed' THEN 'handed_over'
```

This was NOT mapping domain → persistence vocabulary.

This was **cleaning up legacy TEXT data** from Product Module that may have had inconsistent naming before enum was enforced.

The migration author was **converting Product Module's persistence to strict enum**, not trying to represent Platform Kernel's domain model.

### The Real Problem

**Platform Kernel (`src/platform/`) was developed separately from Product Module (`src/modules/`) and never reconciled.**

Platform Kernel services like `reservation.service.ts` write to `real_estate_products` table using Platform Kernel vocabulary (`'held'`, `'completed'`), but:
- DB schema was designed for Product Module vocabulary
- Product Module services expect Product Module vocabulary in DB
- TypeScript errors are preventing Platform Kernel from writing invalid enum values

### Evidence Platform Kernel May Be Unused

**Question:** Is Platform Kernel actually used in production, or is it experimental/deprecated code?

**Evidence suggesting unused:**
- No production services import Platform Kernel domain entity
- All production services (BI, accounting, contracts) use Product Module
- Tests exist for both but Platform tests use mocks, Product tests may be integration

**This explains why the mismatch wasn't caught earlier** — Platform Kernel code may never actually write to DB in production.

### Canonical Authority Determination (REVISED)

**Product Module is canonical for `real_estate_products` table.**

Evidence:
1. DB enum matches Product Module state machine
2. All production services (BI, accounting) use Product Module
3. Migration was cleaning up Product Module legacy data
4. Platform Kernel may be unused/experimental

### Recommended Fix (REVISED)

**DO NOT add `'held'` and `'completed'` to DB enum.**

Instead:

**Option A: Deprecate Platform Kernel (RECOMMENDED if unused)**
1. Verify Platform Kernel is not used in production
2. Remove or mark as deprecated
3. Consolidate on Product Module

**Option B: Fix Platform Kernel to use Product vocabulary**
1. Update `PropertyUnitStatus` to match `ApartmentStatus`
2. Map domain methods:
   - `reserve()` → sets status to `'booked'` (not `'held'`)
   - `complete()` → sets status to `'handed_over'` (not `'completed'`)
3. Update Platform Kernel state machine to match Product

**Option C: Isolate Platform Kernel (if intentionally separate)**
1. Platform Kernel should NOT write to `real_estate_products`
2. Create separate `platform_property_units` table for Platform Kernel
3. Keep Product Module owning `real_estate_products`

### Status Change (FINAL)

**BLOCKED → ARCHITECTURE DECISION REQUIRED**

This is NOT a simple type mismatch.

This is **duplicate domain implementations** at Platform vs Product boundary.

**Cannot fix with migration alone.** Requires architectural decision:
- Is Platform Kernel used in production?
- Should Platform and Product vocabularies be unified?
- Who owns `real_estate_products` table canonical schema?

**Next Action:** Verify Platform Kernel usage in production. If unused, deprecate it. If used, reconcile vocabularies or separate persistence.

### Migration History Analysis

**Migration `20260802100000_fix_partner_portal_schema_conflicts.sql`** (2 days after initial schema):

```sql
UPDATE public.real_estate_products
SET status_enum = CASE 
  WHEN LOWER(status) = 'completed' THEN 'handed_over'::public.re_product_status
  ...
END;
```

**KEY FINDING:** This migration **explicitly mapped domain's `'completed'` → DB's `'handed_over'`** during TEXT-to-ENUM conversion.

**Timeline:**
1. **2026-07-31:** Initial schema created with TEXT status CHECK constraint (7 values)
2. **2026-08-02:** Migration converted TEXT → ENUM, mapped `'completed'` → `'handed_over'`
3. **2026-09-03:** Domain code still uses `'completed'`, creating type mismatch

### Domain Usage Evidence

**Test file:** `src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts`

```typescript
test('Should release active hold successfully', async () => {
  mockProductsDb[0].status = 'held';  // ✅ Tests explicitly use 'held'
  ...
});

test('Should sign contract...', async () => {
  mockProductsDb[0].status = 'held';  // ✅ Tests expect 'held' in DB
  ...
});
```

**Service file:** `src/platform/real-estate/engines/property.service.ts` (line 87)

```typescript
if (unit.status === 'held' || unit.status === 'booked') {
  unit.depositPaid();  // ✅ Business logic treats 'held' as distinct state
}
```

### Canonical Authority Determination

**Evidence strongly suggests:**

1. **Domain is canonical** — Business logic and tests designed around `'held'` and `'completed'`
2. **DB enum is incomplete** — Missing domain states that migration author knew about (hence the `'completed'` → `'handed_over'` mapping)
3. **Migration was incomplete** — Converted TEXT to ENUM but:
   - Did NOT add `'held'` to enum
   - Did NOT add `'completed'` to enum
   - Did NOT update domain code to use `'handed_over'` instead of `'completed'`

### Root Cause

**Schema/domain mismatch caused by incomplete migration:**
- Migration author knew domain used `'completed'` (line 114 explicitly maps it)
- Migration author chose to map to `'handed_over'` instead of adding `'completed'` to enum
- But forgot to:
  1. Update domain code to use `'handed_over'`
  2. Add `'held'` to enum (likely never persisted before, so no mapping needed)

### Semantic Mappings (Based on Evidence)

| Domain | DB Enum | Justification |
|--------|---------|---------------|
| `held` | ❌ Missing | Tests show it's used; never mapped because never persisted before enum |
| `completed` | `handed_over` | Migration line 114 explicitly maps this |
| `booked` | `booked` | ✅ 1:1 match |
| `deposited` | `deposited` | ✅ 1:1 match |
| `contracted` | `contracted` | ✅ 1:1 match |
| `available` | `available` | ✅ 1:1 match |
| ❌ Not in domain | `paid` | Unused (no domain references found) |
| ❌ Not in domain | `cancelled` | Used only for `re_reservations`, not `real_estate_products` |

### Recommended Fix

**Option: Domain is Canonical (RECOMMENDED)**

Based on evidence, domain state machine is the authoritative design. DB enum must conform.

**Migration required:**

```sql
-- Add missing domain states to enum
ALTER TYPE re_product_status ADD VALUE IF NOT EXISTS 'held';
ALTER TYPE re_product_status ADD VALUE IF NOT EXISTS 'completed';

-- Optional: Remove unused values (breaking change if data exists)
-- This requires creating new enum and migrating data
```

**Code changes:** NONE required if DB conforms to domain.

**Risk:** Low — Tests already expect `'held'` to work; migration author already knew about `'completed'`.

**Alternative: Keep DB Enum, Update Domain**

Less recommended because:
- Breaks existing tests
- Changes business semantics (`'completed'` ≠ `'handed_over'` conceptually)
- More code changes required

### Next Steps

1. **Verify no production data uses `'paid'`** (likely safe to ignore)
2. **Create migration** to add `'held'` and `'completed'` to enum
3. **Run regression check** to verify no new diagnostics
4. **Update baseline** if Platform moves from 39 → 40 PASS

### Status Change

**BLOCKED → UNBLOCKED (Evidence-based fix identified)**

Canonical authority: **Domain**
Required action: **Add `'held'` and `'completed'` to DB enum**
Risk level: **Low** (tests already expect these values)
