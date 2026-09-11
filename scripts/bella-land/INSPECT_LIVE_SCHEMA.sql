-- ============================================================================
-- Live Schema Inspection - re_reservations
-- ============================================================================
-- Purpose: Build evidence matrix for minimal safe fix
-- Run via: Supabase Dashboard > SQL Editor
-- ============================================================================

-- STEP 1: List ALL columns with types and constraints
-- ============================================================================
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 're_reservations'
ORDER BY ordinal_position;

-- Expected output: Full column list with types
-- Key columns to check:
--   - deposit_amount (should exist for service, may not exist in current schema)
--   - status (check if TEXT or enum)
--   - user_id (check if nullable)
--   - created_by, updated_by (may not exist)
--   - deposited_at, converted_at, cancelled_at (may not exist)


-- STEP 2: Check if reservation_status enum exists
-- ============================================================================
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('reservation_status', 're_reservation_status')
ORDER BY t.typname, e.enumsortorder;

-- Expected:
--   If exists: reservation_status with values (pending_deposit, deposited, etc.)
--   If not: status column likely TEXT with CHECK constraint


-- STEP 3: Check TEXT status constraint (if enum doesn't exist)
-- ============================================================================
SELECT 
  cc.constraint_name,
  cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu 
  ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 're_reservations' 
  AND ccu.column_name = 'status';

-- Expected: CHECK constraint with allowed values
-- Example: (status IN ('active', 'released', 'expired', 'converted'))


-- STEP 4: Foreign key constraints
-- ============================================================================
SELECT 
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name = 're_reservations';

-- Expected: product_id → re_products, customer_id → re_customers, etc.


-- STEP 5: Indexes
-- ============================================================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 're_reservations'
ORDER BY indexname;

-- Expected: Indexes on tenant_id, product_id, customer_id, status, etc.


-- STEP 6: Table row count (to confirm live state)
-- ============================================================================
SELECT COUNT(*) as record_count FROM re_reservations;

-- Purpose: Verify current data state before schema changes


-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
--
-- SCENARIO A: deposit_amount exists, status is enum
--   → Schema closer to target, minimal fix needed
--   → May only need to adjust enum values or add missing columns
--
-- SCENARIO B: deposit_amount missing, status is TEXT
--   → Schema matches old 20260801020000
--   → Need to add deposit_amount, possibly convert status
--
-- SCENARIO C: Hybrid (some new columns, some old)
--   → Partial migration applied
--   → Need targeted additions for missing pieces
--
-- ============================================================================
-- EVIDENCE MATRIX TEMPLATE
-- ============================================================================
--
-- Column/Rule         Live DB          Service Needs      Action
-- -----------------------------------------------------------------
-- deposit_amount      [EXISTS/MISSING] NUMERIC DEFAULT 0  [ADD/SKIP]
-- status type         [TEXT/ENUM]      reservation_status [CONVERT/SKIP]
-- status values       [list]           [pending_deposit...] [MAP/CREATE]
-- user_id nullable    [YES/NO]         YES                [ALTER/SKIP]
-- created_by          [EXISTS/MISSING] UUID nullable      [ADD/SKIP]
-- updated_by          [EXISTS/MISSING] UUID nullable      [ADD/SKIP]
-- deposited_at        [EXISTS/MISSING] TIMESTAMPTZ null   [ADD/SKIP]
-- converted_at        [EXISTS/MISSING] TIMESTAMPTZ null   [ADD/SKIP]
-- cancelled_at        [EXISTS/MISSING] TIMESTAMPTZ null   [ADD/SKIP]
-- notes               [EXISTS/MISSING] TEXT null          [ADD/SKIP]
-- metadata            [EXISTS/MISSING] JSONB null         [ADD/SKIP]
--
-- ============================================================================
-- DECISION CRITERIA
-- ============================================================================
--
-- MUST FIX (blocks runtime):
--   - Missing columns that service CREATE uses
--   - Status enum mismatch (if service expects specific enum values)
--   - NOT NULL constraints that block service logic
--
-- CAN DEFER (doesn't block first test):
--   - Missing optional columns service doesn't use yet
--   - Index optimizations
--   - Constraint renaming
--
-- ============================================================================
