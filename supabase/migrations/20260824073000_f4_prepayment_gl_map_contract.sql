-- =========================================================================
-- Migration: F4 Prepayment Configurable GL Map Contract
-- Contract: F4_PREPAYMENT_GL_MAP:v1
-- Purpose:
--   Make PREPAYMENT_CONTROL tenant-configured and effective-dated.
--   Bella standardizes the control mechanism, not a universal account code.
-- Scope:
--   - No F1/F2/F4 fact semantic changes.
--   - No PREPAYMENT_GL_BALANCE runner implementation.
--   - No fallback to 331P, 242, or any platform-hardcoded account code.
-- =========================================================================

ALTER TABLE public.finance_control_account_mappings
    ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT DATE '1900-01-01',
    ADD COLUMN IF NOT EXISTS effective_to DATE,
    ADD COLUMN IF NOT EXISTS authority_version TEXT NOT NULL DEFAULT 'TENANT_CONFIG:v1';

ALTER TABLE public.finance_control_account_mappings
    DROP CONSTRAINT IF EXISTS uq_tenant_control_type;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'finance_control_account_mappings_effective_range_chk'
          AND conrelid = 'public.finance_control_account_mappings'::regclass
    ) THEN
        ALTER TABLE public.finance_control_account_mappings
            ADD CONSTRAINT finance_control_account_mappings_effective_range_chk
            CHECK (effective_to IS NULL OR effective_to >= effective_from);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_control_account_mappings_effective
    ON public.finance_control_account_mappings (tenant_id, control_type, effective_from);

CREATE INDEX IF NOT EXISTS idx_finance_control_account_mappings_as_of
    ON public.finance_control_account_mappings (tenant_id, control_type, effective_from, effective_to);

DROP FUNCTION IF EXISTS public.finance_get_control_account(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION public.finance_get_control_account(
    p_tenant_id UUID,
    p_control_type VARCHAR,
    p_as_of DATE DEFAULT CURRENT_DATE
)
RETURNS VARCHAR
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_account_code VARCHAR;
BEGIN
    IF p_tenant_id IS NULL OR p_control_type IS NULL THEN
        RAISE EXCEPTION 'FINANCE_CONTROL_ACCOUNT_NULL_PARAMETER'
            USING ERRCODE = 'F5020';
    END IF;

    SELECT m.account_code INTO v_account_code
    FROM public.finance_control_account_mappings m
    JOIN public.finance_accounts fa
      ON fa.tenant_id = m.tenant_id
     AND fa.code = m.account_code
     AND fa.is_active = TRUE
    WHERE m.tenant_id = p_tenant_id
      AND m.control_type = p_control_type
      AND m.effective_from <= COALESCE(p_as_of, CURRENT_DATE)
      AND (m.effective_to IS NULL OR m.effective_to >= COALESCE(p_as_of, CURRENT_DATE))
    ORDER BY m.effective_from DESC, m.created_at DESC
    LIMIT 1;

    IF v_account_code IS NULL THEN
        IF p_control_type = 'PREPAYMENT_CONTROL' THEN
            RETURN NULL;
        END IF;

        v_account_code := CASE
            WHEN p_control_type = 'AP_CONTROL' THEN '331'
            WHEN p_control_type = 'AR_CONTROL' THEN '131'
            WHEN p_control_type = 'CASH_CONTROL' THEN '111'
            ELSE NULL
        END;
    END IF;

    IF v_account_code IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.finance_accounts
        WHERE tenant_id = p_tenant_id
          AND code = v_account_code
          AND is_active = TRUE
    ) THEN
        IF p_control_type = 'CASH_CONTROL' THEN
            SELECT code INTO v_account_code
            FROM public.finance_accounts
            WHERE tenant_id = p_tenant_id
              AND code IN ('111', '112', '1111', '1121')
              AND is_active = TRUE
            ORDER BY code ASC
            LIMIT 1;
        ELSE
            v_account_code := NULL;
        END IF;
    END IF;

    RETURN v_account_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_get_control_account(UUID, VARCHAR, DATE) TO service_role;

COMMENT ON FUNCTION public.finance_get_control_account(UUID, VARCHAR, DATE) IS
    'Tenant control account resolver. PREPAYMENT_CONTROL is configuration-required and has no platform fallback to 331P, 242, or any other account code.';

CREATE OR REPLACE FUNCTION public.finance_get_prepayment_gl_map_as_of(
    p_tenant_id UUID,
    p_as_of DATE,
    p_contract_version TEXT DEFAULT 'F4_PREPAYMENT_GL_MAP:v1'
)
RETURNS TABLE (
    tenant_id UUID,
    control_key TEXT,
    gl_account_id UUID,
    gl_account_code VARCHAR,
    effective_from DATE,
    effective_to DATE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF p_contract_version NOT IN ('F4_PREPAYMENT_GL_MAP:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_get_prepayment_gl_map_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5021';
    END IF;

    IF p_tenant_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_GL_MAP_NULL_PARAMETER: tenant_id and as_of are required'
            USING ERRCODE = 'F5022';
    END IF;

    RETURN QUERY
    SELECT
        m.tenant_id,
        m.control_type::TEXT AS control_key,
        fa.id AS gl_account_id,
        fa.code AS gl_account_code,
        m.effective_from,
        m.effective_to
    FROM public.finance_control_account_mappings m
    JOIN public.finance_accounts fa
      ON fa.tenant_id = m.tenant_id
     AND fa.code = m.account_code
     AND fa.is_active = TRUE
    WHERE m.tenant_id = p_tenant_id
      AND m.control_type = 'PREPAYMENT_CONTROL'
      AND m.effective_from <= p_as_of
      AND (m.effective_to IS NULL OR m.effective_to >= p_as_of)
    ORDER BY m.effective_from DESC, m.created_at DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.finance_get_prepayment_gl_map_as_of(UUID, DATE, TEXT) IS
    'F4_PREPAYMENT_GL_MAP:v1. Read-only contract exposing tenant-configured PREPAYMENT_CONTROL GL mapping as of a date. No platform account-code fallback.';

GRANT EXECUTE ON FUNCTION public.finance_get_prepayment_gl_map_as_of(UUID, DATE, TEXT) TO service_role;