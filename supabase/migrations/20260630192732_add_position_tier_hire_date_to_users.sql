-- Migration: Add position_tier and hire_date columns to users table
-- Date: 2026-06-30
-- Purpose: Support Commission System Tasks 18-19 (Position Tier & Hire Date)

-- Add position_tier column (enum: junior, senior, lead)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS position_tier TEXT CHECK (position_tier IN ('junior', 'senior', 'lead'));

-- Add hire_date column (date when employee was hired)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN public.users.position_tier IS 'Position tier for KTV staff (junior/senior/lead) - affects commission multiplier';
COMMENT ON COLUMN public.users.hire_date IS 'Date when employee was hired - used for seniority bonus calculation';

-- Create index for common queries filtering by position_tier
CREATE INDEX IF NOT EXISTS idx_users_position_tier ON public.users(position_tier) WHERE position_tier IS NOT NULL;

-- Create index for hire_date queries (for seniority calculations)
CREATE INDEX IF NOT EXISTS idx_users_hire_date ON public.users(hire_date) WHERE hire_date IS NOT NULL;

-- Update RLS policies to allow reading these fields (existing policies should cover this)
-- No changes needed as SELECT policies already exist for users table

-- Audit log
DO $$
BEGIN
  INSERT INTO public.audit_log (
    action,
    table_name,
    record_id,
    new_data,
    old_data
  ) VALUES (
    'SCHEMA_CHANGE',
    'users',
    NULL,
    jsonb_build_object(
      'migration', '20260630192732_add_position_tier_hire_date_to_users',
      'columns_added', jsonb_build_array('position_tier', 'hire_date'),
      'description', 'Support position tier and hire date for commission calculations'
    ),
    NULL
  );
EXCEPTION WHEN OTHERS THEN
  -- Ignore if audit_log table doesn't exist or insert fails
  RAISE NOTICE 'Could not insert audit log: %', SQLERRM;
END $$;
