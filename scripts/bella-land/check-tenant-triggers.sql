-- Check for triggers that auto-inject tenant_id on real_estate_projects

SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'real_estate_projects'
ORDER BY trigger_name;
