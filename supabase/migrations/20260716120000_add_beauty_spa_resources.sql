/**
 * Migration: Add Beauty Spa Resource Fields
 * 
 * **Purpose**: Support resource conflict detection for Beauty Spa
 * - Beds (giường)
 * - Rooms (phòng)
 * - Equipment (thiết bị)
 * 
 * **Business Logic:**
 * - Each booking can reserve specific resources
 * - Conflict detection checks resource availability
 * - Same time + same resource = conflict
 * 
 * **Feature**: Beauty Spa resource management
 * **Module**: beauty_spa
 */

-- =====================================================
-- STEP 1: Add resource columns to bookings table
-- =====================================================

-- Add bed assignment (giường)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS assigned_bed_id UUID REFERENCES beds(id);

-- Add room assignment (phòng)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS assigned_room_id UUID REFERENCES rooms(id);

-- Add equipment requirements (thiết bị - array of UUIDs)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS required_equipment_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Add comments
COMMENT ON COLUMN bookings.assigned_bed_id IS 'Beauty Spa: Giường được phân cho booking này';
COMMENT ON COLUMN bookings.assigned_room_id IS 'Beauty Spa: Phòng được phân cho booking này';
COMMENT ON COLUMN bookings.required_equipment_ids IS 'Beauty Spa: Danh sách thiết bị cần thiết (array of equipment IDs)';

-- =====================================================
-- STEP 2: Create index for faster conflict checks
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bookings_assigned_bed 
ON bookings(assigned_bed_id, start_date, preferred_time) 
WHERE assigned_bed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_assigned_room 
ON bookings(assigned_room_id, start_date, preferred_time) 
WHERE assigned_room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_equipment 
ON bookings USING GIN(required_equipment_ids) 
WHERE required_equipment_ids IS NOT NULL AND array_length(required_equipment_ids, 1) > 0;

-- =====================================================
-- STEP 3: Create beds table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bed_number VARCHAR(50) NOT NULL,
  bed_name VARCHAR(255),
  room_id UUID REFERENCES rooms(id),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_beds_tenant ON beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);

-- Unique constraint: bed_number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_beds_number_tenant 
ON beds(tenant_id, bed_number);

COMMENT ON TABLE beds IS 'Beauty Spa: Danh sách giường phục vụ';
COMMENT ON COLUMN beds.bed_number IS 'Mã số giường (e.g., "G01", "G02")';
COMMENT ON COLUMN beds.status IS 'active = sẵn sàng, maintenance = bảo trì, inactive = không dùng';

-- =====================================================
-- STEP 4: Create rooms table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_number VARCHAR(50) NOT NULL,
  room_name VARCHAR(255),
  capacity INT DEFAULT 1 CHECK (capacity > 0),
  room_type VARCHAR(50), -- 'single', 'double', 'vip', 'group'
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);

-- Unique constraint: room_number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_number_tenant 
ON rooms(tenant_id, room_number);

COMMENT ON TABLE rooms IS 'Beauty Spa: Danh sách phòng phục vụ';
COMMENT ON COLUMN rooms.room_number IS 'Mã số phòng (e.g., "P01", "VIP01")';
COMMENT ON COLUMN rooms.capacity IS 'Số lượng người tối đa trong phòng';
COMMENT ON COLUMN rooms.room_type IS 'Loại phòng: single, double, vip, group';

-- =====================================================
-- STEP 5: Create equipment table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipment_code VARCHAR(50) NOT NULL,
  equipment_name VARCHAR(255) NOT NULL,
  equipment_type VARCHAR(100), -- 'machine', 'tool', 'consumable'
  quantity INT DEFAULT 1 CHECK (quantity >= 0),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_equipment_tenant ON equipment(tenant_id);

-- Unique constraint: equipment_code per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_code_tenant 
ON equipment(tenant_id, equipment_code);

COMMENT ON TABLE equipment IS 'Beauty Spa: Danh sách thiết bị phục vụ';
COMMENT ON COLUMN equipment.equipment_code IS 'Mã thiết bị (e.g., "TB01", "MAY-LASER-01")';
COMMENT ON COLUMN equipment.quantity IS 'Số lượng thiết bị available';
COMMENT ON COLUMN equipment.equipment_type IS 'Loại thiết bị: machine, tool, consumable';

-- =====================================================
-- STEP 6: Verification
-- =====================================================

DO $$
BEGIN
  -- Check columns added
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name IN ('assigned_bed_id', 'assigned_room_id', 'required_equipment_ids')
  ) THEN
    RAISE NOTICE '✅ Resource columns added to bookings table';
  ELSE
    RAISE EXCEPTION '❌ Failed to add resource columns';
  END IF;
  
  -- Check tables created
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name IN ('beds', 'rooms', 'equipment')
  ) THEN
    RAISE NOTICE '✅ Resource tables created';
  ELSE
    RAISE EXCEPTION '❌ Failed to create resource tables';
  END IF;
END $$;

-- =====================================================
-- STEP 7: Sample data (optional, for testing)
-- =====================================================

-- Insert sample beds (commented out - run manually if needed)
/*
INSERT INTO beds (tenant_id, bed_number, bed_name, status)
SELECT 
  id as tenant_id,
  'G' || lpad(n::text, 2, '0') as bed_number,
  'Giường ' || n as bed_name,
  'active' as status
FROM tenants, generate_series(1, 10) n
WHERE enabled_modules @> ARRAY['beauty_spa']::text[]
ON CONFLICT DO NOTHING;
*/

-- Insert sample rooms (commented out - run manually if needed)
/*
INSERT INTO rooms (tenant_id, room_number, room_name, capacity, room_type, status)
SELECT 
  id as tenant_id,
  'P' || lpad(n::text, 2, '0') as room_number,
  'Phòng ' || n as room_name,
  2 as capacity,
  CASE WHEN n <= 2 THEN 'vip' ELSE 'double' END as room_type,
  'active' as status
FROM tenants, generate_series(1, 5) n
WHERE enabled_modules @> ARRAY['beauty_spa']::text[]
ON CONFLICT DO NOTHING;
*/

-- Insert sample equipment (commented out - run manually if needed)
/*
INSERT INTO equipment (tenant_id, equipment_code, equipment_name, equipment_type, quantity, status)
SELECT 
  t.id as tenant_id,
  e.code as equipment_code,
  e.name as equipment_name,
  e.type as equipment_type,
  e.qty as quantity,
  'active' as status
FROM tenants t,
  (VALUES 
    ('TB01', 'Máy Laser', 'machine', 2),
    ('TB02', 'Máy Triệt Lông', 'machine', 1),
    ('TB03', 'Máy RF', 'machine', 3),
    ('TB04', 'Dụng Cụ Spa', 'tool', 10)
  ) as e(code, name, type, qty)
WHERE t.enabled_modules @> ARRAY['beauty_spa']::text[]
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- ROLLBACK PLAN (if needed)
-- =====================================================

-- To remove resource columns (EMERGENCY ONLY):
/*
ALTER TABLE bookings DROP COLUMN IF EXISTS assigned_bed_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS assigned_room_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS required_equipment_ids;

DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
*/
