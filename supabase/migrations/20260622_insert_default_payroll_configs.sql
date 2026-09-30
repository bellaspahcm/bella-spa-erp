-- =====================================================
-- Bella payroll configuration defaults
-- =====================================================
-- Safe to re-run: one row per tenant/provider is protected by the
-- tenant_payroll_config unique constraint.

INSERT INTO public.tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT
  id AS tenant_id,
  'commission' AS provider_key,
  true AS enabled,
  'fixed' AS strategy,
  '{"rate": 120000, "minSessions": 0}'::jsonb AS config,
  'Default commission: 120k per session' AS notes
FROM public.tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

INSERT INTO public.tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT
  id AS tenant_id,
  'kpi' AS provider_key,
  false AS enabled,
  'threshold' AS strategy,
  '{"target": 30, "bonus": 1000000}'::jsonb AS config,
  'KPI bonus: 30 sessions -> 1M VND (disabled by default)' AS notes
FROM public.tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

INSERT INTO public.tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT
  id AS tenant_id,
  'attendance' AS provider_key,
  true AS enabled,
  'late_deduction' AS strategy,
  '{"latePenalty": 50000, "absentPenalty": 200000, "lateGracePeriod": 15}'::jsonb AS config,
  'Attendance deductions: 50k late, 200k absent, 15min grace' AS notes
FROM public.tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

INSERT INTO public.tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT
  id AS tenant_id,
  'rating' AS provider_key,
  false AS enabled,
  'threshold' AS strategy,
  '{"minRating": 4.5, "bonus": 50000}'::jsonb AS config,
  'Rating bonus: >= 4.5 stars -> 50k VND (disabled by default)' AS notes
FROM public.tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

INSERT INTO public.tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT
  id AS tenant_id,
  'bonus' AS provider_key,
  false AS enabled,
  'manual' AS strategy,
  '{}'::jsonb AS config,
  'Manual bonus entries (enable when needed)' AS notes
FROM public.tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;
