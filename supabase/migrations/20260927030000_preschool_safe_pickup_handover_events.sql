-- Preschool Safe Pickup / Handover Event
-- Minimal product-owned event truth: which authorized Guardian Party received
-- which Student Party, from which staff/operator, and when.

CREATE TABLE IF NOT EXISTS public.edu_preschool_pickup_handover_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  guardian_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  pickup_authorization_id UUID NOT NULL REFERENCES public.edu_preschool_pickup_authorizations(id) ON DELETE RESTRICT,
  handed_over_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handed_over_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edu_preschool_pickup_handover_events_student
  ON public.edu_preschool_pickup_handover_events(tenant_id, student_party_id, handed_over_at DESC);

CREATE INDEX IF NOT EXISTS idx_edu_preschool_pickup_handover_events_guardian
  ON public.edu_preschool_pickup_handover_events(tenant_id, guardian_party_id, handed_over_at DESC);

CREATE INDEX IF NOT EXISTS idx_edu_preschool_pickup_handover_events_authorization
  ON public.edu_preschool_pickup_handover_events(pickup_authorization_id);

ALTER TABLE public.edu_preschool_pickup_handover_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edu_preschool_pickup_handover_events_tenant_isolation
  ON public.edu_preschool_pickup_handover_events;

CREATE POLICY edu_preschool_pickup_handover_events_tenant_isolation
  ON public.edu_preschool_pickup_handover_events
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

COMMENT ON TABLE public.edu_preschool_pickup_handover_events IS
  'Preschool product-owned immutable safe pickup handover events. QR, notifications, custody rules, and pickup schedules are separate future capabilities.';
