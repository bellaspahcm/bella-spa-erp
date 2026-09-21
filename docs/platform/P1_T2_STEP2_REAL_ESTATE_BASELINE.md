# P1-T2 Step 2: Real Estate Cleanup Pilot — Baseline

**Date:** 2026-09-16  
**Checkpoint:** `d9dab038`  
**Status:** Baseline captured, root cause analysis in progress

---

## Objective

Clean Real Estate scope from 3 diagnostics → 0 diagnostics.

**Purpose:** Establish proven cleanup workflow for Education (231) and Healthcare (211).

---

## Baseline: 3 TypeScript Diagnostics

**Config:** `tsconfig.real-estate.json`  
**Compiler:** TypeScript via `npx tsc --noEmit`

### Error 1: Type 'number' not assignable to 'never' (× 2 occurrences)

**File:** `src/platform/real-estate/engines/reservation.service.ts`  
**Lines:** 54, 57  
**Code:** TS2322

```
src/platform/real-estate/engines/reservation.service.ts(54,9): error TS2322: Type 'number' is not assignable to type 'never'.
src/platform/real-estate/engines/reservation.service.ts(57,9): error TS2322: Type 'number' is not assignable to type 'never'.
```

**Initial hypothesis:** 
- Array or object typed too narrowly (e.g., `never[]` instead of proper element type)
- Likely initialization issue or incorrect type inference

---

### Error 2: PropertyUnitStatus type mismatch

**File:** `src/platform/real-estate/repositories/property-unit.repository.ts`  
**Line:** 52  
**Code:** TS2322

```
src/platform/real-estate/repositories/property-unit.repository.ts(52,9): error TS2322: Type 'PropertyUnitStatus' is not assignable to type '"booked" | "cancelled" | "paid" | "available" | "deposited" | "contracted" | "handed_over" | undefined'.
  Type '"completed"' is not assignable to type '"booked" | "cancelled" | "paid" | "available" | "deposited" | "contracted" | "handed_over" | undefined'.
```

**Root cause identified:**
- `PropertyUnitStatus` enum/type includes `"completed"` 
- Repository expects narrower union: `"booked" | "cancelled" | "paid" | "available" | "deposited" | "contracted" | "handed_over" | undefined`
- Missing `"completed"` in expected type

**Likely issue:** Type contract mismatch between domain model and repository layer.

---

## Error Clustering

### By Error Code

| Code | Count | Description |
|------|-------|-------------|
| TS2322 | 3 | Type not assignable |

All 3 errors are TS2322 (type assignment mismatch).

### By File

| File | Count | Pattern |
|------|-------|---------|
| `engines/reservation.service.ts` | 2 | `number` → `never` (lines 54, 57) |
| `repositories/property-unit.repository.ts` | 1 | `PropertyUnitStatus` mismatch |

### By Root Cause (Hypothesis)

**Cause A: Narrow type inference in reservation.service.ts**
- Likely: Array initialization with wrong type annotation
- Affects: 2 diagnostics (lines 54, 57)
- Pattern: Same error code, same file, adjacent lines

**Cause B: Incomplete status enum in repository contract**
- Likely: Repository type definition missing `"completed"` status
- Affects: 1 diagnostic (line 52)
- Pattern: Domain type includes value not in repository contract

---

## Investigation Required

### Files to examine:

1. **src/platform/real-estate/engines/reservation.service.ts**
   - Lines 54, 57 (context around these lines)
   - Look for array/object initialization
   - Check type annotations

2. **src/platform/real-estate/repositories/property-unit.repository.ts**
   - Line 52 (context)
   - Find repository type definition
   - Check PropertyUnitStatus domain type

3. **PropertyUnitStatus domain type definition**
   - Likely in domain layer or types file
   - Verify complete status list

---

## Root Cause Classification Status

**CONFIRMED. 2 root causes → 3 diagnostics.**

### Root Cause A: Non-existent fields in reservation insert

**Affects:** 2 diagnostics (lines 54, 57 in reservation.service.ts)

**Problem:**
Code attempts to insert `duration_minutes` and `deposit_amount` into `re_reservations` table, but:
- Fields don't exist in `ReReservationRow` type (src/types/real-estate-temp.types.ts)
- Fields don't exist in database table
- TypeScript infers type as `never` when trying to assign to non-existent properties

**Fix:**
Remove `duration_minutes` and `deposit_amount` from insert statement.

**Rationale:**
- No migration exists for these fields
- Not in type definition
- Likely leftover from earlier design iteration
- Simple removal (no domain logic impact)

---

