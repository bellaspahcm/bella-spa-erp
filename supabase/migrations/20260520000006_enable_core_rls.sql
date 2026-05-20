-- Bật RLS cho các bảng core
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Tạo các policy cho bookings
CREATE POLICY "Admin có toàn quyền trên bookings của chi nhánh"
    ON bookings
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "KTV xem bookings được phân công"
    ON bookings
    FOR SELECT
    TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
    );

CREATE POLICY "KTV cập nhật bookings được phân công"
    ON bookings
    FOR UPDATE
    TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
    );

-- Tạo các policy cho session_logs
CREATE POLICY "Admin có toàn quyền trên session_logs của chi nhánh"
    ON session_logs
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "KTV xem session_logs được phân công"
    ON session_logs
    FOR SELECT
    TO authenticated
    USING (
        assigned_ktv_id = auth.uid() OR completed_by_ktv_id = auth.uid()
    );

CREATE POLICY "KTV cập nhật session_logs được phân công"
    ON session_logs
    FOR UPDATE
    TO authenticated
    USING (
        assigned_ktv_id = auth.uid() OR completed_by_ktv_id = auth.uid()
    );

-- Tạo các policy cho revenue (Chỉ Admin)
CREATE POLICY "Admin quản lý revenue"
    ON revenue
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Tạo các policy cho expenses (Chỉ Admin)
CREATE POLICY "Admin quản lý expenses"
    ON expenses
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Cho phép Guest (Anon) tạo bookings từ Landing Page
CREATE POLICY "Guest tạo bookings"
    ON bookings
    FOR INSERT
    TO anon
    WITH CHECK (true);
    
-- Cho phép Guest (Anon) xem bookings vừa tạo bằng ID (nếu cần cho webhook hoặc success page)
CREATE POLICY "Guest xem bookings"
    ON bookings
    FOR SELECT
    TO anon
    USING (true);
