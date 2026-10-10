-- ============================================================================
-- Bella Manufacturing OS - Production Execution and Completion
-- ============================================================================
-- Scope:
--   - Manufacturing-owned production execution evidence
--   - Manufacturing-owned production order completion evidence
--   - Production order status extension: in_progress, completed
--
-- Explicitly not included:
--   - Logistics stock mutation
--   - Finance posting / accounting outbox
--   - UI/API/runtime route registration
--   - ProductRegistry registration
-- ============================================================================

ALTER TABLE public.manufacturing_production_orders
  ADD COLUMN IF NOT EXISTS completed_by UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
    INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.manufacturing_production_orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.manufacturing_production_orders DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.manufacturing_production_orders
  ADD CONSTRAINT ck_manufacturing_production_orders_status
  CHECK (status IN ('draft', 'released', 'in_progress', 'completed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.manufacturing_production_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  production_order_id UUID NOT NULL,
  production_order_line_id UUID NOT NULL,
  material_issue_document_id TEXT NOT NULL,
  material_issue_movement_id TEXT NOT NULL,
  material_requirement_id UUID,
  actual_quantity NUMERIC(18, 6) NOT NULL CHECK (actual_quantity > 0),
  accepted_quantity NUMERIC(18, 6) NOT NULL CHECK (accepted_quantity >= 0),
  rejected_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  scrap_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (scrap_quantity >= 0),
  uom TEXT NOT NULL,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_production_executions_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_execution_material_movement
    UNIQUE (tenant_id, production_order_line_id, material_issue_movement_id),
  CONSTRAINT ck_manufacturing_execution_quantity_reconciles
    CHECK (actual_quantity = accepted_quantity + rejected_quantity + scrap_quantity),
  CONSTRAINT fk_manufacturing_executions_order_tenant
    FOREIGN KEY (tenant_id, production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_executions_order_line_tenant
    FOREIGN KEY (tenant_id, production_order_line_id)
    REFERENCES public.manufacturing_production_order_lines(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_executions_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_production_order_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  production_order_id UUID NOT NULL,
  completed_quantity NUMERIC(18, 6) NOT NULL CHECK (completed_quantity >= 0),
  rejected_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  scrap_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0 CHECK (scrap_quantity >= 0),
  uom TEXT NOT NULL,
  receipt_evidence JSONB NOT NULL,
  completed_by UUID NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_production_completions_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_production_completion_order UNIQUE (tenant_id, production_order_id),
  CONSTRAINT ck_manufacturing_production_completion_evidence_array
    CHECK (jsonb_typeof(receipt_evidence) = 'array'),
  CONSTRAINT fk_manufacturing_completions_order_tenant
    FOREIGN KEY (tenant_id, production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_completions_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

-- zero-downtime: allow blocking-index - new Manufacturing execution tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_executions_order
  ON public.manufacturing_production_executions(tenant_id, production_order_id, production_order_line_id);

-- zero-downtime: allow blocking-index - new Manufacturing completion table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_completions_order
  ON public.manufacturing_production_order_completions(tenant_id, production_order_id);

ALTER TABLE public.manufacturing_production_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_production_order_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturing_production_executions_order_access
  ON public.manufacturing_production_executions;
CREATE POLICY manufacturing_production_executions_order_access
  ON public.manufacturing_production_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_production_executions.tenant_id
        AND po.id = manufacturing_production_executions.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_production_executions.tenant_id
        AND po.id = manufacturing_production_executions.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  );

DROP POLICY IF EXISTS manufacturing_production_completions_order_access
  ON public.manufacturing_production_order_completions;
CREATE POLICY manufacturing_production_completions_order_access
  ON public.manufacturing_production_order_completions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_production_order_completions.tenant_id
        AND po.id = manufacturing_production_order_completions.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_production_order_completions.tenant_id
        AND po.id = manufacturing_production_order_completions.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  );

REVOKE ALL ON public.manufacturing_production_executions FROM anon;
REVOKE ALL ON public.manufacturing_production_order_completions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_production_executions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_production_order_completions TO authenticated, service_role;

COMMENT ON TABLE public.manufacturing_production_executions IS
  'Manufacturing: actual production output evidence linked to Logistics material issue evidence. No stock mutation.';

COMMENT ON TABLE public.manufacturing_production_order_completions IS
  'Manufacturing: production order completion evidence reconciled against execution and Logistics FGR references. No Finance posting.';
