-- =====================================================
-- VERIFICATION QUERIES
-- Copy và chạy từng query để verify deployment
-- =====================================================

-- Query 1: Check tables exist (nên có 4 rows)
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations')
ORDER BY table_name;

-- Query 2: Check indexes (nên có 9 indexes)
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations')
ORDER BY tablename, indexname;

-- Query 3: Check RLS is enabled (nên có 4 rows với rowsecurity = true)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations');

-- Query 4: Check RPC functions (nên có 3 functions)
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_workflow_definitions', 'get_workflow_rules', 'get_rule_simulation_results');

-- Query 5: Check columns in workflow_definitions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workflow_definitions' 
ORDER BY ordinal_position;
