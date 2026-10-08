-- ============================================================================
-- Bella Hospitality Phase 6 - Housekeeping Scope Trigger Split
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 6 follow-up
-- Purpose: Split room-status and task trigger validation so status rows do not
--          execute task-only NEW.stay_id references.
-- Boundary: No Maintenance runtime, F&B, Travel, Resource Kernel, or allocation engine.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hospitality_validate_room_housekeeping_status_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.hospitality_validate_housekeeping_task_scope()
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

  IF NEW.stay_id IS NOT NULL THEN
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

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hospitality_room_housekeeping_statuses_scope
  ON public.hospitality_room_housekeeping_statuses;
CREATE TRIGGER trg_hospitality_room_housekeeping_statuses_scope
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, room_id, status
  ON public.hospitality_room_housekeeping_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_room_housekeeping_status_scope();

DROP TRIGGER IF EXISTS trg_hospitality_housekeeping_tasks_scope
  ON public.hospitality_housekeeping_tasks;
CREATE TRIGGER trg_hospitality_housekeeping_tasks_scope
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, room_id, stay_id, task_type, status
  ON public.hospitality_housekeeping_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_housekeeping_task_scope();

COMMENT ON FUNCTION public.hospitality_validate_room_housekeeping_status_scope() IS
  'Bella Hospitality Phase 6 - validates room scope for housekeeping status rows only.';

COMMENT ON FUNCTION public.hospitality_validate_housekeeping_task_scope() IS
  'Bella Hospitality Phase 6 - validates room/stay scope for housekeeping task rows only.';
