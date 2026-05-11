-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 16. TENANTS (Create first because others depend on it)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_tenant_id UUID REFERENCES tenants(id),
    franchise_agreement_date DATE,
    royalty_rate DECIMAL,
    contact_name TEXT,
    contact_phone TEXT,
    address TEXT,
    status TEXT CHECK (status IN ('active', 'suspended', 'terminated')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, 
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK (role IN ('admin', 'ktv_lead', 'ktv', 'admin_staff', 'accountant')) NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    name_mother TEXT NOT NULL,
    name_baby TEXT,
    dob_baby DATE,
    dob_expected DATE,
    address TEXT,
    referrer_id UUID REFERENCES users(id),
    zalo_oa_id TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number TEXT UNIQUE NOT NULL, 
    customer_id UUID REFERENCES customers(id) NOT NULL,
    package_id UUID, 
    status TEXT CHECK (status IN ('inquiry', 'deposit_pending', 'booked', 'in_progress', 'completed', 'cancelled')) DEFAULT 'inquiry',
    deposit_amount DECIMAL DEFAULT 0,
    full_price DECIMAL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    expected_birth_date DATE,
    total_sessions INTEGER DEFAULT 21,
    completed_sessions INTEGER DEFAULT 0,
    contract_signed BOOLEAN DEFAULT FALSE,
    contract_url TEXT,
    assigned_ktv_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SESSION_LOGS
CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) NOT NULL,
    session_number INTEGER NOT NULL,
    assigned_date DATE,
    completed_date DATE,
    completed_by_ktv_id UUID REFERENCES users(id),
    address TEXT,
    status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW() 
);
CREATE INDEX IF NOT EXISTS idx_session_logs_booking_id ON session_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_completed_date ON session_logs(completed_date);

-- 5. SESSION_REVIEWS
CREATE TABLE IF NOT EXISTS session_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_log_id UUID REFERENCES session_logs(id) NOT NULL,
    reviewer_id UUID REFERENCES customers(id),
    ktv_id UUID REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    note TEXT, 
    note_encrypted BOOLEAN DEFAULT TRUE,
    is_hidden_from_ktv BOOLEAN DEFAULT TRUE,
    status TEXT CHECK (status IN ('pending_review', 'approved', 'published')) DEFAULT 'pending_review',
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_reviews_ktv_id ON session_reviews(ktv_id);
CREATE INDEX IF NOT EXISTS idx_session_reviews_session_log_id ON session_reviews(session_log_id);

-- 6. KTV_SCHEDULE
CREATE TABLE IF NOT EXISTS ktv_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ktv_id UUID REFERENCES users(id) NOT NULL,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('free_full', 'free_partial', 'full', 'off')) DEFAULT 'free_full',
    off_paid BOOLEAN DEFAULT FALSE,
    note TEXT,
    tenant_id UUID REFERENCES tenants(id),
    UNIQUE(ktv_id, date)
);

-- 7. SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ktv_id UUID REFERENCES users(id) NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    booking_id UUID REFERENCES bookings(id),
    customer_id UUID REFERENCES customers(id),
    address TEXT,
    checkin_time TIMESTAMPTZ,
    checkin_lat DECIMAL,
    checkin_lon DECIMAL,
    checkout_time TIMESTAMPTZ,
    checkout_lat DECIMAL,
    checkout_lon DECIMAL,
    status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
    tenant_id UUID REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_shifts_ktv_date ON shifts(ktv_id, date);

-- 8. REVENUE
CREATE TABLE IF NOT EXISTS revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    amount DECIMAL NOT NULL,
    revenue_type TEXT CHECK (revenue_type IN ('deposit', 'session_completed', 'additional')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'zalo_pay', 'momo')),
    received_date DATE NOT NULL,
    recorded_by_id UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('pending', 'confirmed')) DEFAULT 'pending',
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_revenue_booking_date ON revenue(booking_id, received_date);

-- 9. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    description TEXT,
    receipt_url TEXT,
    expense_date DATE NOT NULL,
    approved_by_id UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('submitted', 'approved', 'rejected')) DEFAULT 'submitted',
    submitted_by_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category, expense_date);

-- 10. SALARY_RECORDS
CREATE TABLE IF NOT EXISTS salary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ktv_id UUID REFERENCES users(id) NOT NULL,
    month_year DATE NOT NULL,
    base_salary DECIMAL DEFAULT 0,
    service_percentage_bonus DECIMAL DEFAULT 0,
    kpi_bonus DECIMAL DEFAULT 0,
    violations_deduction DECIMAL DEFAULT 0,
    total_salary DECIMAL DEFAULT 0,
    status TEXT CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid')) DEFAULT 'draft',
    paid_date DATE,
    paid_method TEXT,
    tenant_id UUID REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_salary_ktv_month ON salary_records(ktv_id, month_year);

-- 11. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ktv_id UUID REFERENCES users(id) NOT NULL,
    date DATE NOT NULL,
    checkin_time TIMESTAMPTZ,
    checkout_time TIMESTAMPTZ,
    shift_id UUID REFERENCES shifts(id),
    status TEXT CHECK (status IN ('present', 'late', 'absent', 'half_day')) DEFAULT 'present',
    tenant_id UUID REFERENCES tenants(id),
    UNIQUE(ktv_id, date)
);

-- 12. KPI_RECORDS
CREATE TABLE IF NOT EXISTS kpi_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ktv_id UUID REFERENCES users(id) NOT NULL,
    month_year DATE NOT NULL,
    sessions_completed INTEGER DEFAULT 0,
    on_time_rate DECIMAL DEFAULT 0,
    customer_satisfaction DECIMAL DEFAULT 0,
    violations_count INTEGER DEFAULT 0,
    target_sessions INTEGER DEFAULT 0,
    kpi_achievement_rate DECIMAL DEFAULT 0,
    bonus_amount DECIMAL DEFAULT 0,
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id)
);

-- 13. CHAT_THREADS
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_type TEXT CHECK (thread_type IN ('booking', 'general', 'team')),
    booking_id UUID REFERENCES bookings(id),
    team_id UUID, 
    channel_name TEXT,
    created_by_id UUID REFERENCES users(id),
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. CHAT_MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES chat_threads(id) NOT NULL,
    sender_id UUID REFERENCES users(id),
    content TEXT,
    message_type TEXT CHECK (message_type IN ('text', 'system', 'file')) DEFAULT 'text',
    file_url TEXT,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_date ON chat_messages(thread_id, created_at);

-- 15. MEMBERSHIP_RECORDS
CREATE TABLE IF NOT EXISTS membership_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) NOT NULL,
    tier TEXT CHECK (tier IN ('silver', 'gold', 'diamond')) DEFAULT 'silver',
    total_points INTEGER DEFAULT 0,
    points_used INTEGER DEFAULT 0,
    tier_upgrade_date DATE,
    expires_at DATE,
    benefits_redeemed TEXT[],
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_membership_updated_at BEFORE UPDATE ON membership_records FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
