-- E6 R4: Receipt Unique Constraint
-- Experiment: E6 Repeatability Validation
-- Created: 2026-08-22
-- Purpose: Prevent duplicate receipts (tenant + PO + vendor + date)

-- ============================================================================
-- R4: UNIQUE CONSTRAINT
-- ============================================================================

-- AC4.1: Uniqueness Check
-- Ensure no duplicate receipts for same PO number + vendor + received_date within tenant
-- Respects soft delete pattern (WHERE deleted_at IS NULL)

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_unique
ON logistics_warehouse_receipts (tenant_id, po_number, vendor_id, received_date)
WHERE deleted_at IS NULL;

-- Comment
COMMENT ON INDEX idx_receipts_unique IS 'E6 R4: Prevent duplicate receipts (tenant + PO + vendor + date)';
