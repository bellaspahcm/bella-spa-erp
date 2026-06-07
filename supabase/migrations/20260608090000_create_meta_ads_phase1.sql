-- Phase 1 Meta Ads integration: read-only ad account mapping, daily insights,
-- and sync audit runs. Access tokens stay in server environment secrets.

CREATE TABLE IF NOT EXISTS public.marketing_meta_ad_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ad_account_id TEXT NOT NULL,
    account_name TEXT,
    currency TEXT,
    timezone_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT marketing_meta_ad_accounts_ad_account_id_check
        CHECK (ad_account_id ~ '^act_[0-9]+$'),
    CONSTRAINT marketing_meta_ad_accounts_unique_account
        UNIQUE (tenant_id, ad_account_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_meta_ads_insights_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ad_account_id TEXT NOT NULL,
    date_start DATE NOT NULL,
    date_stop DATE NOT NULL,
    campaign_id TEXT NOT NULL DEFAULT '',
    campaign_name TEXT,
    adset_id TEXT NOT NULL DEFAULT '',
    adset_name TEXT,
    ad_id TEXT NOT NULL DEFAULT '',
    ad_name TEXT,
    spend NUMERIC(14,2) NOT NULL DEFAULT 0,
    impressions BIGINT NOT NULL DEFAULT 0,
    reach BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    ctr NUMERIC(12,6) NOT NULL DEFAULT 0,
    cpc NUMERIC(14,6) NOT NULL DEFAULT 0,
    cpm NUMERIC(14,6) NOT NULL DEFAULT 0,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT marketing_meta_ads_insights_daily_account_check
        CHECK (ad_account_id ~ '^act_[0-9]+$'),
    CONSTRAINT marketing_meta_ads_insights_daily_date_check
        CHECK (date_stop >= date_start),
    CONSTRAINT marketing_meta_ads_insights_daily_unique_row
        UNIQUE (tenant_id, ad_account_id, date_start, campaign_id, adset_id, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_meta_ads_insights_daily_tenant_date
    ON public.marketing_meta_ads_insights_daily (tenant_id, date_start DESC);

CREATE TABLE IF NOT EXISTS public.marketing_meta_ads_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ad_account_id TEXT NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'failed')),
    rows_synced INTEGER NOT NULL DEFAULT 0 CHECK (rows_synced >= 0),
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT marketing_meta_ads_sync_runs_account_check
        CHECK (ad_account_id ~ '^act_[0-9]+$'),
    CONSTRAINT marketing_meta_ads_sync_runs_date_check
        CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_marketing_meta_ads_sync_runs_tenant_started
    ON public.marketing_meta_ads_sync_runs (tenant_id, started_at DESC);

ALTER TABLE public.marketing_meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_meta_ads_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_meta_ads_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Meta ads read scoped tenant data" ON public.marketing_meta_ad_accounts;
CREATE POLICY "Meta ads read scoped tenant data"
    ON public.marketing_meta_ad_accounts
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin', 'accountant')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads admin manage account mapping" ON public.marketing_meta_ad_accounts;
CREATE POLICY "Meta ads admin manage account mapping"
    ON public.marketing_meta_ad_accounts
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads read scoped insights" ON public.marketing_meta_ads_insights_daily;
CREATE POLICY "Meta ads read scoped insights"
    ON public.marketing_meta_ads_insights_daily
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin', 'accountant')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads admin write insights" ON public.marketing_meta_ads_insights_daily;
CREATE POLICY "Meta ads admin write insights"
    ON public.marketing_meta_ads_insights_daily
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads admin update insights" ON public.marketing_meta_ads_insights_daily;
CREATE POLICY "Meta ads admin update insights"
    ON public.marketing_meta_ads_insights_daily
    FOR UPDATE TO authenticated
    USING (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads read scoped sync runs" ON public.marketing_meta_ads_sync_runs;
CREATE POLICY "Meta ads read scoped sync runs"
    ON public.marketing_meta_ads_sync_runs
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin', 'accountant')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads admin write sync runs" ON public.marketing_meta_ads_sync_runs;
CREATE POLICY "Meta ads admin write sync runs"
    ON public.marketing_meta_ads_sync_runs
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    );

DROP POLICY IF EXISTS "Meta ads admin update sync runs" ON public.marketing_meta_ads_sync_runs;
CREATE POLICY "Meta ads admin update sync runs"
    ON public.marketing_meta_ads_sync_runs
    FOR UPDATE TO authenticated
    USING (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR (
            tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND lower(u.role) IN ('admin', 'super_admin')
            )
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.marketing_meta_ad_accounts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.marketing_meta_ads_insights_daily TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.marketing_meta_ads_sync_runs TO authenticated, service_role;
