-- Migration: Add position_tier and hire_date columns to users table
-- Part of Commission System (Tasks 18-19)
-- Date: 2026-06-22

-- Add position_tier column (enum: junior, senior, lead)
-- Used for commission multiplier calculation
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS position_tier text CHECK (position_tier IN ('junior', 'senior', 'lead'));

-- Add hire_date column
-- Used for seniority bonus calculation
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS hire_date date;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_position_tier ON public.users(position_tier) WHERE position_tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_hire_date ON public.users(hire_date) WHERE hire_date IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.users.position_tier IS 'Position tier for commission multiplier (junior=1.0x, senior=1.2x, lead=1.5x)';
COMMENT ON COLUMN public.users.hire_date IS 'Date when employee started working (for seniority bonus calculation)';
