-- Simplified script: Create booking_resources table (no complex constraints)
-- Run this in Supabase Studio SQL Editor

-- Drop existing table if needed (CAREFUL - this deletes data!)
-- DROP TABLE IF EXISTS booking_resources CASCADE;

-- Create table with simple structure
CREATE TABLE IF NOT EXISTS booking_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    resource_type TEXT DEFAULT 'bed',
    status TEXT DEFAULT 'available',
    location_note TEXT,
    capacity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_resources_tenant_id ON booking_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_resources_status ON booking_resources(status);

-- Enable RLS
ALTER TABLE booking_resources ENABLE ROW LEVEL SECURITY;

-- Simple RLS: allow all authenticated users to read
DROP POLICY IF EXISTS "Allow authenticated read" ON booking_resources;
CREATE POLICY "Allow authenticated read"
    ON booking_resources FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert/update/delete (we'll add admin check later)
DROP POLICY IF EXISTS "Allow authenticated write" ON booking_resources;
CREATE POLICY "Allow authenticated write"
    ON booking_resources FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Seed data for Test Beauty Spa (UUID: 11111111-1111-1111-1111-111111111111)
DELETE FROM booking_resources WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO booking_resources (tenant_id, name, resource_type, status, location_note)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Giường 1', 'bed', 'available', 'Phòng VIP 1'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 2', 'bed', 'available', 'Phòng VIP 1'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 3', 'bed', 'available', 'Phòng VIP 2'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 4', 'bed', 'available', 'Phòng VIP 2'),
    ('11111111-1111-1111-1111-1111-11111111', 'Giường 5', 'bed', 'available', 'Phòng Thường'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 6', 'bed', 'available', 'Phòng Thường'),
    ('11111111-1111-1111-1111-111111111111', 'Phòng Massage 1', 'room', 'available', 'Tầng 2'),
    ('11111111-1111-1111-1111-111111111111', 'Phòng Massage 2', 'room', 'available', 'Tầng 2'),
    ('11111111-1111-1111-1111-111111111111', 'Máy Triệt Lông 1', 'equipment', 'available', 'Phòng Laser'),
    ('11111111-1111-1111-1111-111111111111', 'Máy Triệt Lông 2', 'equipment', 'available', 'Phòng Laser');

-- Verify
SELECT 
    'SUCCESS: ' || COUNT(*)::TEXT || ' resources created' AS result
FROM booking_resources;

-- Show data
SELECT * FROM booking_resources ORDER BY resource_type, name;
