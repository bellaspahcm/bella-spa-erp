-- =========================================================================
-- Migration: Finance Accounting Semantic Configuration UI Write Contract
-- Purpose:
--   Provide one atomic write path for the Accounting Configuration MVP UI.
-- Scope:
--   - Supports only proven semantics: SERVICE_REVENUE, REVENUE_DEDUCTION,
--     GOODS_REVENUE.
--   - Validates the selected GL account belongs to the tenant.
--   - Preserves effective dating by closing the current mapping before
--     inserting or updating the requested effective-from mapping.
--   - Does not create an accounting rules engine or change runtime semantics.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_save_accounting_semantic_gl_mapping(
    p_tenant_id UUID,
    p_semantic_key TEXT,
    p_account_code TEXT,
    p_effective_from DATE,
    p_authority_version TEXT DEFAULT 'TENANT_CONFIG:UI:v1'
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    semantic_key TEXT,
    account_code TEXT,
    effective_from DATE,
    effective_to DATE,
    authority_version TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_existing_same_start UUID;
    v_future_count INTEGER;
    v_saved_id UUID;
BEGIN
    IF p_tenant_id IS NULL OR p_semantic_key IS NULL OR p_account_code IS NULL OR p_effective_from IS NULL THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_CONFIG_NULL_PARAMETER: tenant_id, semantic_key, account_code and effective_from are required'
            USING ERRCODE = 'F5040';
    END IF;

    IF p_semantic_key NOT IN ('SERVICE_REVENUE', 'REVENUE_DEDUCTION', 'GOODS_REVENUE') THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_CONFIG_UNSUPPORTED_SEMANTIC: % is not enabled for UI configuration',
            p_semantic_key
            USING ERRCODE = 'F5041';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.finance_accounts fa
        WHERE fa.tenant_id = p_tenant_id
          AND fa.code = p_account_code
          AND fa.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_CONFIG_INVALID_ACCOUNT: account % is not an active tenant GL account',
            p_account_code
            USING ERRCODE = 'F5042';
    END IF;

    SELECT COUNT(*) INTO v_future_count
    FROM public.finance_control_account_mappings m
    WHERE m.tenant_id = p_tenant_id
      AND m.control_type = p_semantic_key
      AND m.effective_from > p_effective_from;

    IF v_future_count > 0 THEN
        RAISE EXCEPTION 'ACCOUNTING_SEMANTIC_CONFIG_FUTURE_MAPPING_EXISTS: edit the existing future schedule instead of inserting before it'
            USING ERRCODE = 'F5043';
    END IF;

    SELECT m.id INTO v_existing_same_start
    FROM public.finance_control_account_mappings m
    WHERE m.tenant_id = p_tenant_id
      AND m.control_type = p_semantic_key
      AND m.effective_from = p_effective_from
    ORDER BY m.created_at DESC
    LIMIT 1;

    UPDATE public.finance_control_account_mappings m
    SET effective_to = p_effective_from - INTERVAL '1 day',
        updated_at = NOW()
    WHERE m.tenant_id = p_tenant_id
      AND m.control_type = p_semantic_key
      AND m.effective_from < p_effective_from
      AND (m.effective_to IS NULL OR m.effective_to >= p_effective_from);

    IF v_existing_same_start IS NOT NULL THEN
        UPDATE public.finance_control_account_mappings
        SET account_code = p_account_code,
            effective_to = NULL,
            authority_version = p_authority_version,
            updated_at = NOW()
        WHERE id = v_existing_same_start
        RETURNING finance_control_account_mappings.id INTO v_saved_id;
    ELSE
        INSERT INTO public.finance_control_account_mappings (
            tenant_id,
            control_type,
            account_code,
            effective_from,
            effective_to,
            authority_version
        )
        VALUES (
            p_tenant_id,
            p_semantic_key,
            p_account_code,
            p_effective_from,
            NULL,
            p_authority_version
        )
        RETURNING finance_control_account_mappings.id INTO v_saved_id;
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.tenant_id,
        m.control_type::TEXT AS semantic_key,
        m.account_code::TEXT AS account_code,
        m.effective_from,
        m.effective_to,
        m.authority_version
    FROM public.finance_control_account_mappings m
    WHERE m.id = v_saved_id;
END;
$$;

COMMENT ON FUNCTION public.finance_save_accounting_semantic_gl_mapping(UUID, TEXT, TEXT, DATE, TEXT) IS
    'Atomic write path for Accounting Configuration UI MVP. Validates tenant GL account and preserves effective-dated mappings for proven accounting semantics.';

GRANT EXECUTE ON FUNCTION public.finance_save_accounting_semantic_gl_mapping(UUID, TEXT, TEXT, DATE, TEXT) TO service_role;
