-- Super Admin subscription/quota schema foundation.
-- This keeps current plan codes compatible with tenants.subscription_tier while
-- moving limits out of application hard-code for later HQ management screens.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    plan_code TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_plan_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code TEXT NOT NULL REFERENCES public.subscription_plans(plan_code) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    limit_value NUMERIC(14,2),
    is_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
    unit TEXT NOT NULL DEFAULT 'count',
    enforcement_mode TEXT NOT NULL DEFAULT 'hard'
        CHECK (enforcement_mode IN ('hard', 'soft', 'metered', 'informational')),
    reset_period TEXT NOT NULL DEFAULT 'none'
        CHECK (reset_period IN ('none', 'daily', 'monthly', 'yearly')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subscription_plan_entitlements_limit_check
        CHECK (is_unlimited = TRUE OR (limit_value IS NOT NULL AND limit_value >= 0)),
    CONSTRAINT subscription_plan_entitlements_unique_feature
        UNIQUE (plan_code, feature_key)
);

CREATE TABLE IF NOT EXISTS public.tenant_subscription_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    limit_value NUMERIC(14,2),
    is_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
    unit TEXT NOT NULL DEFAULT 'count',
    enforcement_mode TEXT NOT NULL DEFAULT 'hard'
        CHECK (enforcement_mode IN ('hard', 'soft', 'metered', 'informational')),
    reset_period TEXT NOT NULL DEFAULT 'none'
        CHECK (reset_period IN ('none', 'daily', 'monthly', 'yearly')),
    reason TEXT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_subscription_overrides_limit_check
        CHECK (is_unlimited = TRUE OR (limit_value IS NOT NULL AND limit_value >= 0)),
    CONSTRAINT tenant_subscription_overrides_date_check
        CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscription_overrides_one_active_feature
    ON public.tenant_subscription_overrides (tenant_id, feature_key)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.tenant_usage_counters (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    used_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (used_value >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_increment_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, feature_key, period_start),
    CONSTRAINT tenant_usage_counters_period_check CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_entitlements_feature
    ON public.subscription_plan_entitlements (feature_key, plan_code);
CREATE INDEX IF NOT EXISTS idx_tenant_subscription_overrides_tenant_active
    ON public.tenant_subscription_overrides (tenant_id, is_active, feature_key);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_counters_tenant_feature_period
    ON public.tenant_usage_counters (tenant_id, feature_key, period_start DESC);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscription_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read active subscription plans" ON public.subscription_plans;
CREATE POLICY "Read active subscription plans"
    ON public.subscription_plans
    FOR SELECT TO authenticated
    USING (is_active = TRUE OR public.is_hq_super_admin());

DROP POLICY IF EXISTS "HQ manage subscription plans" ON public.subscription_plans;
CREATE POLICY "HQ manage subscription plans"
    ON public.subscription_plans
    FOR ALL TO authenticated
    USING (public.is_hq_super_admin())
    WITH CHECK (public.is_hq_super_admin());

DROP POLICY IF EXISTS "Read subscription plan entitlements" ON public.subscription_plan_entitlements;
CREATE POLICY "Read subscription plan entitlements"
    ON public.subscription_plan_entitlements
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.subscription_plans p
            WHERE p.plan_code = subscription_plan_entitlements.plan_code
              AND p.is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "HQ manage subscription plan entitlements" ON public.subscription_plan_entitlements;
CREATE POLICY "HQ manage subscription plan entitlements"
    ON public.subscription_plan_entitlements
    FOR ALL TO authenticated
    USING (public.is_hq_super_admin())
    WITH CHECK (public.is_hq_super_admin());

DROP POLICY IF EXISTS "Read tenant subscription overrides" ON public.tenant_subscription_overrides;
CREATE POLICY "Read tenant subscription overrides"
    ON public.tenant_subscription_overrides
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

DROP POLICY IF EXISTS "HQ manage tenant subscription overrides" ON public.tenant_subscription_overrides;
CREATE POLICY "HQ manage tenant subscription overrides"
    ON public.tenant_subscription_overrides
    FOR ALL TO authenticated
    USING (public.is_hq_super_admin())
    WITH CHECK (public.is_hq_super_admin());

DROP POLICY IF EXISTS "Read tenant usage counters" ON public.tenant_usage_counters;
CREATE POLICY "Read tenant usage counters"
    ON public.tenant_usage_counters
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

DROP POLICY IF EXISTS "HQ manage tenant usage counters" ON public.tenant_usage_counters;
CREATE POLICY "HQ manage tenant usage counters"
    ON public.tenant_usage_counters
    FOR ALL TO authenticated
    USING (public.is_hq_super_admin())
    WITH CHECK (public.is_hq_super_admin());

INSERT INTO public.subscription_plans (
    plan_code, display_name, description, price_monthly, is_active, sort_order
) VALUES
    ('free_trial', 'Dùng thử', 'Gói dùng thử cho chi nhánh nhượng quyền mới.', 0, TRUE, 10),
    ('basic', 'Cơ bản', 'Gói cơ bản cho chi nhánh nhỏ.', 499000, TRUE, 20),
    ('pro', 'Chuyên nghiệp', 'Gói tăng trưởng cho chi nhánh vận hành ổn định.', 999000, TRUE, 30),
    ('enterprise', 'Nhượng quyền', 'Gói enterprise/franchise với hạn mức cao.', 2499000, TRUE, 40)
ON CONFLICT (plan_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

INSERT INTO public.subscription_plan_entitlements (
    plan_code, feature_key, limit_value, is_unlimited, unit, enforcement_mode, reset_period, description
) VALUES
    ('free_trial', 'ktv', 1, FALSE, 'count', 'hard', 'none', 'Số kỹ thuật viên tối đa.'),
    ('free_trial', 'customer', 15, FALSE, 'count', 'hard', 'none', 'Số khách hàng tối đa.'),
    ('free_trial', 'sms', 20, FALSE, 'message', 'hard', 'monthly', 'Số tin Zalo/SMS mỗi tháng.'),
    ('basic', 'ktv', 3, FALSE, 'count', 'hard', 'none', 'Số kỹ thuật viên tối đa.'),
    ('basic', 'customer', 50, FALSE, 'count', 'hard', 'none', 'Số khách hàng tối đa.'),
    ('basic', 'sms', 100, FALSE, 'message', 'hard', 'monthly', 'Số tin Zalo/SMS mỗi tháng.'),
    ('pro', 'ktv', 10, FALSE, 'count', 'hard', 'none', 'Số kỹ thuật viên tối đa.'),
    ('pro', 'customer', 500, FALSE, 'count', 'hard', 'none', 'Số khách hàng tối đa.'),
    ('pro', 'sms', 500, FALSE, 'message', 'hard', 'monthly', 'Số tin Zalo/SMS mỗi tháng.'),
    ('enterprise', 'ktv', NULL, TRUE, 'count', 'hard', 'none', 'Không giới hạn kỹ thuật viên.'),
    ('enterprise', 'customer', NULL, TRUE, 'count', 'hard', 'none', 'Không giới hạn khách hàng.'),
    ('enterprise', 'sms', 2000, FALSE, 'message', 'hard', 'monthly', 'Số tin Zalo/SMS mỗi tháng.')
ON CONFLICT (plan_code, feature_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    is_unlimited = EXCLUDED.is_unlimited,
    unit = EXCLUDED.unit,
    enforcement_mode = EXCLUDED.enforcement_mode,
    reset_period = EXCLUDED.reset_period,
    description = EXCLUDED.description,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.get_effective_subscription_entitlements(
    p_tenant_id UUID
)
RETURNS TABLE (
    tenant_id UUID,
    plan_code TEXT,
    feature_key TEXT,
    limit_value NUMERIC,
    is_unlimited BOOLEAN,
    unit TEXT,
    enforcement_mode TEXT,
    reset_period TEXT,
    source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_code TEXT;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant_id for subscription entitlement lookup.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR public.is_hq_super_admin()
        OR p_tenant_id = public.get_auth_tenant_id()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: cannot view subscription entitlements for another tenant.';
    END IF;

    SELECT COALESCE(t.subscription_tier, 'free_trial')
    INTO v_plan_code
    FROM public.tenants t
    WHERE t.id = p_tenant_id;

    IF v_plan_code IS NULL THEN
        RAISE EXCEPTION 'Tenant % not found for subscription entitlement lookup.', p_tenant_id;
    END IF;

    RETURN QUERY
    WITH active_overrides AS (
        SELECT DISTINCT ON (o.feature_key)
            o.feature_key,
            o.limit_value,
            o.is_unlimited,
            o.unit,
            o.enforcement_mode,
            o.reset_period
        FROM public.tenant_subscription_overrides o
        WHERE o.tenant_id = p_tenant_id
          AND o.is_active = TRUE
          AND o.starts_at <= NOW()
          AND (o.expires_at IS NULL OR o.expires_at > NOW())
        ORDER BY o.feature_key, o.created_at DESC
    ),
    plan_rows AS (
        SELECT
            p_tenant_id AS tenant_id,
            v_plan_code AS plan_code,
            e.feature_key,
            COALESCE(o.limit_value, e.limit_value) AS limit_value,
            COALESCE(o.is_unlimited, e.is_unlimited) AS is_unlimited,
            COALESCE(o.unit, e.unit) AS unit,
            COALESCE(o.enforcement_mode, e.enforcement_mode) AS enforcement_mode,
            COALESCE(o.reset_period, e.reset_period) AS reset_period,
            CASE WHEN o.feature_key IS NULL THEN 'plan' ELSE 'override' END AS source
        FROM public.subscription_plan_entitlements e
        LEFT JOIN active_overrides o ON o.feature_key = e.feature_key
        WHERE e.plan_code = v_plan_code
    ),
    override_only_rows AS (
        SELECT
            p_tenant_id AS tenant_id,
            v_plan_code AS plan_code,
            o.feature_key,
            o.limit_value,
            o.is_unlimited,
            o.unit,
            o.enforcement_mode,
            o.reset_period,
            'override' AS source
        FROM active_overrides o
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.subscription_plan_entitlements e
            WHERE e.plan_code = v_plan_code
              AND e.feature_key = o.feature_key
        )
    )
    SELECT *
    FROM (
        SELECT * FROM plan_rows
        UNION ALL
        SELECT * FROM override_only_rows
    ) effective_rows
    ORDER BY effective_rows.feature_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_subscription_entitlements(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_subscription_entitlements(UUID) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plan_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscription_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_usage_counters TO authenticated;

GRANT ALL ON public.subscription_plans TO service_role, postgres;
GRANT ALL ON public.subscription_plan_entitlements TO service_role, postgres;
GRANT ALL ON public.tenant_subscription_overrides TO service_role, postgres;
GRANT ALL ON public.tenant_usage_counters TO service_role, postgres;

COMMENT ON TABLE public.subscription_plans IS
  'HQ-managed subscription plan catalog. Seeded with current free_trial/basic/pro/enterprise plan codes.';
COMMENT ON TABLE public.subscription_plan_entitlements IS
  'Feature limits per subscription plan. Tenant overrides are layered separately.';
COMMENT ON TABLE public.tenant_subscription_overrides IS
  'HQ-approved per-tenant quota overrides for subscription limits.';
COMMENT ON TABLE public.tenant_usage_counters IS
  'Per-tenant metered usage counters by feature and period.';
COMMENT ON FUNCTION public.get_effective_subscription_entitlements(UUID) IS
  'Returns plan entitlements after applying active tenant-specific overrides.';
