-- Add metadata column to tenants table for storing additional tenant information
-- This column stores JSON data like demo markers, version info, custom settings, etc.

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN tenants.metadata IS 'Additional tenant metadata (demo markers, version, custom settings, etc.)';

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_tenants_metadata_gin ON tenants USING gin (metadata);
