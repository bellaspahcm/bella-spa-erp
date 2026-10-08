-- ============================================================================
-- Bella Hospitality Phase 4 - Folio + Payment Foundation
-- ============================================================================
-- Product: Bella Hospitality
-- Phase: 4
-- Purpose: Product-owned folio semantics with Finance public contract links.
-- Boundary: No Hospitality payment engine, Housekeeping, F&B, Travel, or Resource Kernel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospitality_folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  stay_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'settled', 'closed')),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  subtotal_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_amount_minor >= 0),
  paid_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
  outstanding_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (outstanding_amount_minor >= 0),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_folios_stay_tenant
    FOREIGN KEY (tenant_id, property_id, stay_id)
    REFERENCES public.hospitality_stays(tenant_id, property_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_hospitality_folios_guest_tenant
    FOREIGN KEY (tenant_id, guest_id)
    REFERENCES public.hospitality_guests(tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_hospitality_folios_balance
    CHECK (subtotal_amount_minor = paid_amount_minor + outstanding_amount_minor),
  CONSTRAINT chk_hospitality_folios_settlement_status
    CHECK (
      (status = 'open' AND closed_at IS NULL)
      OR (status = 'settled' AND outstanding_amount_minor = 0 AND settled_at IS NOT NULL AND closed_at IS NULL)
      OR (status = 'closed' AND outstanding_amount_minor = 0 AND settled_at IS NOT NULL AND closed_at IS NOT NULL)
    ),
  CONSTRAINT uq_hospitality_folios_stay UNIQUE (tenant_id, stay_id),
  CONSTRAINT uq_hospitality_folios_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_hospitality_folios_tenant_property_id UNIQUE (tenant_id, property_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_folio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  folio_id UUID NOT NULL,
  stay_id UUID NOT NULL,
  item_type VARCHAR(30) NOT NULL DEFAULT 'room_charge'
    CHECK (item_type IN ('room_charge')),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_minor BIGINT NOT NULL CHECK (unit_amount_minor > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  service_period_start DATE NOT NULL,
  service_period_end DATE NOT NULL,
  recognition_date DATE NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  source_id TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_folio_items_folio_tenant
    FOREIGN KEY (tenant_id, property_id, folio_id)
    REFERENCES public.hospitality_folios(tenant_id, property_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_hospitality_folio_items_amount
    CHECK (amount_minor = unit_amount_minor * quantity),
  CONSTRAINT chk_hospitality_folio_items_service_period
    CHECK (service_period_end >= service_period_start),
  CONSTRAINT uq_hospitality_folio_items_tenant_property_folio_id
    UNIQUE (tenant_id, property_id, folio_id, id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_folio_finance_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  folio_id UUID NOT NULL,
  folio_item_id UUID NOT NULL,
  finance_invoice_id UUID NOT NULL,
  finance_invoice_number TEXT NOT NULL,
  finance_transaction_id UUID NOT NULL,
  finance_receivable_position_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'recognized'
    CHECK (status IN ('recognized')),
  policy_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_folio_finance_links_item_tenant
    FOREIGN KEY (tenant_id, property_id, folio_id, folio_item_id)
    REFERENCES public.hospitality_folio_items(tenant_id, property_id, folio_id, id)
    ON DELETE CASCADE,
  CONSTRAINT uq_hospitality_folio_finance_links_item UNIQUE (tenant_id, folio_item_id),
  CONSTRAINT uq_hospitality_folio_finance_links_invoice UNIQUE (tenant_id, finance_invoice_id)
);

CREATE TABLE IF NOT EXISTS public.hospitality_folio_payment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  folio_id UUID NOT NULL,
  finance_invoice_id UUID NOT NULL,
  payment_source_type VARCHAR(80) NOT NULL,
  payment_source_id TEXT NOT NULL,
  finance_transaction_id UUID NOT NULL,
  finance_cash_movement_id UUID NOT NULL,
  finance_allocation_id UUID NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  payment_method VARCHAR(40) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_hospitality_folio_payment_applications_folio_tenant
    FOREIGN KEY (tenant_id, property_id, folio_id)
    REFERENCES public.hospitality_folios(tenant_id, property_id, id)
    ON DELETE CASCADE,
  CONSTRAINT uq_hospitality_folio_payment_applications_idempotency UNIQUE (tenant_id, idempotency_key)
);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_folios_property_status
  ON public.hospitality_folios(tenant_id, property_id, status);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_folios_guest
  ON public.hospitality_folios(tenant_id, guest_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_folio_items_folio
  ON public.hospitality_folio_items(tenant_id, folio_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_folio_finance_links_folio
  ON public.hospitality_folio_finance_links(tenant_id, folio_id);

-- zero-downtime: allow blocking-index - new Hospitality product tables have no existing production rows.
CREATE INDEX IF NOT EXISTS idx_hospitality_folio_payment_applications_folio
  ON public.hospitality_folio_payment_applications(tenant_id, folio_id);

CREATE OR REPLACE FUNCTION public.hospitality_validate_folio()
RETURNS TRIGGER AS $$
DECLARE
  v_stay_guest_id UUID;
  v_stay_status TEXT;
BEGIN
  SELECT guest_id, status
  INTO v_stay_guest_id, v_stay_status
  FROM public.hospitality_stays
  WHERE id = NEW.stay_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_stay_guest_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_STAY_NOT_FOUND';
  END IF;

  IF v_stay_guest_id <> NEW.guest_id THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_GUEST_MISMATCH';
  END IF;

  IF v_stay_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_REQUIRES_STAY';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.hospitality_validate_folio_item()
RETURNS TRIGGER AS $$
DECLARE
  v_folio_stay_id UUID;
  v_folio_status TEXT;
BEGIN
  SELECT stay_id, status
  INTO v_folio_stay_id, v_folio_status
  FROM public.hospitality_folios
  WHERE id = NEW.folio_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_folio_stay_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_ITEM_FOLIO_NOT_FOUND';
  END IF;

  IF v_folio_stay_id <> NEW.stay_id THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_ITEM_STAY_MISMATCH';
  END IF;

  IF v_folio_status <> 'open' THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_ITEM_REQUIRES_OPEN_FOLIO';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.hospitality_validate_folio_finance_link()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id UUID;
BEGIN
  SELECT id
  INTO v_item_id
  FROM public.hospitality_folio_items
  WHERE id = NEW.folio_item_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id
    AND folio_id = NEW.folio_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_FINANCE_LINK_ITEM_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.hospitality_validate_folio_payment_application()
RETURNS TRIGGER AS $$
DECLARE
  v_folio_status TEXT;
  v_outstanding_amount_minor BIGINT;
BEGIN
  SELECT status, outstanding_amount_minor
  INTO v_folio_status, v_outstanding_amount_minor
  FROM public.hospitality_folios
  WHERE id = NEW.folio_id
    AND tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id;

  IF v_folio_status IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_PAYMENT_FOLIO_NOT_FOUND';
  END IF;

  IF v_folio_status = 'closed' THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_PAYMENT_REJECTS_CLOSED_FOLIO';
  END IF;

  IF NEW.amount_minor > v_outstanding_amount_minor THEN
    RAISE EXCEPTION 'HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.hospitality_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_folio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_folio_finance_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitality_folio_payment_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitality_folios_tenant_isolation ON public.hospitality_folios;
CREATE POLICY hospitality_folios_tenant_isolation
  ON public.hospitality_folios
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

DROP POLICY IF EXISTS hospitality_folio_items_tenant_isolation ON public.hospitality_folio_items;
CREATE POLICY hospitality_folio_items_tenant_isolation
  ON public.hospitality_folio_items
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

DROP POLICY IF EXISTS hospitality_folio_finance_links_tenant_isolation ON public.hospitality_folio_finance_links;
CREATE POLICY hospitality_folio_finance_links_tenant_isolation
  ON public.hospitality_folio_finance_links
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

DROP POLICY IF EXISTS hospitality_folio_payment_applications_tenant_isolation ON public.hospitality_folio_payment_applications;
CREATE POLICY hospitality_folio_payment_applications_tenant_isolation
  ON public.hospitality_folio_payment_applications
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

REVOKE ALL ON public.hospitality_folios FROM anon;
REVOKE ALL ON public.hospitality_folio_items FROM anon;
REVOKE ALL ON public.hospitality_folio_finance_links FROM anon;
REVOKE ALL ON public.hospitality_folio_payment_applications FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_folios TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_folio_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_folio_finance_links TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_folio_payment_applications TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_hospitality_folios_validation ON public.hospitality_folios;
CREATE TRIGGER trg_hospitality_folios_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, stay_id, guest_id, status, outstanding_amount_minor, settled_at, closed_at
  ON public.hospitality_folios
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_folio();

DROP TRIGGER IF EXISTS trg_hospitality_folio_items_validation ON public.hospitality_folio_items;
CREATE TRIGGER trg_hospitality_folio_items_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, folio_id, stay_id, amount_minor, status
  ON public.hospitality_folio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_folio_item();

DROP TRIGGER IF EXISTS trg_hospitality_folio_finance_links_validation ON public.hospitality_folio_finance_links;
CREATE TRIGGER trg_hospitality_folio_finance_links_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, folio_id, folio_item_id
  ON public.hospitality_folio_finance_links
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_folio_finance_link();

DROP TRIGGER IF EXISTS trg_hospitality_folio_payment_applications_validation ON public.hospitality_folio_payment_applications;
CREATE TRIGGER trg_hospitality_folio_payment_applications_validation
  BEFORE INSERT OR UPDATE OF tenant_id, property_id, folio_id, amount_minor
  ON public.hospitality_folio_payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitality_validate_folio_payment_application();

DROP TRIGGER IF EXISTS trg_hospitality_folios_updated_at ON public.hospitality_folios;
CREATE TRIGGER trg_hospitality_folios_updated_at
  BEFORE UPDATE ON public.hospitality_folios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hospitality_folio_items_updated_at ON public.hospitality_folio_items;
CREATE TRIGGER trg_hospitality_folio_items_updated_at
  BEFORE UPDATE ON public.hospitality_folio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.hospitality_folios IS
  'Bella Hospitality Phase 4 - product-owned guest stay folio; Finance owns receivable and payment primitives.';

COMMENT ON TABLE public.hospitality_folio_payment_applications IS
  'Bella Hospitality Phase 4 - product link to Finance payment allocation result; not a Hospitality payment engine.';
