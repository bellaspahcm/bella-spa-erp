-- Migration: f4_prepayment_policy_resolution_runtime
-- Purpose:
--   Deploy the F4 prepayment posting policy boundary to already-migrated
--   test/pre-prod databases without replaying the original AP migration.
--
-- Boundary:
--   F4 owns prepayment lifecycle mechanics.
--   Tenant accounting policy owns concrete posting accounts.

CREATE OR REPLACE FUNCTION public.finance_validate_account_code(
    p_tenant_id UUID,
    p_account_code VARCHAR,
    p_expected_type VARCHAR
) RETURNS UUID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT id INTO v_account_id
    FROM public.finance_accounts
    WHERE tenant_id = p_tenant_id
      AND code = p_account_code
      AND is_active = TRUE
      AND (type = p_expected_type OR p_expected_type IS NULL);

    RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_get_account_code_by_id(
    p_tenant_id UUID,
    p_account_id UUID,
    p_expected_type VARCHAR
) RETURNS VARCHAR
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_account_code VARCHAR;
BEGIN
    SELECT code INTO v_account_code
    FROM public.finance_accounts
    WHERE tenant_id = p_tenant_id
      AND id = p_account_id
      AND is_active = TRUE
      AND (type = p_expected_type OR p_expected_type IS NULL);

    RETURN v_account_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_validate_account_id(
    p_tenant_id UUID,
    p_account_id UUID,
    p_expected_type VARCHAR
) RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.finance_accounts
        WHERE tenant_id = p_tenant_id
          AND id = p_account_id
          AND is_active = TRUE
          AND (type = p_expected_type OR p_expected_type IS NULL)
    );
END;
$$;

