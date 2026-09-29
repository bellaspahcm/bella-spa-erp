-- ============================================================
-- Migration: Haircut exact COA bootstrap
-- Scope:
--   Exact configuration bootstrap for the 3 verified active bella_haircut tenants.
--   Uses the existing canonical legacy accounting seed_default_coa() function.
--
-- Evidence:
--   2026-09-29 read-only verification found all checked legacy accounting
--   accounts missing for:
--     - Haircut Shop
--     - P1C-haircut-2055f3bb Tenant
--     - P1D1-haircut-75b42702 Tenant
--
-- Guardrails:
--   - No new COA policy.
--   - No ad hoc account definitions.
--   - No tenant outside the three verified active bella_haircut tenants.
--   - seed_default_coa is idempotent via ON CONFLICT DO NOTHING.
--   - 5113 uses the existing canonical definition from
--     20260603010000_tt133_service_revenue_5113.sql because seed_default_coa()
--     predates that account.
-- ============================================================

DO $$
DECLARE
  v_expected_tenants CONSTANT UUID[] := ARRAY[
    '743d7f1e-403f-4817-aaf2-3b5acf540154'::UUID,
    'b5925494-7687-4842-8ed8-6f4be4de6acd'::UUID,
    '6132681f-1663-4f0d-885c-b158f7f9c9e7'::UUID
  ];
  v_tenant_id UUID;
  v_seeded_count INTEGER;
BEGIN
  FOREACH v_tenant_id IN ARRAY v_expected_tenants LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.tenants
      WHERE id = v_tenant_id
        AND product_key = 'bella_haircut'
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'HAIRCUT_COA_BOOTSTRAP_SCOPE_MISMATCH: tenant % is not an active bella_haircut tenant', v_tenant_id;
    END IF;

    v_seeded_count := public.seed_default_coa(v_tenant_id);

    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active, parent_id)
    SELECT
      v_tenant_id,
      '5113',
      'Doanh thu cung cap dich vu',
      'REVENUE',
      TRUE,
      p.id
    FROM public.accounting_accounts p
    WHERE p.tenant_id = v_tenant_id
      AND p.account_code = '511'
      AND NOT EXISTS (
        SELECT 1
        FROM public.accounting_accounts a
        WHERE a.tenant_id = v_tenant_id
          AND a.account_code = '5113'
      );

    UPDATE public.accounting_accounts c
    SET parent_id = p.id,
        is_active = TRUE
    FROM public.accounting_accounts p
    WHERE c.tenant_id = v_tenant_id
      AND c.tenant_id = p.tenant_id
      AND c.account_code = '5113'
      AND p.account_code = '511';

    RAISE NOTICE 'Haircut COA bootstrap checked tenant %, inserted % accounts', v_tenant_id, v_seeded_count;
  END LOOP;
END $$;
