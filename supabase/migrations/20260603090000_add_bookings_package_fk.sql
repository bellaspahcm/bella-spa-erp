-- Ensure Supabase/PostgREST can resolve bookings -> packages nested selects.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_package_id_fkey'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_package_id_fkey
      FOREIGN KEY (package_id)
      REFERENCES public.packages(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
