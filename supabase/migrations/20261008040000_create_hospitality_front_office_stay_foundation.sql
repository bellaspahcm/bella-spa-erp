-- ============================================================================
-- Bella Hospitality Phase 3 - Front Office / Stay Foundation
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 3
-- Purpose: Product-owned check-in, stay, and room occupancy chain only.
-- Boundary: No Folio, Payment, Housekeeping, F&B, Travel, or Resource Kernel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospitality_stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_stays_reservation_tenant
    FOREIGN KEY (tenant_id, property_id, reservation_id)
    REFERENCES public.hospitality_reservations(tenant_id, property_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_hospitality_stays_guest_tenant
    FOREIGN KEY (tenant_id, guest_id)
    REFERENCES public.hospitality_guests(tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_hospitality_stays_checkout_after_checkin
    CHECK (checked_out_at IS NULL OR checked_out_at > checked_in_at),
  CONSTRAINT uq_hospitality_stays_reservation UNIQUE (tenant_id, reservation_id),
  CONSTRAINT uq_hospitality_stays_tenant_property_id UNIQUE (tenant_id, property_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_room_occupancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  stay_id UUID NOT NULL,
  reservation_room_id UUID NOT NULL REFERENCES public.hospitality_reservation_rooms(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.hospitality_rooms(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'occupied'
    CHECK (status IN ('occupied', 'released')),
  occupied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_room_occupancies_stay_tenant
    FOREIGN KEY (tenant_id, property_id, stay_id)
    REFERENCES public.hospitality_stays(tenant_id, property_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_hospitality_room_occupancies_release_after_occupy
    CHECK (released_at IS NULL OR released_at > occupied_at)
);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_stays_property_status
  ON public.hospitality_stays(tenant_id, property_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_stays_guest
  ON public.hospitality_stays(tenant_id, guest_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_room_occupancies_stay
  ON public.hospitality_room_occupancies(tenant_id, stay_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_room_occupancies_room
  ON public.hospitality_room_occupancies(tenant_id, room_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hospitality_room_occupancies_active_room
  ON public.hospitality_room_occupancies(tenant_id, room_id)
  WHERE status = 'occupied';

CREATE OR REPLACE FUNCTION public.hospitality_validate_stay_check_in()
RETURNS TRIGGER AS $$
DECLARE
  v_reservation_guest_id UUID;
  v_reservation_status TEXT;
  v_reservation_check_out_date DATE;
BEGIN
  SELECT guest_id, status, check_out_date
  INTO v_reservation_guest_id, v_reservation_status, v_reservation_check_out_date
  FROM public.hospitality_reservations
  WHERE id = NEW.reservation_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_reservation_guest_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_STAY_RESERVATION_NOT_FOUND';
  END IF;

  IF v_reservation_guest_id <> NEW.guest_id THEN
    RAISE EXCEPTION 'HOSPITALITY_STAY_GUEST_MISMATCH';
  END IF;

  IF v_reservation_status <> 'confirmed' THEN
    RAISE EXCEPTION 'HOSPITALITY_STAY_REQUIRES_CONFIRMED_RESERVATION';
  END IF;

  IF NEW.checked_in_at::date >= v_reservation_check_out_date THEN
    RAISE EXCEPTION 'HOSPITALITY_STAY_CHECK_IN_AFTER_RESERVATION';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.hospitality_validate_room_occupancy()
RETURNS TRIGGER AS $$
DECLARE
  v_stay_reservation_id UUID;
  v_stay_status TEXT;
  v_reserved_room_reservation_id UUID;
  v_reserved_room_room_id UUID;
BEGIN
  SELECT reservation_id, status
  INTO v_stay_reservation_id, v_stay_status
  FROM public.hospitality_stays
  WHERE id = NEW.stay_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_stay_reservation_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_OCCUPANCY_STAY_NOT_FOUND';
  END IF;

  IF NEW.status = 'occupied' AND v_stay_status <> 'active' THEN
    RAISE EXCEPTION 'HOSPITALITY_OCCUPANCY_REQUIRES_ACTIVE_STAY';
  END IF;

  SELECT reservation_id, room_id
  INTO v_reserved_room_reservation_id, v_reserved_room_room_id
  FROM public.hospitality_reservation_rooms
  WHERE id = NEW.reservation_room_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_reserved_room_reservation_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_OCCUPANCY_RESERVED_ROOM_NOT_FOUND';
  END IF;

  IF v_reserved_room_reservation_id <> v_stay_reservation_id
    OR v_reserved_room_room_id <> NEW.room_id THEN
    RAISE EXCEPTION 'HOSPITALITY_OCCUPANCY_RESERVED_ROOM_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.hospitality_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_room_occupancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitality_stays_tenant_isolation ON public.hospitality_stays;
CREATE POLICY hospitality_stays_tenant_isolation
  ON public.hospitality_stays
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

DROP POLICY IF EXISTS hospitality_room_occupancies_tenant_isolation ON public.hospitality_room_occupancies;
CREATE POLICY hospitality_room_occupancies_tenant_isolation
  ON public.hospitality_room_occupancies
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

REVOKE ALL ON public.hospitality_stays FROM anon;
REVOKE ALL ON public.hospitality_room_occupancies FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_stays TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_room_occupancies TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_hospitality_stays_validation ON public.hospitality_stays;
CREATE TRIGGER trg_hospitality_stays_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, reservation_id, guest_id, checked_in_at, status
  ON public.hospitality_stays
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_stay_check_in();

DROP TRIGGER IF EXISTS trg_hospitality_room_occupancies_validation ON public.hospitality_room_occupancies;
CREATE TRIGGER trg_hospitality_room_occupancies_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, stay_id, reservation_room_id, room_id, status
  ON public.hospitality_room_occupancies
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_room_occupancy();

DROP TRIGGER IF EXISTS trg_hospitality_stays_updated_at ON public.hospitality_stays;
CREATE TRIGGER trg_hospitality_stays_updated_at
  BEFORE UPDATE ON public.hospitality_stays
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_room_occupancies_updated_at ON public.hospitality_room_occupancies;
CREATE TRIGGER trg_hospitality_room_occupancies_updated_at
  BEFORE UPDATE ON public.hospitality_room_occupancies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.hospitality_stays IS
  'Bella Hospitality Phase 3 - product-owned active/completed stay; no folio or payment semantics.';

COMMENT ON TABLE public.hospitality_room_occupancies IS
  'Bella Hospitality Phase 3 - product-owned room occupancy for Front Office; not a cross-industry allocation kernel.';
