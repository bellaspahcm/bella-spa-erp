# Platform: Real-Estate Type Fixes - Semantic Review Required

**Date:** 2026-09-02  
**Status:** ⚠️ SCOPED PASS - SEMANTIC REVIEW REQUIRED  
**TypeScript:** 9 errors → 0 (2.7s PASS)

## Summary

Real-Estate achieved scoped TypeScript GREEN, but 3 groups of changes include **semantic decisions** that require domain/migration evidence before closure.

## Fixes Applied

### Group 1: Table/Field Names ✅ (Evidence: Strong)

**Changes:**
- `real_estate_contracts` → `re_contracts`
- `contract_no` → `contract_number`

**Evidence:** Database.types.ts generated from actual schema confirms canonical names.

**Assessment:** Safe - this is schema correction, not semantic decision.

**Files:**
- `src/platform/real-estate/engines/property.service.ts`

---

### Group 2: Status Enum Mapping ⚠️ (Evidence: Weak)

**Changes:**

#### Reservation Status
- `'pending_deposit'` → `'active'` (line 55, reservation.service.ts)
- `'cancelled'` → `'released'` (line 93, reservation.service.ts)

**Rationale used:** Semantic interpretation without migration/domain evidence:
- "pending_deposit" semantically means reservation is active → map to `'active'`
- "cancelled" semantically means unit released → map to `'released'`

**Risk:** 
- Database enum `re_reservation_status` only has: `active | released | expired | converted`
- Code may have been written against old schema or planned migration not yet applied
- Business semantics of "pending deposit" vs "active" may be distinct

#### PropertyUnit Status
- Domain enum: `'held' | 'completed'` → `'booked' | 'handed_over'`
- Updated entity transitions: `reserve()`, `release()`, `depositPaid()`, `complete()`

**Rationale used:** Alignment with database enum `re_product_status`:
- `'held'` → `'booked'` (unit reserved/held)
- `'completed'` → `'handed_over'` (handover complete)

**Risk:**
- Lifecycle transition semantics may differ between `'held'` and `'booked'`
- Domain entity now uses database enum values directly, breaking abstraction if intended
- `property.service.ts` line 87 changed from `status === 'held' || status === 'booked'` to `status === 'booked'` only

**Evidence Required:**
1. Migration history showing enum evolution
2. Domain workflow documentation for Real-Estate lifecycle
3. Existing tests that validate state transitions
4. Business rules for reservation/booking/deposit flow

**Files:**
- `src/platform/real-estate/engines/reservation.service.ts` (lines 55, 93)
- `src/platform/real-estate/domain/property-unit.entity.ts` (enum definition, transitions)
- `src/platform/real-estate/engines/property.service.ts` (line 87)

---

### Group 3: metadata Storage ❌ (Evidence: None)

**Change:**
```typescript
// Before
duration_minutes: params.durationMinutes,
deposit_amount: 0

// After
metadata: {
  duration_minutes: params.durationMinutes,
  deposit_amount: 0
}
```

**Issue:** Database table `re_reservations` has NO `duration_minutes` or `deposit_amount` columns.

**Solution applied:** Store in `metadata` JSON column.

**Risk:**
- No evidence that `metadata` is canonical storage for business attributes
- These may be:
  a) Planned columns in pending migration
  b) Obsolete attributes that should be removed from code
  c) Attributes that belong in different table/model

**This is a data-model decision, not a type fix.**

**Evidence Required:**
1. Schema design doc showing metadata usage patterns
2. Migration showing these fields were intentionally removed
3. Or migration adding these columns (not yet applied)
4. Business requirements for reservation duration/deposit tracking

**Files:**
- `src/platform/real-estate/engines/reservation.service.ts` (line 54-57)

---

## Verification Status

### TypeScript Gate
```bash
npx tsc --noEmit --project tsconfig.platform-real-estate.json
Duration: 2.7s | Exit 0
✅ SCOPED PASS
```

### Architecture Guard
**Status:** Not yet run for Real-Estate changes specifically.

**Required:** Verify no new violations introduced.

---

## Required Actions Before Closure

**Group 1 (Table Names):** ✅ Ready for commit

**Group 2 (Status Mapping):**
1. ❌ Read Real-Estate migrations to verify enum evolution
2. ❌ Check if conformance tests exist for lifecycle transitions
3. ❌ Verify business rules document for reservation/booking flow
4. ❌ If evidence confirms mapping is correct → commit
5. ❌ If evidence shows mapping is wrong → revert and fix correctly
6. ❌ If no evidence exists → **STOP** and mark as blocked pending domain clarification

**Group 3 (metadata Storage):**
1. ❌ Check Real-Estate schema design for metadata usage
2. ❌ Check migrations for `duration_minutes`/`deposit_amount` history
3. ❌ Verify if these attributes still have business requirement
4. ❌ If metadata is correct storage → commit
5. ❌ If pending migration exists → wait for migration application
6. ❌ If attributes are obsolete → remove from code entirely

---

## Recommendation

**Do NOT merge Real-Estate changes until semantic review complete.**

Compiler GREEN does not equal semantic correctness. The risk of breaking:
- Reservation lifecycle
- Property unit state machine
- Business reporting relying on specific status values
- Future migrations expecting specific data structure

is too high without evidence.

---

## Platform Inventory Status

After Real-Estate scoped PASS (pending semantic review):

| Status | Count | Units |
|--------|-------|-------|
| ✅ PASS | 38 | All except Education + 3 HOTSPOT |
| ❌ FAIL | 1 | Education (100 errors) |
| 🟠 HOTSPOT | 3 | Host, Healthcare, Logistics |
| ⚠️ REVIEW | 1 | Real-Estate (scoped PASS, semantic review required) |

**Next Steps:**
1. Complete Real-Estate semantic review
2. Commit Integration-Runtime (36→0, no semantic changes)
3. Run Architecture Guard
4. Update canonical inventory
5. Then assess Education (100 errors)

**HOTSPOT units:** Remain unchanged, no compiler archaeology.
