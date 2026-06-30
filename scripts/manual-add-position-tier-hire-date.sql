-- ============================================================================
-- MANUAL SCRIPT: Add position_tier and hire_date to users table
-- ============================================================================
-- Purpose: Tasks 18-19 - Position Tier & Hire Date for Commission System
-- Migration: 20260630192732_add_position_tier_hire_date_to_users.sql
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run" button
-- 4. Verify success message
-- ============================================================================

-- Step 1: Add position_tier column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'position_tier'
  ) THEN
    ALTER TABLE public.users
    ADD COLUMN position_tier TEXT CHECK (position_tier IN ('junior', 'senior', 'lead'));
    
    RAISE NOTICE '✓ Added position_tier column';
  ELSE
    RAISE NOTICE '⊘ position_tier column already exists';
  END IF;
END $$;

-- Step 2: Add hire_date column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'hire_date'
  ) THEN
    ALTER TABLE public.users
    ADD COLUMN hire_date DATE;
    
    RAISE NOTICE '✓ Added hire_date column';
  ELSE
    RAISE NOTICE '⊘ hire_date column already exists';
  END IF;
END $$;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN public.users.position_tier IS 'Position tier for KTV staff (junior/senior/lead) - affects commission multiplier';
COMMENT ON COLUMN public.users.hire_date IS 'Date when employee was hired - used for seniority bonus calculation';

RAISE NOTICE '✓ Added column comments';

-- Step 4: Create index for position_tier (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND indexname = 'idx_users_position_tier'
  ) THEN
    CREATE INDEX idx_users_position_tier ON public.users(position_tier) WHERE position_tier IS NOT NULL;
    RAISE NOTICE '✓ Created index idx_users_position_tier';
  ELSE
    RAISE NOTICE '⊘ Index idx_users_position_tier already exists';
  END IF;
END $$;

-- Step 5: Create index for hire_date (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND indexname = 'idx_users_hire_date'
  ) THEN
    CREATE INDEX idx_users_hire_date ON public.users(hire_date) WHERE hire_date IS NOT NULL;
    RAISE NOTICE '✓ Created index idx_users_hire_date';
  ELSE
    RAISE NOTICE '⊘ Index idx_users_hire_date already exists';
  END IF;
END $$;

-- Step 6: Verify columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('position_tier', 'hire_date')
ORDER BY column_name;

-- Expected output:
-- column_name   | data_type | is_nullable | column_default
-- --------------|-----------|-------------|---------------
-- hire_date     | date      | YES         | NULL
-- position_tier | text      | YES         | NULL

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if columns are accessible (should return 0 rows if no data yet)
SELECT id, full_name, position_tier, hire_date 
FROM public.users 
WHERE position_tier IS NOT NULL OR hire_date IS NOT NULL
LIMIT 5;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND indexname LIKE 'idx_users_position%'
  OR indexname LIKE 'idx_users_hire%';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run: npm run types:generate (regenerate database types)';
  RAISE NOTICE '2. Edit KTV user in /dashboard/settings?tab=staff';
  RAISE NOTICE '3. Set Position Tier (Junior/Senior/Lead)';
  RAISE NOTICE '4. Set Hire Date';
  RAISE NOTICE '5. Verify salary recalculation works';
  RAISE NOTICE '';
END $$;
