-- ============================================================================
-- Minimal Canonical Forward Patch - re_reservations
-- ============================================================================
-- Purpose: Align live table to canonical contract (reservation_status enum)
-- Scope: ONLY re_reservations, ONLY 5 identified blockers
-- Safe: 0 rows in table (verified 2026-09-11)
-- Does NOT: Touch migration history, other tables, or unrelated schema
-- ============================================================================

-- PRECONDITION CHECK
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM re_reservations;
  
  IF row_count > 0 THEN
    RAISE EXCEPTION '❌ PRECONDITION FAILED: Table has % rows. This patch requires 0 rows.', row_count;
  END IF;
  
  RAISE NOTICE '✅ Precondition met: 0 rows in re_reservations';
END $$;

-- ============================================================================
-- BLOCKER 1: Add deposit_amount
-- ============================================================================
ALTER TABLE re_reservations 
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(15,2) DEFAULT 0;

-- ============================================================================
-- BLOCKER 2: Add notes
-- ============================================================================
ALTER TABLE re_reservations 
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- BLOCKER 3: user_id NOT NULL → nullable
-- ============================================================================
ALTER TABLE re_reservations 
  ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- BLOCKER 4: customer_id nullable → NOT NULL
-- ============================================================================
-- Safe: 0 rows means no existing NULL values to violate constraint
ALTER TABLE re_reservations 
  ALTER COLUMN customer_id SET NOT NULL;

-- ============================================================================
-- BLOCKER 5: status enum re_reservation_status → reservation_status
-- ============================================================================
-- Step 5a: Drop old default (prevents cast error)
ALTER TABLE re_reservations 
  ALTER COLUMN status DROP DEFAULT;

-- Step 5b: Change column type with value mapping
ALTER TABLE re_reservations 
  ALTER COLUMN status TYPE reservation_status 
  USING (
    CASE status::text
      WHEN 'active' THEN 'pending_deposit'::reservation_status
      WHEN 'converted' THEN 'converted_to_contract'::reservation_status
      WHEN 'released' THEN 'cancelled'::reservation_status
      WHEN 'expired' THEN 'cancelled'::reservation_status
      ELSE 'pending_deposit'::reservation_status -- fallback (shouldn't happen with 0 rows)
    END
  );

-- Step 5c: Set new default
ALTER TABLE re_reservations 
  ALTER COLUMN status SET DEFAULT 'pending_deposit'::reservation_status;

-- ============================================================================
-- POST-PATCH VERIFICATION
-- ============================================================================
DO $$
DECLARE
  col_type TEXT;
  col_nullable TEXT;
  col_exists INTEGER;
BEGIN
  -- Verify deposit_amount exists
  SELECT COUNT(*) INTO col_exists
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' AND column_name = 'deposit_amount';
  
  IF col_exists = 0 THEN
    RAISE EXCEPTION '❌ deposit_amount column not added';
  END IF;
  RAISE NOTICE '✅ deposit_amount column exists';

  -- Verify notes exists
  SELECT COUNT(*) INTO col_exists
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' AND column_name = 'notes';
  
  IF col_exists = 0 THEN
    RAISE EXCEPTION '❌ notes column not added';
  END IF;
  RAISE NOTICE '✅ notes column exists';

  -- Verify user_id is nullable
  SELECT is_nullable INTO col_nullable
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' AND column_name = 'user_id';
  
  IF col_nullable != 'YES' THEN
    RAISE EXCEPTION '❌ user_id is not nullable';
  END IF;
  RAISE NOTICE '✅ user_id is nullable';

  -- Verify customer_id is NOT NULL
  SELECT is_nullable INTO col_nullable
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' AND column_name = 'customer_id';
  
  IF col_nullable != 'NO' THEN
    RAISE EXCEPTION '❌ customer_id is nullable';
  END IF;
  RAISE NOTICE '✅ customer_id is NOT NULL';

  -- Verify status uses reservation_status enum
  SELECT udt_name INTO col_type
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' AND column_name = 'status';
  
  IF col_type != 'reservation_status' THEN
    RAISE EXCEPTION '❌ status column uses wrong enum: %', col_type;
  END IF;
  RAISE NOTICE '✅ status uses reservation_status enum';

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ ALL VERIFICATIONS PASSED';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- POST-PATCH SCHEMA INSPECTION
-- ============================================================================
-- Run this to confirm final state:

SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 're_reservations' 
  AND column_name IN (
    'status', 
    'deposit_amount', 
    'notes', 
    'user_id', 
    'customer_id'
  )
ORDER BY column_name;

-- Expected output:
-- customer_id     | uuid         | uuid                  | NO  | null
-- deposit_amount  | numeric      | numeric               | YES | 0
-- notes           | text         | text                  | YES | null
-- status          | USER-DEFINED | reservation_status    | NO  | 'pending_deposit'::reservation_status
-- user_id         | uuid         | uuid                  | YES | null

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. Old enum (re_reservation_status) NOT dropped
--    - May be used by other tables
--    - Cleanup is post-RC governance debt
--
-- 2. This patch does NOT update migration ledger
--    - Tracked as manual fix
--    - Migration history remains inconsistent (40+ diverged)
--    - Governance debt tracked separately
--
-- 3. Scope limited to workflow unblock
--    - ONLY re_reservations table
--    - ONLY 5 identified blockers
--    - No other schema changes
--
-- 4. Next steps after patch:
--    - Verify schema (query above)
--    - Regenerate types: npx supabase gen types typescript
--    - Test: npx tsx scripts/bella-land/test-reservation-creation.ts
--    - Verify: Check created reservation has correct status/deposit_amount
--
-- ============================================================================
