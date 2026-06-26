-- =====================================================
-- Migration: Add metadata columns for enhanced demo data
-- Purpose: Support demo tenant/user/customer context storage
-- Date: 2026-06-22
-- =====================================================
-- CRITICAL: Run this SQL in Supabase SQL Editor
-- DO NOT use Supabase CLI (not working properly per user feedback)
-- =====================================================

-- 1. Add metadata to tenants table (if not exists)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.metadata IS 'Flexible JSON storage for tenant context (marker, version, features, etc.)';

-- 2. Add metadata to users table (if not exists)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.metadata IS 'Flexible JSON storage for user context (position, certifications, skills, shift preferences, etc.)';

-- 3. Add metadata to customers table (if not exists)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.customers.metadata IS 'Flexible JSON storage for customer context (facility type, size, special requirements, operating hours, etc.)';

-- Verify columns were added
SELECT 
  'tenants' as table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tenants' 
  AND column_name = 'metadata'

UNION ALL

SELECT 
  'users' as table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'metadata'

UNION ALL

SELECT 
  'customers' as table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'customers' 
  AND column_name = 'metadata';
