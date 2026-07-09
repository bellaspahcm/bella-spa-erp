-- ============================================================
-- Workflow Engine Tables Verification Script
-- ============================================================
-- Purpose: Verify that workflow_executions and workflow_step_executions
--          tables are created correctly with proper indexes, RLS, and permissions
-- Usage: Run this in Supabase SQL Editor after migration
-- ============================================================

-- ============================================================
-- 1. Verify tables exist
-- ============================================================
SELECT 
  'workflow_executions' AS table_name,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'workflow_executions'
  ) AS exists
UNION ALL
SELECT 
  'workflow_step_executions' AS table_name,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'workflow_step_executions'
  ) AS exists;

-- ============================================================
-- 2. Verify columns
-- ============================================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('workflow_executions', 'workflow_step_executions')
ORDER BY table_name, ordinal_position;

-- ============================================================
-- 3. Verify indexes
-- ============================================================
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('workflow_executions', 'workflow_step_executions')
ORDER BY tablename, indexname;

-- ============================================================
-- 4. Verify RLS is enabled
-- ============================================================
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workflow_executions', 'workflow_step_executions');

-- ============================================================
-- 5. Verify RLS policies
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workflow_executions', 'workflow_step_executions')
ORDER BY tablename, policyname;

-- ============================================================
-- 6. Verify triggers
-- ============================================================
SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('workflow_executions', 'workflow_step_executions')
ORDER BY event_object_table, trigger_name;

-- ============================================================
-- 7. Verify helper functions
-- ============================================================
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_workflow_execution_detail', 'get_workflow_executions')
ORDER BY routine_name;

-- ============================================================
-- 8. Test data insertion (optional - comment out if not needed)
-- ============================================================

-- Test: Insert a sample workflow execution
/*
INSERT INTO workflow_executions (
  tenant_id,
  workflow_id,
  workflow_version,
  status,
  context
) VALUES (
  (SELECT id FROM tenants LIMIT 1), -- Use first tenant for testing
  'test-workflow',
  '1.0.0',
  'running',
  jsonb_build_object(
    'executionId', gen_random_uuid()::text,
    'tenantId', (SELECT id::text FROM tenants LIMIT 1),
    'correlationId', gen_random_uuid()::text,
    'data', '{}'::jsonb,
    'metadata', '{}'::jsonb,
    'currentStepIndex', 0,
    'stepResults', '[]'::jsonb
  )
)
RETURNING id, workflow_id, status, created_at;
*/

-- Test: Query workflow executions
/*
SELECT 
  id,
  workflow_id,
  workflow_version,
  status,
  started_at,
  created_at
FROM workflow_executions
ORDER BY created_at DESC
LIMIT 5;
*/

-- Test: Call helper RPC
/*
SELECT * FROM get_workflow_executions(
  p_tenant_id := (SELECT id FROM tenants LIMIT 1),
  p_workflow_id := NULL,
  p_status := NULL,
  p_limit := 10,
  p_offset := 0
);
*/

-- ============================================================
-- Expected Results:
-- ============================================================
-- 1. Both tables should exist (exists = true)
-- 2. workflow_executions should have 13 columns
-- 3. workflow_step_executions should have 13 columns
-- 4. 8 indexes should exist (7 regular + 1 GIN for JSONB)
-- 5. RLS should be enabled on both tables (rls_enabled = true)
-- 6. 4 policies should exist (2 tenant isolation + 2 service_role)
-- 7. 2 triggers should exist (updated_at triggers)
-- 8. 2 helper functions should exist
-- ============================================================

-- ============================================================
-- Cleanup test data (if needed)
-- ============================================================
/*
DELETE FROM workflow_executions WHERE workflow_id = 'test-workflow';
*/
