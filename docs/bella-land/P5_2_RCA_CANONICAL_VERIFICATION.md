# P5.2 Integration Test RCA — Canonical Verification

**Date:** 2026-09-11  
**Status:** 🔍 ROOT CAUSE ANALYSIS  
**Frozen Evidence:** 5/10 PASS, 5 FAIL

---

## Test Results (Frozen)

```
✅ I1: FK constraint blocks non-existent Product
✅ I2: FK constraint blocks non-existent Customer
❌ I3: Product status not synced (before: available, after: available)
❌ I4: Expected FK RESTRICT error, got: success
❌ I5: Expected FK RESTRICT error, got: success
✅ I6: RLS blocks cross-tenant Product in Reservation
✅ I7: RLS blocks cross-tenant Customer in Reservation
✅ I8: Covered by I6-I7 RLS enforcement
❌ I9: No reservation found for state machine test
❌ I10: Setup failed: product not found
```

---

## RCA Findings

### I4-I5: FK RESTRICT — ✅ SCHEMA DRIFT CONFIRMED

**Test Expectation:**
```typescript
// Test expected ON DELETE RESTRICT to block deletion
```

**Canonical Schema Spec:**
```sql
-- File: supabase/migrations/20260802150000_real_estate_core_schema.sql
product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
```

**Actual Database Behavior — VERIFIED:**

**Script:** `scripts/bella-land/verify-actual-fk-constraints.ts`

```
TEST 1: DELETE Product with active Reservation
🔴 DELETE SUCCEEDED — FK NOT enforced!

TEST 2: DELETE Customer with active Reservation
🔴 DELETE SUCCEEDED — FK NOT enforced!

VERDICT: FK RESTRICT constraints NOT enforced
→ Schema drift confirmed
```

**Conclusion:** ✅ **SCHEMA DRIFT VERIFIED**. Database allows deletion when it should not.

**Verdict:** Test expectation is **CORRECT**. Must apply FK constraints.

**Root Cause:** Migration `20260802150000` not applied OR constraints dropped at some point.

**Action:** Apply FK RESTRICT constraints via migration.

---

**Test Expectation:**
```typescript
// Test expected Product.status to change when Reservation created:
//   available → reserved
```

**Canonical Implementation Found:**

**File:** `src/platform/real-estate/engines/reservation.service.ts`

```typescript
async reserveProduct(params: ReservationParams): Promise<ReservationResultDTO> {
  // 1. Fetch unit from database repository
  const unit = await this.repository.findById(this.supabase, params.tenantId, params.productId);
  
  // 2. Perform state transition checks inside Domain entity (Aggregate Root)
  try {
    unit.reserve(params.customerId);  // ← Domain transition
  } catch (err: unknown) {
    return { success: false, error: errorMessage };
  }

  // 3. Save property unit back to DB via repository
  await this.repository.save(this.supabase, unit);  // ← Persists status change
  
  // 4. Create reservation log in 're_reservations' table
  await this.supabase.from('re_reservations').insert({...});
}
```

**Canonical Behavior:**
- `unit.reserve()` transitions Product status in Domain Model
- `repository.save()` persists status to real_estate_products table
- **Reservation MUST update Product.status**

**Verdict:** ✅ Test expectation is **CORRECT**. Canonical implementation exists.

**Root Cause:** Product-level integration path broken. Either:
- Test is NOT calling canonical `reserveProduct` service
- Repository.save() not persisting status
- Test bypassing domain layer (direct DB insert)

**Action:** Verify test execution path uses canonical service.

---

### I4-I5: FK RESTRICT — ✅ CANONICAL VERIFIED

**Test Expectation:**
```typescript
// Test expected ON DELETE RESTRICT to block:
//   DELETE FROM real_estate_products WHERE id = <has reservations>
//   DELETE FROM re_customers WHERE id = <has reservations>
```

**Canonical Schema Found:**

**File:** `supabase/migrations/20260802150000_real_estate_core_schema.sql`

```sql
CREATE TABLE IF NOT EXISTS re_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  ...
);
```

**Canonical Behavior:**
- FK with ON DELETE RESTRICT prevents parent deletion
- **Database MUST reject DELETE if child records exist**

**Actual Migration History:**
```
Query: SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10

Result:
- 20260511074226_add_notifications (Prisma)
- 20260511072527_init_schema (Prisma)
```

**Observation:** Migration `20260802150000_real_estate_core_schema.sql` **NOT in migration history**.

**Database Allows Delete:** Test successfully deleted Product/Customer with active Reservations.

**Verdict:** ✅ Test expectation is **CORRECT**. Canonical schema declares RESTRICT.

**Root Cause:** Migration not applied to production database.

**Action:** Apply canonical migration to enforce FK constraints.

---

### I9: Reservation State Machine — 🔄 CASCADING FAILURE

**Test Expectation:**
```typescript
// Test expected to find reservation with status='pending_deposit'
// Then transition: pending_deposit → deposited
```

**Root Cause:** Cascaded from I3
- I3 creates reservation but Product status not synced
- Test queries for `pending_deposit` reservation
- May not find it if I3's reservation was cleaned up or not persisted

**Verdict:** 🔄 **SECONDARY FAILURE**. Re-verify after I3 is fixed.

**Action:** Rerun after I3 remediation.

---

### I10: Test Setup Failure — 🐛 TEST ISSUE

**Test Expectation:**
```typescript
// Test expected Product to exist from earlier test setup
```

