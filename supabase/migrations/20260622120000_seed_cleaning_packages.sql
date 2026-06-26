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
-- Package 1: Office Basic
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
    complexity,
    estimated_duration,
    required_workers,
    recommended_area_min,
    recommended_area_max,
    created_at,
    updated_at
)
SELECT
    NULL, -- tenant_id NULL means this is a template (can be cloned by tenants)
    'Office Basic',
    'Gói vệ sinh văn phòng tiêu chuẩn: quét, lau, đổ rác, vệ sinh toilet. Phù hợp văn phòng nhỏ và startup.',
    20, -- 20 lần vệ sinh/tháng (5 days/week x 4 weeks)
    5000000, -- 5 triệu/tháng
    0,
    true,
    'industrial_cleaning',
    1.0, -- Multiplier: 1.0 = ~4 hours work, 1 worker, LOW complexity
    'LOW',
    240, -- 4 hours per session
    1, -- 1 worker
    50, -- Recommended for 50m² minimum
    100, -- Recommended for 100m² maximum
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.packages 
    WHERE module_key = 'industrial_cleaning' AND name = 'Office Basic'
);

-- Package 2: Factory Standard
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
    complexity,
    estimated_duration,
    required_workers,
    recommended_area_min,
    recommended_area_max,
    created_at,
    updated_at
)
SELECT
    NULL,
    'Factory Standard',
    'Gói vệ sinh nhà xưởng sản xuất: làm sạch bụi, dầu mỡ, vệ sinh máy móc. Yêu cầu kỹ năng chuyên môn và thiết bị chuyên dụng.',
    15, -- 15 lần vệ sinh/tháng (3 days/week x 4 weeks + 3 extra)
    12000000, -- 12 triệu/tháng
    0,
    true,
    'industrial_cleaning',
    1.5, -- Multiplier: 1.5 = ~6 hours work OR 1.5x difficulty (hazardous materials)
    'MEDIUM',
    360, -- 6 hours per session
    2, -- 2 workers (team work required)
    200, -- Recommended for 200m² minimum
    500, -- Recommended for 500m² maximum
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.packages 
    WHERE module_key = 'industrial_cleaning' AND name = 'Factory Standard'
);

-- Package 3: Industrial Premium
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
    complexity,
    estimated_duration,
    required_workers,
    recommended_area_min,
    recommended_area_max,
    created_at,
    updated_at
)
SELECT
    NULL,
    'Industrial Premium',
    'Gói vệ sinh công nghiệp toàn diện: phòng sạch, vệ sinh cao, khử trùng chuyên nghiệp. Yêu cầu thiết bị đặc biệt và nhân viên có chứng chỉ.',
    12, -- 12 lần vệ sinh/tháng (3 days/week x 4 weeks)
    25000000, -- 25 triệu/tháng
    0,
    true,
    'industrial_cleaning',
    2.0, -- Multiplier: 2.0 = ~8 hours work OR 2 workers OR HIGH complexity (certifications required)
    'HIGH',
    480, -- 8 hours per session
    3, -- 3 workers (large crew with specialized roles)
    1000, -- Recommended for 1000m² minimum
    NULL, -- No upper limit (can scale to very large facilities)
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.packages 
    WHERE module_key = 'industrial_cleaning' AND name = 'Industrial Premium'
);

-- Add comment to document multiplier meaning and relationship with metadata
COMMENT ON COLUMN public.packages.session_multiplier IS 
'Session multiplier for salary calculation. Represents workload/difficulty factor for KTV commission.

Calculation guideline:
  multiplier ≈ (estimated_duration / 240) * required_workers * complexity_factor
  where:
    - base_duration = 240 minutes (4 hours)
    - complexity_factor: LOW=1.0, MEDIUM=1.25, HIGH=1.5

Examples:
- 1.0 = Basic workload (4h, 1 worker, LOW complexity)
  Beauty: Tiết Kiệm package
  Cleaning: Office Basic (4h, 1 worker, 50-100m²)

- 1.5 = Medium workload (6h OR 1.5x difficulty)
  Beauty: Hạnh Phúc package  
  Cleaning: Factory Standard (6h, 2 workers, hazardous materials)

- 2.0 = High workload (8h OR 2 workers OR HIGH complexity)
  Beauty: VIP package
  Cleaning: Industrial Premium (8h, 3 workers, certifications required)

Why VIP Premium costs 5x but multiplier is only 2x?
- Price = customer value (service quality, materials, brand, market positioning)
- Multiplier = worker effort (time, physical demand, skill level)
- These are independent: a 4-hour luxury spa session may cost 10M but still count as 1x multiplier for KTV

This is a Version 1 compatibility shim. In future versions, this will be replaced with proper WorkUnit abstraction.';


