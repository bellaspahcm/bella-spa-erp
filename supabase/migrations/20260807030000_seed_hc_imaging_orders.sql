-- Make clinical_order_id and encounter_id NULLABLE in hc_imaging_orders for direct orders
ALTER TABLE public.hc_imaging_orders 
ALTER COLUMN clinical_order_id DROP NOT NULL,
ALTER COLUMN encounter_id DROP NOT NULL;

-- Add extra columns to hc_imaging_orders if not present
ALTER TABLE public.hc_imaging_orders
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS ticket_number TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'ROUTINE';

-- Function to seed default imaging orders for all tenants in PostgreSQL
CREATE OR REPLACE FUNCTION public.seed_hc_imaging_orders_for_all_tenants()
RETURNS VOID AS $$
DECLARE
    t_record RECORD;
BEGIN
    FOR t_record IN SELECT id FROM public.tenants LOOP
        -- Item 1: Trần Minh Hoàng (STAT)
        INSERT INTO public.hc_imaging_orders (
            tenant_id, patient_name, ticket_number, modality, body_site, dcm_study_uid, viewer_link, priority, doctor_notified, doctor_notified_time
        )
        VALUES (
            t_record.id,
            'Trần Minh Hoàng',
            'STT-103',
            'CT',
            'CT-Scanner Sọ Não Không Thuốc Tương Quang (Brain CT non-contrast)',
            '1.2.840.113619.2.100.20260806.102',
            '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.102',
            'STAT',
            false,
            NULL
        )
        ON CONFLICT DO NOTHING;

        -- Item 2: Nguyễn Văn Hùng (URGENT)
        INSERT INTO public.hc_imaging_orders (
            tenant_id, patient_name, ticket_number, modality, body_site, dcm_study_uid, viewer_link, priority, radiologist_report, verified_at, doctor_notified, doctor_notified_time
        )
        VALUES (
            t_record.id,
            'Nguyễn Văn Hùng',
            'STT-101',
            'MRI',
            'MRI Cột Sống Thắt Lưng (Lumbar Spine MRI)',
            '1.2.840.113619.2.100.20260806.103',
            '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.103',
            'URGENT',
            'Thoái hóa đĩa đệm L4-L5, L5-S1. Thoát vị đĩa đệm thể sau trung tâm L5-S1 chèn ép nhẹ rễ thần kinh S1 bên trái.',
            NOW(),
            true,
            '09:30'
        )
        ON CONFLICT DO NOTHING;

        -- Item 3: Lê Thị Mai (ROUTINE)
        INSERT INTO public.hc_imaging_orders (
            tenant_id, patient_name, ticket_number, modality, body_site, dcm_study_uid, viewer_link, priority, radiologist_report, verified_at, doctor_notified, doctor_notified_time
        )
        VALUES (
            t_record.id,
            'Lê Thị Mai',
            'STT-102',
            'XRAY',
            'X-Quang Ngực Thẳng (Chest AP/PA)',
            '1.2.840.113619.2.100.20260806.101',
            '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.101',
            'ROUTINE',
            'Nhu mô phổi 2 bên sáng đều, không thấy tổn thương thâm nhiễm hay phế nang. Bóng tim không to (chỉ số tim/lồng ngực < 0.5). Vòm hoành 2 bên đều.',
            NOW(),
            false,
            NULL
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT public.seed_hc_imaging_orders_for_all_tenants();
DROP FUNCTION public.seed_hc_imaging_orders_for_all_tenants();
