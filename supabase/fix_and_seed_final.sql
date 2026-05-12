-- 1. FIX PERMISSIONS (Run this in Supabase SQL Editor first)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE revenue DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_records DISABLE ROW LEVEL SECURITY;

-- 2. POPULATE MISSING DATA (Expenses, Salaries, Session Logs)
DO $$ 
DECLARE
    tid UUID;
    ktv_ids UUID[] := '{}';
    booking_ids UUID[] := '{}';
    i INTEGER;
BEGIN
    SELECT id INTO tid FROM tenants WHERE name = 'Bella Spa Headquarter' LIMIT 1;
    
    -- Get KTV IDs
    SELECT array_agg(id) INTO ktv_ids FROM users WHERE role = 'ktv';
    
    -- Get Booking IDs
    SELECT array_agg(id) INTO booking_ids FROM bookings WHERE tenant_id = tid;

    -- Expenses
    INSERT INTO expenses (category, amount, description, expense_date, status, tenant_id)
    VALUES 
        ('Marketing', 5000000, 'Chạy quảng cáo Facebook tháng 4/2026', '2026-04-15', 'approved', tid),
        ('Supplies', 2500000, 'Mua tinh dầu và thảo dược xông hơ', '2026-05-02', 'approved', tid),
        ('Rent', 15000000, 'Thuê mặt bằng văn phòng', '2026-05-01', 'approved', tid),
        ('Utilities', 1200000, 'Tiền điện nước tháng 4', '2026-05-05', 'approved', tid)
    ON CONFLICT DO NOTHING;

    -- Salary Records for May 2026
    FOR i IN 1..cardinality(ktv_ids) LOOP
        INSERT INTO salary_records (ktv_id, month_year, base_salary, service_percentage_bonus, kpi_bonus, total_salary, status, tenant_id)
        VALUES (ktv_ids[i], '2026-05-01', 6000000, 3000000 + (i * 500000), 1000000, 10000000 + (i * 500000), 'pending_approval', tid)
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Session Logs (historical)
    FOR i IN 1..cardinality(booking_ids) LOOP
        IF i <= 15 THEN
            INSERT INTO session_logs (booking_id, session_number, assigned_date, status, completed_by_ktv_id, tenant_id)
            VALUES (booking_ids[i], 1, '2026-05-10', 'completed', ktv_ids[(i % cardinality(ktv_ids)) + 1], tid)
            ON CONFLICT DO NOTHING;
            
            INSERT INTO session_logs (booking_id, session_number, assigned_date, status, completed_by_ktv_id, tenant_id)
            VALUES (booking_ids[i], 2, '2026-05-12', 'scheduled', ktv_ids[(i % cardinality(ktv_ids)) + 1], tid)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- KPI Records
    FOR i IN 1..cardinality(ktv_ids) LOOP
        INSERT INTO kpi_records (ktv_id, month_year, sessions_completed, on_time_rate, customer_satisfaction, target_sessions, kpi_achievement_rate, tenant_id)
        VALUES (ktv_ids[i], '2026-05-01', 45 + i, 95.5, 4.8, 50, 92.0, tid)
        ON CONFLICT DO NOTHING;
    END LOOP;

END $$;
