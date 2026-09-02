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
