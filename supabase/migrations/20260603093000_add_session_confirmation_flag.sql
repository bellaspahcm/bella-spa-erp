-- Align session_logs with salary confirmation workflows and generated types.
ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
