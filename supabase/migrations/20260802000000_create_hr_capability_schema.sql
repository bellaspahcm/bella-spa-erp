-- ============================================================================
-- Bella EIP — HR Capability Schema
-- Migration: 20260802000000
-- Layer: Capability (Layer 2) — consumes Foundation; never touches legacy modules
--
-- Architectural Invariant 01: Fully additive. Zero impact on beauty_spa / babycare.
-- people_directory.id is the person identity anchor — HR never re-creates person data.
--
-- Tables:
--   hr_departments       — HR-level grouping (different from org_units which is structural)
--   hr_employee_profiles — Employment context for employees in people_directory
--   hr_contracts         — Employment contracts (multiple per employee: initial, renewal, amendment)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. hr_departments — HR grouping layer
-- Scope: HR administrative view (Payroll, Leave tracking)
-- NOT the same as org_units (structural graph) — a team can cross departments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hr_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  code          TEXT,              -- Short code, e.g. "SALES", "OPS", "TECH"
  description   TEXT,

  -- HR department can optionally map to an org_unit for cross-reference
  -- (NULL-safe: org_unit may not exist for pure HR departments)
  org_unit_id   UUID REFERENCES public.org_units(id) ON DELETE SET NULL,

  head_person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,

  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB   NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hr_dept_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hr_dept_tenant ON public.hr_departments (tenant_id, is_active);

COMMENT ON TABLE public.hr_departments IS
  'HR Capability (Layer 2): HR administrative departments. '
  'Distinct from org_units (Foundation graph). '
  'Used for payroll grouping, leave approval chains, headcount reporting.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. hr_employee_profiles — Employment context