**Root Cause:** Test fixture issue
- Product created in I3 setup
- I4 successfully deleted it (when it should have failed)
- I10 tries to use same product → not found

**Verdict:** 🐛 **TEST BUG**. Caused by I4 not blocking deletion.

**Action:** Fix I4 (apply FK RESTRICT) → I10 will resolve.

---

## Canonical Lifecycle Verification

### Product Delete Canonical Behavior

**Check:** Does Bella Land allow hard-delete of Products?

**Findings:**
- Schema has `deleted_at TIMESTAMPTZ` column → soft delete supported
- No `ON DELETE CASCADE` in FK → hard delete NOT intended
- `ON DELETE RESTRICT` declared → protection intended

**Conclusion:** ✅ **Hard delete should be BLOCKED when Reservations exist**.

### Customer Delete Canonical Behavior

**Check:** Does Bella Land allow hard-delete of Customers?

**Similar pattern:**
- `re_customers.deleted_at` exists → soft delete supported
- `ON DELETE RESTRICT` declared → protection intended

**Conclusion:** ✅ **Hard delete should be BLOCKED when Reservations exist**.

---

## Fix Strategy

### Fix 1: Apply Canonical Migration (I4-I5)

**Action:** Apply `20260802150000_real_estate_core_schema.sql` FK constraints

**Risk:** Low. Enforces data integrity as designed.

**Verification:**
```sql
SELECT conname, confdeltype 
FROM pg_constraint 
WHERE conrelid='re_reservations'::regclass AND contype='f';

-- Expected: confdeltype = 'r' (RESTRICT)
```

### Fix 2: Verify Test Execution Path (I3)

**Action:** Confirm test uses canonical reservation service

**Current test code:**
```typescript
const { data: reservationData, error: reservationError } = await supabase
  .from('re_reservations')
  .insert({
    tenant_id: tenant1Id,
    product_id: productId,
    customer_id: customerId,
    deposit_amount: 50000,
    status: 'pending_deposit',
  })
  .select()
  .single();
```

**Issue:** ⚠️ **Direct DB insert bypasses canonical service!**

**Fix:** Call `ReservationService.reserveProduct()` instead

**Expected:**
```typescript
const reservationService = new ReservationService(repository, supabase);
const result = await reservationService.reserveProduct({
  tenantId: tenant1Id,
  productId: productId,
  customerId: customerId,
  userId: testUserId,
  durationMinutes: 1440
});
```

### Fix 3: Secondary Failures (I9-I10)

**Action:** Rerun after I3-I5 fixed

**Expected:** Should PASS after fixes applied

---

## Remediation Plan — EVIDENCE-BASED

### VERIFIED ROOT CAUSES

1. **I4-I5: Schema Drift — FK RESTRICT Missing**
   - ✅ VERIFIED: Database allows DELETE despite active reservations
   - ✅ Action: Apply FK constraints

2. **I3: Test Methodology Defect**
   - ✅ VERIFIED: Test bypasses canonical service
   - ✅ Action: Refactor test to use `ReservationService.reserveProduct()`

3. **I9-I10: Secondary Failures**
   - 🟡 Classification: Likely cascading from I3-I5
   - 🟡 Action: Re-verify after primary fixes

---

### Step 1: Apply FK Constraints (I4-I5)

**Evidence:** Empirical test confirms constraints missing

**SQL Migration:** `supabase/migrations/20260911020000_apply_reservation_fk_constraints.sql`

```sql
ALTER TABLE re_reservations
  DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES real_estate_products(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- Same for customer_id
```

**Verification:**
- Before: DELETE succeeds
- After: DELETE should fail with FK violation

### Step 2: Fix Test to Use Canonical Service (I3)

**Update:** `scripts/bella-land/test-reservation-integration.ts`

**Change:** Replace direct DB insert with canonical service call

**Note:** May require instantiating ReservationService properly

### Step 3: Full P5.2 Rerun

```bash
npx tsx scripts/bella-land/test-reservation-integration.ts
```

**Expected:** 10/10 PASS

---

## Decision Point

**Options:**

### A. Full Canonical Fix (Recommended)
1. Apply FK constraints via migration
2. Update test to use canonical service
3. Full rerun → 10/10 PASS expected

**Timeline:** 1-2 hours  
**Risk:** Low  
**Quality:** High (tests canonical behavior)

### B. Test-Only Fix
1. Keep direct DB insert
2. Remove Product status assertion from I3
3. Apply FK constraints only

**Timeline:** 30 minutes  
**Risk:** Medium (test doesn't verify canonical behavior)  
**Quality:** Medium (partial coverage)

### C. Document Gaps
1. No fixes
2. Seal with 5/10 verified
3. Known limitations documented

**Timeline:** Immediate  
**Risk:** High (RC with data integrity gaps)  
**Quality:** Low

---

## Recommendation

**Choose Option A: Full Canonical Fix**

**Rationale:**
- I3-I5 are legitimate integration defects
- Canonical implementation exists and is correct
- Tests should verify canonical paths, not shortcuts
- FK RESTRICT is essential data integrity
- Product status sync is core business logic

**Next Steps:**
1. Apply SQL migration for FK constraints
2. Refactor test to call ReservationService
3. Full P5.2 rerun
4. All 10/10 gates must PASS
5. Continue P5.3-P5.7

---

**Status:** 🔒 RCA COMPLETE — awaiting fix execution
