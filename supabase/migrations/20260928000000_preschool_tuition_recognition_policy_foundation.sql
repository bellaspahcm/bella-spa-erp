-- ============================================================================
-- BELLA PRESCHOOL P7: Tuition Recognition Policy Foundation
-- Scope:
--   - Product-owned tenant policy vocabulary for tuition recognition.
--   - Explicit PERIOD_COMPLETION evidence.
--   - No Finance OS, GL, payment, prepayment, refund, tax, or invoice mutation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.edu_fin_tuition_recognition_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  policy_type VARCHAR(40) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  policy_version VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edu_fin_tuition_recognition_policy_type_check
    CHECK (policy_type IN ('PERIOD_COMPLETION', 'TIME_BASED', 'MILESTONE_EVENT')),
  CONSTRAINT edu_fin_tuition_recognition_policy_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT edu_fin_tuition_recognition_policy_date_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- zero-downtime: allow blocking-index - reviewed owner-deployed tuition recognition policy effective-date lookup index
CREATE INDEX IF NOT EXISTS idx_edu_fin_tuition_recognition_policies_tenant_effective
  ON public.edu_fin_tuition_recognition_policies(tenant_id, status, effective_from, effective_to);

CREATE OR REPLACE FUNCTION public.fn_check_edu_fin_tuition_recognition_policy_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND EXISTS (
    SELECT 1
    FROM public.edu_fin_tuition_recognition_policies p
    WHERE p.tenant_id = NEW.tenant_id
      AND p.status = 'ACTIVE'
      AND p.id <> NEW.id
      AND daterange(p.effective_from, COALESCE(p.effective_to, 'infinity'::date), '[]')
          && daterange(NEW.effective_from, COALESCE(NEW.effective_to, 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION 'PRESCHOOL_TUITION_RECOGNITION_POLICY_OVERLAP: Active tuition recognition policies must not overlap for the same tenant.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_edu_fin_tuition_recognition_policy_overlap
  ON public.edu_fin_tuition_recognition_policies;

CREATE TRIGGER trg_check_edu_fin_tuition_recognition_policy_overlap
BEFORE INSERT OR UPDATE ON public.edu_fin_tuition_recognition_policies
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_edu_fin_tuition_recognition_policy_overlap();

CREATE TABLE IF NOT EXISTS public.edu_fin_tuition_service_period_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  billing_period_id UUID NOT NULL REFERENCES public.edu_fin_billing_periods(id),
  completed_at TIMESTAMPTZ NOT NULL,
  completed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edu_fin_tuition_service_period_completion_unique
    UNIQUE (tenant_id, billing_period_id)
);

-- zero-downtime: allow blocking-index - reviewed owner-deployed tuition service completion read-back index
CREATE INDEX IF NOT EXISTS idx_edu_fin_tuition_service_period_completions_tenant_period
  ON public.edu_fin_tuition_service_period_completions(tenant_id, billing_period_id);

ALTER TABLE public.edu_fin_tuition_recognition_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_tuition_service_period_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edu_fin_tuition_recognition_policies_tenant_isolation
  ON public.edu_fin_tuition_recognition_policies;

CREATE POLICY edu_fin_tuition_recognition_policies_tenant_isolation
  ON public.edu_fin_tuition_recognition_policies
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS edu_fin_tuition_service_period_completions_tenant_isolation
  ON public.edu_fin_tuition_service_period_completions;

CREATE POLICY edu_fin_tuition_service_period_completions_tenant_isolation
  ON public.edu_fin_tuition_service_period_completions
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

COMMENT ON TABLE public.edu_fin_tuition_recognition_policies IS
  'Bella Preschool product-owned effective-dated tuition recognition policy vocabulary. Execution support is currently PERIOD_COMPLETION only.';

COMMENT ON TABLE public.edu_fin_tuition_service_period_completions IS
  'Bella Preschool explicit evidence that a tuition service period has been completed. This is not invoice issuance, payment, or billing-period date passage.';
