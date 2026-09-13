# P5.2 REMEDIATION PLAN — Schema Correction + Test Fix

**Status:** ▶️ READY FOR EXECUTION  
**Classification:** Schema correction (not new feature)  
**Evidence:** Empirically verified schema drift

---

## Confirmed Issues

```
🔴 I4-I5: FK RESTRICT constraints missing (SCHEMA DRIFT - VERIFIED)
🟡 I3:    Test bypasses canonical service (TEST METHODOLOGY DEFECT)
🟡 I9:    Secondary failure candidate — recheck after primary fixes
🟡 I10:   Fixture/secondary failure candidate — recheck after primary fixes
```

**Verification Evidence:**
- Script: `scripts/bella-land/verify-actual-fk-constraints.ts`
- Result: DELETE operations succeeded when they should fail
- Conclusion: Database does NOT enforce FK RESTRICT

---

## Remediation Sequence

### Step 1: Apply FK Schema Correction (I4-I5)

**Classification:** Schema correction (runtime DB → canonical contract alignment)

**Migration:** `supabase/migrations/20260911020000_apply_reservation_fk_constraints.sql`

**Execution:**
1. Open Supabase SQL Editor
2. Copy migration content
3. Execute SQL
4. Verify constraints applied

**SQL:**
```sql
-- Drop existing FK constraints if they exist
ALTER TABLE IF EXISTS re_reservations 
  DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

ALTER TABLE IF EXISTS re_reservations 
  DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;

-- Apply canonical FK constraints with RESTRICT
ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES real_estate_products(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES re_customers(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;
```

**Verification Query:**
```sql
SELECT 
  conname AS constraint_name,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete_action
FROM pg_constraint
WHERE conrelid = 're_reservations'::regclass
  AND contype = 'f'
  AND (conname LIKE '%product_id%' OR conname LIKE '%customer_id%')
ORDER BY conname;
```

**Expected Output:**
```
re_reservations_customer_id_fkey | RESTRICT
re_reservations_product_id_fkey  | RESTRICT
```

---

### Step 2: Verify FK Protection (Pre-Flight Check)

**Purpose:** Confirm migration effective before full test suite

**Script:** `scripts/bella-land/verify-actual-fk-constraints.ts`

**Run:**
```bash
npx tsx scripts/bella-land/verify-actual-fk-constraints.ts
```

**Expected Output:**
```
TEST 1: DELETE Product with active Reservation
✅ DELETE BLOCKED by FK constraint

TEST 2: DELETE Customer with active Reservation
✅ DELETE BLOCKED by FK constraint

VERDICT: FK RESTRICT constraints ARE enforced
```

**Gate:** Only proceed to Step 3 if BOTH deletes are BLOCKED.

---

### Step 3: Refactor I3 Test (Canonical Service Path)

**Issue:** Test bypasses canonical `ReservationService.reserveProduct()`

**Current Code (WRONG):**
```typescript
// Direct DB insert - bypasses domain logic
const { data: reservationData } = await supabase
  .from('re_reservations')
  .insert({
    tenant_id: tenant1Id,
    product_id: productId,
    customer_id: customerId,
    deposit_amount: 50000,
    status: 'pending_deposit',
  });
```

**Canonical Code (CORRECT):**
```typescript
// Use canonical service - domain logic executes
import { ReservationService } from '@/platform/real-estate/engines/reservation.service';
import { PropertyUnitRepository } from '@/platform/real-estate/repositories/property-unit.repository';

const repository = new PropertyUnitRepository();
const reservationService = new ReservationService(repository, supabase);

const result = await reservationService.reserveProduct({
  tenantId: tenant1Id,
  productId: productId,
  customerId: customerId,
  userId: testUserId, // Need to provide
  durationMinutes: 1440
});
```

**File to Edit:** `scripts/bella-land/test-reservation-integration.ts`

**Changes:**
1. Import ReservationService and dependencies
2. Replace I3 direct insert with service call
3. Update assertions to check service result
4. Verify Product status changes to 'reserved'

---

### Step 4: Fix I10 Test Fixture

**Issue:** Test expects Product to exist but it was deleted by I4

**Root Cause:** I4 successfully deleted Product (when it should have failed)

**Expected:** After Step 1 fix, I4 will FAIL to delete → Product persists → I10 should work

**Action:** Re-verify after Steps 1-3. If still fails, investigate fixture setup.

---

### Step 5: Full P5.2 Rerun

**Command:**
```bash
npx tsx scripts/bella-land/test-reservation-integration.ts
```

**Scope:** All 10 gates (I1-I10)

**Expected Result:**
```
✅ I1: FK constraint blocks non-existent Product
✅ I2: FK constraint blocks non-existent Customer
✅ I3: Product status synced (available → reserved)
✅ I4: FK RESTRICT blocks Product deletion
✅ I5: FK RESTRICT blocks Customer deletion
✅ I6: RLS blocks cross-tenant Product
✅ I7: RLS blocks cross-tenant Customer
✅ I8: Cross-tenant reservation blocked
✅ I9: Reservation state machine works
✅ I10: Availability check enforced

P5.2 INTEGRATION: 10/10 PASS
```

**Verdict:**
- **10/10 PASS** → P5.2 🔒 VERIFIED → Continue P5.3
- **ANY FAIL** → 🔒 FREEZE new evidence → RCA → remediate → full rerun

---

## Execution Checklist

```
[ ] Step 1: Apply FK migration via Supabase SQL Editor
[ ] Step 2: Run verify-actual-fk-constraints.ts → BOTH deletes BLOCKED
[ ] Step 3: Refactor I3 to use ReservationService
[ ] Step 4: Review I10 fixture (may auto-resolve)
[ ] Step 5: Full P5.2 rerun (10 gates)
[ ] Step 6: Document results
[ ] Step 7: If 10/10 PASS → Update RC status → Continue P5.3
```

---

## Governance Notes

**Classification:** Schema correction, not feature addition
- Canonical contract already exists
- Runtime DB was drift from contract
- Remediation = alignment, not new behavior

**Audit Trail:**
- RCA: `docs/bella-land/P5_2_RCA_CANONICAL_VERIFICATION.md`
- Evidence: `scripts/bella-land/verify-actual-fk-constraints.ts` (empirical)
- Migration: `supabase/migrations/20260911020000_apply_reservation_fk_constraints.sql`

**Quality Standard:** Full 10/10 PASS required for P5.2 verification

---

**Status:** Ready for execution  
**Next:** Apply Step 1 (FK migration)
