-- =============================================================================
-- Migration: Accounting Outbox — Transactional Outbox Pattern
-- Ngày: 2026-05-25
-- Mục đích:
--   Bảng queue lưu các "accounting event" sinh ra từ business flow.
--   Business hook (createBooking, checkoutSession...) chỉ insert vào outbox
--   trong cùng transaction với business write → guarantee không mất event.
--
--   Worker (cron 1 phút) sẽ poll PENDING events và gọi AccountingEngineService
--   để post journal entries. Nếu fail → retry với exponential backoff.
--
-- Pattern reference: https://microservices.io/patterns/data/transactional-outbox.html
-- =============================================================================


-- =============================================================================
-- 1. Table: accounting_outbox
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Event type — quyết định handler nào trong AccountingEngineService xử lý
    event_type TEXT NOT NULL CHECK (event_type IN (
        'PACKAGE_SALE',          -- Bán gói dịch vụ (cọc/thanh toán nốt)
        'SESSION_DONE',          -- KTV check-out hoàn thành buổi
        'EXPENSE_RECORDED',      -- Admin ghi nhận chi phí
        'SALARY_PAID',           -- Trả lương + hoa hồng KTV
        'INVENTORY_CONSUMED',    -- Trừ kho khi session done
        'REFUND_ISSUED',         -- Hoàn tiền khách
        'MANUAL_ENTRY'           -- Bút toán thủ công từ UI
    )),

    -- Idempotency: business reference để tránh post 2 lần cùng event
    reference_type TEXT NOT NULL,  -- 'BOOKING', 'REVENUE', 'EXPENSE', 'SESSION_LOG', etc.
    reference_id UUID NOT NULL,    -- ID của bản ghi gốc

    -- Payload chi tiết để handler dùng
    payload JSONB NOT NULL,

    -- Trạng thái xử lý
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD')),

    -- Retry tracking
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),

    -- Link đến journal entry đã tạo (sau khi COMPLETED)
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    -- Idempotency constraint: cùng (event_type, reference_id) chỉ được insert 1 lần
    -- (trừ MANUAL_ENTRY có thể có nhiều entry với cùng reference)
    CONSTRAINT outbox_idempotency UNIQUE (event_type, reference_id)
);


-- =============================================================================
-- 2. Indexes cho worker poll
-- =============================================================================

-- Worker query: tìm PENDING events ready to retry, oldest first
CREATE INDEX IF NOT EXISTS idx_outbox_worker_pending
    ON public.accounting_outbox (next_retry_at, created_at)
    WHERE status IN ('PENDING', 'FAILED');

-- Admin dashboard: xem outbox theo tenant
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_status
    ON public.accounting_outbox (tenant_id, status, created_at DESC);

-- Lookup theo reference (cho idempotency check ở app layer)
CREATE INDEX IF NOT EXISTS idx_outbox_reference
    ON public.accounting_outbox (reference_type, reference_id);


-- =============================================================================
-- 3. RLS — chỉ admin được xem outbox, service-role bypass
-- =============================================================================
ALTER TABLE public.accounting_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read accounting_outbox" ON public.accounting_outbox;
CREATE POLICY "Admin read accounting_outbox"
    ON public.accounting_outbox
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- Insert: chỉ qua service-role (business hook) — không cho user trực tiếp
-- Update: chỉ qua service-role (worker)
-- Không tạo INSERT/UPDATE/DELETE policy → tự động bị chặn cho authenticated


-- =============================================================================
-- 4. Helper RPC: enqueue_accounting_event
-- Dùng cho app layer insert event vào outbox trong cùng transaction với business write.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_accounting_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.accounting_outbox (
        tenant_id, event_type, reference_type, reference_id, payload
    ) VALUES (
        p_tenant_id, p_event_type, p_reference_type, p_reference_id, p_payload
    )
    ON CONFLICT (event_type, reference_id) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;  -- NULL nếu đã tồn tại (idempotent)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 5. Helper RPC: claim_next_outbox_batch
-- Worker call để claim N events vào PROCESSING (atomic, race-condition safe).
-- Dùng FOR UPDATE SKIP LOCKED — nhiều worker chạy song song không conflict.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    event_type TEXT,
    reference_type TEXT,
    reference_id UUID,
    payload JSONB,
    retry_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT o.id
        FROM public.accounting_outbox o
        WHERE o.status IN ('PENDING', 'FAILED')
          AND o.next_retry_at <= NOW()
          AND o.retry_count < o.max_retries
        ORDER BY o.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.accounting_outbox o
    SET status = 'PROCESSING',
        retry_count = o.retry_count + 1
    FROM claimed
    WHERE o.id = claimed.id
    RETURNING o.id, o.tenant_id, o.event_type, o.reference_type, o.reference_id, o.payload, o.retry_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 6. Helper RPC: mark_outbox_completed
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_outbox_completed(
    p_outbox_id UUID,
    p_journal_entry_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE public.accounting_outbox
    SET status = 'COMPLETED',
        journal_entry_id = p_journal_entry_id,
        processed_at = NOW(),
        last_error = NULL
    WHERE id = p_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 7. Helper RPC: mark_outbox_failed
-- Exponential backoff: next_retry = now + 2^retry_count minutes
-- Sau max_retries → DEAD (cần admin can thiệp)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_outbox_failed(
    p_outbox_id UUID,
    p_error TEXT
) RETURNS VOID AS $$
DECLARE
    v_retry_count INTEGER;
    v_max_retries INTEGER;
    v_backoff_minutes INTEGER;
BEGIN
    SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
    FROM public.accounting_outbox WHERE id = p_outbox_id;

    IF v_retry_count >= v_max_retries THEN
        UPDATE public.accounting_outbox
        SET status = 'DEAD',
            last_error = p_error,
            processed_at = NOW()
        WHERE id = p_outbox_id;
    ELSE
        -- Backoff: 2^n phút, capped tại 60 phút (1h)
        v_backoff_minutes := LEAST(POWER(2, v_retry_count)::INTEGER, 60);

        UPDATE public.accounting_outbox
        SET status = 'FAILED',
            last_error = p_error,
            next_retry_at = NOW() + (v_backoff_minutes || ' minutes')::INTERVAL
        WHERE id = p_outbox_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 8. View: outbox_health — dashboard monitoring
-- =============================================================================
CREATE OR REPLACE VIEW public.outbox_health AS
SELECT
    tenant_id,
    status,
    event_type,
    COUNT(*) as count,
    MAX(created_at) as latest_event,
    MAX(processed_at) FILTER (WHERE status = 'COMPLETED') as last_completed,
    AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) FILTER (WHERE status = 'COMPLETED') as avg_latency_seconds
FROM public.accounting_outbox
GROUP BY tenant_id, status, event_type;
