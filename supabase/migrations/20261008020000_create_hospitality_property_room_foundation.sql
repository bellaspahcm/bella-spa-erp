-- ============================================================================
-- Bella Hospitality Phase 1 - Hotel Property + Room Foundation
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 1
-- Purpose: Product-owned physical hotel hierarchy only.
-- Boundary: No Reservation, Guest, Stay, Folio, Payment, Travel, or Resource Kernel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospitality_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(240),
  property_type VARCHAR(30) NOT NULL DEFAULT 'hotel'
    CHECK (property_type IN ('hotel', 'resort', 'aparthotel', 'hostel', 'villa', 'mixed')),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  address_line1 VARCHAR(240),
  city VARCHAR(120),
  country_code CHAR(2) NOT NULL DEFAULT 'VN',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hospitality_properties_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_hospitality_properties_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_buildings_property_tenant
    FOREIGN KEY (tenant_id, property_id)
    REFERENCES public.hospitality_properties(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT uq_hospitality_buildings_property_code UNIQUE (tenant_id, property_id, code),
  CONSTRAINT uq_hospitality_buildings_tenant_property_id UNIQUE (tenant_id, property_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  building_id UUID NOT NULL,
  floor_number INTEGER NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_floors_building_tenant
    FOREIGN KEY (tenant_id, property_id, building_id)
    REFERENCES public.hospitality_buildings(tenant_id, property_id, id)
    ON DELETE CASCADE,
  CONSTRAINT uq_hospitality_floors_building_code UNIQUE (tenant_id, building_id, code),
  CONSTRAINT uq_hospitality_floors_tenant_property_building_id
    UNIQUE (tenant_id, property_id, building_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  max_occupancy INTEGER NOT NULL CHECK (max_occupancy > 0),
  base_adults INTEGER NOT NULL DEFAULT 2 CHECK (base_adults >= 0),
  base_children INTEGER NOT NULL DEFAULT 0 CHECK (base_children >= 0),
  bed_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_room_types_property_tenant
    FOREIGN KEY (tenant_id, property_id)
    REFERENCES public.hospitality_properties(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_hospitality_room_type_base_occupancy
    CHECK (base_adults + base_children <= max_occupancy),
  CONSTRAINT uq_hospitality_room_types_property_code UNIQUE (tenant_id, property_id, code),
  CONSTRAINT uq_hospitality_room_types_tenant_property_id UNIQUE (tenant_id, property_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  building_id UUID NOT NULL,
  floor_id UUID NOT NULL,
  room_type_id UUID NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  display_name VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_rooms_floor_tenant
    FOREIGN KEY (tenant_id, property_id, building_id, floor_id)
    REFERENCES public.hospitality_floors(tenant_id, property_id, building_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hospitality_rooms_room_type_tenant
    FOREIGN KEY (tenant_id, property_id, room_type_id)
    REFERENCES public.hospitality_room_types(tenant_id, property_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_hospitality_rooms_property_room_number UNIQUE (tenant_id, property_id, room_number)
);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_properties_tenant_status
  ON public.hospitality_properties(tenant_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_buildings_property
  ON public.hospitality_buildings(tenant_id, property_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_floors_building
  ON public.hospitality_floors(tenant_id, building_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_room_types_property
  ON public.hospitality_room_types(tenant_id, property_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_rooms_property
  ON public.hospitality_rooms(tenant_id, property_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_rooms_floor
  ON public.hospitality_rooms(tenant_id, floor_id);

ALTER TABLE public.hospitality_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitality_properties_tenant_isolation ON public.hospitality_properties;
CREATE POLICY hospitality_properties_tenant_isolation
  ON public.hospitality_properties
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

DROP POLICY IF EXISTS hospitality_buildings_tenant_isolation ON public.hospitality_buildings;
CREATE POLICY hospitality_buildings_tenant_isolation
  ON public.hospitality_buildings
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

DROP POLICY IF EXISTS hospitality_floors_tenant_isolation ON public.hospitality_floors;
CREATE POLICY hospitality_floors_tenant_isolation
  ON public.hospitality_floors
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

DROP POLICY IF EXISTS hospitality_room_types_tenant_isolation ON public.hospitality_room_types;
CREATE POLICY hospitality_room_types_tenant_isolation
  ON public.hospitality_room_types
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

DROP POLICY IF EXISTS hospitality_rooms_tenant_isolation ON public.hospitality_rooms;
CREATE POLICY hospitality_rooms_tenant_isolation
  ON public.hospitality_rooms
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

REVOKE ALL ON public.hospitality_properties FROM anon;
REVOKE ALL ON public.hospitality_buildings FROM anon;
REVOKE ALL ON public.hospitality_floors FROM anon;
REVOKE ALL ON public.hospitality_room_types FROM anon;
REVOKE ALL ON public.hospitality_rooms FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_properties TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_buildings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_floors TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_room_types TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_rooms TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_hospitality_properties_updated_at ON public.hospitality_properties;
CREATE TRIGGER trg_hospitality_properties_updated_at
  BEFORE UPDATE ON public.hospitality_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_buildings_updated_at ON public.hospitality_buildings;
CREATE TRIGGER trg_hospitality_buildings_updated_at
  BEFORE UPDATE ON public.hospitality_buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_floors_updated_at ON public.hospitality_floors;
CREATE TRIGGER trg_hospitality_floors_updated_at
  BEFORE UPDATE ON public.hospitality_floors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_room_types_updated_at ON public.hospitality_room_types;
CREATE TRIGGER trg_hospitality_room_types_updated_at
  BEFORE UPDATE ON public.hospitality_room_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_rooms_updated_at ON public.hospitality_rooms;
CREATE TRIGGER trg_hospitality_rooms_updated_at
  BEFORE UPDATE ON public.hospitality_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.hospitality_properties IS
  'Bella Hospitality Phase 1 - product-owned hotel property registry.';

COMMENT ON TABLE public.hospitality_rooms IS
  'Bella Hospitality Phase 1 - product-owned physical room registry; not a cross-industry resource kernel.';
