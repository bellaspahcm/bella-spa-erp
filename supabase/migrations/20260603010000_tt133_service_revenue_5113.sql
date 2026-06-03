-- TT133 service revenue mapping hardening.
-- Adds 5113 for service revenue and updates system templates to credit 5113.

INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active, parent_id)
SELECT
    t.id,
    '5113',
    'Doanh thu cung cap dich vu',
    'REVENUE',
    TRUE,
    p.id
FROM public.tenants t
LEFT JOIN public.accounting_accounts p
    ON p.tenant_id = t.id
   AND p.account_code = '511'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.accounting_accounts a
    WHERE a.tenant_id = t.id
      AND a.account_code = '5113'
);

UPDATE public.accounting_accounts c
SET parent_id = p.id,
    is_active = TRUE
FROM public.accounting_accounts p
WHERE c.tenant_id = p.tenant_id
  AND c.account_code = '5113'
  AND p.account_code = '511';

UPDATE public.accounting_event_templates
SET template_lines = jsonb_set(
    template_lines,
    '{1,account_code}',
    '"5113"'::jsonb
)
WHERE standard_profile = 'TT133'
  AND business_event_type = 'SESSION_REVENUE_RECOGNIZED'
  AND jsonb_array_length(template_lines) >= 2;

