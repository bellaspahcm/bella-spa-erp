-- Align users table with HR/salary code paths and generated database types.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 6000000,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS resignation_date DATE;

NOTIFY pgrst, 'reload schema';
