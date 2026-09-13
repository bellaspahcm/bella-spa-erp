-- Migration: Add "held" to re_product_status enum
-- Date: 2026-09-11
-- Purpose: Fix P5.5 defect - align DB enum with domain model

-- Add 'held' as valid status (equivalent to 'booked' semantically)
ALTER TYPE re_product_status ADD VALUE IF NOT EXISTS 'held' AFTER 'booked';

-- Comment explaining the dual values
COMMENT ON TYPE re_product_status IS 'Product status enum. "held" and "booked" are semantically equivalent - both represent reserved state. Domain model uses "held" as canonical term.';
