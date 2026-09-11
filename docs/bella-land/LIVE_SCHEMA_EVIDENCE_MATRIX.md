# Live Schema Evidence Matrix - re_reservations

**Date:** 2026-09-11  
**Source:** Supabase Production Database  
**Record Count:** 0 (safe to modify)

---

## 📊 Evidence Matrix

| Column/Rule | Live DB | Service Needs | Match? | Action Required |
|-------------|---------|---------------|--------|-----------------|
| **id** | uuid NOT NULL, uuid_generate_v4() | uuid NOT NULL | ✅ | None |
| **tenant_id** | uuid NOT NULL | uuid NOT NULL | ✅ | None |
| **product_id** | uuid NOT NULL | uuid NOT NULL | ✅ | None |
| **user_id** | uuid NOT NULL | uuid **nullable** | ❌ | **ALTER to nullable** |
| **customer_id** | uuid **nullable** | uuid NOT NULL | ❌ | **ALTER to NOT NULL** |
| **status type** | re_reservation_status | reservation_status | ❌ | **Change enum type** |
| **status default** | 'active' | 'pending_deposit' | ❌ | **Change default** |
| **deposit_amount** | **MISSING** | NUMERIC(15,2) DEFAULT 0 | ❌ | **ADD COLUMN** |
| **notes** | **MISSING** | TEXT nullable | ❌ | **ADD COLUMN** |
| expires_at | timestamptz NOT NULL | timestamptz (used) | ⚠️ | Keep (nullability OK) |
| reserved_at | timestamptz nullable, now() | timestamptz | ✅ | None |
| deposited_at | timestamptz nullable | timestamptz nullable | ✅ | None |
| converted_at | timestamptz nullable | timestamptz nullable | ✅ | None |
| cancelled_at | timestamptz nullable | timestamptz nullable | ✅ | None |
| metadata | jsonb nullable, '{}' | jsonb nullable | ✅ | None |
| created_at | timestamptz nullable, now() | timestamptz | ✅ | None |
| updated_at | timestamptz nullable, now() | timestamptz | ✅ | None |
| created_by | uuid nullable | uuid nullable | ✅ | None |
| updated_by | uuid nullable | uuid nullable | ✅ | None |
| deleted_at | timestamptz nullable | timestamptz nullable | ✅ | None |

---

## 🔴 Critical Blockers (MUST FIX)

### 1. Status Enum Type Mismatch
```text
LIVE:    status re_reservation_status NOT NULL DEFAULT 'active'
SERVICE: status reservation_status NOT NULL DEFAULT 'pending_deposit'

Problem: Column uses old enum, service uses new enum
Impact:  INSERT will fail with "invalid input value for enum"

Enum values comparison:
OLD (re_reservation_status):  active, released, expired, converted
NEW (reservation_status):     pending_deposit, deposited, converted_to_contract, cancelled

Status: BLOCKER ❌
```

### 2. Missing deposit_amount
```text
LIVE:    Column does not exist
SERVICE: Uses deposit_amount in INSERT (defaults to 0)

Problem: Column missing
Impact:  INSERT will fail with "column does not exist"

Status: BLOCKER ❌
```

### 3. user_id NOT NULL Constraint
```text
LIVE:    user_id uuid NOT NULL
SERVICE: Expects user_id to be nullable (optional field)

Problem: Service may not always provide user_id
Impact:  INSERT without user_id will fail with NOT NULL violation

Status: BLOCKER ❌
```

### 4. customer_id Nullable (Wrong)
```text
LIVE:    customer_id uuid nullable
SERVICE: Expects customer_id NOT NULL (required foreign key)

Problem: Missing NOT NULL constraint
Impact:  Data integrity (reservations without customers possible)

Status: DATA INTEGRITY ISSUE ⚠️ (doesn't block INSERT but violates contract)
```

### 5. Missing notes Column
```text
LIVE:    Column does not exist
SERVICE: May use notes field

Problem: Column missing
Impact:  INSERT with notes will fail

Status: POSSIBLE BLOCKER ❌ (if service uses it in CREATE)
```

---

## ✅ Non-Blocking (Already Correct)

- id, tenant_id, product_id (correct types, constraints)
- Timestamp columns (reserved_at, deposited_at, converted_at, cancelled_at)
- Audit fields (created_by, updated_by, created_at, updated_at, deleted_at)
- metadata (jsonb with default '{}')

---

## 🎯 Minimal Fix Strategy

### Option A: Change Enum Type (COMPLEX)
```sql
-- Convert status column to new enum
ALTER TABLE re_reservations 
  ALTER COLUMN status TYPE reservation_status 
  USING (
    CASE status::text
      WHEN 'active' THEN 'pending_deposit'::reservation_status
      WHEN 'converted' THEN 'converted_to_contract'::reservation_status
      WHEN 'released' THEN 'cancelled'::reservation_status
      WHEN 'expired' THEN 'cancelled'::reservation_status
    END
  );

-- Change default
ALTER TABLE re_reservations 
  ALTER COLUMN status SET DEFAULT 'pending_deposit'::reservation_status;
```

