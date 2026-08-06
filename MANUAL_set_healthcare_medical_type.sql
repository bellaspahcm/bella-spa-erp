-- Manual script: Set healthcare tenants to medical type
-- Run this in Supabase Studio SQL Editor

-- Update all tenants with bella_healthcare module to medical type
UPDATE tenants
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"healthcareType": "medical"}'::jsonb
WHERE enabled_modules::text LIKE '%bella_healthcare%'
  AND (metadata IS NULL OR metadata->>'healthcareType' IS NULL);

-- Verify the update
SELECT 
  id, 
  name, 
  metadata->>'healthcareType' as healthcare_type,
  enabled_modules
FROM tenants
WHERE enabled_modules::text LIKE '%bella_healthcare%';
