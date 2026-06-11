ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS booking_resource_id UUID NULL;

DO $$
BEGIN
  ALTER TABLE public.session_logs
    ADD CONSTRAINT session_logs_booking_resource_id_fkey
    FOREIGN KEY (booking_resource_id)
    REFERENCES public.booking_resources(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_logs_booking_resource_schedule
  ON public.session_logs (tenant_id, booking_resource_id, assigned_date, assigned_time)
  WHERE booking_resource_id IS NOT NULL;

COMMENT ON COLUMN public.session_logs.booking_resource_id IS
  'Schedulable Beauty Spa resource assigned to this session, such as bed, room, machine, or chair.';
