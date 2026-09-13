# Reservations Schema Migration - Application Instructions

**Migration:** `20260911000000_reconcile_reservations_schema.sql`  
**Purpose:** Reconcile deployed `re_reservations` schema to match core schema  
**Safety:** ✅ Table is empty (0 records), safe to apply

---

## 🎯 What This Migration Does

### Adds Missing Columns
```sql
deposit_amount    NUMERIC(15,2) DEFAULT 0
reserved_at       TIMESTAMPTZ DEFAULT NOW()
deposited_at      TIMESTAMPTZ
converted_at      TIMESTAMPTZ
cancelled_at      TIMESTAMPTZ
notes             TEXT
metadata          JSONB
created_by        UUID
updated_by        UUID
deleted_at        TIMESTAMPTZ
```

### Changes Status Column
```text
BEFORE:
- Type: TEXT with CHECK constraint
- Values: 'active', 'released', 'expired', 'converted'

AFTER:
- Type: reservation_status enum
- Values: 'pending_deposit', 'deposited', 'converted_to_contract', 'cancelled'

Mapping:
  active → pending_deposit
  converted → converted_to_contract
  released → cancelled
  expired → cancelled
```

### Makes user_id Nullable
```sql
-- Was: user_id UUID NOT NULL
-- Now: user_id UUID (optional)
```

### Updates Indexes
```sql
-- Adds indexes matching core schema:
- idx_re_reservations_tenant
- idx_re_reservations_product  
- idx_re_reservations_customer
- idx_re_reservations_status
- idx_re_reservations_deleted
```

---

## 📋 Pre-Application Checklist

- [ ] Verify table is empty (0 reservations)
- [ ] Backup database (if data exists)
- [ ] Review migration SQL
- [ ] Confirm no other processes writing to table
- [ ] Schedule maintenance window (if needed)

---

## 🚀 Application Methods

### Method 1: Supabase Dashboard (Recommended for Single Project)

1. Open Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Click: **New Query**
4. Copy contents from: `supabase/migrations/20260911000000_reconcile_reservations_schema.sql`
5. Paste into editor
6. Click: **Run**
7. Verify: "Migration verification passed" message

**Verification:**
```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 're_reservations' 
ORDER BY ordinal_position;

-- Check enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'reservation_status'::regtype;
```

---

### Method 2: Supabase CLI (Recommended for Team/CI)

```bash
# 1. Ensure migration file is in place
ls supabase/migrations/20260911000000_reconcile_reservations_schema.sql

# 2. Push migration to remote
npx supabase db push

# 3. Verify migration applied
npx supabase migration list

# 4. Regenerate TypeScript types
npx supabase gen types typescript --local > src/types/database.types.ts
```

---

### Method 3: Direct psql (Advanced)

```bash
# Requires database credentials
psql postgresql://[USER]:[PASSWORD]@[HOST]:5432/postgres \
  -f supabase/migrations/20260911000000_reconcile_reservations_schema.sql

# Verify
psql postgresql://[USER]:[PASSWORD]@[HOST]:5432/postgres \
  -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 're_reservations';"
```

---

## ✅ Post-Migration Verification

### Step 1: Check Schema
```bash
# Run verification script
npx tsx scripts/bella-land/inspect-deployed-reservation-schema.ts

# Expected: New columns visible
```

### Step 2: Regenerate Types
```bash
# Update TypeScript types
npx supabase gen types typescript --local > src/types/database.types.ts

# Or for remote:
npx supabase gen types typescript > src/types/database.types.ts
```

### Step 3: Test Reservation Creation
```bash
# Rerun blocked test
npx tsx scripts/bella-land/test-reservation-creation.ts

# Expected: Reservation created successfully
```

### Step 4: Verify Reservations
```bash
# Check database
npx tsx scripts/bella-land/verify-reservations-workflow.ts

# Expected: 1 reservation found
```

---

## 🔍 Troubleshooting

### Error: "type reservation_status already exists"
**Solution:** Migration is idempotent, error is expected if enum exists. Check NOTICE messages.

### Error: "column deposit_amount already exists"
**Solution:** Migration already applied. Skip to verification step.

### Error: "cannot change type of column status"
**Cause:** Existing data incompatible with new enum.  
**Solution:** Run data mapping step manually:
```sql
-- Check current status values
SELECT DISTINCT status FROM re_reservations;

-- Map to new enum
UPDATE re_reservations SET status = 
  CASE status
    WHEN 'active' THEN 'pending_deposit'
    WHEN 'converted' THEN 'converted_to_contract'
    ELSE 'cancelled'
  END;
```

### Error: "violates not-null constraint on user_id"
**Solution:** Migration makes user_id nullable first. If error persists, check migration order.

---

## 📊 Rollback Plan (If Needed)

**Note:** Rollback is complex due to enum type changes. Only attempt if absolutely necessary.

```sql
-- Emergency rollback (data loss possible)
BEGIN;

-- Revert status enum
ALTER TABLE re_reservations ALTER COLUMN status TYPE TEXT;
ALTER TABLE re_reservations ADD CONSTRAINT re_reservations_status_check 
  CHECK (status IN ('active', 'released', 'expired', 'converted'));

-- Restore user_id NOT NULL (only if no NULL values)
-- ALTER TABLE re_reservations ALTER COLUMN user_id SET NOT NULL;

-- Drop new columns
ALTER TABLE re_reservations 
  DROP COLUMN IF EXISTS deposit_amount,
  DROP COLUMN IF EXISTS reserved_at,
  DROP COLUMN IF EXISTS deposited_at,
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS deleted_at;

COMMIT;

-- Drop enum type
DROP TYPE IF EXISTS reservation_status;
```

**Better approach:** Restore from backup if rollback needed.

---

## 🎯 Success Criteria

After migration, verify:
- [ ] ✅ New enum type `reservation_status` exists
- [ ] ✅ Column `deposit_amount` exists  
- [ ] ✅ Column `reserved_at` exists
- [ ] ✅ Column `status` uses `reservation_status` enum
- [ ] ✅ Column `user_id` is nullable
- [ ] ✅ TypeScript types regenerated
- [ ] ✅ Reservation creation test passes
- [ ] ✅ No data loss (if table had records)

---

## 📞 Support

**If migration fails:**
1. Check error message
2. Review troubleshooting section above
3. Verify current schema state
4. Do NOT force re-run without analysis
5. Document error and schema state for review

**After successful migration:**
1. Resume runtime testing
2. Complete RLS negative suite
3. Continue Bella Land RC verification

---

**Migration Status:** ✅ Ready to apply (0 records, safe)  
**Risk Level:** 🟢 LOW (empty table, idempotent migration)  
**Estimated Time:** 30 seconds  
**Downtime Required:** None (if no active writes)
