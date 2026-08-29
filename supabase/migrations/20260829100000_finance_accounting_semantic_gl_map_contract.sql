-- =========================================================================
-- Migration: Finance Accounting Semantic GL Map Contract
-- Contract: FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1
-- Purpose:
--   Pilot Accounting Configuration Foundation with SERVICE_REVENUE.
--   Bella standardizes financial semantics; tenants choose GL accounts.
-- Scope:
--   - Additive read-only contract.
--   - No runtime posting/template/report changes.
--   - No platform fallback to 5111, 5113, or any universal revenue account.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_accounting_semantic_map_overlap_guard()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.control_type <> 'SERVICE_REVENUE' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.finance_control_account_mappings existing
        WHERE existing.tenant_id = NEW.tenant_id
          AND existing.control_type = NEW.control_type
          AND existing.id <> NEW.id
          AND existing.effective_from <= COALESCE(NEW.effective_to, DATE '9999-12-31')
          AND COALESCE(existing.effective_to, DATE '9999-12-31') >= NEW.effective_from
    ) THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_MAPPING_OVERLAP: tenant % has overlapping % effective ranges',
            NEW.tenant_id,
            NEW.control_type
            USING ERRCODE = 'F5030';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_accounting_semantic_map_overlap_guard
    ON public.finance_control_account_mappings;

CREATE TRIGGER trg_finance_accounting_semantic_map_overlap_guard
    BEFORE INSERT OR UPDATE OF tenant_id, control_type, effective_from, effective_to
    ON public.finance_control_account_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.finance_accounting_semantic_map_overlap_guard();

COMMENT ON FUNCTION public.finance_accounting_semantic_map_overlap_guard() IS
    'Guards FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1 determinism for SERVICE_REVENUE by rejecting overlapping effective ranges.';

CREATE OR REPLACE FUNCTION public.finance_get_accounting_semantic_gl_map_as_of(
    p_tenant_id UUID,
    p_semantic_key TEXT,
    p_as_of DATE,
    p_contract_version TEXT DEFAULT 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1'
)
RETURNS TABLE (
    tenant_id UUID,
    semantic_key TEXT,
    gl_account_id UUID,
    gl_account_code VARCHAR,
    effective_from DATE,
    effective_to DATE,
    authority_version TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF p_contract_version NOT IN ('FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_get_accounting_semantic_gl_map_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5031';
    END IF;

    IF p_tenant_id IS NULL OR p_semantic_key IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_GL_MAP_NULL_PARAMETER: tenant_id, semantic_key and as_of are required'
            USING ERRCODE = 'F5032';
    END IF;

    IF p_semantic_key NOT IN ('SERVICE_REVENUE') THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_GL_MAP_UNSUPPORTED_SEMANTIC: % is not enabled for v1 pilot',
            p_semantic_key
            USING ERRCODE = 'F5033';
    END IF;

    RETURN QUERY
    SELECT
        m.tenant_id,
        m.control_type::TEXT AS semantic_key,
        fa.id AS gl_account_id,
        fa.code AS gl_account_code,
        m.effective_from,
        m.effective_to,
        m.authority_version
    FROM public.finance_control_account_mappings m
    JOIN public.finance_accounts fa
      ON fa.tenant_id = m.tenant_id
     AND fa.code = m.account_code
     AND fa.is_active = TRUE
    WHERE m.tenant_id = p_tenant_id
      AND m.control_type = p_semantic_key
      AND m.effective_from <= p_as_of
      AND (m.effective_to IS NULL OR m.effective_to >= p_as_of)
    ORDER BY m.effective_from DESC, m.created_at DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.finance_get_accounting_semantic_gl_map_as_of(UUID, TEXT, DATE, TEXT) IS
    'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1. Read-only pilot contract exposing tenant-configured SERVICE_REVENUE GL mapping as of a date. No 5111/5113 platform fallback.';

GRANT EXECUTE ON FUNCTION public.finance_get_accounting_semantic_gl_map_as_of(UUID, TEXT, DATE, TEXT) TO service_role;
