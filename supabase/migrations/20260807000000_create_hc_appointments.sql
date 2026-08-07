-- ============================================================================
-- Bella Healthcare Platform — Healthcare Appointments Schema
-- Migration: 20260807000000_create_hc_appointments.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hc_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    appointment_code TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    specialty TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    slot_time TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'checked_in', 'no_show', 'cancelled', 'completed')),
    channel TEXT NOT NULL CHECK (channel IN ('online_website', 'zalo_oa', 'call_center', 'walk_in')),
    qr_code TEXT NOT NULL,
    reminder_sent BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_tenant_appointment_code UNIQUE (tenant_id, appointment_code)
);

CREATE INDEX IF NOT EXISTS idx_hc_appointments_tenant ON public.hc_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_appointments_code ON public.hc_appointments(appointment_code);
CREATE INDEX IF NOT EXISTS idx_hc_appointments_status ON public.hc_appointments(tenant_id, status);

-- Enable RLS
ALTER TABLE public.hc_appointments ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
CREATE POLICY tenant_isolation_hc_appointments ON public.hc_appointments
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

-- Seed default appointments for all tenants
CREATE OR REPLACE FUNCTION public.seed_hc_appointments_for_all_tenants()
RETURNS VOID AS $$
DECLARE
    t_record RECORD;
BEGIN
    FOR t_record IN SELECT id FROM public.tenants LOOP
        INSERT INTO public.hc_appointments (tenant_id, appointment_code, patient_name, patient_phone, specialty, doctor_name, appointment_date, slot_time, status, channel, qr_code, reminder_sent, notes)
        VALUES 
            (t_record.id, 'APP-8801', 'Trần Minh Hoàng', '0908 123 456', 'Khoa Tim Mạch', 'BS. CKII Nguyễn Văn Minh', CURRENT_DATE, '08:30 - 09:00', 'confirmed', 'online_website', 'QR-APP-8801', true, 'Bệnh nhân tái khám huyết áp định kỳ. Cần đo điện tâm đồ ECG trước khi vào gặp bác sĩ.'),
            (t_record.id, 'APP-8802', 'Lê Thị Mai', '0912 345 678', 'Khoa Tiêu Hóa', 'BS. CKI Trần Đức Hùng', CURRENT_DATE, '09:00 - 09:30', 'checked_in', 'zalo_oa', 'QR-APP-8802', true, 'Đau tức thượng vị sau ăn 2 tuần. Đã nhịn ăn sáng sẵn sàng siêu âm ổ bụng.'),
            (t_record.id, 'APP-8803', 'Nguyễn Văn Hùng', '0988 999 888', 'Khoa Nhi', 'ThS. BS Lê Thị Mai', CURRENT_DATE, '10:00 - 10:30', 'no_show', 'call_center', 'QR-APP-8803', true, 'Khám ho sốt ban đêm. Quá hạn 20 phút không phản hồi Zalo.'),
            (t_record.id, 'APP-8804', 'Phạm Thị Hoa', '0933 111 222', 'Khoa Tai Mũi Họng', 'BS. Vũ Thị Dung', CURRENT_DATE, '14:00 - 14:30', 'confirmed', 'online_website', 'QR-APP-8804', false, 'Viêm họng hạt tái phát kèm sưng hạch góc hàm.'),
            (t_record.id, 'APP-8805', 'Hoàng Đức Nam', '0977 444 555', 'Khoa Thần Kinh', 'BS. CKII Nguyễn Văn Minh', CURRENT_DATE, '15:30 - 16:00', 'confirmed', 'walk_in', 'QR-APP-8805', true, 'Chóng mặt tư thế kịch phát lành tính. Đặt khám trực tiếp tại quầy.')
        ON CONFLICT (tenant_id, appointment_code) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT public.seed_hc_appointments_for_all_tenants();
DROP FUNCTION public.seed_hc_appointments_for_all_tenants();
