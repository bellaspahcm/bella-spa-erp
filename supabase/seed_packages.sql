-- Seed data for testing Waitlist feature
-- Run this in Supabase SQL Editor

-- Get tenant_id (replace with your actual tenant_id)
-- You can find it by running: SELECT id, name FROM tenants LIMIT 1;

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get first tenant (adjust if you have multiple tenants)
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Please create a tenant first.';
  END IF;
  
  RAISE NOTICE 'Using tenant_id: %', v_tenant_id;
  
  -- Insert test packages (check if already exist)
  INSERT INTO packages (tenant_id, name, price, duration_minutes, description, status)
  VALUES
    (v_tenant_id, 'Massage Thư Giãn 60 phút', 300000, 60, 'Massage body thư giãn, giảm stress', 'active'),
    (v_tenant_id, 'Massage Toàn Thân 90 phút', 450000, 90, 'Massage toàn thân, massage chân, massage đầu', 'active'),
    (v_tenant_id, 'Chăm Sóc Da Mặt Cơ Bản', 350000, 60, 'Làm sạch, tẩy tế bào chết, đắp mặt nạ', 'active'),
    (v_tenant_id, 'Gội Đầu Dưỡng Sinh', 150000, 30, 'Gội đầu thảo dược, massage đầu cổ vai', 'active'),
    (v_tenant_id, 'Combo Mẹ & Bé Tiết Kiệm', 800000, 120, 'Massage cho mẹ + chăm sóc bé', 'active')
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE 'Total packages: %', (SELECT COUNT(*) FROM packages WHERE tenant_id = v_tenant_id);
END $$;
