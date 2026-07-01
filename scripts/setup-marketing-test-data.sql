-- Setup Test Data for Marketing Intelligence
-- 
-- Run this in Supabase SQL Editor to create test data for testing marketing APIs
-- 
-- What this script does:
-- 1. Add ads credentials to a tenant
-- 2. Create test marketing campaigns
-- 3. Insert sample external ads data
-- 4. Verify data was created

-- ============================================================================
-- STEP 1: Update tenant with ads credentials
-- ============================================================================

-- Find your tenant ID first
SELECT id, name, status FROM tenants WHERE status = 'active' LIMIT 5;

-- Replace 'YOUR_TENANT_ID' with actual tenant ID from above query
DO $$
DECLARE
    v_tenant_id UUID := 'YOUR_TENANT_ID'; -- CHANGE THIS!
BEGIN
    -- Add Facebook Ads credentials to tenant metadata
    UPDATE tenants
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{ads_credentials}',
        '{
            "facebook_access_token": "TEST_FB_TOKEN_12345",
            "facebook_ad_account_id": "act_123456789",
            "google_access_token": "TEST_GOOGLE_TOKEN_67890",
            "google_customer_id": "123-456-7890",
            "google_developer_token": "TEST_DEV_TOKEN",
            "tiktok_access_token": "TEST_TIKTOK_TOKEN",
            "tiktok_advertiser_id": "1234567890",
            "zalo_access_token": "TEST_ZALO_TOKEN",
            "zalo_oa_id": "1234567890123456"
        }'::jsonb
    )
    WHERE id = v_tenant_id;
    
    RAISE NOTICE 'Added ads credentials to tenant: %', v_tenant_id;
END $$;

-- ============================================================================
-- STEP 2: Create test marketing campaigns
-- ============================================================================

-- Create 3 test campaigns
INSERT INTO marketing_campaigns (id, tenant_id, name, description, budget, start_date, end_date, status, external_mappings)
VALUES
    -- Campaign 1: Summer Sale (Multi-platform)
    (
        gen_random_uuid(),
        'YOUR_TENANT_ID', -- CHANGE THIS!
        'Summer Sale 2026',
        'Khuyến mãi mùa hè - Giảm giá 30% toàn bộ gói dịch vụ',
        50000000, -- 50 triệu VND
        '2026-06-01',
        '2026-06-30',
        'active',
        '{
            "facebook": "campaign_fb_123456",
            "google": "campaign_google_789012"
        }'::jsonb
    ),
    
    -- Campaign 2: Mother's Day Special (Facebook only)
    (
        gen_random_uuid(),
        'YOUR_TENANT_ID', -- CHANGE THIS!
        'Ngày của Mẹ - Ưu đãi đặc biệt',
        'Combo chăm sóc Mẹ & Bé với giá ưu đãi',
        20000000, -- 20 triệu VND
        '2026-05-01',
        '2026-05-15',
        'completed',
        '{
            "facebook": "campaign_fb_mother_day_2026"
        }'::jsonb
    ),
    
    -- Campaign 3: New Year Promotion (All platforms)
    (
        gen_random_uuid(),
        'YOUR_TENANT_ID', -- CHANGE THIS!
        'Năm Mới 2026 - Khỏe Đẹp Tự Tin',
        'Gói trị liệu đặc biệt đầu năm',
        80000000, -- 80 triệu VND
        '2026-01-01',
        '2026-01-31',
        'completed',
        '{
            "facebook": "campaign_fb_newyear_2026",
            "google": "campaign_google_newyear_2026",
            "tiktok": "campaign_tiktok_newyear_2026"
        }'::jsonb
    )
ON CONFLICT DO NOTHING;

-- Get campaign IDs for next step
SELECT id, name, status FROM marketing_campaigns 
WHERE tenant_id = 'YOUR_TENANT_ID' -- CHANGE THIS!
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 3: Insert sample external ads data
-- ============================================================================

-- Insert 30 days of sample data for Summer Sale campaign
-- Replace CAMPAIGN_ID_1 with actual ID from above query

DO $$
DECLARE
    v_tenant_id UUID := 'YOUR_TENANT_ID'; -- CHANGE THIS!
    v_campaign_id UUID := 'CAMPAIGN_ID_1'; -- CHANGE THIS!
    v_date DATE;
    v_impressions INT;
    v_clicks INT;
    v_spend NUMERIC;
    v_conversions INT;
    v_revenue NUMERIC;
