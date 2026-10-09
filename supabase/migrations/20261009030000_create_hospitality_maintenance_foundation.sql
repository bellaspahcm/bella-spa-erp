-- ============================================================================
-- Bella Hospitality Phase 7 - Maintenance Foundation
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 7
-- Purpose: Product-owned room maintenance request lifecycle only.
-- Boundary: No F&B, Travel, Resource Kernel, allocation engine, or generic workflow engine.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospitality_maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.hospitality_rooms(id) ON DELETE RESTRICT,
  source_housekeeping_task_id UUID REFERENCES public.hospitality_housekeeping_tasks(id) ON DELETE SET NULL,
  issue_type VARCHAR(30) NOT NULL
    CHECK (issue_type IN ('repair', 'safety', 'utilities', 'amenity', 'inspection', 'other')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'assigned', 'in_progress', 'completed')),
  title TEXT NOT NULL,
  description TEXT,
  reported_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_hospitality_maintenance_assigned_after_reported
    CHECK (assigned_at IS NULL OR assigned_at >= reported_at),
  CONSTRAINT chk_hospitality_maintenance_started_after_reported
    CHECK (started_at IS NULL OR started_at >= reported_at),
  CONSTRAINT chk_hospitality_maintenance_completed_after_reported
    CHECK (completed_at IS NULL OR completed_at >= reported_at)
);

-- zero-downtime: allow blocking-index - new Hospitality product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_maintenance_requests_property
  ON public.hospitality_maintenance_requests(tenant_id, property_id, status, priority);

-- zero-downtime: allow blocking-index - new Hospitality product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_maintenance_requests_room
  ON public.hospitality_maintenance_requests(tenant_id, room_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_maintenance_requests_assignee
  ON public.hospitality_maintenance_requests(tenant_id, assigned_to_user_id, status);

CREATE OR REPLACE FUNCTION public.hospitality_validate_maintenance_request_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_housekeeping_task_id UUID;
BEGIN
  SELECT id
  INTO v_room_id
  FROM public.hospitality_rooms
  WHERE id = NEW.room_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_MAINTENANCE_ROOM_NOT_FOUND';
  END IF;

  IF NEW.source_housekeeping_task_id IS NOT NULL THEN
    SELECT id
    INTO v_housekeeping_task_id
    FROM public.hospitality_housekeeping_tasks
    WHERE id = NEW.source_housekeeping_task_id
      AND tenant_id = NEW.tenant_id
      AND property_id = NEW.property_id
      AND room_id = NEW.room_id
      AND task_type = 'maintenance_request';

    IF v_housekeeping_task_id IS NULL THEN
      RAISE EXCEPTION 'HOSPITALITY_MAINTENANCE_SOURCE_TASK_NOT_FOUND';
    END IF;
  END IF;

  IF NEW.status = 'assigned' AND NEW.assigned_at IS NULL THEN
    NEW.assigned_at := NOW();
  END IF;

  IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := NOW();
  END IF;

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.hospitality_maintenance_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitality_maintenance_requests_tenant_isolation
  ON public.hospitality_maintenance_requests;
CREATE POLICY hospitality_maintenance_requests_tenant_isolation
  ON public.hospitality_maintenance_requests
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

REVOKE ALL ON public.hospitality_maintenance_requests FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_maintenance_requests TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_hospitality_maintenance_requests_scope
  ON public.hospitality_maintenance_requests;
CREATE TRIGGER trg_hospitality_maintenance_requests_scope
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, room_id, source_housekeeping_task_id, status
  ON public.hospitality_maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_maintenance_request_scope();

DROP TRIGGER IF EXISTS trg_hospitality_maintenance_requests_updated_at
  ON public.hospitality_maintenance_requests;
CREATE TRIGGER trg_hospitality_maintenance_requests_updated_at
  BEFORE UPDATE ON public.hospitality_maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.hospitality_maintenance_requests IS
  'Bella Hospitality Phase 7 - product-owned room maintenance requests; not a cross-industry resource kernel.';

COMMENT ON FUNCTION public.hospitality_validate_maintenance_request_scope() IS
  'Bella Hospitality Phase 7 - validates room and optional Housekeeping source task scope for maintenance requests.';
