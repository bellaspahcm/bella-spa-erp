-- ============================================================================
-- Seed: Discount Provider Sample Rules
-- ============================================================================
-- Purpose: Insert sample discount rules to test Discount Provider
-- 
-- Rules:
-- 1-3: Tier Discounts (VIP/Loyal/New)
-- 4-10: Campaign Promotions (seasonal/bundle/referral/flash/first_time)
--
-- Usage:
-- Run this script in Supabase SQL Editor to populate discount_rules and
-- discount_campaigns tables with sample data.
-- ============================================================================

-- ============================================================================
-- Get tenant_id (replace with your actual tenant)
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_admin_user_id UUID;
BEGIN
  -- Get first tenant (adjust if you have multiple tenants)
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  
  -- Get admin user for created_by field
  SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Please create a tenant first.';
  END IF;
  
  RAISE NOTICE 'Using tenant_id: %', v_tenant_id;
  RAISE NOTICE 'Using admin_user_id: %', COALESCE(v_admin_user_id::TEXT, 'NULL');
  
  -- ============================================================================
  -- TIER DISCOUNTS (3 rules)
  -- ============================================================================
  
  -- Rule 1: VIP Member Discount (15% off)
  INSERT INTO discount_rules (
    tenant_id,
    rule_name,
    rule_type,
    customer_tier,
    discount_type,
    discount_value,
    applies_to,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'VIP Member Discount',
    'tier',
    'vip',
    'percentage',
    15.00,
    ARRAY['services', 'products', 'packages'],
    90, -- High priority
    true,
    v_admin_user_id,
    jsonb_build_object(
      'description', 'VIP members get 15% off all purchases',
      'tier_level', 'premium'
    )
  );
  RAISE NOTICE '✅ Inserted: VIP Member Discount (15%% off)';
  
  -- Rule 2: Loyal Customer Discount (10% off)
  INSERT INTO discount_rules (
    tenant_id,
    rule_name,
    rule_type,
    customer_tier,
    discount_type,
    discount_value,
    applies_to,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Loyal Customer Discount',
    'tier',
    'loyal',
    'percentage',
    10.00,
    ARRAY['services', 'products', 'packages'],
    80, -- Medium-high priority
    true,
    v_admin_user_id,
    jsonb_build_object(
      'description', 'Loyal customers get 10% off all purchases',
      'tier_level', 'standard'
    )
  );
  RAISE NOTICE '✅ Inserted: Loyal Customer Discount (10%% off)';
  
  -- Rule 3: New Customer Welcome (5% off)
  INSERT INTO discount_rules (
    tenant_id,
    rule_name,
    rule_type,
    customer_tier,
    discount_type,
    discount_value,
    applies_to,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'New Customer Welcome',
    'tier',
    'new',
    'percentage',
    5.00,
    ARRAY['services', 'products', 'packages'],
    70, -- Medium priority
    true,
    v_admin_user_id,
    jsonb_build_object(
      'description', 'New customers get 5% off first 3 purchases',
      'max_uses', 3,
      'tier_level', 'entry'
    )
  );
  RAISE NOTICE '✅ Inserted: New Customer Welcome (5%% off)';
  
  -- ============================================================================
  -- CAMPAIGN PROMOTIONS (7 rules)
  -- ============================================================================
  
  -- Campaign 4: Summer Sale 2026 (20% off services)
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    start_date,
    end_date,
    min_purchase_amount,
    applies_to_services,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Summer Sale 2026',
    'SUMMER2026',
    'seasonal',
    'Giảm 20% tất cả dịch vụ spa trong mùa hè',
    'percentage',
    20.00,
    '2026-06-01 00:00:00+07'::TIMESTAMPTZ,
    '2026-08-31 23:59:59+07'::TIMESTAMPTZ,
    NULL, -- No minimum purchase
    NULL, -- All services
    false, -- Cannot stack with other discounts
    85,
    true,
    v_admin_user_id,
    jsonb_build_object(
      'season', 'summer',
      'banner_image', 'summer-sale-2026.jpg'
    )
  );
  RAISE NOTICE '✅ Inserted: Summer Sale 2026 (20%% off, Jun-Aug)';
  
  -- Campaign 5: Buy 3 Massage Get 1 Free
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    bundle_config,
    start_date,
    end_date,
    applies_to_services,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Buy 3 Massage Get 1 Free',
    'MASSAGE3FOR2',
    'bundle',
    'Mua 3 buổi massage, tặng 1 buổi miễn phí',
    'bundle',
    NULL,
    jsonb_build_object(
      'buy_quantity', 3,
      'get_quantity', 1,
      'service_type', 'massage',
      'discount_percent', 25
    ),
    NOW(),
    NOW() + INTERVAL '90 days',
    NULL, -- Filter by service_type in bundle_config
    false,
    80,
    true,
    v_admin_user_id,
    jsonb_build_object(
      'promotion_type', 'bundle',
      'service_category', 'massage'
    )
  );
  RAISE NOTICE '✅ Inserted: Buy 3 Massage Get 1 Free';
  
  -- Campaign 6: Referral Bonus (50k VND off)
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    start_date,
    end_date,
    max_uses_per_customer,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Referral Bonus',
    'REFER50K',
    'referral',
    'Giới thiệu bạn bè - cả 2 nhận 50k VNĐ',
    'fixed_amount',
    50000.00,
    NOW(),
    NOW() + INTERVAL '365 days',
    5, -- Max 5 referrals per customer
    true, -- Can stack with tier discounts
    75,
    true,
    v_admin_user_id,
    jsonb_build_object(
      'referrer_bonus', 50000,
      'referee_bonus', 50000,
      'referral_program', true
    )
  );
  RAISE NOTICE '✅ Inserted: Referral Bonus (50k VND)';
  
  -- Campaign 7: Weekday Flash Sale (30% off Mon-Fri 9am-3pm)
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    start_date,
    end_date,
    time_restrictions,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Weekday Flash Sale',
    'WEEKDAY30',
    'flash',
    'Giảm 30% vào các ngày trong tuần (9h-15h)',
    'percentage',
    30.00,
    NOW(),
    NOW() + INTERVAL '60 days',
    jsonb_build_object(
      'days', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      'start_time', '09:00',
      'end_time', '15:00'
    ),
    false,
    70,
    true,
    v_admin_user_id,
    jsonb_build_object(
      'flash_sale', true,
      'peak_hours_discount', false
    )
  );
  RAISE NOTICE '✅ Inserted: Weekday Flash Sale (30%% off Mon-Fri 9am-3pm)';
  
  -- Campaign 8: First-Time Booking Bonus (100k VND off)
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    start_date,
    end_date,
    min_purchase_amount,
    max_uses_per_customer,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'First-Time Booking Bonus',
    'FIRST100K',
    'first_time',
    'Giảm 100k cho lần đặt lịch đầu tiên (đơn tối thiểu 500k)',
    'fixed_amount',
    100000.00,
    NOW(),
    NOW() + INTERVAL '365 days',
    500000.00, -- Min 500k VND order
    1, -- Only first booking
    true, -- Can stack with tier discounts
    95, -- Very high priority
    true,
    v_admin_user_id,
    jsonb_build_object(
      'first_time_customer', true,
      'welcome_bonus', true
    )
  );
  RAISE NOTICE '✅ Inserted: First-Time Booking Bonus (100k off, min 500k)';
  
  -- Campaign 9: Weekend Warrior (15% off Sat-Sun)
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    start_date,
    end_date,
    time_restrictions,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Weekend Warrior',
    'WEEKEND15',
    'seasonal',
    'Giảm 15% vào cuối tuần (Thứ 7 & Chủ nhật)',
    'percentage',
    15.00,
    NOW(),
    NOW() + INTERVAL '180 days',
    jsonb_build_object(
      'days', ARRAY['saturday', 'sunday']
    ),
    false,
    65,
    true,
    v_admin_user_id,
    jsonb_build_object(
      'weekend_promotion', true
    )
  );
  RAISE NOTICE '✅ Inserted: Weekend Warrior (15%% off Sat-Sun)';
  
  -- Campaign 10: Product Bundle - Buy 2 Get 20% Off
  INSERT INTO discount_campaigns (
    tenant_id,
    campaign_name,
    campaign_code,
    campaign_type,
    description,
    discount_type,
    discount_value,
    bundle_config,
    start_date,
    end_date,
    stacking_allowed,
    priority,
    is_active,
    created_by,
    metadata
  ) VALUES (
    v_tenant_id,
    'Product Bundle: Buy 2 Get 20% Off',
    'PRODUCT2X20',
    'bundle',
    'Mua từ 2 sản phẩm trở lên, giảm 20%',
    'percentage',
    20.00,
    jsonb_build_object(
      'min_quantity', 2,
      'applies_to', 'products'
    ),
    NOW(),
    NOW() + INTERVAL '120 days',
    true, -- Can stack with tier discounts
    60,
    true,
    v_admin_user_id,
    jsonb_build_object(
      'product_promotion', true,
      'bundle_discount', true
    )
  );
  RAISE NOTICE '✅ Inserted: Product Bundle Buy 2 Get 20%% Off';
  
  -- ============================================================================
  -- Summary
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Seeded 10 Discount Rules Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tier Discounts (3):';
  RAISE NOTICE '  1. VIP Member: 15%% off';
  RAISE NOTICE '  2. Loyal Customer: 10%% off';
  RAISE NOTICE '  3. New Customer: 5%% off (first 3 purchases)';
  RAISE NOTICE '';
  RAISE NOTICE 'Campaign Promotions (7):';
  RAISE NOTICE '  4. Summer Sale 2026: 20%% off (Jun-Aug)';
  RAISE NOTICE '  5. Buy 3 Massage Get 1 Free';
  RAISE NOTICE '  6. Referral Bonus: 50k VND';
  RAISE NOTICE '  7. Weekday Flash: 30%% off Mon-Fri 9am-3pm';
  RAISE NOTICE '  8. First-Time Bonus: 100k off (min 500k)';
  RAISE NOTICE '  9. Weekend Warrior: 15%% off Sat-Sun';
  RAISE NOTICE ' 10. Product Bundle: 20%% off (buy 2+)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  - Integrate Discount Provider into checkout flow';
  RAISE NOTICE '  - Test discount calculation with sample orders';
  RAISE NOTICE '  - Verify metrics emission to decision_engine_metrics';
  RAISE NOTICE '';
  
END $$;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check inserted tier discount rules
SELECT
  rule_name,
  customer_tier,
  discount_type,
  discount_value,
  priority,
  is_active
FROM discount_rules
ORDER BY priority DESC;

-- Check inserted campaigns
SELECT
  campaign_name,
  campaign_code,
  campaign_type,
  discount_type,
  discount_value,
  start_date::DATE,
  end_date::DATE,
  is_active
FROM discount_campaigns
ORDER BY priority DESC;

-- Count totals
SELECT
  'Total Tier Discounts' AS category,
  COUNT(*) AS count
FROM discount_rules
UNION ALL
SELECT
  'Total Campaigns' AS category,
  COUNT(*) AS count
FROM discount_campaigns;
