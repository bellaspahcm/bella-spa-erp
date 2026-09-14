-- ============================================================================
-- E5 — ENGLISH CENTER TIMETABLE & ROOM SCHEDULING
-- ============================================================================
-- Product: Bella English Center
-- Phase: E5
-- Purpose: Branch-scoped rooms and class sessions for timetable planning.
-- Architecture: Product-level extension; no Education Kernel scheduling engine.
-- Compliance: Education OS Constitution, additive migration only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_room_code UNIQUE (tenant_id, branch_id, code)
);

CREATE TABLE IF NOT EXISTS public.english_center_class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES public.english_center_classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.english_center_teachers(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.english_center_rooms(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  topic VARCHAR(240),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_english_center_session_time CHECK (starts_at < ends_at)
);

-- zero-downtime: allow blocking-index - new E5 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_rooms_tenant_branch
  ON public.english_center_rooms(tenant_id, branch_id);

-- zero-downtime: allow blocking-index - new E5 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_rooms_status
  ON public.english_center_rooms(status)
  WHERE status = 'active';

-- zero-downtime: allow blocking-index - new E5 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_sessions_tenant_branch
  ON public.english_center_class_sessions(tenant_id, branch_id);

-- zero-downtime: allow blocking-index - new E5 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_sessions_class_window
  ON public.english_center_class_sessions(class_id, starts_at, ends_at)
  WHERE status = 'scheduled';

-- zero-downtime: allow blocking-index - new E5 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_sessions_teacher_window
  ON public.english_center_class_sessions(tenant_id, teacher_id, starts_at, ends_at)
  WHERE teacher_id IS NOT NULL AND status = 'scheduled';

-- zero-downtime: allow blocking-index - new E5 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_sessions_room_window
  ON public.english_center_class_sessions(tenant_id, room_id, starts_at, ends_at)
  WHERE room_id IS NOT NULL AND status = 'scheduled';

ALTER TABLE public.english_center_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_class_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS english_center_rooms_tenant_branch_isolation
  ON public.english_center_rooms;

CREATE POLICY english_center_rooms_tenant_branch_isolation
  ON public.english_center_rooms
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

DROP POLICY IF EXISTS english_center_sessions_tenant_branch_isolation
  ON public.english_center_class_sessions;

CREATE POLICY english_center_sessions_tenant_branch_isolation
  ON public.english_center_class_sessions
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

REVOKE ALL ON public.english_center_rooms FROM anon;
REVOKE ALL ON public.english_center_class_sessions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_rooms TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_class_sessions TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_english_center_rooms_updated_at
  ON public.english_center_rooms;

CREATE TRIGGER trg_english_center_rooms_updated_at
  BEFORE UPDATE ON public.english_center_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_english_center_sessions_updated_at
  ON public.english_center_class_sessions;

CREATE TRIGGER trg_english_center_sessions_updated_at
  BEFORE UPDATE ON public.english_center_class_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.english_center_rooms IS
  'E5 — English Center branch-scoped room registry.';

COMMENT ON TABLE public.english_center_class_sessions IS
  'E5 — English Center class timetable sessions with product-level conflict governance.';
