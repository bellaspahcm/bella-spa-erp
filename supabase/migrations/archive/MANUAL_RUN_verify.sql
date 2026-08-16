-- ============================================================================
-- Verification Queries - Run after migration
-- ============================================================================

-- 1. Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'feature_flags';

-- 2. Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feature_flags'
ORDER BY ordinal_position;

-- 3. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'feature_flags';

-- 4. Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'feature_flags';

-- 5. Check feature flag record
SELECT key, name, enabled, rollout_strategy, rollout_config
FROM feature_flags
WHERE key = 'healthcare.new-engine-architecture';
