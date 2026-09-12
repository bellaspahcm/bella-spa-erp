# Concurrency RC Blocker - Resolution

**Date:** 2026-09-11  
**Severity:** 🔴 CRITICAL (RC BLOCKER)  
**Status:** ✅ RUNTIME FIXED | 🟡 DEPLOYMENT PENDING

---

## 🔴 Finding: Double Reservation Possible

### Before Fix

**Test:** Two concurrent reservation attempts for same apartment

**Result:**
```text
Sales A: ✅ SUCCESS (50,000,000 VND)
Sales B: ✅ SUCCESS (60,000,000 VND)

Database state: 2 active reservations for ONE apartment
Both created at: 08:48:45-46 (1 second apart)
```

**Business Impact:**
- Two customers can reserve same apartment
- Double sale → contract conflict
- Financial/legal liability
- Inventory corruption

**Root Cause:**
```text
Application-level check:
  SELECT available
  → then INSERT

= Race condition between check and insert
```

**Verdict:** 🔴 **RC BLOCKER CONFIRMED**

---

## ✅ Fix Applied

### Database Invariant (Partial Unique Index)

```sql
CREATE UNIQUE INDEX idx_one_active_reservation_per_apartment
ON re_reservations (product_id, tenant_id)
WHERE status IN ('pending_deposit', 'deposited');
```

**Protection Scope:**
- `pending_deposit`: Apartment reserved, awaiting deposit
- `deposited`: Deposit received, awaiting contract

**NOT Protected:**
- `cancelled`: Inventory released (correct - no longer exclusive)
- `converted_to_contract`: Ownership transferred (inventory protection via contract/product.status)

**Why Partial Index:**
- Only active states need exclusivity
- After cancellation, apartment can be re-reserved
- After conversion, ownership protection different layer

---

## ✅ Runtime Verification

### After Fix

**Test:** Same concurrent scenario

**Result:**
```text
Sales A: ✅ SUCCESS
Sales B: ❌ FAILED
  Error: duplicate key value violates unique constraint
  Code: 23505

Database state: 1 active reservation (Sales A only)
```

**Invariant Verified:**
```text
ONE APARTMENT → AT MOST ONE ACTIVE RESERVATION ✅
```

**Test Evidence:**
- Script: `scripts/bella-land/test-reservation-concurrency.ts`
- Duration: 250ms (true concurrent execution)
- Cleanup: Verified (2 deleted after test)
- Result: ✅ PASSED

---

## 📊 Evidence Boundaries

### What Was Verified

✅ **Runtime protection works**
- Concurrent INSERT attempts
- Database enforces uniqueness
- Second attempt blocked with constraint violation
- Exactly ONE reservation in final state

✅ **Fix is at correct layer**
- Database transaction boundary (not application)
- Atomic constraint enforcement
- No race condition possible

### What Was NOT Verified

⏸️ **Deployment reproducibility**
```text
Index created on live DB         ✅
Index in migration file           ?
Clean environment can reproduce   ?
Team members have same index      ?
```

⏸️ **Business rule confirmation**
```text
Scope: pending_deposit + deposited     ✅ IMPLEMENTED
Confirmed with business owner          ?
converted_to_contract exclusion OK     ?
```

---

## 🟡 Remaining Work

### 1. Migration File (REQUIRED for RC)

**Create:**
```sql
-- Migration: supabase/migrations/20260911010000_add_reservation_concurrency_protection.sql

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_reservation_per_apartment
ON re_reservations (product_id, tenant_id)
WHERE status IN ('pending_deposit', 'deposited');

COMMENT ON INDEX idx_one_active_reservation_per_apartment IS 
  'Prevents double-reservation: one apartment can have at most one active reservation';
```

**Test on clean environment:**
```bash
# 1. Fresh DB
npx supabase db reset

# 2. Apply all migrations
npx supabase migration up

# 3. Verify index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'idx_one_active_reservation_per_apartment';

# 4. Rerun concurrency test
npx tsx scripts/bella-land/test-reservation-concurrency.ts
```

**Success Criteria:**
- Index created automatically
- Concurrency test passes
- No manual intervention needed

### 2. Business Rule Documentation

**Confirm with product owner:**
- Q: Can apartment have multiple `deposited` reservations?
  - Current: NO (enforced by index)
  - Expected: ?

- Q: After `converted_to_contract`, can apartment be reserved again?
  - Current: YES (index allows it)
  - Expected: ?

- Q: Should `cancelled` → `pending_deposit` transition be allowed?
  - Current: YES (index allows different reservation after cancellation)
  - Expected: ?

---

## 📈 Status Progression

```text
CONCURRENCY BLOCKER

Before test:
└─ Unknown          ⚠️  (assumed safe)

After test (before fix):
└─ BLOCKER          🔴 CONFIRMED (2 reservations created)

After fix (runtime):
└─ RUNTIME FIXED    ✅ (1 reservation, 1 blocked)

Current:
├─ Runtime          ✅ VERIFIED
├─ Migration file   🟡 PENDING
└─ Clean env test   🟡 PENDING

RC-Ready:
├─ Runtime          ✅
├─ Migration        ✅
├─ Clean env        ✅
└─ Deployment safe  ✅
```

---

## 🏭 Factory Incident Evidence

### Pattern Identified

**Application-level exclusive resource check is insufficient:**

```text
❌ INSUFFICIENT:
check_available()
→ sleep/process
→ create_reservation()

✅ REQUIRED:
Transactional boundary enforcement
(unique constraint, optimistic locking, or DB trigger)
```

**Candidate Factory Rule:**
> "Exclusive business resources (inventory, slots, seats, etc.) MUST enforce exclusivity at database transaction boundary, not application logic."

**This incident provides evidence for:**
- Race condition vulnerability pattern
- Fix verification methodology (concurrent test)
- Correct layer for invariant enforcement

**Recommendation:** Track as post-RC Factory governance incident, NOT gate immediately.

---

## ✅ Resolution Checklist

RC-ready when:

- [x] Runtime protection verified (concurrency test passes)
- [ ] Migration file created
- [ ] Clean environment tested
- [ ] Business rules confirmed
- [ ] Deployment reproducibility verified

**Current:** 1/5 complete

**Estimated:** 30 minutes to complete remaining items

---

## 🎯 Business Rule Verification Questions

**For product owner / domain expert:**

1. **Deposit workflow:**
   ```text
   Customer A: pending_deposit
   Customer B tries: Should be blocked? ✅ YES (enforced)
   ```

2. **After cancellation:**
   ```text
   Reservation A: cancelled
   Customer B tries: Should succeed? Expected: YES (allowed)
   ```

3. **After conversion:**
   ```text
   Reservation A: converted_to_contract
   Customer B tries: Should be blocked? Expected: NO (apartment sold)
   
   BUT: Protection may be via apartment.status = 'sold', not reservation table
   ```

4. **Edge case - deposit timeout:**
   ```text
   Reservation A: pending_deposit (expired)
   System/cron: Should auto-cancel? 
   Then: Customer B can create new reservation
   ```

**Recommendation:** Document business rules before RC seal.

---

**Resolution Quality:** ✅ Evidence-based, runtime verified

**Deployment Ready:** 🟡 Migration file required

**RC Blocker:** ✅ RUNTIME RESOLVED | 🟡 DEPLOYMENT PENDING
