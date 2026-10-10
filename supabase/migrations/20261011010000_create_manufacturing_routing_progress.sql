-- ============================================================================
-- Bella Manufacturing OS - Routing, Work Center, Operation Progress
-- ============================================================================
-- Scope:
--   - Manufacturing-owned Work Center
--   - Routing Revision and Routing Operations
--   - Production Operation Progress
--
-- Explicitly not included:
--   - Logistics stock mutation
--   - Finance posting / costing / WIP
--   - UI/API/runtime route registration
--   - ProductRegistry registration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manufacturing_work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_work_centers_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_work_centers_code UNIQUE (tenant_id, factory_org_unit_id, code),
  CONSTRAINT fk_manufacturing_work_centers_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_routing_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  finished_good_item_id TEXT NOT NULL,
  revision_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_routing_revisions_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_routing_revision_code
    UNIQUE (tenant_id, factory_org_unit_id, finished_good_item_id, revision_code),
  CONSTRAINT fk_manufacturing_routing_revisions_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_routing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  routing_revision_id UUID NOT NULL,
  operation_sequence INTEGER NOT NULL CHECK (operation_sequence > 0),
  operation_code TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  work_center_id UUID NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_routing_operations_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_routing_operation_revision_id
    UNIQUE (tenant_id, routing_revision_id, id),
  CONSTRAINT uq_manufacturing_routing_operation_sequence
    UNIQUE (tenant_id, routing_revision_id, operation_sequence),
  CONSTRAINT uq_manufacturing_routing_operation_code
    UNIQUE (tenant_id, routing_revision_id, operation_code),
  CONSTRAINT fk_manufacturing_routing_operations_revision_tenant
    FOREIGN KEY (tenant_id, routing_revision_id)
    REFERENCES public.manufacturing_routing_revisions(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_routing_operations_work_center_tenant
    FOREIGN KEY (tenant_id, work_center_id)
    REFERENCES public.manufacturing_work_centers(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.manufacturing_operation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  factory_org_unit_id UUID NOT NULL,
  production_order_id UUID NOT NULL,
  production_order_line_id UUID NOT NULL,
  routing_revision_id UUID NOT NULL,
  routing_operation_id UUID NOT NULL,
  work_center_id UUID NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'ready', 'in_progress', 'completed', 'blocked')),
  blocked_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manufacturing_operation_progress_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_manufacturing_operation_progress_operation
    UNIQUE (tenant_id, production_order_line_id, routing_operation_id),
  CONSTRAINT ck_manufacturing_operation_progress_blocked_reason
    CHECK (status <> 'blocked' OR NULLIF(BTRIM(blocked_reason), '') IS NOT NULL),
  CONSTRAINT fk_manufacturing_operation_progress_order_tenant
    FOREIGN KEY (tenant_id, production_order_id)
    REFERENCES public.manufacturing_production_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_operation_progress_order_line_tenant
    FOREIGN KEY (tenant_id, production_order_line_id)
    REFERENCES public.manufacturing_production_order_lines(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_manufacturing_operation_progress_revision_tenant
    FOREIGN KEY (tenant_id, routing_revision_id)
    REFERENCES public.manufacturing_routing_revisions(tenant_id, id),
  CONSTRAINT fk_manufacturing_operation_progress_operation_revision
    FOREIGN KEY (tenant_id, routing_revision_id, routing_operation_id)
    REFERENCES public.manufacturing_routing_operations(tenant_id, routing_revision_id, id),
  CONSTRAINT fk_manufacturing_operation_progress_work_center_tenant
    FOREIGN KEY (tenant_id, work_center_id)
    REFERENCES public.manufacturing_work_centers(tenant_id, id),
  CONSTRAINT fk_manufacturing_operation_progress_factory
    FOREIGN KEY (factory_org_unit_id)
    REFERENCES public.org_units(id)
);

-- zero-downtime: allow blocking-index - new Manufacturing routing tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_work_centers_factory
  ON public.manufacturing_work_centers(tenant_id, factory_org_unit_id, status);

-- zero-downtime: allow blocking-index - new Manufacturing routing tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_routing_revisions_finished_good
  ON public.manufacturing_routing_revisions(tenant_id, factory_org_unit_id, finished_good_item_id, status);

-- zero-downtime: allow blocking-index - new Manufacturing routing tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_manufacturing_operation_progress_order
  ON public.manufacturing_operation_progress(tenant_id, production_order_id, production_order_line_id, status);

ALTER TABLE public.manufacturing_work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_routing_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_routing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_operation_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturing_work_centers_factory_access
  ON public.manufacturing_work_centers;
CREATE POLICY manufacturing_work_centers_factory_access
  ON public.manufacturing_work_centers
  FOR ALL
  USING (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id))
  WITH CHECK (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id));

DROP POLICY IF EXISTS manufacturing_routing_revisions_factory_access
  ON public.manufacturing_routing_revisions;
CREATE POLICY manufacturing_routing_revisions_factory_access
  ON public.manufacturing_routing_revisions
  FOR ALL
  USING (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id))
  WITH CHECK (public.manufacturing_factory_access_allowed(tenant_id, factory_org_unit_id));

DROP POLICY IF EXISTS manufacturing_routing_operations_revision_access
  ON public.manufacturing_routing_operations;
CREATE POLICY manufacturing_routing_operations_revision_access
  ON public.manufacturing_routing_operations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_routing_revisions revision
      WHERE revision.tenant_id = manufacturing_routing_operations.tenant_id
        AND revision.id = manufacturing_routing_operations.routing_revision_id
        AND public.manufacturing_factory_access_allowed(revision.tenant_id, revision.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_routing_revisions revision
      WHERE revision.tenant_id = manufacturing_routing_operations.tenant_id
        AND revision.id = manufacturing_routing_operations.routing_revision_id
        AND public.manufacturing_factory_access_allowed(revision.tenant_id, revision.factory_org_unit_id)
    )
  );

DROP POLICY IF EXISTS manufacturing_operation_progress_order_access
  ON public.manufacturing_operation_progress;
CREATE POLICY manufacturing_operation_progress_order_access
  ON public.manufacturing_operation_progress
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_operation_progress.tenant_id
        AND po.id = manufacturing_operation_progress.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manufacturing_production_orders po
      WHERE po.tenant_id = manufacturing_operation_progress.tenant_id
        AND po.id = manufacturing_operation_progress.production_order_id
        AND public.manufacturing_factory_access_allowed(po.tenant_id, po.factory_org_unit_id)
    )
  );

REVOKE ALL ON public.manufacturing_work_centers FROM anon;
REVOKE ALL ON public.manufacturing_routing_revisions FROM anon;
REVOKE ALL ON public.manufacturing_routing_operations FROM anon;
REVOKE ALL ON public.manufacturing_operation_progress FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_work_centers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_routing_revisions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_routing_operations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_operation_progress TO authenticated, service_role;

COMMENT ON TABLE public.manufacturing_work_centers IS
  'Manufacturing: factory work centers for routing. No stock mutation or Finance posting.';

COMMENT ON TABLE public.manufacturing_routing_revisions IS
  'Manufacturing: versioned production routing definition for finished goods.';

COMMENT ON TABLE public.manufacturing_routing_operations IS
  'Manufacturing: ordered operations in a routing revision.';

COMMENT ON TABLE public.manufacturing_operation_progress IS
  'Manufacturing: production order line operation progress. No stock mutation or Finance posting.';
