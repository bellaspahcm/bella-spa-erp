-- =====================================================
-- CHECK BELLA SPA HEADQUARTER SETTINGS
-- =====================================================
-- Purpose: Show current payroll configuration for Bella Spa
-- Run this in Supabase SQL Editor to see what settings exist
-- =====================================================

-- Find Bella Spa Headquarter tenant
SELECT 
  id,
  name,
  contact_phone,
  email
FROM tenants 
WHERE name ILIKE '%bella%' 
  OR name ILIKE '%headquarter%'
LIMIT 5;

-- If you know the tenant ID, replace '<TENANT_ID>' below with actual UUID
-- Example: '123e4567-e89b-12d3-a456-426614174000'

-- =====================================================
-- CURRENT PAYROLL SETTINGS FOR BELLA SPA
-- =====================================================

SELECT 
  provider_key AS "Provider",
  CASE 
    WHEN enabled THEN '✅ BẬT'
    ELSE '⚪ TẮT'
  END AS "Trạng thái",
  strategy AS "Chiến lược",
  config AS "Cấu hình",
  notes AS "Ghi chú",
  version AS "Phiên bản",
  updated_at AS "Cập nhật lần cuối"
FROM tenant_payroll_config
WHERE tenant_id = (
  SELECT id FROM tenants 
  WHERE name ILIKE '%bella%spa%' 
    OR name = 'Bella Spa Headquarter'
  LIMIT 1
)
ORDER BY 
  CASE provider_key
    WHEN 'commission' THEN 1
    WHEN 'kpi' THEN 2
    WHEN 'attendance' THEN 3
    WHEN 'rating' THEN 4
    WHEN 'bonus' THEN 5
    ELSE 999
  END;

-- =====================================================
-- DETAILED BREAKDOWN BY PROVIDER
-- =====================================================

-- 1. COMMISSION (Hoa hồng)
SELECT 
  '🎯 HOA HỒNG' as title,
  enabled as "Đang bật?",
  strategy as "Chiến lược",
  config->>'rate' as "Hoa hồng/ca (VNĐ)",
  config->>'minSessions' as "Số ca tối thiểu"
FROM tenant_payroll_config
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)
  AND provider_key = 'commission';

-- 2. KPI (Thưởng hiệu suất)
SELECT 
  '🏆 THƯỞNG KPI' as title,
  enabled as "Đang bật?",
  strategy as "Chiến lược",
  config->>'target' as "Mục tiêu (ca)",
  config->>'bonus' as "Thưởng (VNĐ)"
FROM tenant_payroll_config
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)
  AND provider_key = 'kpi';

-- 3. ATTENDANCE (Phạt kỷ luật)
SELECT 
  '📅 PHẠT KỶ LUẬT' as title,
  enabled as "Đang bật?",
  strategy as "Chiến lược",
  config->>'latePenalty' as "Phạt đi trễ (VNĐ)",
  config->>'absentPenalty' as "Phạt vắng (VNĐ)",
  config->>'lateGracePeriod' as "Dung sai (phút)"
FROM tenant_payroll_config
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)
  AND provider_key = 'attendance';

-- 4. RATING (Thưởng chất lượng)
SELECT 
  '⭐ THƯỞNG CHẤT LƯỢNG' as title,
  enabled as "Đang bật?",
  strategy as "Chiến lược",
  config->>'minRating' as "Đánh giá tối thiểu",
  config->>'bonus' as "Thưởng (VNĐ)"
FROM tenant_payroll_config
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)
  AND provider_key = 'rating';

-- 5. BONUS (Thưởng thủ công)
SELECT 
  '💰 THƯỞNG THỦ CÔNG' as title,
  enabled as "Đang bật?",
  strategy as "Chiến lược",
  config as "Cấu hình"
FROM tenant_payroll_config
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)
  AND provider_key = 'bonus';

-- =====================================================
-- CHANGE HISTORY (Last 10 changes)
-- =====================================================

SELECT 
  provider_key AS "Provider đã sửa",
  change_type AS "Loại thay đổi",
  old_value AS "Giá trị cũ",
  new_value AS "Giá trị mới",
  changed_at AS "Thời gian",
  (SELECT email FROM auth.users WHERE id = changed_by) AS "Người sửa"
FROM tenant_payroll_config_history
WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)
ORDER BY changed_at DESC
LIMIT 10;

-- =====================================================
-- SUMMARY FOR UI DISPLAY
-- =====================================================

SELECT 
  '📊 TỔNG HỢP CẤU HÌNH LƯƠNG BELLA SPA' as summary,
  (SELECT COUNT(*) FROM tenant_payroll_config WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)) as "Tổng số provider",
  (SELECT COUNT(*) FROM tenant_payroll_config WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1) AND enabled = true) as "Đang bật",
  (SELECT COUNT(*) FROM tenant_payroll_config WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1) AND enabled = false) as "Đang tắt",
  (SELECT MAX(updated_at) FROM tenant_payroll_config WHERE tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%spa%' LIMIT 1)) as "Lần sửa gần nhất";
