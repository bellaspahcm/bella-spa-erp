-- ============================================
-- Migration: Extend users table for position tier
-- Date: 2026-06-22 17:10:00
-- Epic: Advanced Commission System - Position Tier for Commission Multipliers
-- ============================================
--
-- Purpose:
-- Add position_tier column to users table to support position-based commission multipliers.
-- Used primarily for Beauty Spa KTV position hierarchy but applicable to all modules.
--
-- Business Rules:
-- 1. Position tiers: 'junior', 'senior', 'lead'
-- 2. Commission multipliers:
--    - Junior: 1.0x (baseline)
--    - Senior: 1.2x (20% higher)
--    - Lead: 1.5x (50% higher)
-- 3. Defaults to 'junior' for backward compatibility
-- 4. Only applies to service_commission calculation (not base_salary or other bonuses)
-- 5. Module-agnostic: All modules can use this field
--
-- Position Tier Definitions:
-- - Junior (Nhân viên mới/cấp thấp): 0-1 year experience, learning phase
-- - Senior (Nhân viên chính thức): 1-3 years experience, proven skills
-- - Lead (Trưởng ca/Kỹ thuật viên chính): 3+ years experience, mentorship role

-- Add position_tier column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS position_tier TEXT DEFAULT 'junior' CHECK (position_tier IN ('junior', 'senior', 'lead'));

-- Add hire_date column for seniority calculation (if not exists)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Backfill position_tier for existing users (default to 'junior')
UPDATE public.users
SET position_tier = COALESCE(position_tier, 'junior')
WHERE position_tier IS NULL;

-- Make position_tier NOT NULL after backfilling
ALTER TABLE public.users
  ALTER COLUMN position_tier SET NOT NULL;

-- Create index for position tier queries
CREATE INDEX IF NOT EXISTS idx_users_position_tier
  ON public.users (tenant_id, position_tier)
  WHERE position_tier IS NOT NULL;

-- Create index for hire date (for seniority bonus calculation)
CREATE INDEX IF NOT EXISTS idx_users_hire_date
  ON public.users (tenant_id, hire_date)
  WHERE hire_date IS NOT NULL;

-- Column comments
COMMENT ON COLUMN public.users.position_tier IS
  'Position tier for commission multipliers: junior (1.0x), senior (1.2x), lead (1.5x). Used primarily in Beauty Spa service commission calculations.';

COMMENT ON COLUMN public.users.hire_date IS
  'Employee hire date. Used for seniority bonus calculation (0-1y: 0%, 1-3y: 5%, 3-5y: 10%, 5+y: 15%). Optional field.';

-- Migration validation query (for manual verification after migration)
-- SELECT
--   position_tier,
--   COUNT(*) as user_count,
--   COUNT(*) FILTER (WHERE role = 'ktv') as ktv_count,
--   COUNT(*) FILTER (WHERE hire_date IS NOT NULL) as with_hire_date
-- FROM public.users
-- GROUP BY position_tier
-- ORDER BY position_tier;
