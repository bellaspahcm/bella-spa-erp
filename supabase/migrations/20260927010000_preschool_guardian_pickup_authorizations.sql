-- Preschool Guardian Authorization
-- Minimal product-owned truth for: which Guardian Party is currently authorized
-- to pick up which Student Party. This does not implement pickup events or QR.

CREATE TABLE IF NOT EXISTS public.edu_preschool_pickup_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  guardian_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'authorized' CHECK (status IN ('authorized', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- zero-downtime: allow blocking-index - reviewed owner-deployed product table unique boundary for active pickup authorization
CREATE UNIQUE INDEX IF NOT EXISTS idx_edu_preschool_pickup_authorizations_active_unique
  ON public.edu_preschool_pickup_authorizations(tenant_id, student_party_id, guardian_party_id)
  WHERE status = 'authorized';

-- zero-downtime: allow blocking-index - reviewed owner-deployed product table index for student authorization lookup
CREATE INDEX IF NOT EXISTS idx_edu_preschool_pickup_authorizations_student
  ON public.edu_preschool_pickup_authorizations(tenant_id, student_party_id);

-- zero-downtime: allow blocking-index - reviewed owner-deployed product table index for guardian authorization lookup
CREATE INDEX IF NOT EXISTS idx_edu_preschool_pickup_authorizations_guardian
  ON public.edu_preschool_pickup_authorizations(tenant_id, guardian_party_id);

ALTER TABLE public.edu_preschool_pickup_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edu_preschool_pickup_authorizations_tenant_isolation
  ON public.edu_preschool_pickup_authorizations;

CREATE POLICY edu_preschool_pickup_authorizations_tenant_isolation
  ON public.edu_preschool_pickup_authorizations
  FOR ALL
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

COMMENT ON TABLE public.edu_preschool_pickup_authorizations IS
  'Preschool product-owned pickup authorization truth: authorized Guardian Party for Student Party. Pickup events and QR are separate capabilities.';
