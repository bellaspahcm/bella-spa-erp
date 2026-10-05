-- ============================================================================
-- Beauty V2 Attendance Gate: Persist Platform Branch on attendance events
-- ============================================================================
-- Owner: Workforce / Attendance event
-- Platform dependency: public.org_units(id) as canonical Branch identity
--
-- Legacy posture:
--   Existing attendance rows have no canonical historical branch source. This
--   migration intentionally leaves branch_id nullable and does not backfill.
--   New Beauty V2 branch-aware writes must pass an authorized branch_id at the
--   service boundary.
-- ============================================================================

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS branch_id UUID;

COMMENT ON COLUMN public.attendance.branch_id IS
  'Platform org_units.id for the branch where this attendance event was recorded. NULL is reserved for legacy rows where no canonical historical branch source exists.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_branch_id_fkey'
      AND conrelid = 'public.attendance'::regclass
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.org_units(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_branch_date
  ON public.attendance (tenant_id, branch_id, date)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_ktv_date
  ON public.attendance (tenant_id, ktv_id, date);
