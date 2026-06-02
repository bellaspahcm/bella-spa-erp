-- Harden RLS rules created by the previous core RLS migration.

DROP POLICY IF EXISTS "Guest xem bookings" ON bookings;
DROP POLICY IF EXISTS "Guest can view bookings" ON bookings;
CREATE POLICY "Guest bookings select blocked"
    ON bookings FOR SELECT TO anon
    USING (false);

DROP POLICY IF EXISTS "KTV xem bookings duoc phan cong" ON bookings;
DROP POLICY IF EXISTS "KTV cap nhat bookings duoc phan cong" ON bookings;
DROP POLICY IF EXISTS "KTV can view assigned bookings" ON bookings;
DROP POLICY IF EXISTS "KTV can update assigned bookings" ON bookings;

CREATE POLICY "KTV view assigned bookings tenant safe"
    ON bookings FOR SELECT TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "KTV update assigned bookings tenant safe"
    ON bookings FOR UPDATE TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "KTV xem session_logs duoc phan cong" ON session_logs;
DROP POLICY IF EXISTS "KTV cap nhat session_logs duoc phan cong" ON session_logs;
DROP POLICY IF EXISTS "KTV can view completed session logs" ON session_logs;
DROP POLICY IF EXISTS "KTV can update completed session logs" ON session_logs;

CREATE POLICY "KTV view own session logs tenant safe"
    ON session_logs FOR SELECT TO authenticated
    USING (
        completed_by_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "KTV update own session logs tenant safe"
    ON session_logs FOR UPDATE TO authenticated
    USING (
        completed_by_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

DO $$
BEGIN
    IF to_regclass('public."Notification"') IS NOT NULL THEN
        ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "User only sees own notification"
            ON "Notification" FOR SELECT TO authenticated
            USING ("userId" = auth.uid()::text);

        CREATE POLICY "User updates own notification"
            ON "Notification" FOR UPDATE TO authenticated
            USING ("userId" = auth.uid()::text);

        CREATE POLICY "System insert notifications"
            ON "Notification" FOR INSERT TO authenticated
            WITH CHECK (true);

        CREATE POLICY "Admin sees tenant notifications"
            ON "Notification" FOR SELECT TO authenticated
            USING (
                "tenantId" = (
                    SELECT tenant_id::text
                    FROM users
                    WHERE id = auth.uid()
                      AND role = 'admin'
                )
            );
    END IF;
END $$;
