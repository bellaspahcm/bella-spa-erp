-- ============================================================================
-- Bella Manufacturing OS - Quality Disposition Evidence
-- ============================================================================
-- Scope:
--   - Manufacturing-owned quality disposition evidence
--   - Completion evidence link to the quality dispositions used for reconciliation
--
-- Explicitly not included:
--   - Logistics stock mutation
--   - Finance posting / accounting outbox
--   - UI/API/runtime route registration
--   - ProductRegistry registration
--   - CAPA or Quality OS workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_quality_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  production_order_id UUID NOT NULL,
  production_order_line_id UUID NOT NULL,
  production_execution_id UUID NOT NULL,
  receipt_document_id TEXT,
  receipt_line_id TEXT,
  source_quantity_type TEXT NOT NULL
    CHECK (source_quantity_type IN ('accepted', 'rejected', 'scrap', 'pending')),
  disposition TEXT NOT NULL
    CHECK (disposition IN ('accepted', 'conditional_accept', 'rework', 'scrap', 'discard_reject', 'pending')),
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
  accepted_output_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0
    CHECK (accepted_output_quantity >= 0 AND accepted_output_quantity <= quantity),
  reason_code TEXT,
  reason_text TEXT,
  evidence_reference TEXT,
  final_handling_decision BOOLEAN,
  conditional_accept_policy_approved BOOLEAN,
  terminal BOOLEAN NOT NULL,
  decided_by UUID NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_quality_dispositions_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT ck_manufacturing_quality_dispositions_receipt_pair
    CHECK (
      (receipt_document_id IS NULL AND receipt_line_id IS NULL)
      OR (receipt_document_id IS NOT NULL AND receipt_line_id IS NOT NULL)
    ),
  CONSTRAINT ck_manufacturing_quality_dispositions_terminal_semantics
    CHECK (
      (disposition IN ('accepted', 'conditional_accept', 'scrap', 'discard_reject') AND terminal = TRUE)
      OR (disposition IN ('rework', 'pending') AND terminal = FALSE)
    ),
  CONSTRAINT ck_manufacturing_quality_dispositions_accepted_output
    CHECK (
      (disposition = 'accepted' AND accepted_output_quantity = quantity)
      OR (disposition = 'conditional_accept')
      OR (disposition IN ('rework', 'scrap', 'discard_reject', 'pending') AND accepted_output_quantity = 0)
    ),
  CONSTRAINT fk_manufacturing_quality_dispositions_order_tenant
    FOREIGN KEY (tenant_id, production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_quality_dispositions_order_line_tenant
    FOREIGN KEY (tenant_id, production_order_line_id)
    REFERENCES public.manufacturing_production_order_lines(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_quality_dispositions_execution_tenant
    FOREIGN KEY (tenant_id, production_execution_id)
    REFERENCES public.manufacturing_production_executions(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_quality_dispositions_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

ALTER TABLE public.manufacturing_production_order_completions
  ADD COLUMN IF NOT EXISTS quality_disposition_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.manufacturing_production_order_completions
  DROP CONSTRAINT IF EXISTS ck_manufacturing_production_completion_quality_evidence_array;

ALTER TABLE public.manufacturing_production_order_completions
  ADD CONSTRAINT ck_manufacturing_production_completion_quality_evidence_array
  CHECK (jsonb_typeof(quality_disposition_evidence) = 'array');

-- zero-downtime: allow blocking-index - Manufacturing quality dispositions are a new table.
CREATE INDEX IF NOT EXISTS idx_manufacturing_quality_dispositions_order
  ON public.manufacturing_quality_dispositions(tenant_id, production_order_id, production_order_line_id);

-- zero-downtime: allow blocking-index - Manufacturing quality dispositions are a new table.
CREATE INDEX IF NOT EXISTS idx_manufacturing_quality_dispositions_execution
  ON public.manufacturing_quality_dispositions(tenant_id, production_execution_id);

ALTER TABLE public.manufacturing_quality_dispositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturing_quality_dispositions_order_access
  ON public.manufacturing_quality_dispositions;
CREATE POLICY manufacturing_quality_dispositions_order_access
  ON public.manufacturing_quality_dispositions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_quality_dispositions.tenant_id
        AND po.id = manufacturing_quality_dispositions.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_quality_dispositions.tenant_id
        AND po.id = manufacturing_quality_dispositions.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  );

REVOKE ALL ON public.manufacturing_quality_dispositions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_quality_dispositions TO authenticated, service_role;

COMMENT ON TABLE public.manufacturing_quality_dispositions IS
  'Manufacturing: quality disposition evidence for accepted, conditional, rework, scrap, discard/reject, and pending quantities. No stock mutation.';

COMMENT ON COLUMN public.manufacturing_production_order_completions.quality_disposition_evidence IS
  'Quality disposition evidence snapshot used when completing the production order.';