-- One-to-one with people_directory for person_type = ''employee''
-- HR-only fields: hire date, department, position, manager, employment status
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hr_employee_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- The identity anchor — always resolve display name via people_directory
  person_id     UUID NOT NULL REFERENCES public.people_directory(id) ON DELETE CASCADE,

  -- Employment classification
  employment_type TEXT NOT NULL CHECK (employment_type IN (
    'full_time',    -- Toàn thời gian
    'part_time',    -- Bán thời gian
    'contract',     -- Hợp đồng có thời hạn
    'probation',    -- Thử việc
    'intern',       -- Thực tập sinh
    'freelance'     -- Cộng tác viên không có hợp đồng lao động
  )) DEFAULT 'full_time',

  -- Position and grade
  position_title  TEXT,           -- e.g. "Senior Sales Specialist"
  grade           TEXT,           -- e.g. "L3", "Senior", "Manager"
  salary_band     TEXT,           -- e.g. "Band-B", "Band-Manager"

  -- Hierarchy
  department_id   UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  manager_person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,

  -- Key dates
  hire_date       DATE,
  probation_end   DATE,           -- When probation period ends
  confirmation_date DATE,         -- When employment confirmed (after probation)
  termination_date DATE,          -- NULL = still employed

  -- Employment status (HR operational status)
  employment_status TEXT NOT NULL CHECK (employment_status IN (
    'active',        -- Đang làm việc
    'on_leave',      -- Đang nghỉ phép dài (thai sản, ốm đau)
    'probation',     -- Đang thử việc
    'suspended',     -- Tạm đình chỉ
    'terminated',    -- Đã nghỉ việc
    'resigned'       -- Tự nghỉ
  )) DEFAULT 'active',

  -- Base compensation (HR owns this; Assignment Engine never reads salary)
  base_salary     NUMERIC(15, 2),
  currency        TEXT NOT NULL DEFAULT 'VND',

  -- Social insurance and tax
  bhxh_number     TEXT,           -- Số BHXH
  tax_code        TEXT,           -- Mã số thuế cá nhân
  bank_account    TEXT,           -- Số tài khoản ngân hàng
  bank_name       TEXT,           -- Tên ngân hàng

  -- Work schedule
  work_schedule   TEXT CHECK (work_schedule IN (
    'mon_fri',       -- Thứ 2 - Thứ 6
    'mon_sat',       -- Thứ 2 - Thứ 7
    'shift',         -- Ca kíp (theo lịch)
    'flexible'       -- Linh hoạt
  )) DEFAULT 'mon_sat',

  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active HR profile per person per tenant
  CONSTRAINT uq_hr_profile_person UNIQUE (tenant_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_profile_tenant     ON public.hr_employee_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_profile_dept       ON public.hr_employee_profiles (tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_hr_profile_status     ON public.hr_employee_profiles (tenant_id, employment_status);
CREATE INDEX IF NOT EXISTS idx_hr_profile_person     ON public.hr_employee_profiles (person_id);
CREATE INDEX IF NOT EXISTS idx_hr_profile_manager    ON public.hr_employee_profiles (manager_person_id) WHERE manager_person_id IS NOT NULL;

COMMENT ON TABLE public.hr_employee_profiles IS
  'HR Capability (Layer 2): Employment context for persons in people_directory. '
  'Links via person_id — never duplicates display_name. '
  'Source of truth for hire_date, position, department, salary_band, BHXH.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. hr_contracts — Employment contract documents
-- One employee can have multiple contracts (initial, renewal, amendment, termination)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hr_contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Links to employee profile (not directly to person_id — always through profile)
  profile_id    UUID NOT NULL REFERENCES public.hr_employee_profiles(id) ON DELETE CASCADE,

  -- Contract classification
  contract_type TEXT NOT NULL CHECK (contract_type IN (
    'probation',          -- Hợp đồng thử việc
    'fixed_term_1y',      -- HĐLĐ xác định thời hạn 1 năm
    'fixed_term_3y',      -- HĐLĐ xác định thời hạn 3 năm
    'indefinite',         -- HĐLĐ không xác định thời hạn
    'freelance',          -- Hợp đồng cộng tác viên
    'service_contract',   -- Hợp đồng dịch vụ
    'amendment',          -- Phụ lục hợp đồng
    'termination'         -- Biên bản thỏa thuận chấm dứt
  )),

  -- Contract number / reference
  contract_number TEXT,
  contract_title  TEXT,       -- e.g. "HĐLĐ lần 2 - Vị trí Chuyên viên Kinh doanh"

  -- Contract period
  start_date    DATE NOT NULL,
  end_date      DATE,         -- NULL for indefinite contracts

  -- Financial terms at contract signing (snapshot — not the live salary)
  agreed_base_salary  NUMERIC(15, 2),
  agreed_allowances   JSONB DEFAULT '{}'::jsonb,  -- {transport: 500000, lunch: 800000, phone: 300000}

  -- Workflow status
  status        TEXT NOT NULL CHECK (status IN (
    'draft',       -- Đang soạn thảo
    'pending',     -- Chờ ký
    'active',      -- Đang hiệu lực
    'expired',     -- Hết hạn
    'terminated',  -- Chấm dứt sớm
    'superseded'   -- Bị thay thế bởi hợp đồng mới
  )) DEFAULT 'draft',

  -- Document reference (URL to signed document in storage)
  document_url  TEXT,

  -- Signatory tracking
  signed_by_employee  BOOLEAN NOT NULL DEFAULT FALSE,
  signed_by_company   BOOLEAN NOT NULL DEFAULT FALSE,
  signed_at           TIMESTAMPTZ,

  -- Notes
  notes         TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_contracts_profile  ON public.hr_contracts (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_contracts_tenant   ON public.hr_contracts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_contracts_active   ON public.hr_contracts (tenant_id, start_date, end_date) WHERE status = 'active';

COMMENT ON TABLE public.hr_contracts IS
  'HR Capability (Layer 2): Employment contracts linked to hr_employee_profiles. '
  'Multiple contracts per employee: probation → fixed_term → indefinite → amendments. '
  'Financial terms are snapshots at signing; live salary is in hr_employee_profiles.base_salary.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_hr_departments_updated_at ON public.hr_departments;
CREATE TRIGGER trg_hr_departments_updated_at
  BEFORE UPDATE ON public.hr_departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hr_profiles_updated_at ON public.hr_employee_profiles;
CREATE TRIGGER trg_hr_profiles_updated_at
  BEFORE UPDATE ON public.hr_employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hr_contracts_updated_at ON public.hr_contracts;
CREATE TRIGGER trg_hr_contracts_updated_at
  BEFORE UPDATE ON public.hr_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.hr_departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_contracts          ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN

  -- hr_departments: read by all staff; write by admin + hr
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_departments' AND policyname = 'hr_dept_tenant_read') THEN
    CREATE POLICY hr_dept_tenant_read ON public.hr_departments
      FOR SELECT TO authenticated
      USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_departments' AND policyname = 'hr_dept_admin_write') THEN
    CREATE POLICY hr_dept_admin_write ON public.hr_departments
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'hr'))
        )
      );
  END IF;

  -- hr_employee_profiles: HR + admin read/write; KTV read own only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_employee_profiles' AND policyname = 'hr_profile_admin_read') THEN
    CREATE POLICY hr_profile_admin_read ON public.hr_employee_profiles
      FOR SELECT TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'hr', 'accountant'))
        )
        OR (
          -- Employee can read their own profile
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (
            SELECT 1
            FROM public.people_directory pd
            WHERE pd.id = hr_employee_profiles.person_id
              AND pd.user_id = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_employee_profiles' AND policyname = 'hr_profile_admin_write') THEN
    CREATE POLICY hr_profile_admin_write ON public.hr_employee_profiles
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'hr'))
        )
      );
  END IF;

  -- hr_contracts: HR + admin read/write; employee reads their own
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_contracts' AND policyname = 'hr_contracts_admin_read') THEN
    CREATE POLICY hr_contracts_admin_read ON public.hr_contracts
      FOR SELECT TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'hr', 'accountant'))
        )
        OR (
          -- Employee reads their own contracts
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (
            SELECT 1
            FROM public.hr_employee_profiles ep
            JOIN public.people_directory pd ON pd.id = ep.person_id
            WHERE ep.id = hr_contracts.profile_id
              AND pd.user_id = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hr_contracts' AND policyname = 'hr_contracts_admin_write') THEN
    CREATE POLICY hr_contracts_admin_write ON public.hr_contracts
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND lower(u.role) IN ('admin', 'hr'))
        )
      );
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.hr_departments       FROM anon;
REVOKE ALL ON TABLE public.hr_employee_profiles FROM anon;
REVOKE ALL ON TABLE public.hr_contracts         FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_departments       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_employee_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_contracts         TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Useful RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- get_hr_employee_summary: join people_directory + hr_employee_profiles + hr_departments
CREATE OR REPLACE FUNCTION public.get_hr_employee_summary(
  p_tenant_id UUID,
  p_status    TEXT DEFAULT NULL   -- NULL = all active; otherwise filter by employment_status
)
RETURNS TABLE (
  person_id         UUID,
  display_name      TEXT,
  person_type       TEXT,
  position_title    TEXT,
  employment_type   TEXT,
  employment_status TEXT,
  department_name   TEXT,
  hire_date         DATE,
  base_salary       NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  -- Authorization
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND lower(u.role) IN ('admin', 'hr', 'accountant', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'HR access denied: admin, hr, or accountant role required.';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    pd.id             AS person_id,
    pd.display_name,
    pd.person_type,
    ep.position_title,
    ep.employment_type,
    ep.employment_status,
    d.name            AS department_name,
    ep.hire_date,
    ep.base_salary
  FROM public.people_directory pd
  JOIN public.hr_employee_profiles ep ON ep.person_id = pd.id
  LEFT JOIN public.hr_departments d   ON d.id = ep.department_id
  WHERE pd.tenant_id = p_tenant_id
    AND pd.is_active  = TRUE
    AND (p_status IS NULL OR ep.employment_status = p_status)
  ORDER BY d.name NULLS LAST, pd.display_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hr_employee_summary(UUID, TEXT) TO authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
