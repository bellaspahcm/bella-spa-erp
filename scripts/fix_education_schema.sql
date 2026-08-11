-- ============================================================================
-- FIX EDUCATION SCHEMA
-- Drop existing tables with wrong schema and recreate correctly
-- ============================================================================

-- Drop tables in correct order (FK dependencies)
DROP TABLE IF EXISTS public.attendances CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

-- Now run the create script
-- Copy content from apply_education_migrations_manual.sql below:
