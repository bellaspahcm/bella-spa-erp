-- Additive contract repair for Core booking actions.
-- Source code and generated types already include bookings.metadata; E2E schema
-- drifted and rejected createBooking() at runtime.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bookings.metadata IS
  'Flexible JSON storage for booking context (package details, product proof metadata, facility notes, special requirements, emergency bookings, etc.).';
