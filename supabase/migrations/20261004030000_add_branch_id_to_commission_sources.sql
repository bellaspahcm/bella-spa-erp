-- Beauty V2 Commission branch mapping.
-- Branch identity must be captured on commission source transactions before the
-- salary engine may include them in branch-proven commission results.
--
-- Legacy rows are intentionally left NULL. There is no canonical historical
-- source that can safely backfill branch_id.

ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS branch_id UUID;

COMMENT ON COLUMN public.session_logs.branch_id IS
  'Platform org_units.id for the branch of this completed session source transaction. Nullable for legacy rows; branch-aware Commission V1 rejects NULL source branches.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_logs_branch_id_fkey'
      AND conrelid = 'public.session_logs'::regclass
  ) THEN
    ALTER TABLE public.session_logs
      ADD CONSTRAINT session_logs_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.org_units(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- zero-downtime: allow blocking-index - additive nullable branch-dimension index for completed commission sources
CREATE INDEX IF NOT EXISTS idx_session_logs_tenant_branch_completed
  ON public.session_logs (tenant_id, branch_id, completed_date)
  WHERE branch_id IS NOT NULL AND status = 'completed';

ALTER TABLE public.booking_service_items
  ADD COLUMN IF NOT EXISTS branch_id UUID;

COMMENT ON COLUMN public.booking_service_items.branch_id IS
  'Platform org_units.id for the branch of this service commission source transaction. Nullable for legacy rows; branch-aware Commission V1 rejects NULL source branches.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_service_items_branch_id_fkey'
      AND conrelid = 'public.booking_service_items'::regclass
  ) THEN
    ALTER TABLE public.booking_service_items
      ADD CONSTRAINT booking_service_items_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.org_units(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- zero-downtime: allow blocking-index - additive nullable branch-dimension index for completed service item commission sources
CREATE INDEX IF NOT EXISTS idx_booking_service_items_tenant_branch_date
  ON public.booking_service_items (tenant_id, branch_id, completed_date)
  WHERE branch_id IS NOT NULL AND status = 'completed';

ALTER TABLE public.product_sales
  ADD COLUMN IF NOT EXISTS branch_id UUID;

COMMENT ON COLUMN public.product_sales.branch_id IS
  'Platform org_units.id for the branch of this product sale commission source transaction. Nullable for legacy rows; branch-aware Commission V1 rejects NULL source branches.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_sales_branch_id_fkey'
      AND conrelid = 'public.product_sales'::regclass
  ) THEN
    ALTER TABLE public.product_sales
      ADD CONSTRAINT product_sales_branch_id_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.org_units(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- zero-downtime: allow blocking-index - additive nullable branch-dimension index for completed product sale commission sources
CREATE INDEX IF NOT EXISTS idx_product_sales_tenant_branch_date
  ON public.product_sales (tenant_id, branch_id, sale_date)
  WHERE branch_id IS NOT NULL AND status = 'completed';
