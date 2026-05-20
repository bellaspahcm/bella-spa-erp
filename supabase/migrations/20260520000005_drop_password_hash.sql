-- Drop the password_hash column from the users table
-- Supabase handles authentication, so storing password_hash in the public schema is a security risk

ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
