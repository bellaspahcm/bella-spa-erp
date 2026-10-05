-- Beauty V2 Payroll Gate: Persist Platform Branch on salary records
--
-- Contract:
--   public.salary_records.branch_id stores the Platform org_units.id for the
--   single branch proven by branch-aware attendance rows in the payroll period.
--
-- Legacy behavior:
--   Existing salary rows have no canonical historical branch source. This
--   migration intentionally leaves branch_id nullable and does not backfill.

ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS branch_id UUID;

COMMENT ON COLUMN public.salary_records.branch_id IS
  'Platform org_units.id for the single branch proven by branch-aware attendance in this payroll period. NULL is reserved for legacy or non-branch-proven salary records.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salary_records_branch_id_fkey'
      AND conrelid = 'public.salary_records'::regclass
  ) THEN
    ALTER TABLE public.salary_records
      ADD CONSTRAINT salary_records_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.org_units(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_salary_records_tenant_branch_month
  ON public.salary_records (tenant_id, branch_id, month_year)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_salary_records_tenant_ktv_month_branch
  ON public.salary_records (tenant_id, ktv_id, month_year, branch_id)
  WHERE branch_id IS NOT NULL;
