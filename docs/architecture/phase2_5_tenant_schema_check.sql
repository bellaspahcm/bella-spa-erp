SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'tenants'
    AND column_name IN ('id', 'name', 'status')
ORDER BY ordinal_position;

-- Check how many tenants have NULL names
SELECT 
    COUNT(*) as total_tenants,
    COUNT(name) as tenants_with_name,
    COUNT(*) - COUNT(name) as tenants_with_null_name
FROM tenants;
