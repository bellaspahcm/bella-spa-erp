-- ============================================================================
-- E7 - ENGLISH CENTER TUITION & BILLING
-- ============================================================================
-- Product: Bella English Center
-- Phase: E7
-- Purpose: Product-owned tuition plan, invoice, payment, and allocation context.
-- Architecture: Product-level extension; accounting/cash interactions go through
-- Finance OS public contracts only.
-- Compliance: Education OS Constitution, Finance boundary, additive migration only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_tuition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.org_units(id) ON DELETE RESTRICT,
  program_id UUID REFERENCES public.english_center_programs(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.english_center_classes(id) ON DELETE SET NULL,
  code VARCHAR(80) NOT NULL,
  name TEXT NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'term', 'course', 'installment')),
  amount_minor NUMERIC(20, 0) NOT NULL CHECK (amount_minor >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_tuition_plan_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.english_center_tuition_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  tuition_plan_id UUID NOT NULL REFERENCES public.english_center_tuition_plans(id) ON DELETE RESTRICT,
  english_enrollment_id UUID NOT NULL REFERENCES public.english_center_enrollments(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.english_center_classes(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_tuition_assignment_active
    UNIQUE (tenant_id, tuition_plan_id, english_enrollment_id, start_date)
);

CREATE TABLE IF NOT EXISTS public.english_center_tuition_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL REFERENCES public.english_center_tuition_assignments(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(80) NOT NULL,
  invoice_status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (invoice_status IN ('draft', 'issued', 'void')),
  settlement_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (settlement_status IN ('unpaid', 'partially_paid', 'paid', 'overpaid')),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  gross_amount_minor NUMERIC(20, 0) NOT NULL CHECK (gross_amount_minor >= 0),
  discount_amount_minor NUMERIC(20, 0) NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  net_amount_minor NUMERIC(20, 0) NOT NULL CHECK (net_amount_minor >= 0),
  paid_amount_minor NUMERIC(20, 0) NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
  outstanding_amount_minor NUMERIC(20, 0) NOT NULL CHECK (outstanding_amount_minor >= 0),
  due_date DATE NOT NULL,
  issued_at TIMESTAMPTZ,
  finance_transaction_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_tuition_invoice_number UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.english_center_tuition_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.english_center_tuition_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_minor NUMERIC(20, 0) NOT NULL CHECK (unit_amount_minor >= 0),
  line_amount_minor NUMERIC(20, 0) NOT NULL CHECK (line_amount_minor >= 0),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.english_center_tuition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  payer_party_id UUID,
  amount_minor NUMERIC(20, 0) NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'card', 'qr_code')),
  status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'allocated', 'void')),
  payment_date DATE NOT NULL,
  idempotency_key TEXT NOT NULL,
  external_reference TEXT,
  finance_transaction_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_tuition_payment_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.english_center_tuition_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.english_center_tuition_invoices(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES public.english_center_tuition_payments(id) ON DELETE RESTRICT,
  amount_minor NUMERIC(20, 0) NOT NULL CHECK (amount_minor > 0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_tuition_payment_allocation UNIQUE (tenant_id, invoice_id, payment_id)
);

-- zero-downtime: allow blocking-index - new E7 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_tuition_plans_scope
  ON public.english_center_tuition_plans(tenant_id, branch_id, status);

-- zero-downtime: allow blocking-index - new E7 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_tuition_assignments_enrollment
  ON public.english_center_tuition_assignments(tenant_id, english_enrollment_id, status);

-- zero-downtime: allow blocking-index - new E7 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_tuition_invoices_assignment
  ON public.english_center_tuition_invoices(tenant_id, assignment_id, due_date);

-- zero-downtime: allow blocking-index - new E7 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_tuition_invoices_branch
  ON public.english_center_tuition_invoices(tenant_id, branch_id, settlement_status, due_date);

-- zero-downtime: allow blocking-index - new E7 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_tuition_payments_branch
  ON public.english_center_tuition_payments(tenant_id, branch_id, payment_date);

ALTER TABLE public.english_center_tuition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_tuition_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_tuition_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_tuition_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_tuition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_tuition_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS english_center_tuition_plans_tenant_branch_isolation
  ON public.english_center_tuition_plans;

CREATE POLICY english_center_tuition_plans_tenant_branch_isolation
  ON public.english_center_tuition_plans
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND (
      branch_id IS NULL
      OR branch_id IN (
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
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND (
      branch_id IS NULL
      OR branch_id IN (
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
  );

DROP POLICY IF EXISTS english_center_tuition_assignments_tenant_branch_isolation
  ON public.english_center_tuition_assignments;

CREATE POLICY english_center_tuition_assignments_tenant_branch_isolation
  ON public.english_center_tuition_assignments
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

DROP POLICY IF EXISTS english_center_tuition_invoices_tenant_branch_isolation
  ON public.english_center_tuition_invoices;

CREATE POLICY english_center_tuition_invoices_tenant_branch_isolation
  ON public.english_center_tuition_invoices
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

DROP POLICY IF EXISTS english_center_tuition_payments_tenant_branch_isolation
  ON public.english_center_tuition_payments;

CREATE POLICY english_center_tuition_payments_tenant_branch_isolation
  ON public.english_center_tuition_payments
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

DROP POLICY IF EXISTS english_center_tuition_invoice_lines_tenant_isolation
  ON public.english_center_tuition_invoice_lines;

CREATE POLICY english_center_tuition_invoice_lines_tenant_isolation
  ON public.english_center_tuition_invoice_lines
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_tuition_invoices i
      WHERE i.id = invoice_id
        AND i.tenant_id = english_center_tuition_invoice_lines.tenant_id
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_tuition_invoices i
      WHERE i.id = invoice_id
        AND i.tenant_id = english_center_tuition_invoice_lines.tenant_id
    )
  );

DROP POLICY IF EXISTS english_center_tuition_allocations_tenant_isolation
  ON public.english_center_tuition_payment_allocations;

CREATE POLICY english_center_tuition_allocations_tenant_isolation
  ON public.english_center_tuition_payment_allocations
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_tuition_invoices i
      WHERE i.id = invoice_id
        AND i.tenant_id = english_center_tuition_payment_allocations.tenant_id
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_tuition_invoices i
      WHERE i.id = invoice_id
        AND i.tenant_id = english_center_tuition_payment_allocations.tenant_id
    )
  );

