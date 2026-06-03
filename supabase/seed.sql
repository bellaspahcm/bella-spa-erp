-- Seed Demo Data for Bella Spa ERP - Year 2026
-- Primary source of truth for a deterministic demo environment.

DO $$
DECLARE
    tid UUID;
    admin_id UUID;
    ktv_lead_id UUID;
    temp_id UUID;
    pkg_id UUID;
    ktv_ids UUID[] := '{}';
    cust_ids UUID[] := '{}';
    booking_ids UUID[] := '{}';
    pkg_ids UUID[] := '{}';
    pkg_names TEXT[] := ARRAY[
        'Combo Me & Be Tiet Kiem',
        'Combo Me & Be Hanh Phuc',
        'Combo Me & Be VIP Toan Dien'
    ];
    pkg_descriptions TEXT[] := ARRAY[
        'Goi cham soc co ban voi he so ca 1.0',
        'Goi cham soc nang cao voi he so ca 1.5',
        'Goi cham soc VIP voi he so ca 2.0'
    ];
    pkg_prices NUMERIC[] := ARRAY[12000000, 18000000, 26000000];
    pkg_sessions INTEGER[] := ARRAY[12, 15, 20];
    pkg_multipliers NUMERIC[] := ARRAY[1.0, 1.5, 2.0];
    pkg_commissions INTEGER[] := ARRAY[120000, 160000, 220000];
    pkg_index INTEGER;
    i INTEGER;
