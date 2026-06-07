-- =============================================================================
-- Migration: Accounting worker run observability
-- Purpose:
--   Persist each cron worker run so accounting health can detect silent workers,
--   failed runs, and processing latency without relying on console logs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_worker_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (
        status IN ('success', 'partial_failure', 'critical_failure', 'claim_failed', 'exception')
    ),
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    claimed_count INTEGER NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
    success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
    dead_letter_count INTEGER NOT NULL DEFAULT 0 CHECK (dead_letter_count >= 0),
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    critical_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (critical_failure_count >= 0),
    tenant_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
    details JSONB NOT NULL DEFAULT '[]'::JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_worker_runs_started_at
    ON public.accounting_worker_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_worker_runs_status_started_at
    ON public.accounting_worker_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_worker_runs_tenant_ids
    ON public.accounting_worker_runs USING GIN (tenant_ids);

ALTER TABLE public.accounting_worker_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read accounting_worker_runs" ON public.accounting_worker_runs;
CREATE POLICY "Admin read accounting_worker_runs"
    ON public.accounting_worker_runs
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR cardinality(tenant_ids) = 0
            OR public.get_auth_tenant_id() = ANY(tenant_ids)
        )
    );

GRANT SELECT ON public.accounting_worker_runs TO authenticated;
GRANT ALL ON public.accounting_worker_runs TO service_role, postgres;

NOTIFY pgrst, 'reload schema';
