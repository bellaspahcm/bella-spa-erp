-- H8 Beauty OS persistence. Additive only; legacy BabyCare tables remain compatibility inputs.

CREATE TABLE IF NOT EXISTS beauty_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')) DEFAULT 'PENDING',
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS beauty_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES beauty_appointments(id) ON DELETE RESTRICT,
  service_commitment_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')) DEFAULT 'PLANNED',
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  actual_performer_id UUID,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (actual_end_at IS NULL OR actual_start_at IS NOT NULL),
  CHECK (actual_end_at IS NULL OR actual_end_at > actual_start_at),
  CHECK (status <> 'COMPLETED' OR (actual_performer_id IS NOT NULL AND outcome IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS beauty_professional_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_commitment_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED','ACCEPTED','REJECTED','DISRUPTED')) DEFAULT 'PROPOSED',
  replacement_for_id UUID REFERENCES beauty_professional_assignments(id) ON DELETE RESTRICT,
  reason TEXT,
  actor_id UUID,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status NOT IN ('REJECTED','DISRUPTED') OR (reason IS NOT NULL AND actor_id IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS beauty_resource_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_commitment_id UUID NOT NULL,
  segment_id UUID NOT NULL,
  resource_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity_units INTEGER NOT NULL DEFAULT 1 CHECK (capacity_units > 0),
  status TEXT NOT NULL CHECK (status IN ('PROPOSED','ACTIVE','RELEASED','DISRUPTED')) DEFAULT 'PROPOSED',
  replacement_for_id UUID REFERENCES beauty_resource_allocations(id) ON DELETE RESTRICT,
  reason TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at),
  CHECK (status NOT IN ('DISRUPTED') OR (reason IS NOT NULL AND actor_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS beauty_professional_assignment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES beauty_professional_assignments(id) ON DELETE RESTRICT,
  from_professional_id UUID,
  to_professional_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beauty_resource_allocation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  allocation_id UUID NOT NULL REFERENCES beauty_resource_allocations(id) ON DELETE RESTRICT,
  replacement_allocation_id UUID REFERENCES beauty_resource_allocations(id) ON DELETE RESTRICT,
  old_resource_id UUID,
  new_resource_id UUID,
  segment_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beauty_appointments_tenant_time ON beauty_appointments(tenant_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_beauty_sessions_tenant_appointment ON beauty_sessions(tenant_id, appointment_id);
CREATE INDEX IF NOT EXISTS idx_beauty_assignments_tenant_commitment ON beauty_professional_assignments(tenant_id, service_commitment_id, status);
CREATE INDEX IF NOT EXISTS idx_beauty_allocations_tenant_resource_time ON beauty_resource_allocations(tenant_id, resource_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_beauty_allocations_tenant_segment ON beauty_resource_allocations(tenant_id, service_commitment_id, segment_id);

ALTER TABLE beauty_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_professional_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_professional_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_resource_allocation_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_professional_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_resource_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_professional_assignment_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON beauty_resource_allocation_history TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beauty_appointments' AND policyname = 'beauty_appointments_tenant_isolation') THEN
    CREATE POLICY beauty_appointments_tenant_isolation ON beauty_appointments FOR ALL TO authenticated
      USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id())
      WITH CHECK (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beauty_sessions' AND policyname = 'beauty_sessions_tenant_isolation') THEN
    CREATE POLICY beauty_sessions_tenant_isolation ON beauty_sessions FOR ALL TO authenticated
      USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id())
      WITH CHECK (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beauty_professional_assignments' AND policyname = 'beauty_assignments_tenant_isolation') THEN
    CREATE POLICY beauty_assignments_tenant_isolation ON beauty_professional_assignments FOR ALL TO authenticated
      USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id())
      WITH CHECK (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beauty_resource_allocations' AND policyname = 'beauty_allocations_tenant_isolation') THEN
    CREATE POLICY beauty_allocations_tenant_isolation ON beauty_resource_allocations FOR ALL TO authenticated
      USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id())
      WITH CHECK (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beauty_professional_assignment_history' AND policyname = 'beauty_assignment_history_tenant_isolation') THEN
    CREATE POLICY beauty_assignment_history_tenant_isolation ON beauty_professional_assignment_history FOR ALL TO authenticated
      USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id())
      WITH CHECK (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beauty_resource_allocation_history' AND policyname = 'beauty_allocation_history_tenant_isolation') THEN
    CREATE POLICY beauty_allocation_history_tenant_isolation ON beauty_resource_allocation_history FOR ALL TO authenticated
      USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id())
      WITH CHECK (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());
  END IF;
END
$$;