CREATE TABLE IF NOT EXISTS public.finance_prepayment_posting_policy_mappings (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type          VARCHAR(50) NOT NULL CHECK (event_type IN (
                            'VENDOR_PREPAYMENT_RECORDED',
                            'VENDOR_PREPAYMENT_APPLIED',
                            'VENDOR_PREPAYMENT_REFUNDED'
                        )),
    debit_account_code  VARCHAR(50) NOT NULL,
    credit_account_code VARCHAR(50) NULL,
    valid_from          TIMESTAMPTZ NOT NULL,
    valid_to            TIMESTAMPTZ NULL,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_prepayment_policy_valid_window
        CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT uq_prepayment_policy_mapping
        UNIQUE (tenant_id, event_type, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_prepayment_policy_lookup
    ON public.finance_prepayment_posting_policy_mappings(tenant_id, event_type, valid_from, valid_to)
    WHERE is_active = TRUE;

ALTER TABLE public.finance_prepayment_posting_policy_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for finance_prepayment_posting_policy_mappings"
    ON public.finance_prepayment_posting_policy_mappings;

CREATE POLICY "Tenant isolation for finance_prepayment_posting_policy_mappings"
    ON public.finance_prepayment_posting_policy_mappings
    FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE OR REPLACE FUNCTION public.finance_prevent_prepayment_policy_overlap()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_active = FALSE THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.finance_prepayment_posting_policy_mappings existing
        WHERE existing.tenant_id = NEW.tenant_id
          AND existing.event_type = NEW.event_type
          AND existing.is_active = TRUE
          AND existing.id <> NEW.id
          AND tstzrange(existing.valid_from, existing.valid_to, '[)')
              && tstzrange(NEW.valid_from, NEW.valid_to, '[)')
    ) THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_MAPPING_OVERLAP: tenant %, event %, valid_from %, valid_to %',
            NEW.tenant_id, NEW.event_type, NEW.valid_from, NEW.valid_to
            USING ERRCODE = 'F4077';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_prepayment_policy_overlap
    ON public.finance_prepayment_posting_policy_mappings;

CREATE TRIGGER trg_prevent_prepayment_policy_overlap
    BEFORE INSERT OR UPDATE ON public.finance_prepayment_posting_policy_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.finance_prevent_prepayment_policy_overlap();

CREATE OR REPLACE FUNCTION public.finance_resolve_prepayment_posting_accounts(
    p_tenant_id       UUID,
    p_event_type      VARCHAR,
    p_effective_date  TIMESTAMPTZ
) RETURNS TABLE (
    debit_account_code  VARCHAR,
    credit_account_code VARCHAR
)
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_mapping RECORD;
    v_overlap_count INT;
BEGIN
    IF p_tenant_id IS NULL OR p_event_type IS NULL OR p_effective_date IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_RESOLUTION_NULL_INPUT' USING ERRCODE = 'F4070';
    END IF;

    IF p_event_type NOT IN (
        'VENDOR_PREPAYMENT_RECORDED',
        'VENDOR_PREPAYMENT_APPLIED',
        'VENDOR_PREPAYMENT_REFUNDED'
    ) THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_EVENT_UNSUPPORTED: %', p_event_type USING ERRCODE = 'F4071';
    END IF;

    SELECT COUNT(*) INTO v_overlap_count
    FROM public.finance_prepayment_posting_policy_mappings
    WHERE tenant_id = p_tenant_id
      AND event_type = p_event_type
      AND is_active = TRUE
      AND valid_from <= p_effective_date
      AND (valid_to IS NULL OR valid_to > p_effective_date);

    IF v_overlap_count = 0 THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_MAPPING_NOT_FOUND: tenant %, event %, effective_date %',
            p_tenant_id, p_event_type, p_effective_date
            USING ERRCODE = 'F4072';
    ELSIF v_overlap_count > 1 THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_MAPPING_AMBIGUOUS: tenant %, event %, effective_date %',
            p_tenant_id, p_event_type, p_effective_date
            USING ERRCODE = 'F4073';
    END IF;

    SELECT * INTO v_mapping
    FROM public.finance_prepayment_posting_policy_mappings
    WHERE tenant_id = p_tenant_id
      AND event_type = p_event_type
      AND is_active = TRUE
      AND valid_from <= p_effective_date
      AND (valid_to IS NULL OR valid_to > p_effective_date)
    LIMIT 1;

    IF public.finance_validate_account_code(p_tenant_id, v_mapping.debit_account_code, NULL) IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_DEBIT_ACCOUNT_INVALID: %', v_mapping.debit_account_code
            USING ERRCODE = 'F4074';
    END IF;

    IF v_mapping.credit_account_code IS NOT NULL
       AND public.finance_validate_account_code(p_tenant_id, v_mapping.credit_account_code, NULL) IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_CREDIT_ACCOUNT_INVALID: %', v_mapping.credit_account_code
            USING ERRCODE = 'F4075';
    END IF;

    RETURN QUERY SELECT v_mapping.debit_account_code, v_mapping.credit_account_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_record_prepayment(
    p_tenant_id               UUID,
    p_vendor_id               UUID,
    p_amount_minor            BIGINT,
    p_bank_finance_account_id UUID,
    p_posting_attempt_id      UUID,
    p_source_type             VARCHAR,
    p_source_id               VARCHAR
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key1              INT;
    v_key2              INT;
    v_fact_id           UUID;
    v_f1_res            JSONB;
    v_f1_tx_id          UUID;
    v_policy            RECORD;
    v_effective_date    TIMESTAMPTZ;
    v_bank_account_code VARCHAR;
    v_lines             JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    IF p_amount_minor <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'F4030';
    END IF;

    SELECT id, f1_transaction_id INTO v_fact_id, v_f1_tx_id
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_fact_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'prepayment_fact_id', v_fact_id,
            'transaction_id', v_f1_tx_id,
            'is_duplicate', TRUE
        );
    END IF;

    SELECT key1, key2 INTO v_key1, v_key2
    FROM public.finance_financial_lock_key(p_tenant_id, 'VENDOR', p_vendor_id);
    PERFORM pg_advisory_xact_lock(v_key1, v_key2);

    IF NOT public.finance_validate_account_id(p_tenant_id, p_bank_finance_account_id, 'ASSET') THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_INVALID_OR_INACTIVE' USING ERRCODE = 'F4050';
    END IF;

    v_bank_account_code := public.finance_get_account_code_by_id(
        p_tenant_id,
        p_bank_finance_account_id,
        'ASSET'
    );

    IF v_bank_account_code IS NULL THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_INVALID_OR_INACTIVE' USING ERRCODE = 'F4050';
    END IF;

    v_effective_date := NOW();
    SELECT * INTO v_policy
    FROM public.finance_resolve_prepayment_posting_accounts(
        p_tenant_id,
        'VENDOR_PREPAYMENT_RECORDED',
        v_effective_date
    );

    IF v_policy.credit_account_code IS NOT NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_RECORDED_CREDIT_UNSUPPORTED: event %',
            'VENDOR_PREPAYMENT_RECORDED'
            USING ERRCODE = 'F4078';
    END IF;

    v_fact_id := gen_random_uuid();
    v_lines := jsonb_build_array(
        jsonb_build_object(
            'account_code', v_policy.debit_account_code,
            'debit_amount_minor', p_amount_minor,
            'debit_currency', 'VND',
            'credit_amount_minor', 0,
            'credit_currency', 'VND',
            'debit_functional_amount', p_amount_minor,
            'debit_functional_currency', 'VND',
            'credit_functional_amount', 0,
            'credit_functional_currency', 'VND',
            'memo', 'AP prepayment recorded'
        ),
        jsonb_build_object(
            'account_code', v_bank_account_code,
            'debit_amount_minor', 0,
            'debit_currency', 'VND',
            'credit_amount_minor', p_amount_minor,
            'credit_currency', 'VND',
            'debit_functional_amount', 0,
            'debit_functional_currency', 'VND',
            'credit_functional_amount', p_amount_minor,
            'credit_functional_currency', 'VND',
            'memo', 'AP prepayment cash out'
        )
    );

    v_f1_res := public.finance_post_transaction(
        p_tenant_id,
        p_posting_attempt_id::VARCHAR,
        md5(v_lines::TEXT)::VARCHAR,
        'VENDOR_PREPAYMENT',
        v_fact_id::VARCHAR,
        'CASH',
        v_effective_date,
        'VND',
        'VND',
        1,
        'IDENTITY',
        'VND',
        v_effective_date,
        'AP_PREPAYMENT_RECORDED: Vendor ' || p_vendor_id::TEXT,
        'VENDOR_PREPAYMENT',
        v_fact_id::VARCHAR,
        v_lines,
        v_effective_date::DATE
    );
    v_f1_tx_id := (v_f1_res->>'transaction_id')::UUID;

    INSERT INTO public.finance_vendor_prepayments (
        id, tenant_id, vendor_id, fact_type, amount_minor,
        posting_attempt_id, f1_transaction_id, source_type, source_id, currency
    ) VALUES (
        v_fact_id, p_tenant_id, p_vendor_id, 'PREPAYMENT_RECORDED', p_amount_minor,
        p_posting_attempt_id, v_f1_tx_id, COALESCE(p_source_type, 'VENDOR_PREPAYMENT'), COALESCE(p_source_id, v_fact_id::VARCHAR), 'VND'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'prepayment_fact_id', v_fact_id,
        'transaction_id', v_f1_tx_id,
        'is_duplicate', FALSE
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_apply_prepayment(
    p_tenant_id          UUID,
    p_bill_id            UUID,
    p_prepayment_fact_id UUID,
    p_amount_minor       BIGINT,
    p_posting_attempt_id UUID
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key1           INT;
    v_key2           INT;
    v_bill           RECORD;
    v_prepayment     RECORD;
    v_available      BIGINT;
    v_outstanding    BIGINT;
    v_fact_id        UUID;
    v_f1_res         JSONB;
    v_f1_tx_id       UUID;
    v_policy         RECORD;
    v_effective_date TIMESTAMPTZ;
    v_lines          JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    IF p_amount_minor <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'F4030';
    END IF;

    SELECT id, f1_transaction_id INTO v_fact_id, v_f1_tx_id
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_fact_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'prepayment_fact_id', v_fact_id,
            'transaction_id', v_f1_tx_id,
            'is_duplicate', TRUE
        );
    END IF;

    SELECT * INTO v_prepayment
    FROM public.finance_vendor_prepayments
    WHERE id = p_prepayment_fact_id AND tenant_id = p_tenant_id
      AND fact_type = 'PREPAYMENT_RECORDED';

    IF v_prepayment.id IS NULL THEN
        RAISE EXCEPTION 'PREPAYMENT_NOT_FOUND' USING ERRCODE = 'F4060';
    END IF;

    SELECT key1, key2 INTO v_key1, v_key2
    FROM public.finance_financial_lock_key(p_tenant_id, 'VENDOR', v_prepayment.vendor_id);
    PERFORM pg_advisory_xact_lock(v_key1, v_key2);

    SELECT * INTO v_bill
    FROM public.finance_vendor_bills
    WHERE id = p_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'BILL_NOT_FOUND' USING ERRCODE = 'F4010';
    END IF;

    IF v_prepayment.vendor_id <> v_bill.vendor_id THEN
        RAISE EXCEPTION 'ERROR_AP_CROSS_VENDOR_PREPAYMENT: Prepayment vendor (%) does not match bill vendor (%).',
            v_prepayment.vendor_id, v_bill.vendor_id
            USING ERRCODE = 'F4061';
    END IF;

    PERFORM 1 FROM public.finance_vendor_prepayments
    WHERE id = p_prepayment_fact_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    SELECT COALESCE(SUM(
        CASE fact_type
            WHEN 'PREPAYMENT_RECORDED' THEN  amount_minor
            WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor
            WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor
        END
    ), 0) INTO v_available
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND vendor_id = v_prepayment.vendor_id;

    IF p_amount_minor > v_available THEN
        RAISE EXCEPTION 'ERROR_AP_EXCEEDS_PREPAYMENT_BALANCE: Application (%) exceeds available prepayment (%).',
            p_amount_minor, v_available
            USING ERRCODE = 'F4062';
    END IF;

    SELECT outstanding_amount_minor INTO v_outstanding
    FROM public.finance_payable_positions
    WHERE vendor_bill_id = p_bill_id AND tenant_id = p_tenant_id;

    IF p_amount_minor > v_outstanding THEN
        RAISE EXCEPTION 'ERROR_AP_EXCEEDS_BILL_BALANCE: Application (%) exceeds bill outstanding (%).',
            p_amount_minor, v_outstanding
            USING ERRCODE = 'F4025';
    END IF;

    v_effective_date := NOW();
    SELECT * INTO v_policy
    FROM public.finance_resolve_prepayment_posting_accounts(
        p_tenant_id,
        'VENDOR_PREPAYMENT_APPLIED',
        v_effective_date
    );

    IF v_policy.credit_account_code IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_CREDIT_ACCOUNT_REQUIRED: event %',
            'VENDOR_PREPAYMENT_APPLIED'
            USING ERRCODE = 'F4076';
    END IF;

    v_fact_id := gen_random_uuid();
    v_lines := jsonb_build_array(
        jsonb_build_object(
            'account_code', v_policy.debit_account_code,
            'debit_amount_minor', p_amount_minor,
            'debit_currency', 'VND',
            'credit_amount_minor', 0,
            'credit_currency', 'VND',
            'debit_functional_amount', p_amount_minor,
            'debit_functional_currency', 'VND',
            'credit_functional_amount', 0,
            'credit_functional_currency', 'VND',
            'memo', 'AP prepayment applied'
        ),
        jsonb_build_object(
            'account_code', v_policy.credit_account_code,
            'debit_amount_minor', 0,
            'debit_currency', 'VND',
            'credit_amount_minor', p_amount_minor,
            'credit_currency', 'VND',
            'debit_functional_amount', 0,
            'debit_functional_currency', 'VND',
            'credit_functional_amount', p_amount_minor,
            'credit_functional_currency', 'VND',
            'memo', 'AP prepayment relieved'
        )
    );

    v_f1_res := public.finance_post_transaction(
        p_tenant_id,
        p_posting_attempt_id::VARCHAR,
        md5(v_lines::TEXT)::VARCHAR,
        'VENDOR_PREPAYMENT',
        v_fact_id::VARCHAR,
        'ACCRUAL',
        v_effective_date,
        'VND',
        'VND',
        1,
        'IDENTITY',
        'VND',
        v_effective_date,
        'AP_PREPAYMENT_APPLIED: Bill ' || p_bill_id::TEXT,
        'VENDOR_PREPAYMENT',
        v_fact_id::VARCHAR,
        v_lines,
        v_effective_date::DATE
    );
    v_f1_tx_id := (v_f1_res->>'transaction_id')::UUID;

    INSERT INTO public.finance_vendor_prepayments (
        id, tenant_id, vendor_id, fact_type, amount_minor,
        posting_attempt_id, f1_transaction_id, matched_vendor_bill_id, currency
    ) VALUES (
        v_fact_id, p_tenant_id, v_prepayment.vendor_id, 'PREPAYMENT_APPLIED', p_amount_minor,
        p_posting_attempt_id, v_f1_tx_id, p_bill_id, 'VND'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'prepayment_fact_id', v_fact_id,
        'transaction_id', v_f1_tx_id,
        'is_duplicate', FALSE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_validate_account_code(UUID, VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_get_account_code_by_id(UUID, UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_validate_account_id(UUID, UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_resolve_prepayment_posting_accounts(UUID, VARCHAR, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_record_prepayment(UUID, UUID, BIGINT, UUID, UUID, VARCHAR, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_apply_prepayment(UUID, UUID, UUID, BIGINT, UUID) TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.finance_prepayment_posting_policy_mappings TO service_role;
GRANT SELECT ON public.finance_prepayment_posting_policy_mappings TO authenticated;
