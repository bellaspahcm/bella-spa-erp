-- Store Meta Ads tokens separately from the read-facing account mapping.
-- Account metadata stays visible to reporting roles; token rows are admin-only.

ALTER TABLE public.marketing_meta_ad_accounts
    ADD COLUMN IF NOT EXISTS token_last_four TEXT,
    ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'marketing_meta_ad_accounts_token_last_four_check'
    ) THEN
        ALTER TABLE public.marketing_meta_ad_accounts
            ADD CONSTRAINT marketing_meta_ad_accounts_token_last_four_check
            CHECK (token_last_four IS NULL OR length(token_last_four) BETWEEN 1 AND 8);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.marketing_meta_ad_account_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meta_ad_account_id UUID NOT NULL REFERENCES public.marketing_meta_ad_accounts(id) ON DELETE CASCADE,
    access_token_encrypted TEXT NOT NULL,
    token_last_four TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT marketing_meta_ad_account_tokens_unique_account
        UNIQUE (meta_ad_account_id),
    CONSTRAINT marketing_meta_ad_account_tokens_token_last_four_check
        CHECK (token_last_four IS NULL OR length(token_last_four) BETWEEN 1 AND 8)
);

CREATE INDEX IF NOT EXISTS idx_marketing_meta_ad_account_tokens_tenant
    ON public.marketing_meta_ad_account_tokens (tenant_id, meta_ad_account_id);

ALTER TABLE public.marketing_meta_ad_account_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Meta ads admin manage account tokens" ON public.marketing_meta_ad_account_tokens;
CREATE POLICY "Meta ads admin manage account tokens"
    ON public.marketing_meta_ad_account_tokens
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

GRANT SELECT, INSERT, UPDATE ON public.marketing_meta_ad_account_tokens TO authenticated, service_role;
