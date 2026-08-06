-- Set all healthcare tenants to medical type by default
-- Migration: 20260806_set_healthcare_tenants_to_medical

-- Update all tenants with bella_healthcare module to medical type
UPDATE tenants
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"healthcareType": "medical"}'::jsonb
WHERE enabled_modules::text LIKE '%bella_healthcare%'
  AND (metadata IS NULL OR metadata->>'healthcareType' IS NULL);

-- Verify the update
SELECT 
  id, 
  name, 
  metadata->>'healthcareType' as healthcare_type
FROM tenants
WHERE enabled_modules::text LIKE '%bella_healthcare%';
