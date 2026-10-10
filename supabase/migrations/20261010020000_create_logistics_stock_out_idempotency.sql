-- Logistics stock-out idempotency persistence for production consumption.
--
-- Scope:
-- - Additive Logistics-owned table only.
-- - Binds idempotency to tenant, operation and canonical payload hash.
-- - Supports atomic claim/stock movement/complete inside the Logistics stock-out transaction.
-- - Does not create Manufacturing-owned stock mutation or Finance posting.

DO $$
BEGIN
  IF to_regnamespace('logistics') IS NULL THEN
    RAISE NOTICE 'Skipping Logistics stock-out idempotency: schema logistics is not deployed in this database.';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS logistics.stock_out_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_logistics_stock_out_idempotency
      UNIQUE (tenant_id, operation, idempotency_key),
    CONSTRAINT ck_logistics_stock_out_idempotency_completed_result
      CHECK (status <> 'completed' OR result IS NOT NULL)
  );

  -- zero-downtime: allow blocking-index - new Logistics stock-out idempotency table has no existing production rows.
  CREATE INDEX IF NOT EXISTS idx_logistics_stock_out_idempotency_tenant_status
    ON logistics.stock_out_idempotency(tenant_id, status);

  ALTER TABLE logistics.stock_out_idempotency ENABLE ROW LEVEL SECURITY;

  GRANT SELECT, INSERT, UPDATE
    ON logistics.stock_out_idempotency
    TO authenticated;

  DROP POLICY IF EXISTS stock_out_idempotency_tenant_isolation
    ON logistics.stock_out_idempotency;
  CREATE POLICY stock_out_idempotency_tenant_isolation
    ON logistics.stock_out_idempotency
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

  COMMENT ON TABLE logistics.stock_out_idempotency IS
    'Logistics stock-out idempotency state for tenant-scoped production consumption retries.';
  COMMENT ON CONSTRAINT uq_logistics_stock_out_idempotency
    ON logistics.stock_out_idempotency IS
    'Prevents duplicate stock-out execution for the same tenant, operation and idempotency key.';
END $$;
