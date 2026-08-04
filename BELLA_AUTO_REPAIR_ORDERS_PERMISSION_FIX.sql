-- ============================================================================
-- HOTFIX: Grant permission for auto_repair_orders table
-- Error: "permission denied for table auto_repair_orders"
-- Run this immediately in Supabase SQL Editor
-- ============================================================================

-- Grant permissions if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_repair_orders') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_repair_orders TO authenticated;
    RAISE NOTICE 'Granted permissions on auto_repair_orders to authenticated role';
  ELSE
    RAISE NOTICE 'Table auto_repair_orders does not exist - skipping';
  END IF;
END $$;

-- Also grant related tables if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_repair_order_items') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_repair_order_items TO authenticated;
    RAISE NOTICE 'Granted permissions on auto_repair_order_items';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_repair_order_history') THEN
    GRANT SELECT ON public.auto_repair_order_history TO authenticated;
    RAISE NOTICE 'Granted SELECT on auto_repair_order_history';
  END IF;
END $$;

-- Verify permissions
SELECT 
  tablename,
  has_table_privilege('authenticated', 'public.' || tablename, 'SELECT') AS can_select,
  has_table_privilege('authenticated', 'public.' || tablename, 'INSERT') AS can_insert,
  has_table_privilege('authenticated', 'public.' || tablename, 'UPDATE') AS can_update,
  has_table_privilege('authenticated', 'public.' || tablename, 'DELETE') AS can_delete
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'auto_repair%'
ORDER BY tablename;
