-- THE GREAT PURGE: FINAL BELLA SPA STANDARDIZATION
-- Applied on 2026-05-15 to remove all legacy RealEstate CRM entities

-- 0. Fix data first to allow NOT NULL constraints
DO $$ 
DECLARE
    default_pkg_id UUID;
BEGIN
    SELECT id INTO default_pkg_id FROM public.packages WHERE name = 'Dịch Vụ Lẻ (Mẹ)' LIMIT 1;
    
    UPDATE public.bookings 
    SET package_id = default_pkg_id, 
        package_name = 'Dịch Vụ Lẻ (Mẹ)',
        total_sessions = 1,
        full_price = 350000,
        status = 'booked'
    WHERE package_id IS NULL;
END $$;

-- 1. Drop foreign keys first
ALTER TABLE IF EXISTS public.bookings DROP CONSTRAINT IF EXISTS bookings_unit_id_fkey;
ALTER TABLE IF EXISTS public.bookings DROP CONSTRAINT IF EXISTS bookings_f2_agency_id_fkey;
ALTER TABLE IF EXISTS public.bookings DROP CONSTRAINT IF EXISTS bookings_sales_id_fkey;
ALTER TABLE IF EXISTS public.customers DROP CONSTRAINT IF EXISTS customers_assigned_sales_id_fkey;
ALTER TABLE IF EXISTS public.expenses DROP CONSTRAINT IF EXISTS expenses_project_id_fkey;
ALTER TABLE IF EXISTS public.expenses DROP CONSTRAINT IF EXISTS expenses_employee_id_fkey;

-- 2. Drop RealEstate-only tables
DROP TABLE IF EXISTS public.cancellations CASCADE;
DROP TABLE IF EXISTS public.internal_commissions CASCADE;
DROP TABLE IF EXISTS public.commission_records CASCADE;
DROP TABLE IF EXISTS public.payment_schedules CASCADE;
DROP TABLE IF EXISTS public.sale_contracts CASCADE;
DROP TABLE IF EXISTS public.distribution_contracts CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.f2_agencies CASCADE;
DROP TABLE IF EXISTS public.developers CASCADE;
DROP TABLE IF EXISTS public.commission_split_policies CASCADE;
DROP TABLE IF EXISTS public.kpi_snapshots CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;

-- 3. Cleanup "bookings" table: Remove RealEstate columns and standardize types
ALTER TABLE public.bookings ALTER COLUMN status TYPE TEXT;

ALTER TABLE public.bookings 
    DROP COLUMN IF EXISTS unit_id,
    DROP COLUMN IF EXISTS sales_id,
    DROP COLUMN IF EXISTS f2_agency_id,
    DROP COLUMN IF EXISTS booking_amount,
    DROP COLUMN IF EXISTS expiry_date,
    DROP COLUMN IF EXISTS agreed_price,
    DROP COLUMN IF EXISTS transferred_to_developer,
    DROP COLUMN IF EXISTS transfer_date;

-- Ensure critical Spa columns are NOT NULL
ALTER TABLE public.bookings ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN package_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN total_sessions SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'booked';

-- 4. Cleanup "customers" table
ALTER TABLE public.customers
    DROP COLUMN IF EXISTS id_number,
    DROP COLUMN IF EXISTS id_issued_date,
    DROP COLUMN IF EXISTS id_issued_place,
    DROP COLUMN IF EXISTS permanent_address,
    DROP COLUMN IF EXISTS assigned_sales_id;

-- 5. Cleanup "expenses" table
ALTER TABLE public.expenses
    DROP COLUMN IF EXISTS project_id,
    DROP COLUMN IF EXISTS employee_id;

-- 6. Cleanup obsolete Enums
DROP TYPE IF EXISTS public.unit_status CASCADE;
DROP TYPE IF EXISTS public.booking_status CASCADE;
DROP TYPE IF EXISTS public.sale_contract_status CASCADE;
DROP TYPE IF EXISTS public.agency_tier CASCADE;
DROP TYPE IF EXISTS public.employee_role CASCADE;
DROP TYPE IF EXISTS public.cancellation_type CASCADE;
DROP TYPE IF EXISTS public.internal_commission_status CASCADE;
DROP TYPE IF EXISTS public.commission_status CASCADE;
DROP TYPE IF EXISTS public.payment_schedule_status CASCADE;

-- 7. Hardening the Schema
DELETE FROM public.session_logs WHERE booking_id IS NULL;
ALTER TABLE public.session_logs ALTER COLUMN booking_id SET NOT NULL;

-- 8. Standardize RPC
CREATE OR REPLACE FUNCTION public.get_chat_customers(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    phone TEXT,
    customer_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_package_name TEXT,
    total_spent BIGINT,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.phone,
        COALESCE(c.gender_baby, 'Thành viên') as customer_level,
        c.created_at,
        (SELECT b.package_name FROM public.bookings b WHERE b.customer_id = c.id ORDER BY b.created_at DESC LIMIT 1) as last_package_name,
        (SELECT COALESCE(SUM(r.amount), 0) FROM public.revenue r WHERE r.booking_id IN (SELECT b.id FROM public.bookings b WHERE b.customer_id = c.id)) as total_spent,
        (SELECT COUNT(*) FROM public.chat_messages m WHERE m.customer_id = c.id AND m.is_read = false AND m.sender_type = 'customer') as unread_count
    FROM public.customers c
    WHERE c.tenant_id = p_tenant_id
    ORDER BY (SELECT MAX(m.created_at) FROM public.chat_messages m WHERE m.customer_id = c.id) DESC NULLS LAST, c.created_at DESC;
END;
$$;
