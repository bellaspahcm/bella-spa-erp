-- Seed initial tenant
INSERT INTO tenants (name, status) VALUES ('Bella Spa Headquarter', 'active');

-- Seed initial admin (Note: In real app, this should be linked to Supabase Auth)
INSERT INTO users (email, full_name, role, status, tenant_id)
SELECT 'admin@bellaspa.com.vn', 'System Admin', 'admin', 'active', id
FROM tenants WHERE name = 'Bella Spa Headquarter'
LIMIT 1;

-- Seed mock customers and bookings
DO $$ 
DECLARE
    tid UUID;
BEGIN
    SELECT id INTO tid FROM tenants WHERE name = 'Bella Spa Headquarter' LIMIT 1;
    
    -- Insert Customers
    INSERT INTO customers (id, phone, name_mother, name_baby, address, status, dob_baby, dob_expected, tenant_id)
    VALUES 
        ('00000000-0000-0000-0000-000000000001', '0901234567', 'Nguyễn Thu Thủy', 'Gia Bảo', 'Quận 7, TP.HCM', 'active', '2024-03-15', NULL, tid),
        ('00000000-0000-0000-0000-000000000002', '0987654321', 'Trần Thị Mai', 'Minh Anh', 'Quận 2, TP.HCM', 'active', '2024-01-20', NULL, tid),
        ('00000000-0000-0000-0000-000000000003', '0912334455', 'Lê Diệu Linh', 'Chờ sinh', 'Quận 1, TP.HCM', 'active', NULL, '2024-06-10', tid),
        ('00000000-0000-0000-0000-000000000004', '0933445566', 'Phạm Hải Yến', 'Chưa có', 'Quận Bình Thạnh, TP.HCM', 'active', NULL, '2024-08-15', tid)
    ON CONFLICT (phone) DO NOTHING;

    -- Insert Bookings
    INSERT INTO bookings (booking_number, customer_id, status, deposit_amount, full_price, start_date, total_sessions, completed_sessions, tenant_id)
    VALUES 
        ('BK-001', '00000000-0000-0000-0000-000000000001', 'in_progress', 2000000, 15500000, '2024-04-01', 15, 8, tid),
        ('BK-002', '00000000-0000-0000-0000-000000000002', 'in_progress', 3000000, 18200000, '2024-03-10', 20, 12, tid),
        ('BK-003', '00000000-0000-0000-0000-000000000003', 'booked', 2000000, 15500000, '2024-06-15', 15, 0, tid)
    ON CONFLICT (booking_number) DO NOTHING;
END $$;
