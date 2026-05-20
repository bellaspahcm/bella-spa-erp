-- 1. FIX: Guest chỉ được đọc booking của chính mình (nếu có booking_id trong request headers hoặc JWT)
-- Vì Next.js Server Actions hiện không pass JWT custom claims cho anonymous users, 
-- và để bảo mật tối đa, chúng ta sẽ BLOCK hoàn toàn việc anonymous read từ DB. 
-- Nếu khách hàng cần xem booking từ Landing Page, họ phải cung cấp số điện thoại / OTP hoặc admin cung cấp link chứa token.
-- Trước mắt: Block SELECT trên bookings cho anon để tránh rò rỉ dữ liệu.
DROP POLICY IF EXISTS "Guest xem bookings" ON bookings;
CREATE POLICY "Guest xem bookings (Blocked)"
    ON bookings FOR SELECT TO anon
    USING (false);

-- 2. FIX: KTV phải thuộc cùng tenant với booking
DROP POLICY IF EXISTS "KTV xem bookings được phân công" ON bookings;
DROP POLICY IF EXISTS "KTV cập nhật bookings được phân công" ON bookings;

CREATE POLICY "KTV xem bookings được phân công (tenant-safe)"
    ON bookings FOR SELECT TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "KTV cập nhật bookings được phân công (tenant-safe)"
    ON bookings FOR UPDATE TO authenticated
    USING (
        assigned_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- 3. FIX: session_logs dùng đúng cột (không có assigned_ktv_id)
DROP POLICY IF EXISTS "KTV xem session_logs được phân công" ON session_logs;
DROP POLICY IF EXISTS "KTV cập nhật session_logs được phân công" ON session_logs;

CREATE POLICY "KTV xem session_logs của mình (tenant-safe)"
    ON session_logs FOR SELECT TO authenticated
    USING (
        completed_by_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "KTV cập nhật session_logs của mình (tenant-safe)"
    ON session_logs FOR UPDATE TO authenticated
    USING (
        completed_by_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- 4. FIX: Enable RLS và tạo policy cho Notification table
-- Do table Notification sử dụng camelCase (Prisma convention cũ) 
-- Cần cẩn thận bọc tên bảng và cột bằng dấu ngoặc kép ""
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User chỉ xem notification của mình"
    ON "Notification" FOR SELECT TO authenticated
    USING ("userId" = auth.uid()::text);

CREATE POLICY "User cập nhật notification của mình"
    ON "Notification" FOR UPDATE TO authenticated
    USING ("userId" = auth.uid()::text);

CREATE POLICY "System insert notifications"
    ON "Notification" FOR INSERT TO authenticated
    WITH CHECK (true);

-- 5. THÊM: Admin có quyền xem mọi notification của tenant
CREATE POLICY "Admin xem notification của chi nhánh"
    ON "Notification" FOR SELECT TO authenticated
    USING (
        "tenantId" = (SELECT tenant_id::text FROM users WHERE id = auth.uid() AND role = 'admin')
    );
