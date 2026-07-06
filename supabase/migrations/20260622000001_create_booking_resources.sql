-- Migration: Create booking_resources table for Beauty Spa resource management
-- Created: 2026-06-22
-- Purpose: Allow spa to manage beds, rooms, and equipment for booking assignments

-- Create booking_resources table
CREATE TABLE IF NOT EXISTS booking_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    name TEXT NOT NULL,
    resource_type TEXT CHECK (resource_type IN ('bed', 'room', 'equipment', 'other')) DEFAULT 'bed',
    status TEXT CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')) DEFAULT 'available',
    location_note TEXT,
    capacity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_booking_resources_tenant_id ON booking_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_resources_status ON booking_resources(status);
CREATE INDEX IF NOT EXISTS idx_booking_resources_type ON booking_resources(resource_type);

-- Enable RLS
ALTER TABLE booking_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view booking resources in their tenant"
    ON booking_resources FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_tenant_access WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can manage booking resources in their tenant"
    ON booking_resources FOR ALL
    USING (
        tenant_id IN (
            SELECT uta.tenant_id 
            FROM user_tenant_access uta
            JOIN users u ON u.id = uta.user_id
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'owner')
        )
    );

-- Add trigger to update updated_at
CREATE TRIGGER update_booking_resources_updated_at
    BEFORE UPDATE ON booking_resources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed data for Test Beauty Spa (11111111-1111-1111-1111-111111111111)
INSERT INTO booking_resources (tenant_id, name, resource_type, status, location_note)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Giường 1', 'bed', 'available', 'Phòng VIP 1'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 2', 'bed', 'available', 'Phòng VIP 1'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 3', 'bed', 'available', 'Phòng VIP 2'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 4', 'bed', 'available', 'Phòng VIP 2'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 5', 'bed', 'available', 'Phòng Thường'),
    ('11111111-1111-1111-1111-111111111111', 'Giường 6', 'bed', 'available', 'Phòng Thường'),
    ('11111111-1111-1111-1111-111111111111', 'Phòng Massage 1', 'room', 'available', 'Tầng 2'),
    ('11111111-1111-1111-1111-111111111111', 'Phòng Massage 2', 'room', 'available', 'Tầng 2'),
    ('11111111-1111-1111-1111-111111111111', 'Máy Triệt Lông 1', 'equipment', 'available', 'Phòng Laser'),
    ('11111111-1111-1111-1111-111111111111', 'Máy Triệt Lông 2', 'equipment', 'available', 'Phòng Laser')
ON CONFLICT (tenant_id, name) DO NOTHING;

COMMENT ON TABLE booking_resources IS 'Manages spa resources (beds, rooms, equipment) for booking assignments';
COMMENT ON COLUMN booking_resources.resource_type IS 'Type of resource: bed (giường), room (phòng), equipment (máy), other';
COMMENT ON COLUMN booking_resources.status IS 'Resource status: available (sẵn sàng), in_use (đang dùng), maintenance (bảo trì), retired (ngưng dùng)';
COMMENT ON COLUMN booking_resources.location_note IS 'Physical location note (e.g., room number, floor)';
COMMENT ON COLUMN booking_resources.capacity IS 'How many sessions this resource can handle simultaneously (default: 1)';
