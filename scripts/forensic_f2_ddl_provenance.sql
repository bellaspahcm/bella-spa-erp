-- =============================================================================
-- E4: F2 DDL Provenance Verification
-- Created: 2026-08-24
-- 
-- Purpose: Verify if 20260824000000_f2_cash_effective_date DDL already exists
-- on remote database (applied but not recorded in migration history)
-- 
-- READ-ONLY: No modifications
-- =============================================================================

-- Step 1: Check if f2_cash_effective_date column exists
-- Expected: column exists in finance_cash_movements table

SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'finance_transactions'
  AND table_name = 'finance_cash_movements'
  AND column_name = 'effective_date'
ORDER BY ordinal_position;

-- Step 2: Check if related functions/triggers exist
-- (Replace with actual function names from F2 migration if any)

SELECT 
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'finance_transactions'
  AND routine_name LIKE '%effective_date%'
ORDER BY routine_name;

-- Step 3: Check if indexes related to effective_date exist

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'finance_transactions'
  AND tablename = 'finance_cash_movements'
  AND indexdef LIKE '%effective_date%'
ORDER BY indexname;

-- Step 4: Verify column constraints

SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'finance_transactions'
  AND tc.table_name = 'finance_cash_movements'
  AND kcu.column_name = 'effective_date';

-- =============================================================================
-- Expected Results:
-- 
-- CASE A: F2 DDL already applied
-- - effective_date column EXISTS
-- - data_type = date (or timestamptz)
-- - Possibly NOT NULL with default
-- - Related indexes/constraints may exist
-- 
-- CASE B: F2 DDL NOT applied
-- - effective_date column DOES NOT EXIST
-- - No related indexes/constraints
-- 
-- =============================================================================
-- 
-- If CASE A (DDL exists):
--   → F2 was applied without migration history record
--   → Can safely DELETE 20260824000000_f2_cash_effective_date.sql
--   → Or RECORD its history and DELETE local file
--   → RPC can own version 20260824000000
-- 
-- If CASE B (DDL missing):
--   → F2 is a genuine pending migration
--   → Must deploy F2 BEFORE RPC
--   → RPC must use version 20260824000001 or later
--   → Step 2 Gate cannot pass with only RPC
-- 
-- =============================================================================