**Pros:** Aligns with target schema  
**Cons:** Complex, risky with enum conversion  
**Safe?:** 🟡 Medium risk (0 rows helps, but enum changes tricky)

### Option B: Adapt Service to Old Enum (PRAGMATIC)
```typescript
// In ReservationService, map to old enum
const statusMap = {
  'pending_deposit': 'active',
  'deposited': 'active', // or new state
  'converted_to_contract': 'converted',
  'cancelled': 'released'
};
```

**Pros:** No schema change, fast  
**Cons:** Service uses wrong enum (technical debt)  
**Safe?:** ✅ Low risk

### Option C: Hybrid - Add Missing Columns, Keep Old Enum
```sql
-- Add missing columns
ALTER TABLE re_reservations ADD COLUMN deposit_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE re_reservations ADD COLUMN notes TEXT;

-- Fix nullability
ALTER TABLE re_reservations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE re_reservations ALTER COLUMN customer_id SET NOT NULL;

-- Adapt service to use old enum
```

**Pros:** Minimal schema change, unblocks workflow  
**Cons:** Status enum mismatch remains (debt)  
**Safe?:** ✅ Low risk

---

## 📋 Recommended Path: **Option C (Hybrid)**

**Rationale:**
1. Enum conversion is RISKY (even with 0 rows, enum types are tricky)
2. Adding columns is SAFE
3. Nullability changes are SAFE (0 rows)
4. Service can adapt to old enum with minimal code change
5. Track enum migration as post-RC debt

**Implementation:**
1. Apply schema patch (add columns, fix nullability)
2. Adapt ReservationService to use old enum values
3. Test reservation creation
4. Document enum debt for post-RC cleanup

---

## 🔧 Targeted SQL Patch (Option C)

```sql
-- ============================================================================
-- Minimal Forward Fix - Reservation Workflow Unblock
-- ============================================================================
-- Purpose: Add missing columns and fix nullability
-- Does NOT: Convert enum (tracked as post-RC debt)
-- Safe: 0 rows in table
-- ============================================================================

BEGIN;

-- 1. Add missing deposit_amount
ALTER TABLE re_reservations 
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(15,2) DEFAULT 0;

-- 2. Add missing notes
ALTER TABLE re_reservations 
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Fix user_id nullability (should be optional)
ALTER TABLE re_reservations 
  ALTER COLUMN user_id DROP NOT NULL;

-- 4. Fix customer_id nullability (should be required)
ALTER TABLE re_reservations 
  ALTER COLUMN customer_id SET NOT NULL;

-- Verification
DO $$
BEGIN
  -- Check deposit_amount exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 're_reservations' AND column_name = 'deposit_amount'
  ) THEN
    RAISE EXCEPTION 'deposit_amount column not added';
  END IF;

  -- Check notes exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 're_reservations' AND column_name = 'notes'
  ) THEN
    RAISE EXCEPTION 'notes column not added';
  END IF;

  RAISE NOTICE '✅ Schema patch applied successfully';
END $$;

COMMIT;

-- Post-patch verification
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns
WHERE table_name = 're_reservations' 
  AND column_name IN ('deposit_amount', 'notes', 'user_id', 'customer_id')
ORDER BY column_name;
```

---

## 📝 Service Adaptation Required

### Before (Blocked)
```typescript
status: 'pending_deposit' as const  // ❌ Wrong enum
```

### After (Unblocked)
```typescript
// Map to old enum temporarily
const STATUS_MAP = {
  PENDING: 'active',
  DEPOSITED: 'active', 
  CONVERTED: 'converted',
  CANCELLED: 'released'
} as const;

status: STATUS_MAP.PENDING  // ✅ Uses old enum
```

---

## 🎯 Post-RC Debt

### Enum Migration (Deferred)
```text
Issue: Table uses re_reservation_status, service expects reservation_status
Impact: Service must adapt, not using semantic enum values
Priority: Medium
Effort: 2-4 hours (enum conversion + data migration)
Risk: Medium (enum changes always risky)

Resolution:
1. Create migration to convert enum type
2. Map old values to new values
3. Update service to use new enum
4. Test thoroughly on staging
5. Apply to production
6. Drop old enum type
```

---

## ✅ Success Criteria

After applying Option C patch:

- [ ] deposit_amount column exists
- [ ] notes column exists
- [ ] user_id is nullable
- [ ] customer_id is NOT NULL
- [ ] Service adapted to old enum
- [ ] Reservation creation test passes
- [ ] No data corruption (0 rows helps)

---

**Recommendation:** Apply Option C patch immediately

**Estimated time:** 15 minutes (patch + service change + test)

**Risk level:** 🟢 LOW (0 rows, additive changes, safe nullability fixes)
