-- ============================================================================
-- Bella Manufacturing OS - Operation Progress Evidence Binding
-- ============================================================================
-- Scope:
--   - Bind completed operation progress to Manufacturing production execution.
--   - Persist completed operation quantity evidence.
--
-- Explicitly not included:
--   - Logistics stock mutation
--   - Finance posting / costing / WIP
--   - UI/API/runtime route registration
--   - ProductRegistry registration
-- ============================================================================

ALTER TABLE public.manufacturing_operation_progress
  ADD COLUMN IF NOT EXISTS production_execution_id UUID,
  ADD COLUMN IF NOT EXISTS completed_quantity NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS quantity_uom TEXT;

-- zero-downtime: allow blocking-index - redundant uniqueness supports an evidence FK on already tenant-unique execution ids.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_manufacturing_production_executions_line_id'
  ) THEN
    ALTER TABLE public.manufacturing_production_executions
      ADD CONSTRAINT uq_manufacturing_production_executions_line_id
      UNIQUE (tenant_id, production_order_line_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_manufacturing_operation_progress_execution_line'
  ) THEN
    ALTER TABLE public.manufacturing_operation_progress
      ADD CONSTRAINT fk_manufacturing_operation_progress_execution_line
      FOREIGN KEY (tenant_id, production_order_line_id, production_execution_id)
      REFERENCES public.manufacturing_production_executions(tenant_id, production_order_line_id, id)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_manufacturing_operation_progress_completed_evidence'
  ) THEN
    ALTER TABLE public.manufacturing_operation_progress
      ADD CONSTRAINT ck_manufacturing_operation_progress_completed_evidence
      CHECK (
        status <> 'completed'
        OR (
          production_execution_id IS NOT NULL
          AND completed_quantity IS NOT NULL
          AND completed_quantity > 0
          AND NULLIF(BTRIM(quantity_uom), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;
END $$;

-- zero-downtime: allow blocking-index - new Manufacturing evidence lookup index on existing Manufacturing-owned table.
CREATE INDEX IF NOT EXISTS idx_manufacturing_operation_progress_execution
  ON public.manufacturing_operation_progress(tenant_id, production_order_line_id, production_execution_id);

COMMENT ON COLUMN public.manufacturing_operation_progress.production_execution_id IS
  'Manufacturing: production execution evidence for completed operation progress.';

COMMENT ON COLUMN public.manufacturing_operation_progress.completed_quantity IS
  'Manufacturing: quantity completed for the operation, bounded by referenced execution actual quantity in service.';

COMMENT ON COLUMN public.manufacturing_operation_progress.quantity_uom IS
  'Manufacturing: unit of measure for completed operation quantity evidence.';
