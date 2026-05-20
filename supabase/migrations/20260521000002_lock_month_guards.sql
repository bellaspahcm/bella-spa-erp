-- Trigger chặn chỉnh sửa dữ liệu đã khóa
CREATE OR REPLACE FUNCTION public.prevent_locked_record_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_locked = true AND NEW.is_locked = true THEN
        RAISE EXCEPTION 'Không thể chỉnh sửa bản ghi đã khóa sổ. Liên hệ Admin để mở khóa.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Áp dụng cho revenue
DROP TRIGGER IF EXISTS prevent_locked_revenue_update ON revenue;
CREATE TRIGGER prevent_locked_revenue_update
    BEFORE UPDATE ON revenue
    FOR EACH ROW
    WHEN (OLD.is_locked = true AND TG_OP = 'UPDATE')
    EXECUTE FUNCTION public.prevent_locked_record_update();

-- Áp dụng cho expenses
DROP TRIGGER IF EXISTS prevent_locked_expense_update ON expenses;
CREATE TRIGGER prevent_locked_expense_update
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    WHEN (OLD.is_locked = true AND TG_OP = 'UPDATE')
    EXECUTE FUNCTION public.prevent_locked_record_update();

-- Áp dụng cho salary_records
DROP TRIGGER IF EXISTS prevent_locked_salary_update ON salary_records;
CREATE TRIGGER prevent_locked_salary_update
    BEFORE UPDATE ON salary_records
    FOR EACH ROW
    WHEN (OLD.is_locked = true AND TG_OP = 'UPDATE')
    EXECUTE FUNCTION public.prevent_locked_record_update();
