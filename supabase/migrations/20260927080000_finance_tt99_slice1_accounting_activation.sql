-- Finance OS TT99 Slice 1 accounting activation.
-- Scope:
-- - Enable semantic GL runtime for TRADE_RECEIVABLE and SERVICE_REVENUE only.
-- - Activate minimum proven TT99 Slice 1 Finance accounts for the isolated
--   Preschool browser-smoke tenant only.
-- - Save effective-dated, authority-backed semantic mappings.
--
-- This migration intentionally does not post tuition, connect Preschool, seed a
-- full TT99 chart of accounts, activate 5111, or touch other tenants.

ALTER TABLE public.finance_control_account_mappings
  ADD COLUMN IF NOT EXISTS authority_version VARCHAR(100) NOT NULL DEFAULT 'TENANT_CONFIG:v1';

ALTER TABLE public.finance_control_account_mappings
  ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT DATE '1900-01-01';

ALTER TABLE public.finance_control_account_mappings
  ADD COLUMN IF NOT EXISTS effective_to DATE;

-- zero-downtime: allow blocking-index - reviewed owner-deployed TT99 semantic mapping effective-date lookup index
CREATE INDEX IF NOT EXISTS idx_finance_control_account_mappings_effective
  ON public.finance_control_account_mappings(tenant_id, control_type, effective_from, effective_to);

