-- ============================================================================
-- Bella Land - Reservations Schema Reconciliation
-- Phase 2B Runtime Patches - Forward Migration
-- Date: 2026-09-11
-- ============================================================================
--
-- CRITICAL: This migration matches the ACTUAL patches applied via CLI
-- Evidence: docs/bella-land/PHASE_2B_RUNTIME_VERIFIED.md
--
-- Patches Applied (7 total):
-- 1. Status enum conversion (re_reservation_status → reservation_status)
-- 2. ADD deposit_amount
-- 3. ADD notes
-- 4. user_id NOT NULL → NULLABLE
-- 5. customer_id NULLABLE → NOT NULL
-- 6. expires_at NOT NULL → NULLABLE
-- 7. FK fix (customer_id → re_customers)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- PRECONDITION: Create reservation_status enum if not exists
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'pending_deposit',
    'deposited',
    'converted_to_contract',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN 
    RAISE NOTICE 'Type reservation_status already exists, skipping';
END $$;

-- ============================================================================
-- PATCH 1: Convert status column to reservation_status enum
-- ============================================================================

-- Drop DEFAULT temporarily for type conversion
ALTER TABLE re_reservations 
  ALTER COLUMN status DROP DEFAULT;

-- Convert type with CASE mapping
-- Old enum (re_reservation_status): active, released, expired, converted
-- New enum (reservation_status): pending_deposit, deposited, converted_to_contract, cancelled
ALTER TABLE re_reservations 
  ALTER COLUMN status TYPE reservation_status 
  USING (
    CASE status::text
      WHEN 'active' THEN 'pending_deposit'::reservation_status
      WHEN 'converted' THEN 'converted_to_contract'::reservation_status
      WHEN 'released' THEN 'cancelled'::reservation_status
      WHEN 'expired' THEN 'cancelled'::reservation_status
      ELSE 'pending_deposit'::reservation_status
    END
  );

-- Restore DEFAULT with new enum
ALTER TABLE re_reservations 
  ALTER COLUMN status SET DEFAULT 'pending_deposit'::reservation_status;

-- ============================================================================
-- PATCH 2: ADD deposit_amount
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE re_reservations 
    ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(15, 2) DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN 
    RAISE NOTICE 'Column deposit_amount already exists';
END $$;

-- ============================================================================
-- PATCH 3: ADD notes
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE re_reservations 
    ADD COLUMN IF NOT EXISTS notes TEXT;
EXCEPTION
  WHEN duplicate_column THEN 
    RAISE NOTICE 'Column notes already exists';
END $$;

-- ============================================================================
-- PATCH 4: user_id NOT NULL → NULLABLE
-- ============================================================================

ALTER TABLE re_reservations 
  ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- PATCH 5: customer_id NULLABLE → NOT NULL
-- ============================================================================

-- Note: Requires all existing rows have customer_id populated
-- If table has 0 rows, this is safe
-- If table has rows with NULL customer_id, this will FAIL (correct behavior)

ALTER TABLE re_reservations 
  ALTER COLUMN customer_id SET NOT NULL;

-- ============================================================================
-- PATCH 6: expires_at NOT NULL → NULLABLE
-- ============================================================================

ALTER TABLE re_reservations 
  ALTER COLUMN expires_at DROP NOT NULL;

-- ============================================================================
-- PATCH 7: Fix FK constraint (customer_id → re_customers)
-- ============================================================================

-- Drop old FK if exists
ALTER TABLE re_reservations 
  DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;

-- Create correct FK to re_customers
ALTER TABLE re_reservations 
  ADD CONSTRAINT re_reservations_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES re_customers(id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  status_enum_type regtype;
  deposit_exists boolean;
  notes_exists boolean;
  user_nullable boolean;
  customer_not_null boolean;
  expires_nullable boolean;
BEGIN
  -- Check status column uses reservation_status enum
  SELECT atttypid::regtype INTO status_enum_type
  FROM pg_attribute 
  WHERE attrelid = 're_reservations'::regclass 
    AND attname = 'status';
  
  IF status_enum_type != 'reservation_status'::regtype THEN
    RAISE EXCEPTION 'Status column type mismatch: expected reservation_status, got %', status_enum_type;
  END IF;
  
  -- Check deposit_amount exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 're_reservations' 
      AND column_name = 'deposit_amount'
  ) INTO deposit_exists;
  
  IF NOT deposit_exists THEN
    RAISE EXCEPTION 'deposit_amount column missing';
  END IF;
  
  -- Check notes exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 're_reservations' 
      AND column_name = 'notes'
  ) INTO notes_exists;
  
  IF NOT notes_exists THEN
    RAISE EXCEPTION 'notes column missing';
  END IF;
  
  -- Check user_id is nullable
  SELECT is_nullable = 'YES' INTO user_nullable
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' 
    AND column_name = 'user_id';
  
  IF NOT user_nullable THEN
    RAISE EXCEPTION 'user_id should be nullable';
  END IF;
  
  -- Check customer_id is NOT NULL
  SELECT is_nullable = 'NO' INTO customer_not_null
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' 
    AND column_name = 'customer_id';
  
  IF NOT customer_not_null THEN
    RAISE EXCEPTION 'customer_id should be NOT NULL';
  END IF;
  
  -- Check expires_at is nullable
  SELECT is_nullable = 'YES' INTO expires_nullable
  FROM information_schema.columns 
  WHERE table_name = 're_reservations' 
    AND column_name = 'expires_at';
  
  IF NOT expires_nullable THEN
    RAISE EXCEPTION 'expires_at should be nullable';
  END IF;
  
  RAISE NOTICE '✅ Migration verification PASSED: All 7 patches applied correctly';
END $$;

COMMIT;

-- ============================================================================
-- Post-Migration Actions (MANUAL)
-- ============================================================================
-- 
-- 1. Apply concurrency protection:
--    See: 20260911010000_add_reservation_concurrency_protection.sql
-- 
-- 2. Regenerate TypeScript types:
--    npx supabase gen types typescript --linked > src/types/supabase.ts
-- 
-- 3. Verify with tests:
--    npx tsx scripts/bella-land/test-reservation-creation.ts
--    npx tsx scripts/bella-land/test-field-semantics.ts
-- 
-- ============================================================================

-- ============================================================================
-- Evidence Trail
-- ============================================================================
--
-- Live DB patches applied: 2026-09-11
-- Evidence: docs/bella-land/PHASE_2B_RUNTIME_VERIFIED.md
--
-- Status enum mapping:
--   active → pending_deposit
--   converted → converted_to_contract
--   released → cancelled
--   expired → cancelled
--
-- Fields added:
--   deposit_amount NUMERIC(15,2) DEFAULT 0
--   notes TEXT
--
-- Constraints modified:
--   user_id: NOT NULL → NULLABLE
--   customer_id: NULLABLE → NOT NULL
--   expires_at: NOT NULL → NULLABLE
--
-- FK fixed:
--   customer_id → re_customers(id)
--
-- ============================================================================
