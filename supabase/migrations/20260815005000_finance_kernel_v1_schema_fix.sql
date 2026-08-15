-- Migration: finance_kernel_v1_schema_fix
-- Description: Adds missing columns to Finance OS Kernel tables
--   that are referenced by RPCs in migration 20260815010000.
--
-- Missing columns:
--   1. finance_transactions.request_hash — used by idempotency check in finance_post_transaction RPC
--   2. finance_outbox_events.event_id — used by RPC to track event identity

-- =========================================================================
-- 1. Add request_hash to finance_transactions
-- =========================================================================
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);

-- Index for idempotency + hash lookups (already indexed on idempotency_key, this aids conflict detection)
CREATE INDEX IF NOT EXISTS idx_finance_txs_request_hash
  ON public.finance_transactions(tenant_id, idempotency_key, request_hash)
  WHERE request_hash IS NOT NULL;

-- =========================================================================
-- 2. Add event_id to finance_outbox_events (for deduplication by event identity)
-- =========================================================================
ALTER TABLE public.finance_outbox_events
  ADD COLUMN IF NOT EXISTS event_id UUID;

-- Index for fast event_id lookups
CREATE INDEX IF NOT EXISTS idx_finance_outbox_event_id
  ON public.finance_outbox_events(tenant_id, event_id)
  WHERE event_id IS NOT NULL;
