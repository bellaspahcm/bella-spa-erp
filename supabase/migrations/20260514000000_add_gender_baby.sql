-- Add gender_baby column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender_baby TEXT;

-- Refresh schema cache (only works if run as superuser/postgres, which dashboard usually does)
NOTIFY pgrst, 'reload schema';
