-- Update log_audit_event trigger function to support tenants table (which doesn't have tenant_id column but uses id instead)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    record_tenant_id UUID;
BEGIN
    -- Try to get the user ID from the Supabase auth context
    current_user_id := auth.uid();
    
    -- Determine the tenant_id from the record
    IF TG_TABLE_NAME = 'tenants' THEN
        IF TG_OP = 'DELETE' THEN
            record_tenant_id := OLD.id;
        ELSE
            record_tenant_id := NEW.id;
        END IF;
    ELSE
        IF TG_OP = 'DELETE' THEN
            record_tenant_id := OLD.tenant_id;
        ELSE
            record_tenant_id := NEW.tenant_id;
        END IF;
    END IF;

    -- Insert the audit log record
    INSERT INTO public.audit_logs (
        tenant_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by_id
    ) VALUES (
        record_tenant_id,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
        current_user_id
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to additional operational tables

-- 1. Bookings (Quản lý đặt lịch)
DROP TRIGGER IF EXISTS audit_bookings_changes ON public.bookings;
CREATE TRIGGER audit_bookings_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. Session Logs (Quản lý ca làm việc)
DROP TRIGGER IF EXISTS audit_session_logs_changes ON public.session_logs;
CREATE TRIGGER audit_session_logs_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.session_logs
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 3. Customers (Quản lý hồ sơ khách hàng)
DROP TRIGGER IF EXISTS audit_customers_changes ON public.customers;
CREATE TRIGGER audit_customers_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. Users (Quản lý nhân sự)
DROP TRIGGER IF EXISTS audit_users_changes ON public.users;
CREATE TRIGGER audit_users_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 5. Inventory Items (Quản lý vật tư kho)
DROP TRIGGER IF EXISTS audit_inventory_items_changes ON public.inventory_items;
CREATE TRIGGER audit_inventory_items_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 6. Packages (Danh mục gói liệu trình)
DROP TRIGGER IF EXISTS audit_packages_changes ON public.packages;
CREATE TRIGGER audit_packages_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.packages
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 7. Session Reviews (Quản lý đánh giá chất lượng)
DROP TRIGGER IF EXISTS audit_session_reviews_changes ON public.session_reviews;
CREATE TRIGGER audit_session_reviews_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.session_reviews
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 8. Attendance (Quản lý chấm công)
DROP TRIGGER IF EXISTS audit_attendance_changes ON public.attendance;
CREATE TRIGGER audit_attendance_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 9. Tenants (Thông tin đối tác nhượng quyền & cấu hình Zalo OA/Ngân hàng)
DROP TRIGGER IF EXISTS audit_tenants_changes ON public.tenants;
CREATE TRIGGER audit_tenants_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 10. Package Materials (Định mức tiêu thụ kho)
DROP TRIGGER IF EXISTS audit_package_materials_changes ON public.package_materials;
CREATE TRIGGER audit_package_materials_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.package_materials
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
