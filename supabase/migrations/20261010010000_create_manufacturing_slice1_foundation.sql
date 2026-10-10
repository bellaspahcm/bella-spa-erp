-- ============================================================================
-- Bella Manufacturing OS - Slice 1 Foundation
-- ============================================================================
-- Scope:
--   - Production Order
--   - BOM Revision and BOM Components
--   - Material Requirement
--   - Idempotent Command Log
--
-- Explicitly not included:
--   - ProductRegistry registration
--   - UI/API/runtime route registration
--   - Logistics stock mutation
--   - finished goods receipt
--   - Finance posting / accounting outbox
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  finished_good_item_id TEXT NOT NULL,
  target_quantity NUMERIC(18, 6) NOT NULL CHECK (target_quantity > 0),
  uom TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'released', 'cancelled')),
  bom_revision_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_by UUID,
  released_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_production_orders_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_production_orders_number UNIQUE (tenant_id, order_number),
  CONSTRAINT fk_manufacturing_production_orders_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_production_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL,
  finished_good_item_id TEXT NOT NULL,
  target_quantity NUMERIC(18, 6) NOT NULL CHECK (target_quantity > 0),
  uom TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_production_order_lines_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_production_order_lines_order_item
    UNIQUE (tenant_id, production_order_id, finished_good_item_id),
  CONSTRAINT fk_manufacturing_order_lines_order_tenant
    FOREIGN KEY (tenant_id, production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.manufacturing_bom_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  finished_good_item_id TEXT NOT NULL,
  revision_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_bom_revisions_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_bom_revision_code UNIQUE (tenant_id, finished_good_item_id, revision_code)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_bom_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bom_revision_id UUID NOT NULL,
  component_item_id TEXT NOT NULL,
  quantity_per_unit NUMERIC(18, 6) NOT NULL CHECK (quantity_per_unit > 0),
  uom TEXT NOT NULL,
  scrap_allowance_percent NUMERIC(8, 4) CHECK (scrap_allowance_percent IS NULL OR scrap_allowance_percent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_bom_components_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_manufacturing_bom_components_revision_tenant
    FOREIGN KEY (tenant_id, bom_revision_id)
    REFERENCES public.manufacturing_bom_revisions(tenant_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.manufacturing_material_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL,
  bom_revision_id UUID NOT NULL,
  component_item_id TEXT NOT NULL,
  source_location_id TEXT NOT NULL,
  required_quantity NUMERIC(18, 6) NOT NULL CHECK (required_quantity > 0),
  available_quantity NUMERIC(18, 6),
  status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (status IN ('not_checked', 'available', 'shortage', 'not_proven')),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_material_requirements_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_material_requirements_component
    UNIQUE (tenant_id, production_order_id, bom_revision_id, component_item_id, source_location_id),
  CONSTRAINT fk_manufacturing_material_requirements_order_tenant
    FOREIGN KEY (tenant_id, production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_material_requirements_bom_tenant
    FOREIGN KEY (tenant_id, bom_revision_id)
    REFERENCES public.manufacturing_bom_revisions(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  operation TEXT NOT NULL,
  business_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_command_idempotency UNIQUE (tenant_id, operation, business_key),
  CONSTRAINT fk_manufacturing_command_idempotency_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

-- zero-downtime: allow blocking-index - new Manufacturing Slice 1 tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_tenant_factory_status
  ON public.manufacturing_production_orders(tenant_id, factory_org_unit_id, status);

-- zero-downtime: allow blocking-index - new Manufacturing Slice 1 tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_bom_revisions_finished_good
  ON public.manufacturing_bom_revisions(tenant_id, finished_good_item_id, status);

-- zero-downtime: allow blocking-index - new Manufacturing Slice 1 tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_requirements_order
  ON public.manufacturing_material_requirements(tenant_id, production_order_id, status);

CREATE OR REPLACE FUNCTION public.manufacturing_factory_access_allowed(
  p_tenant_id UUID,
  p_factory_org_unit_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND p_factory_org_unit_id IN (
      SELECT access.org_unit_id
      FROM public.user_org_unit_access access
      WHERE access.user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND access.tenant_id = p_tenant_id
    );
$$;

ALTER TABLE public.manufacturing_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_production_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_bom_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_bom_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_material_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_command_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturing_production_orders_factory_access ON public.manufacturing_production_orders;
CREATE POLICY manufacturing_production_orders_factory_access
  ON public.manufacturing_production_orders
  FOR ALL
  USING (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id))
  WITH CHECK (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id));

DROP POLICY IF EXISTS manufacturing_order_lines_tenant_access ON public.manufacturing_production_order_lines;
CREATE POLICY manufacturing_order_lines_tenant_access
  ON public.manufacturing_production_order_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_production_order_lines.tenant_id
        AND po.id = manufacturing_production_order_lines.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_production_order_lines.tenant_id
        AND po.id = manufacturing_production_order_lines.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  );

DROP POLICY IF EXISTS manufacturing_bom_revisions_tenant_access ON public.manufacturing_bom_revisions;
CREATE POLICY manufacturing_bom_revisions_tenant_access
  ON public.manufacturing_bom_revisions
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

DROP POLICY IF EXISTS manufacturing_bom_components_tenant_access ON public.manufacturing_bom_components;
CREATE POLICY manufacturing_bom_components_tenant_access
  ON public.manufacturing_bom_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_bom_revisions bom
      WHERE bom.tenant_id = manufacturing_bom_components.tenant_id
        AND bom.id = manufacturing_bom_components.bom_revision_id
        AND bom.tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_bom_revisions bom
      WHERE bom.tenant_id = manufacturing_bom_components.tenant_id
        AND bom.id = manufacturing_bom_components.bom_revision_id
        AND bom.tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

DROP POLICY IF EXISTS manufacturing_material_requirements_order_access ON public.manufacturing_material_requirements;
CREATE POLICY manufacturing_material_requirements_order_access
  ON public.manufacturing_material_requirements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_material_requirements.tenant_id
        AND po.id = manufacturing_material_requirements.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_material_requirements.tenant_id
        AND po.id = manufacturing_material_requirements.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  );

DROP POLICY IF EXISTS manufacturing_command_idempotency_factory_access ON public.manufacturing_command_idempotency;
CREATE POLICY manufacturing_command_idempotency_factory_access
  ON public.manufacturing_command_idempotency
  FOR ALL
  USING (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id))
  WITH CHECK (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id));

REVOKE ALL ON public.manufacturing_production_orders FROM anon;
REVOKE ALL ON public.manufacturing_production_order_lines FROM anon;
REVOKE ALL ON public.manufacturing_bom_revisions FROM anon;
REVOKE ALL ON public.manufacturing_bom_components FROM anon;
REVOKE ALL ON public.manufacturing_material_requirements FROM anon;
REVOKE ALL ON public.manufacturing_command_idempotency FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_production_orders TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_production_order_lines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_bom_revisions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_bom_components TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_material_requirements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_command_idempotency TO authenticated, service_role;

COMMENT ON TABLE public.manufacturing_production_orders IS
  'Manufacturing Slice 1: production planning order header. No stock mutation or Finance posting.';

COMMENT ON TABLE public.manufacturing_material_requirements IS
  'Manufacturing Slice 1: calculated material requirements and read-only availability result.';

COMMENT ON TABLE public.manufacturing_command_idempotency IS
  'Manufacturing Slice 1: command duplicate defense keyed by tenant, operation, and business key.';