CREATE OR REPLACE FUNCTION public.finance_get_accounting_semantic_gl_map_as_of(
  p_tenant_id UUID,
  p_semantic_key VARCHAR,
  p_as_of DATE,
  p_contract_version VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  semantic_key VARCHAR,
  gl_account_code VARCHAR,
  gl_account_id UUID,
  authority_version VARCHAR,
  effective_from DATE,
  effective_to DATE,
  tenant_id UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_contract_version IS NOT NULL THEN
    RAISE EXCEPTION
      'UNKNOWN_CONTRACT_VERSION: finance_get_accounting_semantic_gl_map_as_of does not support version %',
      p_contract_version
      USING ERRCODE = 'F5031';
  END IF;

  IF p_semantic_key NOT IN ('TRADE_RECEIVABLE', 'SERVICE_REVENUE') THEN
    RAISE EXCEPTION
      'ACCOUNTING_SEMANTIC_GL_MAP_UNSUPPORTED_SEMANTIC: % is not enabled for TT99 Slice 1',
      p_semantic_key
      USING ERRCODE = 'F5033';
  END IF;

  RETURN QUERY
  SELECT
    m.control_type::VARCHAR AS semantic_key,
    m.account_code::VARCHAR AS gl_account_code,
    a.id AS gl_account_id,
    m.authority_version::VARCHAR AS authority_version,
    m.effective_from::DATE AS effective_from,
    m.effective_to::DATE AS effective_to,
    m.tenant_id
  FROM public.finance_control_account_mappings m
  JOIN public.finance_accounts a
    ON a.tenant_id = m.tenant_id
   AND a.code = m.account_code
   AND a.is_active = TRUE
  WHERE m.tenant_id = p_tenant_id
    AND m.control_type = p_semantic_key
    AND m.effective_from <= p_as_of
    AND (m.effective_to IS NULL OR m.effective_to > p_as_of)
  ORDER BY m.effective_from DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_get_accounting_semantic_gl_map_as_of(UUID, VARCHAR, DATE, VARCHAR) TO service_role;

CREATE OR REPLACE FUNCTION public.finance_save_accounting_semantic_gl_mapping(
  p_tenant_id UUID,
  p_semantic_key VARCHAR,
  p_account_code VARCHAR,
  p_effective_from DATE,
  p_authority_version VARCHAR DEFAULT 'TENANT_CONFIG:v1'
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  semantic_key VARCHAR,
  account_code VARCHAR,
  authority_version VARCHAR,
  effective_from DATE,
  effective_to DATE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_mapping_id UUID;
BEGIN
  IF p_semantic_key NOT IN ('TRADE_RECEIVABLE', 'SERVICE_REVENUE') THEN
    RAISE EXCEPTION
      'ACCOUNTING_SEMANTIC_CONFIG_UNSUPPORTED_SEMANTIC: % is not enabled for TT99 Slice 1',
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
    RAISE EXCEPTION
      'ACCOUNTING_SEMANTIC_CONFIG_INVALID_ACCOUNT: account % is missing or inactive for tenant %',
      p_account_code,
      p_tenant_id
      USING ERRCODE = 'F5042';
  END IF;

  UPDATE public.finance_control_account_mappings m
  SET
    account_code = p_account_code,
    authority_version = p_authority_version,
    effective_from = p_effective_from,
    effective_to = NULL,
    updated_at = NOW()
  WHERE m.tenant_id = p_tenant_id
    AND m.control_type = p_semantic_key
  RETURNING m.id INTO v_mapping_id;

  IF v_mapping_id IS NULL THEN
    INSERT INTO public.finance_control_account_mappings (
      tenant_id,
      control_type,
      account_code,
      authority_version,
      effective_from,
      effective_to,
      created_at,
      updated_at
    )
    VALUES (
      p_tenant_id,
      p_semantic_key,
      p_account_code,
      p_authority_version,
      p_effective_from,
      NULL,
      NOW(),
      NOW()
    )
    RETURNING finance_control_account_mappings.id INTO v_mapping_id;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.tenant_id,
    m.control_type::VARCHAR AS semantic_key,
    m.account_code::VARCHAR AS account_code,
    m.authority_version::VARCHAR AS authority_version,
    m.effective_from::DATE AS effective_from,
    m.effective_to::DATE AS effective_to
  FROM public.finance_control_account_mappings m
  WHERE m.id = v_mapping_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_save_accounting_semantic_gl_mapping(UUID, VARCHAR, VARCHAR, DATE, VARCHAR) TO service_role;

DO $$
DECLARE
  v_target_tenant UUID := 'd2a96838-605e-40eb-ab0b-c2749778f338'::UUID;
  v_authority VARCHAR := 'VI_TT99_2025|99/2025/TT-BTC|PROVEN';
  v_bad_account RECORD;
BEGIN
  SELECT code, type, normal_balance
  INTO v_bad_account
  FROM public.finance_accounts
  WHERE tenant_id = v_target_tenant
    AND code = '131'
    AND (type <> 'ASSET' OR normal_balance <> 'DEBIT')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'TT99_SLICE1_COA_CONFLICT: tenant % account 131 has invalid type/balance', v_target_tenant;
  END IF;

  SELECT code, type, normal_balance
  INTO v_bad_account
  FROM public.finance_accounts
  WHERE tenant_id = v_target_tenant
    AND code = '511'
    AND (type <> 'REVENUE' OR normal_balance <> 'CREDIT')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'TT99_SLICE1_COA_CONFLICT: tenant % account 511 has invalid type/balance', v_target_tenant;
  END IF;

  INSERT INTO public.finance_accounts (
    tenant_id,
    code,
    name,
    type,
    normal_balance,
    currency,
    is_active
  )
  VALUES
    (
      v_target_tenant,
      '131',
      'Phải thu của khách hàng',
      'ASSET',
      'DEBIT',
      'VND',
      TRUE
    ),
    (
      v_target_tenant,
      '511',
      'Doanh thu bán hàng và cung cấp dịch vụ',
      'REVENUE',
      'CREDIT',
      'VND',
      TRUE
    )
  ON CONFLICT (tenant_id, code)
  DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    normal_balance = EXCLUDED.normal_balance,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active;

  PERFORM *
  FROM public.finance_save_accounting_semantic_gl_mapping(
    v_target_tenant,
    'TRADE_RECEIVABLE',
    '131',
    DATE '2026-01-01',
    v_authority
  );

  PERFORM *
  FROM public.finance_save_accounting_semantic_gl_mapping(
    v_target_tenant,
    'SERVICE_REVENUE',
    '511',
    DATE '2026-01-01',
    v_authority
  );
END;
$$;
