-- ============================================================================
-- Bella Hospitality Phase 6 - Housekeeping Foundation
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 6
-- Purpose: Product-owned room housekeeping status and task lifecycle only.
-- Boundary: No Maintenance runtime, F&B, Travel, Resource Kernel, or allocation engine.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospitality_room_housekeeping_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.hospitality_rooms(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied', 'dirty', 'clean', 'inspected', 'out_of_order')),
  source VARCHAR(40) NOT NULL DEFAULT 'manual',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hospitality_room_housekeeping_statuses_room
    UNIQUE (tenant_id, property_id, room_id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.hospitality_rooms(id) ON DELETE RESTRICT,
  stay_id UUID REFERENCES public.hospitality_stays(id) ON DELETE SET NULL,
  task_type VARCHAR(30) NOT NULL
    CHECK (task_type IN ('cleaning', 'inspection', 'maintenance_request', 'status_update')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  target_room_status VARCHAR(20) NOT NULL
    CHECK (target_room_status IN ('available', 'occupied', 'dirty', 'clean', 'inspected', 'out_of_order')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_hospitality_housekeeping_tasks_started_after_open
    CHECK (started_at IS NULL OR started_at >= opened_at),
  CONSTRAINT chk_hospitality_housekeeping_tasks_completed_after_open
    CHECK (completed_at IS NULL OR completed_at >= opened_at)
);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_room_housekeeping_statuses_property
  ON public.hospitality_room_housekeeping_statuses(tenant_id, property_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_housekeeping_tasks_property_status
  ON public.hospitality_housekeeping_tasks(tenant_id, property_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_housekeeping_tasks_room
  ON public.hospitality_housekeeping_tasks(tenant_id, room_id, status);

CREATE OR REPLACE FUNCTION public.hospitality_validate_housekeeping_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_stay_status TEXT;
BEGIN
  SELECT id
  INTO v_room_id
  FROM public.hospitality_rooms
  WHERE id = NEW.room_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_HOUSEKEEPING_ROOM_NOT_FOUND';
  END IF;

  IF TG_TABLE_NAME = 'hospitality_housekeeping_tasks' AND NEW.stay_id IS NOT NULL THEN
    SELECT status
    INTO v_stay_status
    FROM public.hospitality_stays
    WHERE id = NEW.stay_id
      AND tenant_id = NEW.tenant_id
      AND property_id = NEW.property_id;

    IF v_stay_status IS NULL THEN
      RAISE EXCEPTION 'HOSPITALITY_HOUSEKEEPING_STAY_NOT_FOUND';
    END IF;

    IF NEW.task_type = 'cleaning' AND v_stay_status <> 'completed' THEN
      RAISE EXCEPTION 'HOSPITALITY_HOUSEKEEPING_CLEANING_REQUIRES_COMPLETED_STAY';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'hospitality_housekeeping_tasks'
    AND NEW.status = 'completed'
    AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.hospitality_room_housekeeping_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_housekeeping_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitality_room_housekeeping_statuses_tenant_isolation
  ON public.hospitality_room_housekeeping_statuses;
CREATE POLICY hospitality_room_housekeeping_statuses_tenant_isolation
  ON public.hospitality_room_housekeeping_statuses
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

DROP POLICY IF EXISTS hospitality_housekeeping_tasks_tenant_isolation
  ON public.hospitality_housekeeping_tasks;
CREATE POLICY hospitality_housekeeping_tasks_tenant_isolation
  ON public.hospitality_housekeeping_tasks
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

REVOKE ALL ON public.hospitality_room_housekeeping_statuses FROM anon;
REVOKE ALL ON public.hospitality_housekeeping_tasks FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_room_housekeeping_statuses TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_housekeeping_tasks TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_hospitality_room_housekeeping_statuses_scope
  ON public.hospitality_room_housekeeping_statuses;
CREATE TRIGGER trg_hospitality_room_housekeeping_statuses_scope
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, room_id, status
  ON public.hospitality_room_housekeeping_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_housekeeping_scope();

DROP TRIGGER IF EXISTS trg_hospitality_housekeeping_tasks_scope
  ON public.hospitality_housekeeping_tasks;
CREATE TRIGGER trg_hospitality_housekeeping_tasks_scope
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, room_id, stay_id, task_type, status
  ON public.hospitality_housekeeping_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_housekeeping_scope();

DROP TRIGGER IF EXISTS trg_hospitality_room_housekeeping_statuses_updated_at
  ON public.hospitality_room_housekeeping_statuses;
CREATE TRIGGER trg_hospitality_room_housekeeping_statuses_updated_at
  BEFORE UPDATE ON public.hospitality_room_housekeeping_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_housekeeping_tasks_updated_at
  ON public.hospitality_housekeeping_tasks;
CREATE TRIGGER trg_hospitality_housekeeping_tasks_updated_at
  BEFORE UPDATE ON public.hospitality_housekeeping_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.hospitality_room_housekeeping_statuses IS
  'Bella Hospitality Phase 6 - product-owned room housekeeping status; not a cross-industry resource kernel.';

COMMENT ON TABLE public.hospitality_housekeeping_tasks IS
  'Bella Hospitality Phase 6 - product-owned housekeeping tasks; maintenance_request is not Maintenance runtime.';