BEGIN
    -- Generate data for last 30 days
    FOR i IN 0..29 LOOP
        v_date := CURRENT_DATE - i;
        
        -- Random metrics (simulating Facebook Ads performance)
        v_impressions := 10000 + floor(random() * 5000)::int;
        v_clicks := floor(v_impressions * (0.02 + random() * 0.03))::int; -- CTR 2-5%
        v_spend := 500000 + floor(random() * 300000); -- 500k-800k VND per day
        v_conversions := floor(v_clicks * (0.05 + random() * 0.10))::int; -- Conversion 5-15%
        v_revenue := v_conversions * (2000000 + floor(random() * 1000000)); -- 2-3M VND per conversion
        
        -- Insert Facebook Ads data
        INSERT INTO external_ads_data (
            tenant_id,
            platform,
            date,
            external_campaign_id,
            external_ad_id,
            internal_campaign_id,
            impressions,
            clicks,
            spend,
            conversions,
            revenue,
            ctr,
            cpc,
            cpa,
            roas,
            roi,
            sync_status,
            synced_at
        ) VALUES (
            v_tenant_id,
            'facebook',
            v_date,
            'campaign_fb_123456',
            'ad_fb_' || i,
            v_campaign_id,
            v_impressions,
            v_clicks,
            v_spend,
            v_conversions,
            v_revenue,
            (v_clicks::numeric / v_impressions * 100)::numeric(5,2), -- CTR
            (v_spend / v_clicks)::numeric(10,2), -- CPC
            CASE WHEN v_conversions > 0 THEN (v_spend / v_conversions)::numeric(10,2) ELSE NULL END, -- CPA
            CASE WHEN v_spend > 0 THEN (v_revenue / v_spend)::numeric(10,2) ELSE NULL END, -- ROAS
            CASE WHEN v_spend > 0 THEN ((v_revenue - v_spend) / v_spend * 100)::numeric(10,2) ELSE NULL END, -- ROI
            'success',
            NOW()
        )
        ON CONFLICT (platform, external_campaign_id, external_ad_id, date, tenant_id) DO NOTHING;
        
    END LOOP;
    
    RAISE NOTICE 'Inserted 30 days of sample Facebook Ads data';
END $$;

-- ============================================================================
-- STEP 4: Verify test data
-- ============================================================================

-- Check tenant ads credentials
SELECT 
    id,
    name,
    metadata->'ads_credentials' as ads_credentials
FROM tenants
WHERE metadata->'ads_credentials' IS NOT NULL
LIMIT 5;

-- Check marketing campaigns
SELECT 
    id,
    name,
    status,
    budget,
    start_date,
    end_date,
    external_mappings
FROM marketing_campaigns
WHERE tenant_id = 'YOUR_TENANT_ID' -- CHANGE THIS!
ORDER BY created_at DESC;

-- Check external ads data
SELECT 
    platform,
    date,
    COUNT(*) as records,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(spend) as total_spend,
    SUM(conversions) as total_conversions,
    SUM(revenue) as total_revenue
FROM external_ads_data
WHERE tenant_id = 'YOUR_TENANT_ID' -- CHANGE THIS!
GROUP BY platform, date
ORDER BY date DESC
LIMIT 10;

-- Check campaign performance summary
SELECT 
    c.name as campaign_name,
    COUNT(DISTINCT e.date) as days_active,
    SUM(e.impressions) as total_impressions,
    SUM(e.clicks) as total_clicks,
    SUM(e.spend) as total_spend,
    SUM(e.conversions) as total_conversions,
    SUM(e.revenue) as total_revenue,
    ROUND(AVG(e.ctr), 2) as avg_ctr,
    ROUND(SUM(e.revenue) / NULLIF(SUM(e.spend), 0), 2) as roas
FROM marketing_campaigns c
LEFT JOIN external_ads_data e ON e.internal_campaign_id = c.id
WHERE c.tenant_id = 'YOUR_TENANT_ID' -- CHANGE THIS!
GROUP BY c.id, c.name
ORDER BY total_spend DESC;

-- ============================================================================
-- DONE! Now you can test the Marketing Intelligence APIs
-- ============================================================================

-- Sample API test queries (use in your browser or curl):
-- 
-- 1. Campaign Analytics:
--    GET /api/intelligence/marketing/campaign-analytics?campaignId=YOUR_CAMPAIGN_ID&period=month
--
-- 2. Channel Performance:
--    GET /api/intelligence/marketing/channel-performance?tenantId=YOUR_TENANT_ID&period=month
--
-- 3. ROI Report:
--    GET /api/intelligence/marketing/roi-report?tenantId=YOUR_TENANT_ID&period=month&groupBy=campaign
--
-- 4. Ad Spend Summary:
--    GET /api/intelligence/marketing/ad-spend-summary?tenantId=YOUR_TENANT_ID&period=month
--
-- 5. Top Performing Ads:
--    GET /api/intelligence/marketing/top-performing-ads?tenantId=YOUR_TENANT_ID&metric=roi&limit=10
