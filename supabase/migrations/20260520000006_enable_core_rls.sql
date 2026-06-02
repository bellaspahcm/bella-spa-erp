-- Enable RLS for core tables.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bookings in tenant"
    ON bookings
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "KTV can view assigned bookings"
    ON bookings
    FOR SELECT
    TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
    );

CREATE POLICY "KTV can update assigned bookings"
    ON bookings
    FOR UPDATE
    TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
    );

CREATE POLICY "Admin can manage session logs in tenant"
    ON session_logs
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "KTV can view completed session logs"
    ON session_logs
    FOR SELECT
    TO authenticated
    USING (
        completed_by_ktv_id = auth.uid()
    );

CREATE POLICY "KTV can update completed session logs"
    ON session_logs
    FOR UPDATE
    TO authenticated
    USING (
        completed_by_ktv_id = auth.uid()
    );

CREATE POLICY "Admin can manage revenue"
    ON revenue
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin can manage expenses"
    ON expenses
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Guest can create bookings"
    ON bookings
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Guest can view bookings"
    ON bookings
    FOR SELECT
    TO anon
    USING (true);
