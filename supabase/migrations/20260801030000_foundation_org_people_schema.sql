-- ============================================================================
-- Bella EIP — Foundation Layer: Organization + People Directory Schema
-- Migration: 20260801030000
-- Layer: Foundation (Layer 1) — shared cross-module infrastructure
-- Architectural Invariant 01: Fully Additive. Zero impact on beauty_spa / babycare.
--
-- Tables created:
--   org_units          — Graph nodes (Company, Branch, Department, Team, Project, Task Force)
--   org_relationships  — Graph edges (belongs_to, manages, reports_to, participates_in)
--   people_directory   — All assignable persons (Employee, Broker, Agency, Partner, Consultant)
--   people_profiles    — Extended profile data for persons (email, phone, avatar)
--
-- Design notes:
--   - org_units uses a self-referential parent_id for primary tree display,
--     but org_relationships enables graph traversal for Matrix/Task Force structures.
--   - people_directory is NOT part of HR. It tracks "who exists" regardless of employment.
--     HR attaches Contract/Salary/Attendance to a person. People Directory just registers them.
--   - Assignment Engine queries people_directory via org_relationships — never imports HR.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. org_units — Organization graph nodes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Org unit type — supports flexible graph model beyond rigid tree
  unit_type   TEXT NOT NULL CHECK (unit_type IN (
    'company',      -- Công ty mẹ / pháp nhân
    'region',       -- Miền / vùng địa lý
    'branch',       -- Chi nhánh
    'department',   -- Phòng ban
    'team',         -- Team bán hàng / kỹ thuật
    'project',      -- Dự án (org context — không phải sản phẩm real estate)
    'task_force',   -- Nhóm công tác tạm thời
    'committee'     -- Hội đồng / ban
  )),

  name        TEXT NOT NULL,
  code        TEXT,                  -- Short identifier, e.g. "HCM-Q1", "TEAM-LUX"

  -- Primary parent for tree-style display.
  -- Full relationships are in org_relationships table for graph traversal.
  parent_id   UUID REFERENCES public.org_units(id) ON DELETE SET NULL,

  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB   NOT NULL DEFAULT '{}'::jsonb,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_org_unit_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_units_tenant        ON public.org_units (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_org_units_parent        ON public.org_units (parent_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_org_units_type_tenant   ON public.org_units (tenant_id, unit_type, is_active);

COMMENT ON TABLE public.org_units IS
  'Enterprise Foundation: Organization graph nodes. '
  'Supports Company/Region/Branch/Department/Team/Project/TaskForce/Committee. '
  'parent_id provides tree view; full graph is in org_relationships.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. org_relationships — Organization graph edges
-- Connects: Unit→Unit, Person→Unit, Person→Person
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_relationships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Source node (unit or person)
  from_id     UUID NOT NULL,
  from_type   TEXT NOT NULL CHECK (from_type IN ('unit', 'person')),

  -- Target node (unit or person)
  to_id       UUID NOT NULL,
  to_type     TEXT NOT NULL CHECK (to_type IN ('unit', 'person')),

  -- Relationship type
  rel_type    TEXT NOT NULL CHECK (rel_type IN (
    'belongs_to',       -- Person/Unit là thành viên của Unit
    'manages',          -- Person/Unit quản lý Unit khác
    'participates_in',  -- Person tham gia vào Task Force / Project
    'reports_to',       -- Person báo cáo trực tiếp cho manager
    'collaborates_with' -- Hợp tác ngang hàng
  )),

  -- Contextual role in this specific relationship
  -- e.g. "Team Lead" in this task force, "Sales Manager" in this branch
  role        TEXT,

  since       DATE,     -- When relationship started (NULL = from org founding)
  until       DATE,     -- When it ends (NULL = ongoing). Used for Task Force / rotation.

  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate active relationships of the same type
  CONSTRAINT uq_org_relationship UNIQUE (tenant_id, from_id, to_id, rel_type)
);

-- Hot path: getAssignablesInUnit uses this heavily
CREATE INDEX IF NOT EXISTS idx_org_rel_person_unit ON public.org_relationships
  (tenant_id, to_id, rel_type, from_type)
  WHERE from_type = 'person' AND rel_type = 'belongs_to';

-- Manager lookup: getManagerOf
CREATE INDEX IF NOT EXISTS idx_org_rel_reports_to ON public.org_relationships
  (tenant_id, from_id, rel_type)
  WHERE rel_type = 'reports_to' AND from_type = 'person';

-- General traversal
CREATE INDEX IF NOT EXISTS idx_org_rel_from ON public.org_relationships (tenant_id, from_id, from_type);
CREATE INDEX IF NOT EXISTS idx_org_rel_to   ON public.org_relationships (tenant_id, to_id, to_type);

COMMENT ON TABLE public.org_relationships IS
  'Enterprise Foundation: Organization graph edges. '
  'Enables Matrix/Task Force structures beyond rigid tree hierarchy. '
  'Hot path for Assignment Engine: getAssignablesInUnit uses from_type=person + rel_type=belongs_to.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. people_directory — All assignable persons (NOT limited to Employees)
--
-- Key design: A Broker, Agency, or Partner can receive Lead assignments
-- without having an HR record. This table is the source of truth for
-- "who can be assigned to what" regardless of employment type.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.people_directory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Auth user link — optional. Employees have auth.users; Brokers may not.
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  person_type  TEXT NOT NULL CHECK (person_type IN (
    'employee',    -- Nhân viên chính thức (has HR record)
    'broker',      -- Môi giới bên ngoài
    'agency',      -- Đại lý (F1, F2)
    'partner',     -- Đối tác chiến lược
    'consultant',  -- Tư vấn độc lập
    'contractor'   -- Nhân sự hợp đồng ngắn hạn
  )),

  display_name TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,

  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_dir_tenant        ON public.people_directory (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_people_dir_type          ON public.people_directory (tenant_id, person_type, is_active);
CREATE INDEX IF NOT EXISTS idx_people_dir_user          ON public.people_directory (user_id) WHERE user_id IS NOT NULL;
-- Unique: one directory entry per user per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_dir_user_tenant 
  ON public.people_directory (tenant_id, user_id) 
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.people_directory IS
  'Enterprise Foundation: All assignable persons. '
  'Covers Employee + Broker + Agency + Partner + Consultant. '
  'Assignment Engine queries this — never imports HR. '
  'HR attaches Contract/Salary/Attendance to persons here via person_id FK.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. people_profiles — Extended contact data (fetched separately, never in assignment records)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.people_profiles (
  id           UUID PRIMARY KEY REFERENCES public.people_directory(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  email        TEXT,
  phone        TEXT,
  avatar_url   TEXT,

  -- Denormalized org unit memberships for fast profile queries.
  -- Source of truth is org_relationships table.
  org_unit_ids UUID[] DEFAULT '{}',

  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_profiles_tenant ON public.people_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_people_profiles_email  ON public.people_profiles (email) WHERE email IS NOT NULL;

COMMENT ON TABLE public.people_profiles IS
  'Extended profile for persons in People Directory. '
  'Fetched by UI and Notification Hub — never by Assignment or SLA Engine. '
  'org_unit_ids is a denormalized cache — source of truth is org_relationships.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- Reuse or create the update_updated_at_column function (safe to call if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_units_updated_at ON public.org_units;
CREATE TRIGGER trg_org_units_updated_at
  BEFORE UPDATE ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_people_directory_updated_at ON public.people_directory;
CREATE TRIGGER trg_people_directory_updated_at
  BEFORE UPDATE ON public.people_directory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_people_profiles_updated_at ON public.people_profiles;
CREATE TRIGGER trg_people_profiles_updated_at
  BEFORE UPDATE ON public.people_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.org_units         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_relationships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_directory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_profiles    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN

  -- org_units: tenant-scoped read; admin-only write
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_units' AND policyname = 'org_units_tenant_read') THEN
    CREATE POLICY org_units_tenant_read ON public.org_units
      FOR SELECT TO authenticated
      USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_units' AND policyname = 'org_units_admin_write') THEN
    CREATE POLICY org_units_admin_write ON public.org_units
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'super_admin'))
        )
      );
  END IF;

  -- org_relationships: tenant-scoped read; admin-only write
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_relationships' AND policyname = 'org_relationships_tenant_read') THEN
    CREATE POLICY org_relationships_tenant_read ON public.org_relationships
      FOR SELECT TO authenticated
      USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_relationships' AND policyname = 'org_relationships_admin_write') THEN
    CREATE POLICY org_relationships_admin_write ON public.org_relationships
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'super_admin'))
        )
      );
  END IF;

  -- people_directory: tenant-scoped read; admin-only write
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'people_directory' AND policyname = 'people_directory_tenant_read') THEN
    CREATE POLICY people_directory_tenant_read ON public.people_directory
      FOR SELECT TO authenticated
      USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'people_directory' AND policyname = 'people_directory_admin_write') THEN
    CREATE POLICY people_directory_admin_write ON public.people_directory
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'super_admin'))
        )
      );
  END IF;

  -- people_profiles: tenant-scoped read; admin-only write
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'people_profiles' AND policyname = 'people_profiles_tenant_read') THEN
    CREATE POLICY people_profiles_tenant_read ON public.people_profiles
      FOR SELECT TO authenticated
      USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'people_profiles' AND policyname = 'people_profiles_admin_write') THEN
    CREATE POLICY people_profiles_admin_write ON public.people_profiles
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'super_admin'))
        )
      );
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.org_units          FROM anon;
REVOKE ALL ON TABLE public.org_relationships   FROM anon;
REVOKE ALL ON TABLE public.people_directory    FROM anon;
REVOKE ALL ON TABLE public.people_profiles     FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_units         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_relationships  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.people_directory   TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.people_profiles    TO authenticated, service_role;