REVOKE ALL ON public.english_center_tuition_plans FROM anon;
REVOKE ALL ON public.english_center_tuition_assignments FROM anon;
REVOKE ALL ON public.english_center_tuition_invoices FROM anon;
REVOKE ALL ON public.english_center_tuition_invoice_lines FROM anon;
REVOKE ALL ON public.english_center_tuition_payments FROM anon;
REVOKE ALL ON public.english_center_tuition_payment_allocations FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_tuition_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_tuition_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_tuition_invoices TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_tuition_invoice_lines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_tuition_payments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_tuition_payment_allocations TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_english_center_tuition_plans_updated_at
  ON public.english_center_tuition_plans;

CREATE TRIGGER trg_english_center_tuition_plans_updated_at
  BEFORE UPDATE ON public.english_center_tuition_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_english_center_tuition_assignments_updated_at
  ON public.english_center_tuition_assignments;

CREATE TRIGGER trg_english_center_tuition_assignments_updated_at
  BEFORE UPDATE ON public.english_center_tuition_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_english_center_tuition_invoices_updated_at
  ON public.english_center_tuition_invoices;

CREATE TRIGGER trg_english_center_tuition_invoices_updated_at
  BEFORE UPDATE ON public.english_center_tuition_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_english_center_tuition_payments_updated_at
  ON public.english_center_tuition_payments;

CREATE TRIGGER trg_english_center_tuition_payments_updated_at
  BEFORE UPDATE ON public.english_center_tuition_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.english_center_tuition_plans IS
  'E7 - English Center tuition plan catalog. Product context only; no accounting policy.';

COMMENT ON TABLE public.english_center_tuition_invoices IS
  'E7 - English Center invoice metadata. Ledger posting goes through Finance OS public contracts.';

COMMENT ON TABLE public.english_center_tuition_payments IS
  'E7 - English Center payment receipt and allocation context. Cash state remains Finance OS-owned.';
