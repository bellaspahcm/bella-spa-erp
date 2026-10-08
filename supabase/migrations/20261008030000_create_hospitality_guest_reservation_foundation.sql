-- ============================================================================
-- Bella Hospitality Phase 2 - Guest + Reservation Foundation
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 2
-- Purpose: Product-owned guest reservation chain only.
-- Boundary: No Check-in/out, Stay, Folio, Payment, Housekeeping, Travel, or Resource Kernel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospitality_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hospitality_guests_tenant_party UNIQUE (tenant_id, party_id),
  CONSTRAINT uq_hospitality_guests_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  reservation_code VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER NOT NULL CHECK (adults > 0),
  children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_reservations_property_tenant
    FOREIGN KEY (tenant_id, property_id)
    REFERENCES public.hospitality_properties(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hospitality_reservations_guest_tenant
    FOREIGN KEY (tenant_id, guest_id)
    REFERENCES public.hospitality_guests(tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_hospitality_reservations_date_range
    CHECK (check_out_date > check_in_date),
  CONSTRAINT uq_hospitality_reservations_property_code
    UNIQUE (tenant_id, property_id, reservation_code),
  CONSTRAINT uq_hospitality_reservations_tenant_property_id
    UNIQUE (tenant_id, property_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_reservation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  room_type_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.hospitality_rooms(id) ON DELETE RESTRICT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER NOT NULL CHECK (adults > 0),
  children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'cancelled')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_reservation_rooms_reservation_tenant
    FOREIGN KEY (tenant_id, property_id, reservation_id)
    REFERENCES public.hospitality_reservations(tenant_id, property_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hospitality_reservation_rooms_room_type_tenant
    FOREIGN KEY (tenant_id, property_id, room_type_id)
    REFERENCES public.hospitality_room_types(tenant_id, property_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_hospitality_reservation_rooms_date_range
    CHECK (check_out_date > check_in_date)
);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_guests_tenant_status
  ON public.hospitality_guests(tenant_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_guests_party
  ON public.hospitality_guests(party_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_reservations_property_dates
  ON public.hospitality_reservations(tenant_id, property_id, check_in_date, check_out_date);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_reservations_guest
  ON public.hospitality_reservations(tenant_id, guest_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_reservation_rooms_room_dates
  ON public.hospitality_reservation_rooms(tenant_id, room_id, check_in_date, check_out_date);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_reservation_rooms_reservation
  ON public.hospitality_reservation_rooms(tenant_id, reservation_id);

CREATE OR REPLACE FUNCTION public.hospitality_validate_guest_party_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_party_tenant_id UUID;
  v_party_type TEXT;
BEGIN
  SELECT tenant_id, party_type
  INTO v_party_tenant_id, v_party_type
  FROM public.party_parties
  WHERE id = NEW.party_id
    AND deleted_at IS NULL;

  IF v_party_tenant_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_GUEST_PARTY_NOT_FOUND';
  END IF;

  IF v_party_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'HOSPITALITY_GUEST_PARTY_TENANT_MISMATCH';
  END IF;

  IF v_party_type <> 'person' THEN
    RAISE EXCEPTION 'HOSPITALITY_GUEST_PARTY_MUST_BE_PERSON';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.hospitality_validate_reservation_room()
RETURNS TRIGGER AS $$
DECLARE
  v_reservation_tenant_id UUID;
  v_reservation_property_id UUID;
  v_room_tenant_id UUID;
  v_room_property_id UUID;
  v_room_type_id UUID;
  v_max_occupancy INTEGER;
BEGIN
  SELECT tenant_id, property_id
  INTO v_reservation_tenant_id, v_reservation_property_id
  FROM public.hospitality_reservations
  WHERE id = NEW.reservation_id;

  IF v_reservation_tenant_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_RESERVATION_NOT_FOUND';
  END IF;

  IF v_reservation_tenant_id <> NEW.tenant_id
    OR v_reservation_property_id <> NEW.property_id THEN
    RAISE EXCEPTION 'HOSPITALITY_RESERVATION_ROOM_RESERVATION_MISMATCH';
  END IF;

  SELECT tenant_id, property_id, room_type_id
  INTO v_room_tenant_id, v_room_property_id, v_room_type_id
  FROM public.hospitality_rooms
  WHERE id = NEW.room_id;

  IF v_room_tenant_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_ROOM_NOT_FOUND';
  END IF;

  IF v_room_tenant_id <> NEW.tenant_id
    OR v_room_property_id <> NEW.property_id
    OR v_room_type_id <> NEW.room_type_id THEN
    RAISE EXCEPTION 'HOSPITALITY_RESERVATION_ROOM_PROPERTY_MISMATCH';
  END IF;

  SELECT max_occupancy
  INTO v_max_occupancy
  FROM public.hospitality_room_types
  WHERE id = NEW.room_type_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_max_occupancy IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_ROOM_TYPE_NOT_FOUND';
  END IF;

  IF NEW.adults + NEW.children > v_max_occupancy THEN
    RAISE EXCEPTION 'HOSPITALITY_OCCUPANCY_EXCEEDS_ROOM_TYPE';
  END IF;

  IF NEW.status = 'reserved'
    AND EXISTS (
      SELECT 1
      FROM public.hospitality_reservation_rooms existing
      WHERE existing.tenant_id = NEW.tenant_id
        AND existing.room_id = NEW.room_id
        AND existing.status = 'reserved'
        AND existing.id <> NEW.id
        AND NEW.check_in_date < existing.check_out_date
        AND NEW.check_out_date > existing.check_in_date
    ) THEN
    RAISE EXCEPTION 'HOSPITALITY_ROOM_ALREADY_RESERVED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.hospitality_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_reservation_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitality_guests_tenant_isolation ON public.hospitality_guests;
CREATE POLICY hospitality_guests_tenant_isolation
  ON public.hospitality_guests
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

DROP POLICY IF EXISTS hospitality_reservations_tenant_isolation ON public.hospitality_reservations;
CREATE POLICY hospitality_reservations_tenant_isolation
  ON public.hospitality_reservations
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

DROP POLICY IF EXISTS hospitality_reservation_rooms_tenant_isolation ON public.hospitality_reservation_rooms;
CREATE POLICY hospitality_reservation_rooms_tenant_isolation
  ON public.hospitality_reservation_rooms
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

REVOKE ALL ON public.hospitality_guests FROM anon;
REVOKE ALL ON public.hospitality_reservations FROM anon;
REVOKE ALL ON public.hospitality_reservation_rooms FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_guests TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_reservations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_reservation_rooms TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_hospitality_guests_party_tenant ON public.hospitality_guests;
CREATE TRIGGER trg_hospitality_guests_party_tenant
  BEFORE INSERT OR UPDATE OF tenant_id, party_id ON public.hospitality_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_guest_party_tenant();

DROP TRIGGER IF EXISTS trg_hospitality_reservation_rooms_validation ON public.hospitality_reservation_rooms;
CREATE TRIGGER trg_hospitality_reservation_rooms_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, reservation_id, room_type_id, room_id, check_in_date, check_out_date, adults, children, status
  ON public.hospitality_reservation_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_reservation_room();

DROP TRIGGER IF EXISTS trg_hospitality_guests_updated_at ON public.hospitality_guests;
CREATE TRIGGER trg_hospitality_guests_updated_at
  BEFORE UPDATE ON public.hospitality_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_reservations_updated_at ON public.hospitality_reservations;
CREATE TRIGGER trg_hospitality_reservations_updated_at
  BEFORE UPDATE ON public.hospitality_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_reservation_rooms_updated_at ON public.hospitality_reservation_rooms;
CREATE TRIGGER trg_hospitality_reservation_rooms_updated_at
  BEFORE UPDATE ON public.hospitality_reservation_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.hospitality_guests IS
  'Bella Hospitality Phase 2 - product-owned guest profile linked to Platform Party identity.';

COMMENT ON TABLE public.hospitality_reservations IS
  'Bella Hospitality Phase 2 - product-owned hotel reservation header.';

COMMENT ON TABLE public.hospitality_reservation_rooms IS
  'Bella Hospitality Phase 2 - product-owned reserved room line; not a cross-industry allocation kernel.';