BEGIN
    -- 1. Get or create demo tenant.
    SELECT id INTO tid FROM tenants WHERE name = 'Bella Spa Headquarter' LIMIT 1;
    IF tid IS NULL THEN
        INSERT INTO tenants (name, status) VALUES ('Bella Spa Headquarter', 'active') RETURNING id INTO tid;
    END IF;

    -- 2. Insert staff.
    INSERT INTO users (email, full_name, role, status, tenant_id)
    VALUES ('admin@bellaspa.com.vn', 'Nguyen Phuong Anh', 'admin', 'active', tid)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, tenant_id = EXCLUDED.tenant_id
    RETURNING id INTO admin_id;

    INSERT INTO users (email, full_name, role, status, tenant_id)
    VALUES ('lead@bellaspa.com.vn', 'Tran Hong Nhung', 'ktv_lead', 'active', tid)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, tenant_id = EXCLUDED.tenant_id
    RETURNING id INTO ktv_lead_id;

    FOR i IN 1..5 LOOP
        INSERT INTO users (email, full_name, role, status, tenant_id)
        VALUES (
            'ktv' || i || '@bellaspa.com.vn',
            CASE i
                WHEN 1 THEN 'Nguyen Thi Hoa'
                WHEN 2 THEN 'Le Thu Ha'
                WHEN 3 THEN 'Pham Minh Tuyet'
                WHEN 4 THEN 'Tran Thi Thanh'
                WHEN 5 THEN 'Hoang Ngoc Mai'
            END,
            'ktv',
            'active',
            tid
        )
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, tenant_id = EXCLUDED.tenant_id
        RETURNING id INTO temp_id;

        ktv_ids := array_append(ktv_ids, temp_id);
    END LOOP;

    -- 3. Insert package catalog used by bookings and salary session multipliers.
    FOR i IN 1..array_length(pkg_names, 1) LOOP
        SELECT id INTO pkg_id
        FROM packages
        WHERE tenant_id = tid AND name = pkg_names[i]
        ORDER BY created_at
        LIMIT 1;

        IF pkg_id IS NULL THEN
            INSERT INTO packages (
                name,
                description,
                full_price,
                price,
                total_sessions,
                ktv_commission,
                tenant_id,
                status,
                session_multiplier
            )
            VALUES (
                pkg_names[i],
                pkg_descriptions[i],
                pkg_prices[i],
                pkg_prices[i],
                pkg_sessions[i],
                pkg_commissions[i],
                tid,
                'active',
                pkg_multipliers[i]
            )
            RETURNING id INTO pkg_id;
        ELSE
            UPDATE packages
            SET description = pkg_descriptions[i],
                full_price = pkg_prices[i],
                price = pkg_prices[i],
                total_sessions = pkg_sessions[i],
                ktv_commission = pkg_commissions[i],
                status = 'active',
                session_multiplier = pkg_multipliers[i],
                updated_at = NOW()
            WHERE id = pkg_id;
        END IF;

        pkg_ids := array_append(pkg_ids, pkg_id);
    END LOOP;

    -- 4. Insert customers.
    FOR i IN 1..20 LOOP
        INSERT INTO customers (phone, name_mother, name_baby, address, dob_baby, dob_expected, tenant_id, status)
        VALUES (
            '09' || LPAD(i::text, 8, '0'),
            CASE (i % 5)
                WHEN 0 THEN 'Nguyen Thi ' || i
                WHEN 1 THEN 'Tran Thu ' || i
                WHEN 2 THEN 'Le Dieu ' || i
                WHEN 3 THEN 'Pham Hai ' || i
                WHEN 4 THEN 'Vu Bich ' || i
            END,
            CASE WHEN i < 15 THEN 'Be ' || i ELSE 'Chua sinh' END,
            'Quan ' || (i % 12 + 1) || ', TP. Ho Chi Minh',
            CASE WHEN i < 15 THEN ('2026-0' || (i % 4 + 1) || '-10')::DATE ELSE NULL END,
            CASE WHEN i >= 15 THEN ('2026-0' || (i % 4 + 6) || '-15')::DATE ELSE NULL END,
            tid,
            'active'
        )
        ON CONFLICT (phone) DO UPDATE SET
            name_mother = EXCLUDED.name_mother,
            name_baby = EXCLUDED.name_baby,
            address = EXCLUDED.address,
            tenant_id = EXCLUDED.tenant_id
        RETURNING id INTO temp_id;

        cust_ids := array_append(cust_ids, temp_id);
    END LOOP;

    -- 5. Remove previous demo side effects so repeated seed runs are deterministic.
    DELETE FROM session_reviews
    WHERE session_log_id IN (
        SELECT sl.id
        FROM session_logs sl
        JOIN bookings b ON b.id = sl.booking_id
        WHERE b.tenant_id = tid AND b.booking_number LIKE 'BK-2026-%'
    );

    DELETE FROM inventory_logs
    WHERE session_log_id IN (
        SELECT sl.id
        FROM session_logs sl
        JOIN bookings b ON b.id = sl.booking_id
        WHERE b.tenant_id = tid AND b.booking_number LIKE 'BK-2026-%'
    );

    DELETE FROM session_logs
    WHERE booking_id IN (
        SELECT id FROM bookings WHERE tenant_id = tid AND booking_number LIKE 'BK-2026-%'
    );

    DELETE FROM revenue
    WHERE booking_id IN (
        SELECT id FROM bookings WHERE tenant_id = tid AND booking_number LIKE 'BK-2026-%'
    );

    DELETE FROM expenses
    WHERE tenant_id = tid
      AND expense_date BETWEEN '2026-04-01'::DATE AND '2026-05-31'::DATE
      AND description IN (
          'Facebook ads April 2026',
          'Essential oils and herbal supplies',
          'Office rent May 2026',
          'Utilities April 2026'
      );

    DELETE FROM salary_records
    WHERE tenant_id = tid
      AND month_year = '2026-05-01'::DATE
      AND ktv_id = ANY(ktv_ids);

    DELETE FROM kpi_records
    WHERE tenant_id = tid
      AND month_year = '2026-05-01'::DATE
      AND ktv_id = ANY(ktv_ids);

    -- 6. Insert bookings with required package linkage.
    FOR i IN 1..20 LOOP
        pkg_index := ((i - 1) % array_length(pkg_ids, 1)) + 1;

        INSERT INTO bookings (
            booking_number,
            customer_id,
            package_id,
            package_name,
            status,
            deposit_amount,
            full_price,
            start_date,
            total_sessions,
            completed_sessions,
            assigned_ktv_id,
            ktv_commission,
            tenant_id
        )
        VALUES (
            'BK-2026-' || LPAD(i::text, 3, '0'),
            cust_ids[i],
            pkg_ids[pkg_index],
            pkg_names[pkg_index],
            CASE
                WHEN i <= 5 THEN 'completed'
                WHEN i <= 15 THEN 'in_progress'
                WHEN i <= 18 THEN 'booked'
                ELSE 'inquiry'
            END,
            2000000,
            pkg_prices[pkg_index] + (i * 100000),
            ('2026-0' || (i % 5 + 1) || '-01')::DATE,
            pkg_sessions[pkg_index],
            CASE
                WHEN i <= 5 THEN pkg_sessions[pkg_index]
                WHEN i <= 15 THEN LEAST((i % 10 + 1), pkg_sessions[pkg_index])
                ELSE 0
            END,
            ktv_ids[((i - 1) % array_length(ktv_ids, 1)) + 1],
            pkg_commissions[pkg_index],
            tid
        )
        ON CONFLICT (booking_number) DO UPDATE SET
            customer_id = EXCLUDED.customer_id,
            package_id = EXCLUDED.package_id,
            package_name = EXCLUDED.package_name,
            status = EXCLUDED.status,
            deposit_amount = EXCLUDED.deposit_amount,
            full_price = EXCLUDED.full_price,
            start_date = EXCLUDED.start_date,
            total_sessions = EXCLUDED.total_sessions,
            completed_sessions = EXCLUDED.completed_sessions,
            assigned_ktv_id = EXCLUDED.assigned_ktv_id,
            ktv_commission = EXCLUDED.ktv_commission,
            tenant_id = EXCLUDED.tenant_id
        RETURNING id INTO temp_id;

        booking_ids := array_append(booking_ids, temp_id);
    END LOOP;

    -- 7. Insert revenue.
    FOR i IN 1..20 LOOP
        INSERT INTO revenue (booking_id, amount, revenue_type, payment_method, received_date, status, tenant_id)
        VALUES (
            booking_ids[i],
            2000000,
            'deposit',
            'bank_transfer',
            ('2026-0' || (i % 5 + 1) || '-05')::DATE,
            'confirmed',
            tid
        );

        IF i <= 5 THEN
            INSERT INTO revenue (booking_id, amount, revenue_type, payment_method, received_date, status, tenant_id)
            VALUES (
                booking_ids[i],
                (SELECT full_price - deposit_amount FROM bookings WHERE id = booking_ids[i]),
                'session_completed',
                'bank_transfer',
                CASE WHEN i <= 2 THEN '2026-04-30'::DATE ELSE '2026-05-10'::DATE END,
                'confirmed',
                tid
            );
        END IF;
    END LOOP;

    -- 8. Insert expenses.
    INSERT INTO expenses (category, amount, description, expense_date, status, tenant_id)
    VALUES
        ('Marketing', 5000000, 'Facebook ads April 2026', '2026-04-15', 'approved', tid),
        ('Supplies', 2500000, 'Essential oils and herbal supplies', '2026-05-02', 'approved', tid),
        ('Rent', 15000000, 'Office rent May 2026', '2026-05-01', 'approved', tid),
        ('Utilities', 1200000, 'Utilities April 2026', '2026-05-05', 'approved', tid);

    -- 9. Insert salary and KPI records.
    FOR i IN 1..array_length(ktv_ids, 1) LOOP
        INSERT INTO salary_records (
            ktv_id,
            month_year,
            base_salary,
            service_percentage_bonus,
            kpi_bonus,
            rating_bonus,
            total_salary,
            status,
            tenant_id
        )
        VALUES (
            ktv_ids[i],
            '2026-05-01',
            6000000,
            3000000 + (i * 500000),
            1000000,
            250000,
            10250000 + (i * 500000),
            'pending_approval',
            tid
        );

        INSERT INTO kpi_records (
            ktv_id,
            month_year,
            sessions_completed,
            on_time_rate,
            customer_satisfaction,
            target_sessions,
            kpi_achievement_rate,
            bonus_amount,
            tenant_id
        )
        VALUES (
            ktv_ids[i],
            '2026-05-01',
            45 + i,
            98.0,
            4.9,
            50,
            95.0,
            1000000,
            tid
        );
    END LOOP;

    -- 10. Insert session logs for operational dashboards.
    FOR i IN 1..15 LOOP
        INSERT INTO session_logs (booking_id, session_number, assigned_date, completed_date, status, completed_by_ktv_id, tenant_id)
        VALUES (
            booking_ids[i],
            1,
            '2026-05-10',
            '2026-05-10',
            'completed',
            ktv_ids[((i - 1) % array_length(ktv_ids, 1)) + 1],
            tid
        );

        INSERT INTO session_logs (booking_id, session_number, assigned_date, status, completed_by_ktv_id, tenant_id)
        VALUES (
            booking_ids[i],
            2,
            '2026-05-12',
            'scheduled',
            ktv_ids[((i - 1) % array_length(ktv_ids, 1)) + 1],
            tid
        );
    END LOOP;
END $$;
