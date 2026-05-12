-- Seed Demo Data for Bella Spa ERP - Year 2026
-- This file is the primary source of truth for the demo environment.

DO $$ 
DECLARE
    tid UUID;
    admin_id UUID;
    ktv_lead_id UUID;
    temp_id UUID;
    ktv_ids UUID[] := '{}';
    cust_ids UUID[] := '{}';
    booking_ids UUID[] := '{}';
    i INTEGER;
BEGIN
    -- 1. Get or Create Tenant ID
    SELECT id INTO tid FROM tenants WHERE name = 'Bella Spa Headquarter' LIMIT 1;
    IF tid IS NULL THEN
        INSERT INTO tenants (name, status) VALUES ('Bella Spa Headquarter', 'active') RETURNING id INTO tid;
    END IF;

    -- 2. Insert Staff (Users)
    -- Admin
    INSERT INTO users (email, full_name, role, status, tenant_id)
    VALUES ('admin@bellaspa.com.vn', 'Nguyễn Phương Anh', 'admin', 'active', tid)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO admin_id;

    -- KTV Lead
    INSERT INTO users (email, full_name, role, status, tenant_id)
    VALUES ('lead@bellaspa.com.vn', 'Trần Hồng Nhung', 'ktv_lead', 'active', tid)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO ktv_lead_id;

    -- 5 KTVs
    FOR i IN 1..5 LOOP
        INSERT INTO users (email, full_name, role, status, tenant_id)
        VALUES 
            ('ktv' || i || '@bellaspa.com.vn', 
             CASE i 
                WHEN 1 THEN 'Nguyễn Thị Hoa' 
                WHEN 2 THEN 'Lê Thu Hà' 
                WHEN 3 THEN 'Phạm Minh Tuyết' 
                WHEN 4 THEN 'Trần Thị Thanh' 
                WHEN 5 THEN 'Hoàng Ngọc Mai' 
             END, 
             'ktv', 'active', tid)
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id INTO temp_id;
        ktv_ids := array_append(ktv_ids, temp_id);
    END LOOP;

    -- 3. Insert 20 Customers
    FOR i IN 1..20 LOOP
        INSERT INTO customers (phone, name_mother, name_baby, address, dob_baby, dob_expected, tenant_id, status)
        VALUES 
            ('09' || LPAD(i::text, 8, '0'), 
             CASE (i % 5)
                WHEN 0 THEN 'Nguyễn Thị ' || i
                WHEN 1 THEN 'Trần Thu ' || i
                WHEN 2 THEN 'Lê Diệu ' || i
                WHEN 3 THEN 'Phạm Hải ' || i
                WHEN 4 THEN 'Vũ Bích ' || i
              END,
             CASE WHEN i < 15 THEN 'Bé ' || i ELSE 'Chưa sinh' END,
             'Quận ' || (i % 12 + 1) || ', TP. Hồ Chí Minh',
             CASE WHEN i < 15 THEN ('2026-0' || (i % 4 + 1) || '-10')::DATE ELSE NULL END,
             CASE WHEN i >= 15 THEN ('2026-0' || (i % 4 + 6) || '-15')::DATE ELSE NULL END,
             tid, 'active')
        ON CONFLICT (phone) DO UPDATE SET name_mother = EXCLUDED.name_mother
        RETURNING id INTO temp_id;
        cust_ids := array_append(cust_ids, temp_id);
    END LOOP;

    -- 4. Insert Bookings for each customer
    FOR i IN 1..20 LOOP
        INSERT INTO bookings (booking_number, customer_id, status, deposit_amount, full_price, start_date, total_sessions, completed_sessions, assigned_ktv_id, tenant_id)
        VALUES 
            ('BK-2026-' || LPAD(i::text, 3, '0'), 
             cust_ids[i], 
             CASE 
                WHEN i <= 5 THEN 'completed'
                WHEN i <= 15 THEN 'in_progress'
                WHEN i <= 18 THEN 'booked'
                ELSE 'inquiry'
             END,
             2000000, 
             15000000 + (i * 100000), 
             ('2026-0' || (i % 5 + 1) || '-01')::DATE,
             15, 
             CASE 
                WHEN i <= 5 THEN 15
                WHEN i <= 15 THEN (i % 10 + 1)
                ELSE 0
             END,
             ktv_ids[(i % 5) + 1],
             tid)
        ON CONFLICT (booking_number) DO UPDATE SET status = EXCLUDED.status
        RETURNING id INTO temp_id;
        booking_ids := array_append(booking_ids, temp_id);
    END LOOP;

    -- 5. Insert Revenue (Financial Data)
    FOR i IN 1..20 LOOP
        -- Deposit for all
        INSERT INTO revenue (booking_id, amount, revenue_type, payment_method, received_date, status, tenant_id)
        VALUES (booking_ids[i], 2000000, 'deposit', 'bank_transfer', ('2026-0' || (i % 3 + 1) || '-05')::DATE, 'confirmed', tid);
        
        -- Full payment for completed ones
        IF i <= 5 THEN
            INSERT INTO revenue (booking_id, amount, revenue_type, payment_method, received_date, status, tenant_id)
            VALUES (booking_ids[i], 13000000 + (i * 100000), 'session_completed', 'bank_transfer', ('2026-04-30')::DATE, 'confirmed', tid);
        END IF;
    END LOOP;

    -- 6. Insert Expenses (Financial Data)
    INSERT INTO expenses (category, amount, description, expense_date, status, tenant_id)
    VALUES 
        ('Marketing', 5000000, 'Chạy quảng cáo Facebook tháng 4/2026', '2026-04-15', 'approved', tid),
        ('Supplies', 2500000, 'Mua tinh dầu và thảo dược xông hơ', '2026-05-02', 'approved', tid),
        ('Rent', 15000000, 'Thuê mặt bằng văn phòng', '2026-05-01', 'approved', tid),
        ('Utilities', 1200000, 'Tiền điện nước tháng 4', '2026-05-05', 'approved', tid);

    -- 7. Insert Salary Records (Personnel Data)
    FOR i IN 1..5 LOOP
        INSERT INTO salary_records (ktv_id, month_year, base_salary, service_percentage_bonus, kpi_bonus, total_salary, status, tenant_id)
        VALUES (ktv_ids[i], '2026-05-01', 6000000, 3000000 + (i * 500000), 1000000, 10000000 + (i * 500000), 'pending_approval', tid);
        
        INSERT INTO kpi_records (ktv_id, month_year, sessions_completed, on_time_rate, customer_satisfaction, target_sessions, kpi_achievement_rate, tenant_id)
        VALUES (ktv_ids[i], '2026-05-01', 45 + i, 98.0, 4.9, 50, 95.0, tid);
    END LOOP;

    -- 8. Insert Session Logs for Realtime display
    FOR i IN 1..15 LOOP
        INSERT INTO session_logs (booking_id, session_number, assigned_date, status, completed_by_ktv_id, tenant_id)
        VALUES 
            (booking_ids[i], 1, '2026-05-10', 'completed', ktv_ids[(i % 5) + 1], tid),
            (booking_ids[i], 2, '2026-05-12', 'scheduled', ktv_ids[(i % 5) + 1], tid);
    END LOOP;

END $$;
