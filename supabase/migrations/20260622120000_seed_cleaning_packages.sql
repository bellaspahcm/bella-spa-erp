-- =============================================================================
-- Migration: Seed Industrial Cleaning Packages
-- Date: 2026-06-22
-- Purpose:
--   1. Create example cleaning service packages for industrial_cleaning module
--   2. Set appropriate session_multiplier for each package tier
--   3. Support future cleaning tenant demos
-- =============================================================================

-- WARNING: This seed only inserts if packages don't already exist for cleaning module
-- to prevent duplicate records when migration runs multiple times.

-- Insert Cleaning Packages (only if not exists)
INSERT INTO public.packages (
    tenant_id,
    name,
    description,
    total_sessions,
    price,
    discount_percent,
    is_active,
    module_key,
    session_multiplier,
    created_at,
    updated_at
)
SELECT
    NULL, -- tenant_id NULL means this is a template (can be cloned by tenants)
    'Vệ sinh văn phòng cơ bản',
    'Gói vệ sinh văn phòng tiêu chuẩn: quét, lau, đổ rác. Diện tích 50-100m². Phù hợp văn phòng nhỏ.',
    20, -- 20 lần vệ sinh/tháng (5 days/week x 4 weeks)
    5000000, -- 5 triệu/tháng
    0,
    true,
    'industrial_cleaning',
    1.0, -- Multiplier: 1.0 (basic difficulty)
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.packages 
    WHERE module_key = 'industrial_cleaning' AND name = 'Vệ sinh văn phòng cơ bản'
);

INSERT INTO public.packages (
    tenant_id,
    name,
    description,
    total_sessions,
    price,
    discount_percent,
    is_active,
    module_key,
    session_multiplier,
    created_at,
    updated_at
)
SELECT
    NULL,
    'Vệ sinh nhà xưởng tiêu chuẩn',
    'Gói vệ sinh nhà xưởng sản xuất: làm sạch bụi, dầu mỡ, vệ sinh máy móc. Diện tích 200-500m². Yêu cầu chuyên môn cao hơn.',
    15, -- 15 lần vệ sinh/tháng (3 days/week x 4 weeks + 3 extra)
    12000000, -- 12 triệu/tháng
    0,
    true,
    'industrial_cleaning',
    1.5, -- Multiplier: 1.5 (higher difficulty, hazardous materials)
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.packages 
    WHERE module_key = 'industrial_cleaning' AND name = 'Vệ sinh nhà xưởng tiêu chuẩn'
);

INSERT INTO public.packages (
    tenant_id,
    name,
    description,
    total_sessions,
    price,
    discount_percent,
    is_active,
    module_key,
    session_multiplier,
    created_at,
    updated_at
)
SELECT
    NULL,
    'Vệ sinh công nghiệp chuyên sâu VIP',
    'Gói vệ sinh toàn diện: phòng sạch, vệ sinh cao, khử trùng chuyên nghiệp. Diện tích >1000m². Yêu cầu thiết bị đặc biệt và nhân viên có chứng chỉ.',
    12, -- 12 lần vệ sinh/tháng (3 days/week x 4 weeks)
    25000000, -- 25 triệu/tháng
    0,
    true,
    'industrial_cleaning',
    2.0, -- Multiplier: 2.0 (highest difficulty, specialized equipment, certifications required)
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.packages 
    WHERE module_key = 'industrial_cleaning' AND name = 'Vệ sinh công nghiệp chuyên sâu VIP'
);

-- Add comment to document multiplier meaning
COMMENT ON COLUMN public.packages.session_multiplier IS 
'Session multiplier for salary calculation. Used to convert completed work sessions into equivalent base sessions for KTV commission. 
Examples:
- 1.0 = Basic package (Beauty: Tiết Kiệm, Cleaning: Văn phòng cơ bản)
- 1.5 = Medium package (Beauty: Hạnh Phúc, Cleaning: Nhà xưởng tiêu chuẩn)
- 2.0 = Premium package (Beauty: VIP, Cleaning: Công nghiệp chuyên sâu)

This is a Version 1 compatibility shim. In future versions, this will be replaced with proper WorkUnit abstraction.';

