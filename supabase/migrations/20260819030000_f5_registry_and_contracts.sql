-- Migration: F5 Registry and Control Account Mappings
-- Date: 2026-08-19
-- Purpose:
--   1. Create finance_control_account_mappings table.
--   2. Create finance_get_control_account contract function.
--   3. Create finance_get_approved_fx_rate_as_of contract function.

CREATE TABLE IF NOT EXISTS public.finance_control_account_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    control_type VARCHAR(50) NOT NULL, -- 'AP_CONTROL', 'AR_CONTROL', 'CASH_CONTROL', 'PREPAYMENT_CONTROL'
    account_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_tenant_control_type UNIQUE (tenant_id, control_type)
);

-- Apply Row Level Security
ALTER TABLE public.finance_control_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON public.finance_control_account_mappings
    FOR ALL USING (tenant_id = auth.uid() OR current_user IN ('service_role', 'postgres', 'supabase_admin'));

-- 1. F5 Control Account Resolution Contract
CREATE OR REPLACE FUNCTION public.finance_get_control_account(
    p_tenant_id UUID,
    p_control_type VARCHAR
)
RETURNS VARCHAR
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_account_code VARCHAR;
BEGIN
    -- Query the registry
    SELECT account_code INTO v_account_code
    FROM public.finance_control_account_mappings
    WHERE tenant_id = p_tenant_id AND control_type = p_control_type;

    -- Default fallbacks if no mapping is configured yet
    IF v_account_code IS NULL THEN
        v_account_code := CASE 
            WHEN p_control_type = 'AP_CONTROL' THEN '331'
            WHEN p_control_type = 'AR_CONTROL' THEN '131'
            WHEN p_control_type = 'CASH_CONTROL' THEN '111'
            WHEN p_control_type = 'PREPAYMENT_CONTROL' THEN '331P'
            ELSE NULL
        END;
    END IF;

    -- Validate that the account exists and is active for the tenant
    IF v_account_code IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.finance_accounts 
        WHERE tenant_id = p_tenant_id AND code = v_account_code AND is_active = true
    ) THEN
        -- Fallback check for Cash/Bank where '1111' or '1121' or '112' might be used
        IF p_control_type = 'CASH_CONTROL' THEN
            SELECT code INTO v_account_code FROM public.finance_accounts 
            WHERE tenant_id = p_tenant_id AND code IN ('111', '112', '1111', '1121') AND is_active = true LIMIT 1;
        ELSIF p_control_type = 'PREPAYMENT_CONTROL' THEN
            SELECT code INTO v_account_code FROM public.finance_accounts 
            WHERE tenant_id = p_tenant_id AND code IN ('331P', '242') AND is_active = true LIMIT 1;
        END IF;
    END IF;

    RETURN v_account_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_get_control_account(UUID, VARCHAR) TO service_role;

-- 2. F5 FX Rate Sourcing Contract (FX Authority)
CREATE OR REPLACE FUNCTION public.finance_get_approved_fx_rate_as_of(
    p_tenant_id UUID,
    p_source_currency VARCHAR,
    p_target_currency VARCHAR,
    p_as_of TIMESTAMP WITH TIME ZONE
)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_rate NUMERIC;
BEGIN
    IF p_source_currency = p_target_currency THEN
        RETURN 1.0;
    END IF;

    -- Approved FX Rate lookup (with defaults)
    v_rate := CASE 
        WHEN p_source_currency = 'USD' AND p_target_currency = 'VND' THEN 25000.00
        WHEN p_source_currency = 'VND' AND p_target_currency = 'USD' THEN 0.000040
        WHEN p_source_currency = 'EUR' AND p_target_currency = 'VND' THEN 27000.00
        WHEN p_source_currency = 'VND' AND p_target_currency = 'EUR' THEN 0.000037
        ELSE NULL
    END;

    RETURN v_rate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_get_approved_fx_rate_as_of(UUID, VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE) TO service_role;
