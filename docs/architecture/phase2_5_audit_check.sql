-- Check if audit schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'audit';

-- Check for any NULL-named migrations (potential test/cleanup operations)
SELECT version, name, COALESCE(LENGTH(name::text), 0) as name_length
FROM supabase_migrations.schema_migrations
WHERE version >= '20260815000000' 
    AND version <= '20260824999999'
ORDER BY version;
