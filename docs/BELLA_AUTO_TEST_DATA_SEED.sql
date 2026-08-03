-- =====================================================================================
-- Bella Auto - Test Data Seed Script
-- Purpose: Generate realistic test data for user testing
-- Tenant: bella_auto_demo
-- =====================================================================================

-- Set tenant context
SET app.current_tenant_id = 'bella_auto_demo';

-- =====================================================================================
-- PHASE 1: VEHICLES (10 test vehicles)
-- =====================================================================================

INSERT INTO auto_vehicles (tenant_id, vin, make, model, variant, year, color, purchase_price, list_price, status, location) VALUES
('bella_auto_demo', '1HGCM82633A100001', 'Honda', 'Accord', 'EX-L', 2023, 'Pearl White', 800000000, 850000000, 'showroom', 'Showroom Hà Nội'),
('bella_auto_demo', '1HGCM82633A100002', 'Honda', 'CR-V', 'Touring', 2023, 'Obsidian Blue', 950000000, 1050000000, 'showroom', 'Showroom Hà Nội'),
('bella_auto_demo', '1HGCM82633A100003', 'Honda', 'Civic', 'Type R', 2023, 'Championship White', 1200000000, 1400000000, 'showroom', 'Showroom Hà Nội'),
('bella_auto_demo', '4T1BF1FK8HU100004', 'Toyota', 'Camry', 'XLE', 2023, 'Celestial Silver', 850000000, 950000000, 'warehouse', 'Kho Bắc Ninh'),
('bella_auto_demo', '4T1BF1FK8HU100005', 'Toyota', 'RAV4', 'Limited', 2023, 'Magnetic Gray', 920000000, 1020000000, 'warehouse', 'Kho Bắc Ninh'),
('bella_auto_demo', '4T1BF1FK8HU100006', 'Toyota', 'Vios', 'G', 2023, 'Super White', 520000000, 580000000, 'showroom', 'Showroom TP.HCM'),
('bella_auto_demo', 'WBAPH77519A100007', 'BMW', 'X5', 'xDrive40i', 2023, 'Alpine White', 2500000000, 2800000000, 'showroom', 'Showroom TP.HCM'),
('bella_auto_demo', 'WBAPH77519A100008', 'BMW', '3 Series', '330i', 2023, 'Jet Black', 1500000000, 1700000000, 'allocated', 'Reserved for Customer'),
('bella_auto_demo', 'WDDWF4HB8JA100009', 'Mercedes-Benz', 'C-Class', 'C300', 2023, 'Polar White', 1800000000, 2000000000, 'in_transit', 'En route'),
('bella_auto_demo', 'WDDWF4HB8JA100010', 'Mercedes-Benz', 'GLC', 'GLC 300', 2023, 'Obsidian Black', 2200000000, 2500000000, 'in_transit', 'En route');

-- =====================================================================================
-- PHASE 3: CUSTOMER JOURNEYS (5 test journeys at different stages)
-- =====================================================================================

-- Note: customer_id should reference existing customers table
-- Replace these UUIDs with actual customer IDs from your system

-- Journey 1: Early stage (awareness)
INSERT INTO auto_customer_journeys (tenant_id, customer_id, current_stage_code, lead_source, assigned_to, sla_status, is_active)
VALUES ('bella_auto_demo', gen_random_uuid(), 'awareness', 'facebook_ads', gen_random_uuid(), 'on_time', true);

-- Journey 2: Mid stage (test_drive)
INSERT INTO auto_customer_journeys (tenant_id, customer_id, current_stage_code, lead_source, assigned_to, sla_status, is_active)
VALUES ('bella_auto_demo', gen_random_uuid(), 'test_drive', 'google_ads', gen_random_uuid(), 'on_time', true);