### Root Cause B: Domain type includes status not in database enum

**Affects:** 1 diagnostic (line 52 in property-unit.repository.ts)

**Problem:**
- Domain type: `PropertyUnitStatus = 'available' | 'held' | 'booked' | 'deposited' | 'contracted' | 'completed'`
- Database enum `re_product_status`: `available | booked | deposited | contracted | paid | handed_over | cancelled`
- Domain includes `'held'` and `'completed'`
- Database doesn't have these but has `'paid'`, `'handed_over'`, `'cancelled'`

**CRITICAL: Domain states are actively used:**
- `reserve()` → sets `'held'`
- `release()` / `depositPaid()` → require `'held'` or `'booked'`
- `complete()` → sets `'completed'`
- Integration tests verify these states

**Cannot remove domain states without breaking logic.**

**Fix Strategy: State Mapping in Repository Layer**

Repository must map domain states to database states:
- Domain `'held'` → Database `'booked'` (semantic match: temporarily held)
- Domain `'completed'` → Database `'handed_over'` (semantic match: transaction complete)

**Alternative considered:** Add `'held'` and `'completed'` to database enum via migration.
**Rejected:** Requires database change; mapping approach is safer for pilot.

---

## Fix Implementation Plan

### Fix A: Remove non-existent fields (UNCHANGED)

**File:** `src/platform/real-estate/engines/reservation.service.ts`

**Before (lines 49-57):**
```typescript
.insert({
  tenant_id: params.tenantId,
  product_id: params.productId,
  user_id: params.userId,
  customer_id: params.customerId,
  duration_minutes: params.durationMinutes,  // ← REMOVE (line 54)
  status: 'active' as any,
  expires_at: expiresAt,
  deposit_amount: 0  // ← REMOVE (line 57)
})
```

**After:**
```typescript
.insert({
  tenant_id: params.tenantId,
  product_id: params.productId,
  user_id: params.userId,
  customer_id: params.customerId,
  status: 'active' as any,
  expires_at: expiresAt
})
```

---

### Fix B: Add state mapping in repository (REVISED)

**File:** `src/platform/real-estate/repositories/property-unit.repository.ts`

**Strategy:** Map domain states to database states before database operations.

**Before (line 48-56):**
```typescript
const { error } = await supabase
  .from('real_estate_products')
  .update({
    status: unit.status,  // ← Direct assignment causes type error
    owner_name: unit.ownerName,
    updated_at: new Date().toISOString()
  })
  .eq('id', unit.id)
  .eq('tenant_id', unit.tenantId);
```

**After:**
```typescript
// Map domain states to database enum
const dbStatus = mapDomainStatusToDb(unit.status);

const { error } = await supabase
  .from('real_estate_products')
  .update({
    status: dbStatus,
    owner_name: unit.ownerName,
    updated_at: new Date().toISOString()
  })
  .eq('id', unit.id)
  .eq('tenant_id', unit.tenantId);
```

**Add mapping function:**
```typescript
/**
 * Maps domain PropertyUnitStatus to database re_product_status enum.
 * 
 * Domain model uses richer state machine; database uses operational states.
 */
function mapDomainStatusToDb(
  domainStatus: PropertyUnitStatus
): 'available' | 'booked' | 'deposited' | 'contracted' | 'paid' | 'handed_over' | 'cancelled' {
  switch (domainStatus) {
    case 'held':
      return 'booked';  // Temporary reservation
    case 'completed':
      return 'handed_over';  // Final handover state
    // Direct mappings
    case 'available':
    case 'booked':
    case 'deposited':
    case 'contracted':
      return domainStatus;
    default:
      throw new Error(`Unknown domain status: ${domainStatus}`);
  }
}
```

**Rationale:**
- Domain layer keeps rich FSM (`'held'`, `'completed'`)
- Repository layer translates to database constraints
- Separation of concerns: domain logic vs database schema
- No migration required
- Tests continue to work (domain states unchanged)

---

## Verification Plan

1. ✅ Root causes identified
2. ⏳ Implement Fix A (reservation.service.ts)
3. ⏳ Implement Fix B (property-unit.entity.ts)
4. ⏳ Check for usages of `'held'` or `'completed'` statuses
5. ⏳ Run TypeScript compiler: `tsc --project tsconfig.real-estate.json --noEmit`
6. ⏳ Expected: 3 → 0 diagnostics
7. ⏳ Run Real Estate regression tests
8. ⏳ Add Real Estate to clean scope gate
9. ⏳ Document as proven workflow

---

**Status:** Root cause analysis COMPLETE, ready for implementation
