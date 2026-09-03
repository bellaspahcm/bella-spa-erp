-- =============================================================================
-- Record Migration History for 16 Class B Migrations
-- Created: 2026-08-24
-- 
-- APPROVED by Human Architect after full verification
-- 
-- Evidence:
-- - 16/16 migrations = Class B (DDL applied, history missing)
-- - 11 Runtime/Approval: verified via pg_catalog (HIGH confidence)
-- - 5 Logistics: verified via table existence (HIGH confidence)
-- - 0 Class A (no missing DDL)
-- 
-- Action: INSERT into supabase_migrations.schema_migrations
-- NO DDL execution - history reconciliation only
-- =============================================================================

BEGIN;

-- Insert 16 Class B migration histories
-- statements array = generic DDL type markers only (NOT actual object names)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  -- Runtime/Approval Migrations (11)
  ('20260819040000', 'runtime_migration_e1_gate_schema_safe', ARRAY['CREATE OR REPLACE FUNCTION']::text[]),
  ('20260819050000', 'runtime_migration_05a_classification_reservation', ARRAY['CREATE OR REPLACE FUNCTION', 'CREATE TABLE', 'CREATE SCHEMA']::text[]),
  ('20260819050001', 'runtime_migration_05_e2_orphan_safety_gate', ARRAY['CREATE OR REPLACE FUNCTION']::text[]),
  ('20260819050002', 'runtime_migration_05b_canonical_tenant_creation', ARRAY['CREATE OR REPLACE FUNCTION']::text[]),
  ('20260819050003', 'runtime_migration_05c_text_to_uuid_type_migration', ARRAY['CREATE OR REPLACE FUNCTION', 'ALTER TABLE']::text[]),
  ('20260819050004', 'runtime_migration_e3_post_05c_verification', ARRAY['CREATE OR REPLACE FUNCTION']::text[]),
  ('20260820110000', 'database_role_separation_v2', ARRAY['CREATE TABLE', 'CREATE ROLE']::text[]),
  ('20260820140000', 'enable_rls_block_service_key', ARRAY['ALTER TABLE', 'CREATE POLICY']::text[]),
  ('20260820151000_r4_3_gate_tokens', 'r4_3_gate_tokens', ARRAY['CREATE OR REPLACE FUNCTION', 'CREATE TABLE', 'ALTER TABLE']::text[]),
  ('20260820152000_r4_4_monitoring_audit', 'r4_4_monitoring_audit', ARRAY['CREATE OR REPLACE FUNCTION', 'CREATE TABLE']::text[]),
  ('20260820150000_r4_approval_contract', 'r4_approval_contract', ARRAY['CREATE TABLE']::text[]),
  
  -- Logistics Migrations (5)
  ('20260821115404', 'logistics_schema', ARRAY['CREATE TABLE']::text[]),
  ('20260821122000_create_accessorial_rates_table', 'create_accessorial_rates_table', ARRAY['CREATE TABLE']::text[]),
  ('20260821121000_create_carrier_rates_table', 'create_carrier_rates_table', ARRAY['CREATE TABLE']::text[]),
  ('20260821123000_create_discrepancies_table', 'create_discrepancies_table', ARRAY['CREATE TABLE']::text[]),
  ('20260821120000_create_freight_audit_tables', 'create_freight_audit_tables', ARRAY['CREATE TABLE']::text[])
ON CONFLICT (version) DO NOTHING;

-- Verify insertion
SELECT 
  version, 
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260819040000',
  '20260819050000',
  '20260819050001',
  '20260819050002',
  '20260819050003',
  '20260819050004',
  '20260820110000',
  '20260820140000',
  '20260820151000_r4_3_gate_tokens',
  '20260820152000_r4_4_monitoring_audit',
  '20260820150000_r4_approval_contract',
  '20260821115404',
  '20260821122000_create_accessorial_rates_table',
  '20260821121000_create_carrier_rates_table',
  '20260821123000_create_discrepancies_table',
  '20260821120000_create_freight_audit_tables'
)
ORDER BY version;

COMMIT;

-- Expected output: 16 rows
-- If less than 16, some were already recorded (ON CONFLICT DO NOTHING)
-- If 16, all successfully recorded

-- Next steps:
-- 1. npx supabase db push
--    Expected: Only 20260824000000_finance_test_cleanup_rpc.sql
-- 2. npx tsx scripts/verify_cleanup_rpc.ts
--    Expected: 4/4 tests PASS
-- 3. STOP - await Human Architect approval
-- 4. npx tsx scripts/phase4_4_execute_cleanup.ts
--    Expected: 274 deleted, 401 remaining, 0 orphans