-- Journey 3: Late stage (deposit)
INSERT INTO auto_customer_journeys (tenant_id, customer_id, current_stage_code, lead_source, assigned_to, sla_status, is_active)
VALUES ('bella_auto_demo', gen_random_uuid(), 'deposit', 'walk_in', gen_random_uuid(), 'at_risk', true);

-- Journey 4: Completed (vehicle_delivered)
INSERT INTO auto_customer_journeys (tenant_id, customer_id, current_stage_code, lead_source, assigned_to, sla_status, is_active, completed_at)
VALUES ('bella_auto_demo', gen_random_uuid(), 'vehicle_delivered', 'referral', gen_random_uuid(), 'on_time', false, NOW() - INTERVAL '7 days');

-- Journey 5: Service stage (regular_service)
INSERT INTO auto_customer_journeys (tenant_id, customer_id, current_stage_code, lead_source, assigned_to, sla_status, is_active)
VALUES ('bella_auto_demo', gen_random_uuid(), 'regular_service', 'existing_customer', gen_random_uuid(), 'on_time', true);

-- =====================================================================================
-- PHASE 4: LEADS (10 test leads)
-- =====================================================================================

INSERT INTO auto_leads (tenant_id, customer_id, source, status, interested_make, interested_model, budget_min, budget_max, priority, lead_score)
VALUES
('bella_auto_demo', gen_random_uuid(), 'facebook_ads', 'new', 'Honda', 'Accord', 700000000, 900000000, 'high', 85),
('bella_auto_demo', gen_random_uuid(), 'google_ads', 'contacted', 'Toyota', 'Camry', 800000000, 1000000000, 'high', 78),
('bella_auto_demo', gen_random_uuid(), 'tiktok_ads', 'new', 'BMW', 'X5', 2000000000, 3000000000, 'medium', 65),
('bella_auto_demo', gen_random_uuid(), 'walk_in', 'qualified', 'Honda', 'CR-V', 900000000, 1100000000, 'high', 90),
('bella_auto_demo', gen_random_uuid(), 'referral', 'new', 'Mercedes-Benz', 'C-Class', 1500000000, 2000000000, 'low', 55),
('bella_auto_demo', gen_random_uuid(), 'facebook_ads', 'contacted', 'Toyota', 'Vios', 500000000, 650000000, 'medium', 70),
('bella_auto_demo', gen_random_uuid(), 'google_ads', 'new', 'Honda', 'Civic', 1000000000, 1500000000, 'high', 82),
('bella_auto_demo', gen_random_uuid', 'website', 'lost', 'BMW', '3 Series', 1400000000, 1800000000, 'low', 45),
('bella_auto_demo', gen_random_uuid(), 'phone_inquiry', 'qualified', 'Toyota', 'RAV4', 850000000, 1100000000, 'high', 88),
('bella_auto_demo', gen_random_uuid(), 'tiktok_ads', 'new', 'Mercedes-Benz', 'GLC', 2000000000, 2600000000, 'medium', 72);

-- =====================================================================================
-- Test Data Summary
-- =====================================================================================

SELECT 'Test Data Seed Complete!' AS status;

SELECT 
  'Vehicles' AS entity,
  COUNT(*) AS count 
FROM auto_vehicles 
WHERE tenant_id = 'bella_auto_demo';

SELECT 
  'Journeys' AS entity,
  COUNT(*) AS count 
FROM auto_customer_journeys 
WHERE tenant_id = 'bella_auto_demo';

SELECT 
  'Leads' AS entity,
  COUNT(*) AS count 
FROM auto_leads 
WHERE tenant_id = 'bella_auto_demo';

-- =====================================================================================
-- Cleanup Script (Run this to remove all test data)
-- =====================================================================================

/*
DELETE FROM auto_vehicles WHERE tenant_id = 'bella_auto_demo' AND vin LIKE '%100%';
DELETE FROM auto_customer_journeys WHERE tenant_id = 'bella_auto_demo';
DELETE FROM auto_leads WHERE tenant_id = 'bella_auto_demo';
*/
