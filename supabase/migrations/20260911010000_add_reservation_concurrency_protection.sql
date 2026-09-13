-- Migration: Add Concurrency Protection for Reservations
-- Date: 2026-09-11
-- Purpose: Prevent double-booking (two active reservations for same apartment)
--
-- Business Rule:
--   ONE APARTMENT → AT MOST ONE ACTIVE RESERVATION
--
-- Active states: pending_deposit, deposited
-- Inactive states: converted_to_contract, cancelled
--
-- This partial unique index prevents race conditions where:
-- - Sales A reserves Apartment X (status: pending_deposit)
-- - Sales B reserves Apartment X (status: pending_deposit) ← BLOCKED
--
-- Evidence: scripts/bella-land/test-reservation-concurrency.ts
-- Status: RUNTIME VERIFIED (2026-09-11)

-- Create partial unique index to enforce "one active reservation per apartment"
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_reservation_per_apartment 
ON re_reservations (product_id, tenant_id) 
WHERE status IN ('pending_deposit', 'deposited');

-- Rationale:
-- - Covers tenant_id: multi-tenant isolation (same apartment ID in different tenants OK)
-- - Covers product_id: the apartment being reserved
-- - WHERE clause: only "active" reservations hold inventory
-- - cancelled/converted_to_contract do NOT block new reservations

-- Example blocked scenario:
-- INSERT INTO re_reservations (product_id, tenant_id, status) VALUES ('apt-1', 'tenant-a', 'pending_deposit');
-- INSERT INTO re_reservations (product_id, tenant_id, status) VALUES ('apt-1', 'tenant-a', 'pending_deposit');
-- ↑ Second insert FAILS: duplicate key value violates unique constraint

-- Example allowed scenario:
-- UPDATE re_reservations SET status = 'converted_to_contract' WHERE id = 'reservation-1';
-- INSERT INTO re_reservations (product_id, tenant_id, status) VALUES ('apt-1', 'tenant-a', 'pending_deposit');
-- ↑ Allowed: previous reservation no longer "active" (not in partial index)
