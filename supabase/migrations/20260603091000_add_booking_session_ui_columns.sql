-- Align lab/runtime schema with generated types and booking/session UI queries.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS preferred_time TEXT;

ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS assigned_time TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT;

NOTIFY pgrst, 'reload schema';
