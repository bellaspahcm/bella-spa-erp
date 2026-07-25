# Intelligence Layer Phase 3: Marketing Intelligence - Task Summary

**Report Date**: 2026-06-22  
**Phase**: Phase 3 - Marketing Intelligence (Week 11-14)  
**Progress**: 0/10 tasks completed (0%)  
**Status**: 🚀 PLANNING COMPLETE - READY TO START

---

## 🎉 PHASE 3 PROGRESS SUMMARY

### 📊 Progress Overview

```
Task #1: Database Schema (external_ads_data, campaigns)        [ ] 0%
Task #2: Marketing Intelligence Queries Module                 [ ] 0%
Task #3: Facebook Ads Connector                                [ ] 0%
Task #4: Google Ads Connector                                  [ ] 0%
Task #5: TikTok Ads Connector                                  [ ] 0%
Task #6: Zalo OA Connector                                     [ ] 0%
Task #7: MarketingIntelligenceService Class                    [ ] 0%
Task #8: API Routes for Marketing Intelligence                 [ ] 0%
Task #9: Daily Sync Jobs (Scheduled)                           [ ] 0%
Task #10: Marketing Dashboard UI + CMO Integration             [ ] 0%

TOTAL: 0/10 tasks complete (0%)
```

### 📊 Metrics

- **Total Lines of Code (Estimated)**: ~6500 lines
  - SQL: 500 lines
  - TypeScript Backend: 2500 lines (connectors: 1600, service: 500, queries: 400)
  - TypeScript UI: 1200 lines
  - Tests: 1000 lines
  - Docs: 1300 lines
- **Files to Create**: ~30 files
- **External APIs**: 4 (Facebook, Google, TikTok, Zalo)
- **API Endpoints**: 5 (campaign analytics, ROI report, channel performance, sync trigger, ad spend summary)

---

## 📊 OVERVIEW

Phase 3 delivers **Marketing Intelligence Layer** with external ad platform integrations for data-driven marketing decisions:

### Key Features
- ✨ **4 External Ad Connectors**: Facebook, Google, TikTok, Zalo
- ✨ **Unified Marketing Metrics**: Impressions, clicks, spend, conversions, ROI across platforms
- ✨ **Campaign Performance Tracking**: Multi-platform campaign analytics with cost attribution
- ✨ **ROI Analysis**: Revenue attribution, ROAS (Return on Ad Spend), CAC (Customer Acquisition Cost)
- ✨ **Daily Auto-Sync**: Scheduled jobs pull latest ad data at 3:00 AM
- ✨ **CMO Agent Integration**: AI-powered insights for marketing strategy

### Architecture Principles
- **Read-Write Operations** (unlike Phase 1/2 read-only)
- **External API Integration** (OAuth, rate limiting, error handling)
- **Data Synchronization** (daily sync with conflict resolution)
- **Multi-Platform Normalization** (unified schema across platforms)
- **Cache Strategy**: 1-hour TTL (fresher data than operational metrics)


---

## 🎯 PHASE 3 OBJECTIVES

### Focus Areas

1. **Multi-Platform Ad Data Aggregation**
   - Connect to Facebook Ads API (Graph API v20.0)
   - Connect to Google Ads API (v17)
   - Connect to TikTok Ads API (v1.3)
   - Connect to Zalo OA API (Official Account API)
   - Normalize data across platforms into unified schema

2. **Campaign Performance Analytics**
   - Impressions, clicks, CTR by campaign/ad set/ad
   - Spend tracking with daily granularity
   - Conversion tracking (attributed to ad campaigns)
   - ROI calculation (revenue - spend) / spend × 100%
   - ROAS calculation (revenue / spend)

3. **Attribution & Revenue Mapping**
   - Map external campaign IDs to internal campaigns
   - Track customer acquisition source (which ad brought customer)
   - Calculate CAC (Customer Acquisition Cost)
   - Calculate LTV:CAC ratio

4. **Scheduled Data Synchronization**
   - Daily sync at 3:00 AM (low-traffic hours)
   - Pull last 7 days of data (to handle delayed conversions)
   - Conflict resolution (update if exists, insert if new)
   - Error handling & retry logic

5. **CMO Agent Integration**
   - Provide marketing insights API for CMO agent
   - Suggest budget allocation across channels
   - Identify underperforming campaigns
   - Recommend optimization actions

---

## 📋 TASK BREAKDOWN (10 Tasks)

### Task #1: Database Schema & Materialized Views ⏳
**Estimated Effort**: 10-12 hours  
**Priority**: HIGH (blocks other tasks)  
**Dependencies**: None

**Deliverables**:

1. **Table: external_ads_data**
```sql
CREATE TABLE external_ads_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Platform info
  platform VARCHAR(50) NOT NULL, -- 'facebook', 'google', 'tiktok', 'zalo'
  external_campaign_id VARCHAR(255) NOT NULL,
  external_adset_id VARCHAR(255),
  external_ad_id VARCHAR(255),
  
  -- Internal mapping
  internal_campaign_id UUID REFERENCES marketing_campaigns(id),
  
  -- Date
  date DATE NOT NULL,
  
  -- Metrics
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend NUMERIC(12, 2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC(12, 2) DEFAULT 0,
  
  -- Calculated metrics
  ctr NUMERIC(5, 2), -- Click-through rate (clicks / impressions × 100)
  cpc NUMERIC(10, 2), -- Cost per click (spend / clicks)
  cpa NUMERIC(10, 2), -- Cost per acquisition (spend / conversions)
  roas NUMERIC(10, 2), -- Return on ad spend (revenue / spend)
  roi NUMERIC(10, 2), -- Return on investment ((revenue - spend) / spend × 100)
  
  -- Raw data
  raw_data JSONB,
  
  -- Sync metadata
  synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'success', -- 'success', 'error', 'partial'
  sync_error TEXT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE (platform, external_campaign_id, external_adset_id, external_ad_id, date, tenant_id)
);

-- Indexes
CREATE INDEX idx_external_ads_data_tenant ON external_ads_data(tenant_id);
CREATE INDEX idx_external_ads_data_platform ON external_ads_data(platform, tenant_id);
CREATE INDEX idx_external_ads_data_date ON external_ads_data(date DESC, tenant_id);
CREATE INDEX idx_external_ads_data_campaign ON external_ads_data(internal_campaign_id, tenant_id);
CREATE INDEX idx_external_ads_data_sync ON external_ads_data(synced_at DESC, tenant_id);
```

2. **Table: marketing_campaigns** (if not exists)
```sql
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  budget NUMERIC(12, 2),
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'completed'
  
  -- External platform mappings (JSONB array)
  external_mappings JSONB, -- [{ platform: 'facebook', campaign_id: '123' }, ...]
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

3. **Materialized View: mv_campaign_performance**
```sql
CREATE MATERIALIZED VIEW mv_campaign_performance AS
SELECT
  mc.id AS campaign_id,
  mc.tenant_id,
  mc.name AS campaign_name,
  mc.budget,
  mc.start_date,
  mc.end_date,
  mc.status,
  
  -- Aggregated metrics (all platforms)
  SUM(ead.impressions) AS total_impressions,
  SUM(ead.clicks) AS total_clicks,
  SUM(ead.spend) AS total_spend,
  SUM(ead.conversions) AS total_conversions,
  SUM(ead.revenue) AS total_revenue,
  
  -- Calculated metrics
  ROUND((SUM(ead.clicks)::NUMERIC / NULLIF(SUM(ead.impressions), 0)) * 100, 2) AS avg_ctr,
  ROUND(SUM(ead.spend) / NULLIF(SUM(ead.clicks), 0), 2) AS avg_cpc,
  ROUND(SUM(ead.spend) / NULLIF(SUM(ead.conversions), 0), 2) AS avg_cpa,
  ROUND(SUM(ead.revenue) / NULLIF(SUM(ead.spend), 0), 2) AS avg_roas,
  ROUND(((SUM(ead.revenue) - SUM(ead.spend)) / NULLIF(SUM(ead.spend), 0)) * 100, 2) AS roi_pct,
  
  -- Platform breakdown
  COUNT(DISTINCT ead.platform) AS platforms_count,
  JSONB_AGG(DISTINCT ead.platform) AS platforms_list,
  
  -- Date range
  MIN(ead.date) AS first_ad_date,
  MAX(ead.date) AS last_ad_date,
  
  -- Metadata
  NOW() AS computed_at
FROM marketing_campaigns mc
LEFT JOIN external_ads_data ead ON ead.internal_campaign_id = mc.id
WHERE mc.tenant_id IS NOT NULL
GROUP BY mc.id, mc.tenant_id, mc.name, mc.budget, mc.start_date, mc.end_date, mc.status
WITH DATA;

-- Indexes
CREATE UNIQUE INDEX idx_mv_campaign_performance_pk ON mv_campaign_performance(campaign_id, tenant_id);
CREATE INDEX idx_mv_campaign_performance_tenant ON mv_campaign_performance(tenant_id);
CREATE INDEX idx_mv_campaign_performance_roi ON mv_campaign_performance(roi_pct DESC, tenant_id);
CREATE INDEX idx_mv_campaign_performance_spend ON mv_campaign_performance(total_spend DESC, tenant_id);

-- Refresh every 1 hour
SELECT cron.schedule(
  'refresh_mv_campaign_performance',
  '0 * * * *', -- Every hour at minute 0
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance'
);
```

4. **Materialized View: mv_channel_performance** (platform-level aggregation)
```sql
CREATE MATERIALIZED VIEW mv_channel_performance AS
SELECT
  ead.tenant_id,
  ead.platform,
  DATE_TRUNC('month', ead.date) AS month,
  
  -- Metrics
  SUM(ead.impressions) AS total_impressions,
  SUM(ead.clicks) AS total_clicks,
  SUM(ead.spend) AS total_spend,
  SUM(ead.conversions) AS total_conversions,
  SUM(ead.revenue) AS total_revenue,
  
  -- Calculated
  ROUND((SUM(ead.clicks)::NUMERIC / NULLIF(SUM(ead.impressions), 0)) * 100, 2) AS avg_ctr,
  ROUND(SUM(ead.spend) / NULLIF(SUM(ead.clicks), 0), 2) AS avg_cpc,
  ROUND(SUM(ead.spend) / NULLIF(SUM(ead.conversions), 0), 2) AS avg_cpa,
  ROUND(SUM(ead.revenue) / NULLIF(SUM(ead.spend), 0), 2) AS avg_roas,
  ROUND(((SUM(ead.revenue) - SUM(ead.spend)) / NULLIF(SUM(ead.spend), 0)) * 100, 2) AS roi_pct,
  
  NOW() AS computed_at
FROM external_ads_data ead
WHERE ead.sync_status = 'success'
GROUP BY ead.tenant_id, ead.platform, DATE_TRUNC('month', ead.date)
WITH DATA;

-- Indexes
CREATE UNIQUE INDEX idx_mv_channel_performance_pk ON mv_channel_performance(tenant_id, platform, month);
CREATE INDEX idx_mv_channel_performance_month ON mv_channel_performance(month DESC, tenant_id);

-- Refresh every 1 hour
SELECT cron.schedule(
  'refresh_mv_channel_performance',
  '5 * * * *', -- Every hour at minute 5
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_performance'
);
```

**Files to Create**:
- `supabase/migrations/20260622200000_create_external_ads_data.sql`
- `supabase/migrations/20260622201000_create_marketing_campaigns.sql`
- `supabase/migrations/20260622202000_create_mv_campaign_performance.sql`
- `supabase/migrations/20260622203000_create_mv_channel_performance.sql`
- `supabase/migrations/20260622204000_create_mv_marketing_refresh_jobs.sql`

**Acceptance Criteria**:
- ✅ All tables created with indexes
- ✅ Materialized views created with CONCURRENTLY refresh
- ✅ pg_cron jobs scheduled (1-hour refresh interval)
- ✅ RLS policies applied (tenant isolation)
- ✅ Manual refresh tested


---

### Task #2: Marketing Intelligence Queries Module ⏳
**Estimated Effort**: 8-10 hours  
**Priority**: HIGH  
**Dependencies**: Task #1

**File**: `src/services/intelligence/marketing/queries.ts` (~400 lines)

**Implement 5 Query Builders**:

1. **`getCampaignAnalytics(campaignId, dateRange)`**
   - Query `mv_campaign_performance` + `external_ads_data` for detailed metrics
   - Return: Campaign overview, daily breakdown, platform breakdown
   - Filter by date range

2. **`getChannelPerformance(tenantId, dateRange)`**
   - Query `mv_channel_performance` for platform comparison
   - Return: Metrics by platform (Facebook, Google, TikTok, Zalo)
   - Include month-over-month trends

3. **`getROIReport(tenantId, dateRange, groupBy = 'campaign')`**
   - Query aggregated ROI metrics
   - Support grouping: campaign / platform / month
   - Return: ROI%, ROAS, total spend, total revenue

4. **`getAdSpendSummary(tenantId, dateRange)`**
   - Query total ad spend across all platforms
   - Return: Daily spend, budget vs actual, spend by platform

5. **`getTopPerformingAds(tenantId, metric = 'roi', limit = 10)`**
   - Query top ads ranked by metric (ROI / ROAS / CTR / conversions)
   - Return: Top N ads with key metrics

**Type Definitions**:
```typescript
export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  platform: string[];
  dateRange: { start: string; end: string };
  
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  
  avgCTR: number; // %
  avgCPC: number; // VND
  avgCPA: number; // VND
  avgROAS: number; // ratio
  roiPct: number; // %
  
  dailyBreakdown: DailyMetrics[];
  platformBreakdown: PlatformMetrics[];
}

export interface ChannelPerformance {
  platform: string;
  month: string;
  
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  
  avgCTR: number;
  avgCPC: number;
  avgCPA: number;
  avgROAS: number;
  roiPct: number;
  
  shareOfSpend: number; // % of total spend
  shareOfRevenue: number; // % of total revenue
}

export interface ROIReport {
  groupBy: 'campaign' | 'platform' | 'month';
  dateRange: { start: string; end: string };
  items: ROIReportItem[];
  summary: {
    totalSpend: number;
    totalRevenue: number;
    totalROI: number;
    avgROAS: number;
  };
}

export interface AdSpendSummary {
  dateRange: { start: string; end: string };
  totalSpend: number;
  totalBudget: number;
  budgetUtilization: number; // %
  
  dailySpend: { date: string; spend: number }[];
  spendByPlatform: { platform: string; spend: number; share: number }[];
}
```

**Data Sources**:
- `mv_campaign_performance`
- `mv_channel_performance`
- `external_ads_data`
- `marketing_campaigns`

**Acceptance Criteria**:
- ✅ All 5 query builders implemented
- ✅ TypeScript types defined
- ✅ Tenant isolation (`tenant_id` filter)
- ✅ Date range filtering
- ✅ Error handling with QueryError
- ✅ camelCase mapping from database snake_case


---

### Task #3: Facebook Ads Connector ⏳
**Estimated Effort**: 5-6 hours  
**Priority**: HIGH  
**Dependencies**: Task #1

**File**: `src/services/intelligence/marketing/connectors/facebook-ads.ts` (~400 lines)

**Facebook Graph API Integration**:
- **API Version**: v20.0
- **Authentication**: OAuth 2.0 Access Token (stored in `tenant.metadata.facebook_ads_token`)
- **Rate Limits**: 200 calls per hour per user
- **Endpoint**: `https://graph.facebook.com/v20.0/act_{ad_account_id}/insights`

**Implementation**:
```typescript
export class FacebookAdsConnector {
  private accessToken: string;
  private adAccountId: string;
  private baseURL = 'https://graph.facebook.com/v20.0';

  constructor(accessToken: string, adAccountId: string) {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
  }

  /**
   * Fetch ad insights for date range
   */
  async fetchInsights(params: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    level: 'campaign' | 'adset' | 'ad';
  }): Promise<FacebookAdInsight[]> {
    // GET /act_{ad_account_id}/insights
    // Query params:
    // - time_range: { since: startDate, until: endDate }
    // - level: campaign/adset/ad
    // - fields: impressions,clicks,spend,actions,action_values
    // - limit: 100
    // - access_token: {token}
    
    const url = `${this.baseURL}/act_${this.adAccountId}/insights`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // ... query params
    });
    
    // Handle pagination (next/previous cursors)
    // Parse response
    // Map to internal format
    return insights;
  }

  /**
   * Map Facebook API response to internal format
   */
  private mapToInternalFormat(fbData: any): ExternalAdsData {
    return {
      platform: 'facebook',
      external_campaign_id: fbData.campaign_id,
      external_adset_id: fbData.adset_id,
      external_ad_id: fbData.ad_id,
      date: fbData.date_start,
      
      impressions: parseInt(fbData.impressions || '0'),
      clicks: parseInt(fbData.clicks || '0'),
      spend: parseFloat(fbData.spend || '0'),
      conversions: this.extractConversions(fbData.actions),
      revenue: this.extractRevenue(fbData.action_values),
      
      raw_data: fbData, // Store original response for debugging
    };
  }

  /**
   * Extract conversion count from actions array
   */
  private extractConversions(actions: any[]): number {
    // Facebook returns actions as array: [{ action_type: 'purchase', value: '5' }, ...]
    const purchaseAction = actions?.find(a => a.action_type === 'purchase');
    return parseInt(purchaseAction?.value || '0');
  }

  /**
   * Extract revenue from action_values array
   */
  private extractRevenue(actionValues: any[]): number {
    const purchaseValue = actionValues?.find(a => a.action_type === 'purchase');
    return parseFloat(purchaseValue?.value || '0');
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseURL}/act_${this.adAccountId}?fields=id,name&access_token=${this.accessToken}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

**Error Handling**:
- Token expired → Return specific error code
- Rate limit exceeded → Exponential backoff retry (3 attempts)
- Network error → Retry with timeout
- Invalid account ID → Return validation error

**Acceptance Criteria**:
- ✅ Fetch insights for campaign/adset/ad levels
- ✅ Handle pagination (cursor-based)
- ✅ Map Facebook response to internal format
- ✅ Extract conversions and revenue correctly
- ✅ Rate limiting with exponential backoff
- ✅ Error handling (token, rate limit, network)
- ✅ Connection test method
- ✅ Unit tests (mocked API responses)


---

### Task #4: Google Ads Connector ⏳
**Estimated Effort**: 5-6 hours  
**Priority**: HIGH  
**Dependencies**: Task #1

**File**: `src/services/intelligence/marketing/connectors/google-ads.ts` (~400 lines)

**Google Ads API Integration**:
- **API Version**: v17
- **Authentication**: OAuth 2.0 + Developer Token
- **Rate Limits**: 15,000 operations per day
- **Endpoint**: `https://googleads.googleapis.com/v17/customers/{customer_id}/googleAds:search`

**Implementation** (similar structure to Facebook):
```typescript
export class GoogleAdsConnector {
  private accessToken: string;
  private developerToken: string;
  private customerId: string;
  private baseURL = 'https://googleads.googleapis.com/v17';

  /**
   * Fetch ad performance report
   */
  async fetchReport(params: {
    startDate: string;
    endDate: string;
    level: 'campaign' | 'adgroup' | 'ad';
  }): Promise<GoogleAdMetrics[]> {
    // Use Google Ads Query Language (GAQL)
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date >= '${params.startDate}'
        AND segments.date <= '${params.endDate}'
    `;
    
    const url = `${this.baseURL}/customers/${this.customerId}/googleAds:search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'developer-token': this.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    // Parse and map to internal format
    return metrics;
  }

  /**
   * Map Google Ads API response to internal format
   */
  private mapToInternalFormat(googleData: any): ExternalAdsData {
    return {
      platform: 'google',
      external_campaign_id: googleData.campaign.id,
      date: googleData.segments.date,
      
      impressions: parseInt(googleData.metrics.impressions || '0'),
      clicks: parseInt(googleData.metrics.clicks || '0'),
      spend: parseInt(googleData.metrics.cost_micros || '0') / 1_000_000, // Micros to currency
      conversions: parseFloat(googleData.metrics.conversions || '0'),
      revenue: parseFloat(googleData.metrics.conversions_value || '0'),
      
      raw_data: googleData,
    };
  }
}
```

**Google Ads Specifics**:
- Cost is in micros (1/1,000,000 of currency unit) → Divide by 1M
- Query Language (GAQL) instead of REST endpoints
- Developer token required (in addition to OAuth)
- Customer ID format: `123-456-7890` (no dashes in API calls)

**Acceptance Criteria**:
- ✅ Fetch reports using GAQL
- ✅ Handle cost_micros conversion
- ✅ Map response to internal format
- ✅ Support campaign/adgroup/ad levels
- ✅ Error handling
- ✅ Connection test
- ✅ Unit tests


---

### Task #5: TikTok Ads Connector ⏳
**Estimated Effort**: 4-5 hours  
**Priority**: MEDIUM  
**Dependencies**: Task #1

**File**: `src/services/intelligence/marketing/connectors/tiktok-ads.ts` (~350 lines)

**TikTok Marketing API Integration**:
- **API Version**: v1.3
- **Authentication**: Access Token (OAuth 2.0)
- **Rate Limits**: 1,000 calls per hour
- **Endpoint**: `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`

**Implementation**:
```typescript
export class TikTokAdsConnector {
  private accessToken: string;
  private advertiserId: string;
  private baseURL = 'https://business-api.tiktok.com/open_api/v1.3';

  /**
   * Fetch ad report
   */
  async fetchReport(params: {
    startDate: string; // YYYY-MM-DD
    endDate: string;
    level: 'campaign' | 'adgroup' | 'ad';
  }): Promise<TikTokAdMetrics[]> {
    const url = `${this.baseURL}/report/integrated/get/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      // Query params: advertiser_id, report_type, dimensions, metrics, start_date, end_date
    });
    
    return metrics;
  }

  /**
   * Map TikTok API response to internal format
   */
  private mapToInternalFormat(tiktokData: any): ExternalAdsData {
    return {
      platform: 'tiktok',
      external_campaign_id: tiktokData.dimensions.campaign_id,
      date: tiktokData.dimensions.stat_time_day,
      
      impressions: parseInt(tiktokData.metrics.impressions || '0'),
      clicks: parseInt(tiktokData.metrics.clicks || '0'),
      spend: parseFloat(tiktokData.metrics.spend || '0'),
      conversions: parseInt(tiktokData.metrics.conversions || '0'),
      revenue: parseFloat(tiktokData.metrics.value || '0'),
      
      raw_data: tiktokData,
    };
  }
}
```

**TikTok Ads Specifics**:
- Report type: `BASIC` (campaign-level), `AUDIENCE` (demographic)
- Dimensions: `campaign_id`, `adgroup_id`, `ad_id`, `stat_time_day`
- Metrics: `impressions`, `clicks`, `spend`, `conversions`, `value`

**Acceptance Criteria**:
- ✅ Fetch integrated report
- ✅ Support campaign/adgroup/ad levels
- ✅ Map response to internal format
- ✅ Error handling
- ✅ Connection test
- ✅ Unit tests

---

### Task #6: Zalo OA Connector ⏳
**Estimated Effort**: 4-5 hours  
**Priority**: MEDIUM  
**Dependencies**: Task #1

**File**: `src/services/intelligence/marketing/connectors/zalo-oa.ts` (~350 lines)

**Zalo Official Account API Integration**:
- **API Version**: v2.0
- **Authentication**: Access Token + App ID
- **Rate Limits**: 500 calls per hour
- **Endpoint**: `https://openapi.zalo.me/v2.0/oa/message/stats`

**Implementation**:
```typescript
export class ZaloOAConnector {
  private accessToken: string;
  private oaId: string; // Official Account ID
  private baseURL = 'https://openapi.zalo.me/v2.0/oa';

  /**
   * Fetch message stats (broadcast campaigns)
   */
  async fetchMessageStats(params: {
    startDate: string;
    endDate: string;
  }): Promise<ZaloMessageStats[]> {
    const url = `${this.baseURL}/message/stats`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'access_token': this.accessToken,
        'Content-Type': 'application/json',
      },
      // Query params: offset, count, date_from, date_to
    });
    
    return stats;
  }

  /**
   * Map Zalo OA API response to internal format
   */
  private mapToInternalFormat(zaloData: any): ExternalAdsData {
    return {
      platform: 'zalo',
      external_campaign_id: zaloData.msg_id,
      date: zaloData.sent_time.split('T')[0], // ISO to YYYY-MM-DD
      
      impressions: parseInt(zaloData.sent_count || '0'),
      clicks: parseInt(zaloData.click_count || '0'),
      spend: 0, // Zalo OA broadcast is free
      conversions: parseInt(zaloData.conversion_count || '0'),
      revenue: 0, // No direct revenue tracking in Zalo OA
      
      raw_data: zaloData,
    };
  }
}
```

**Zalo OA Specifics**:
- Free broadcast messages (no ad spend)
- Message stats: `sent_count`, `click_count`, `conversion_count`
- Conversion tracking requires SDK integration in landing pages

**Acceptance Criteria**:
- ✅ Fetch message stats
- ✅ Handle free broadcast (spend = 0)
- ✅ Map response to internal format
- ✅ Error handling
- ✅ Connection test
- ✅ Unit tests


---

### Task #7: MarketingIntelligenceService Class ⏳
**Estimated Effort**: 6-8 hours  
**Priority**: HIGH  
**Dependencies**: Tasks 2, 3, 4, 5, 6

**File**: `src/services/intelligence/marketing/service.ts` (~500 lines)

**Implementation**:
```typescript
export class MarketingIntelligenceService implements IntelligenceService {
  readonly moduleName = 'marketing';
  private cache: CacheService;

  // ─── Public API - Campaign Analytics ────────────────────────
  
  async getCampaignAnalytics(
    campaignId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<CampaignAnalytics>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.MARKETING,
        campaignId,
        'campaignAnalytics',
        { startDate: formatDate(parsedRange.startDate), endDate: formatDate(parsedRange.endDate) }
      );

      const cached = await this.cache.get<CampaignAnalytics>(cacheKey);
      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      const data = await queryCampaignAnalytics(campaignId, dateRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.MARKETING, // 1 hour
        tags: ['marketing', `campaign:${campaignId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_campaign_performance', 'external_ads_data'],
        },
      };
    } catch (error) {
      throw this.handleError('getCampaignAnalytics', error);
    }
  }

  // ─── Public API - Channel Performance ────────────────────────
  
  async getChannelPerformance(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<ChannelPerformance[]>> {
    // Similar cache-first pattern
  }

  // ─── Public API - ROI Report ────────────────────────────────
  
  async getROIReport(
    tenantId: string,
    dateRange: DateRange | TimePeriod,
    groupBy: 'campaign' | 'platform' | 'month' = 'campaign'
  ): Promise<IntelligenceResponse<ROIReport>> {
    // Similar cache-first pattern
  }

  // ─── Public API - Ad Spend Summary ──────────────────────────
  
  async getAdSpendSummary(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<AdSpendSummary>> {
    // Similar cache-first pattern
  }

  // ─── Public API - Data Synchronization ──────────────────────
  
  /**
   * Sync ad data from external platforms
   * Called by daily cron job at 3:00 AM
   */
  async syncExternalAds(tenantId: string): Promise<SyncResult> {
    const results: SyncResult = {
      facebook: { success: false, recordsInserted: 0, recordsUpdated: 0 },
      google: { success: false, recordsInserted: 0, recordsUpdated: 0 },
      tiktok: { success: false, recordsInserted: 0, recordsUpdated: 0 },
      zalo: { success: false, recordsInserted: 0, recordsUpdated: 0 },
    };

    // Fetch tenant credentials
    const tenant = await getTenantById(tenantId);
    const credentials = tenant.metadata?.ads_credentials || {};

    // Sync Facebook
    if (credentials.facebook_access_token) {
      try {
        const connector = new FacebookAdsConnector(
          credentials.facebook_access_token,
          credentials.facebook_ad_account_id
        );
        
        const insights = await connector.fetchInsights({
          startDate: formatDate(subDays(new Date(), 7)), // Last 7 days
          endDate: formatDate(new Date()),
          level: 'campaign',
        });
        
        // Upsert into external_ads_data
        const { inserted, updated } = await upsertExternalAdsData(tenantId, insights);
        results.facebook = { success: true, recordsInserted: inserted, recordsUpdated: updated };
        
        // Invalidate marketing cache
        await this.cache.deleteByTag(`tenant:${tenantId}`);
      } catch (error) {
        results.facebook = { success: false, error: error.message };
      }
    }

    // Repeat for Google, TikTok, Zalo...

    return results;
  }

  // ─── Interface Implementation ────────────────────────────────
  
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache
      const testKey = `${CACHE_KEY_PREFIX.MARKETING}:health:test`;
      await this.cache.set(testKey, { test: true }, { ttl: 10 });
      const cached = await this.cache.get(testKey);
      await this.cache.delete(testKey);

      if (!cached) {
        console.error('[MarketingIntelligence] Cache health check failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[MarketingIntelligence] Health check failed:', error);
      return false;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await this.cache.deletePattern(`${CACHE_KEY_PREFIX.MARKETING}:*`);
      console.log('[MarketingIntelligence] Cache cleared successfully');
    } catch (error) {
      console.error('[MarketingIntelligence] Failed to clear cache:', error);
      throw new IntelligenceError(
        'Failed to clear marketing intelligence cache',
        'CACHE_CLEAR_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  private handleError(functionName: string, error: unknown): IntelligenceError {
    if (error instanceof IntelligenceError || error instanceof QueryError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MarketingIntelligence.${functionName}] Error:`, error);

    return new IntelligenceError(
      `Marketing intelligence operation failed: ${message}`,
      'MARKETING_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

// Singleton instance
let serviceInstance: MarketingIntelligenceService | null = null;

export function getMarketingIntelligenceService(): MarketingIntelligenceService {
  if (!serviceInstance) {
    serviceInstance = new MarketingIntelligenceService();
  }
  return serviceInstance;
}
```

**Cache Strategy**:
- **TTL**: 1 hour (DEFAULT_CACHE_TTL.MARKETING = 3600 seconds)
- **Rationale**: Marketing data changes less frequently than operational metrics
- **Tags**: `['marketing', 'tenant:{tenantId}', 'campaign:{campaignId}']`
- **Invalidation**: On external ads sync completion (daily 3:00 AM)

**Acceptance Criteria**:
- ✅ All 5 metric methods implemented
- ✅ Cache-first pattern for reads
- ✅ syncExternalAds() for write operations
- ✅ Error handling with IntelligenceError
- ✅ healthCheck() and clearCache() implemented
- ✅ Singleton pattern
- ✅ Unit tests (80%+ coverage)


---

### Task #8: API Routes for Marketing Intelligence ⏳
**Estimated Effort**: 6-8 hours  
**Priority**: MEDIUM  
**Dependencies**: Task #7

**Files**: `src/app/api/intelligence/marketing/` (5 routes, ~450 lines total)

**Create 5 GET/POST Endpoints**:

1. **`GET /api/intelligence/marketing/campaign-analytics`**
   - Query Params: `campaignId` (required), `period` or `startDate + endDate`
   - Returns: `IntelligenceResponse<CampaignAnalytics>`

2. **`GET /api/intelligence/marketing/channel-performance`**
   - Query Params: `tenantId` (required), `period` or date range
   - Returns: `IntelligenceResponse<ChannelPerformance[]>`

3. **`GET /api/intelligence/marketing/roi-report`**
   - Query Params: `tenantId`, `period`, `groupBy` (campaign/platform/month)
   - Returns: `IntelligenceResponse<ROIReport>`

4. **`GET /api/intelligence/marketing/ad-spend-summary`**
   - Query Params: `tenantId`, `period` or date range
   - Returns: `IntelligenceResponse<AdSpendSummary>`

5. **`POST /api/intelligence/marketing/sync`**
   - Body: `{ tenantId, platforms?: string[] }` (optional platform filter)
   - Returns: `{ success: boolean, results: SyncResult }`
   - **Note**: Admin-only endpoint, triggers manual sync

**Validation**:
- UUID format check for tenantId, campaignId
- Date range validation
- Enum validation for groupBy, period
- Platform validation (facebook, google, tiktok, zalo)

**Example Request/Response**:
```bash
# Campaign Analytics
curl "https://your-domain.com/api/intelligence/marketing/campaign-analytics?campaignId=abc-123&period=month"

# Response
{
  "data": {
    "campaignId": "abc-123",
    "campaignName": "Summer Sale 2026",
    "platform": ["facebook", "google"],
    "dateRange": { "start": "2026-06-01", "end": "2026-06-30" },
    "totalImpressions": 1250000,
    "totalClicks": 45000,
    "totalSpend": 18500000,
    "totalConversions": 850,
    "totalRevenue": 127500000,
    "avgCTR": 3.6,
    "avgCPC": 411.11,
    "avgCPA": 21764.71,
    "avgROAS": 6.89,
    "roiPct": 589.19,
    "dailyBreakdown": [...],
    "platformBreakdown": [...]
  },
  "metadata": {
    "generatedAt": "2026-06-22T10:00:00.000Z",
    "cacheHit": true,
    "queryTimeMs": 12,
    "dataSourcesUsed": ["cache"]
  }
}
```

**Acceptance Criteria**:
- ✅ All 5 endpoints created
- ✅ Input validation (Zod schemas)
- ✅ Error handling (400/401/403/500)
- ✅ Admin auth check for sync endpoint
- ✅ Rate limiting (10 requests/minute for sync)
- ✅ Build passes with 0 errors


---

### Task #9: Daily Sync Jobs (Scheduled) ⏳
**Estimated Effort**: 4-6 hours  
**Priority**: HIGH  
**Dependencies**: Task #7

**Files**:
- `src/cron/sync-external-ads.ts` (~200 lines)
- `src/app/api/cron/sync-external-ads/route.ts` (~100 lines)

**Implementation**:

1. **Cron Job Script**
```typescript
// src/cron/sync-external-ads.ts
import { getMarketingIntelligenceService } from '@/services/intelligence/marketing';
import { getAllActiveTenants } from '@/lib/tenant-queries';

export async function syncExternalAdsJob() {
  console.log('[CRON] Starting external ads sync job...');
  const startTime = Date.now();

  try {
    // Get all active tenants with ad credentials
    const tenants = await getAllActiveTenants();
    const tenantsWithAds = tenants.filter(t => 
      t.metadata?.ads_credentials?.facebook_access_token ||
      t.metadata?.ads_credentials?.google_access_token ||
      t.metadata?.ads_credentials?.tiktok_access_token ||
      t.metadata?.ads_credentials?.zalo_access_token
    );

    console.log(`[CRON] Found ${tenantsWithAds.length} tenants with ad credentials`);

    const service = getMarketingIntelligenceService();
    const results = [];

    // Sync each tenant sequentially (to avoid rate limits)
    for (const tenant of tenantsWithAds) {
      try {
        console.log(`[CRON] Syncing tenant: ${tenant.id}`);
        const syncResult = await service.syncExternalAds(tenant.id);
        results.push({ tenantId: tenant.id, success: true, result: syncResult });
      } catch (error) {
        console.error(`[CRON] Sync failed for tenant ${tenant.id}:`, error);
        results.push({ tenantId: tenant.id, success: false, error: error.message });
      }
    }

    console.log(`[CRON] Sync job completed in ${Date.now() - startTime}ms`);
    console.log(`[CRON] Success: ${results.filter(r => r.success).length}/${results.length}`);

    return { success: true, results };
  } catch (error) {
    console.error('[CRON] Sync job failed:', error);
    return { success: false, error: error.message };
  }
}
```

2. **API Route for Cron Job**
```typescript
// src/app/api/cron/sync-external-ads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncExternalAdsJob } from '@/cron/sync-external-ads';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run sync job
    const result = await syncExternalAdsJob();

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('[API] Cron sync-external-ads error:', error);
    return NextResponse.json(
      { error: 'Sync job failed', details: error.message },
      { status: 500 }
    );
  }
}
```

3. **Vercel Cron Configuration**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-external-ads",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Cron Schedule**:
- **Frequency**: Daily at 3:00 AM (Vietnam time)
- **Reason**: Low-traffic hours, data available from previous day
- **Duration**: ~10-15 minutes (depends on number of tenants and platforms)

**Error Handling**:
- Token expired → Send email alert to admin
- Rate limit exceeded → Skip platform, retry next day
- Network error → Retry once after 5 minutes
- Data validation error → Log error, continue with next tenant

**Monitoring**:
- Log sync results to database (`cron_job_logs` table)
- Send Slack/email notification on failure
- Track metrics: duration, records synced, errors

**Acceptance Criteria**:
- ✅ Cron job script implemented
- ✅ API route with auth check
- ✅ Vercel cron configuration
- ✅ Handles all 4 platforms
- ✅ Error handling for each platform
- ✅ Sequential processing (avoid rate limits)
- ✅ Logging and monitoring
- ✅ Manual trigger endpoint (admin-only)


---

### Task #10: Marketing Dashboard UI + CMO Integration ⏳
**Estimated Effort**: 10-12 hours  
**Priority**: MEDIUM  
**Dependencies**: Tasks #7, #8

**Files**:
- `src/app/dashboard/marketing/analytics/page.tsx` (~600 lines)
- `src/app/dashboard/marketing/campaigns/page.tsx` (~550 lines)
- `src/app/dashboard/marketing/settings/page.tsx` (~400 lines)
- `src/services/ai-agents/cmo-agent.ts` (update ~100 lines)

**Dashboard Features**:

#### 1. Marketing Analytics Dashboard (`/dashboard/marketing/analytics`)

**Layout**:
- **Overview Cards** (4 cards):
  - Total Ad Spend (this month)
  - Total Revenue (attributed)
  - Average ROAS (all platforms)
  - Average ROI %
- **Channel Performance Chart** (bar chart):
  - X-axis: Platform (Facebook, Google, TikTok, Zalo)
  - Y-axis: Spend, Revenue (dual axis)
  - Color-coded bars
- **ROI Trend Chart** (line chart):
  - X-axis: Date (last 30 days)
  - Y-axis: ROI %
  - Line per platform
- **Top Campaigns Table** (top 10 by ROI):
  - Columns: Campaign Name, Platform, Spend, Revenue, ROI%, Actions
  - Sortable, filterable
- **Sync Status Panel**:
  - Last sync time
  - Sync status per platform (success/failed)
  - "Sync Now" button (admin-only)

**Features**:
- Period selector (week/month/quarter)
- Platform filter (multi-select)
- Export to CSV/PDF
- Refresh button
- Loading/empty states

#### 2. Campaign Management Dashboard (`/dashboard/marketing/campaigns`)

**Features**:
- List all marketing campaigns with external mappings
- Create new campaign with platform linking
- Edit campaign (map external IDs)
- View detailed analytics per campaign
- Archive inactive campaigns

**Campaign Form**:
- Campaign name
- Description
- Budget
- Start/end date
- Platform mappings (Facebook campaign ID, Google campaign ID, etc.)
- Status (active/paused/completed)

#### 3. Marketing Settings (`/dashboard/marketing/settings`)

**Platform Credentials Management**:
- **Facebook Ads**:
  - Access Token input
  - Ad Account ID input
  - "Test Connection" button
- **Google Ads**:
  - OAuth 2.0 flow (Connect button)
  - Developer Token input
  - Customer ID input
  - "Test Connection" button
- **TikTok Ads**:
  - Access Token input
  - Advertiser ID input
  - "Test Connection" button
- **Zalo OA**:
  - Access Token input
  - OA ID input
  - "Test Connection" button

**Sync Settings**:
- Auto-sync enabled/disabled
- Sync frequency (daily/weekly)
- Data retention period (30/60/90 days)
- Email notifications on sync failure

#### 4. CMO Agent Integration

**Update CMO Agent** to consume Marketing Intelligence:
```typescript
// src/services/ai-agents/cmo-agent.ts
import { getMarketingIntelligenceService } from '@/services/intelligence/marketing';

export class CMOAgent {
  private marketingService = getMarketingIntelligenceService();

  async analyzeMarketingPerformance(tenantId: string): Promise<string> {
    // Fetch ROI report
    const roiReport = await this.marketingService.getROIReport(tenantId, 'month');
    
    // Fetch channel performance
    const channelPerf = await this.marketingService.getChannelPerformance(tenantId, 'month');
    
    // Generate insights
    const insights = this.generateInsights(roiReport.data, channelPerf.data);
    
    return insights;
  }

  private generateInsights(roi: ROIReport, channels: ChannelPerformance[]): string {
    // AI-powered analysis
    // - Identify underperforming campaigns
    // - Suggest budget reallocation
    // - Recommend optimization actions
    // - Predict future performance
    
    let insights = '';
    
    // Check ROI by campaign
    const lowROICampaigns = roi.items.filter(item => item.roi < 100);
    if (lowROICampaigns.length > 0) {
      insights += `⚠️ Có ${lowROICampaigns.length} chiến dịch có ROI < 100%:\n`;
      lowROICampaigns.forEach(c => {
        insights += `- ${c.name}: ROI ${c.roi}% (nên tạm dừng hoặc tối ưu)\n`;
      });
    }
    
    // Check channel performance
    const bestChannel = channels.sort((a, b) => b.roiPct - a.roiPct)[0];
    insights += `\n✅ Kênh hiệu quả nhất: ${bestChannel.platform} (ROI ${bestChannel.roiPct}%)\n`;
    insights += `💡 Đề xuất: Tăng ngân sách cho ${bestChannel.platform} thêm 20%\n`;
    
    return insights;
  }
}
```

**Acceptance Criteria**:
- ✅ All 3 dashboard pages created
- ✅ Overview cards with real-time data
- ✅ Charts (bar, line) with responsive design
- ✅ Campaign management CRUD
- ✅ Platform credentials settings
- ✅ Connection testing for all 4 platforms
- ✅ CMO Agent updated to use Marketing Intelligence
- ✅ Auth guard (admin/marketing manager roles)
- ✅ Mobile responsive
- ✅ Loading/error/empty states
- ✅ Build verified: 0 errors

---

## 📁 FILES TO CREATE (Summary)

### Database (5 migrations):
1. `supabase/migrations/20260622200000_create_external_ads_data.sql`
2. `supabase/migrations/20260622201000_create_marketing_campaigns.sql`
3. `supabase/migrations/20260622202000_create_mv_campaign_performance.sql`
4. `supabase/migrations/20260622203000_create_mv_channel_performance.sql`
5. `supabase/migrations/20260622204000_create_mv_marketing_refresh_jobs.sql`

### Services & Business Logic (6):
6. `src/services/intelligence/marketing/queries.ts`
7. `src/services/intelligence/marketing/service.ts`
8. `src/services/intelligence/marketing/connectors/facebook-ads.ts`
9. `src/services/intelligence/marketing/connectors/google-ads.ts`
10. `src/services/intelligence/marketing/connectors/tiktok-ads.ts`
11. `src/services/intelligence/marketing/connectors/zalo-oa.ts`
12. `src/services/intelligence/marketing/index.ts`

### API Routes (6):
13. `src/app/api/intelligence/marketing/campaign-analytics/route.ts`
14. `src/app/api/intelligence/marketing/channel-performance/route.ts`
15. `src/app/api/intelligence/marketing/roi-report/route.ts`
16. `src/app/api/intelligence/marketing/ad-spend-summary/route.ts`
17. `src/app/api/intelligence/marketing/sync/route.ts`
18. `src/app/api/cron/sync-external-ads/route.ts`

### Cron Jobs (1):
19. `src/cron/sync-external-ads.ts`

### UI Components (3):
20. `src/app/dashboard/marketing/analytics/page.tsx`
21. `src/app/dashboard/marketing/campaigns/page.tsx`
22. `src/app/dashboard/marketing/settings/page.tsx`

### Tests (4):
23. `src/services/intelligence/marketing/__tests__/service.test.ts`
24. `src/services/intelligence/marketing/__tests__/queries.test.ts`
25. `src/services/intelligence/marketing/__tests__/facebook-connector.test.ts`
26. `src/services/intelligence/marketing/__tests__/integration.test.ts`

### Documentation (3):
27. `docs/MARKETING_INTELLIGENCE_GUIDE.md`
28. `docs/INTELLIGENCE_LAYER_PHASE_3_PROGRESS_REPORT.md`
29. `docs/INTELLIGENCE_LAYER_PHASE_3_TASK_SUMMARY.md` (this file)

**Total Files**: ~29 files  
**Estimated Total Lines**: ~6500 lines

---

## 🎯 SUCCESS CRITERIA

### Functionality
- ✅ All 4 external connectors working (Facebook, Google, TikTok, Zalo)
- ✅ Daily sync job running successfully
- ✅ Marketing Intelligence API returning accurate data
- ✅ CMO Agent integrated with Marketing Intelligence
- ✅ Dashboard displaying real-time marketing metrics

### Performance
- ✅ Cache hit rate > 85% (1-hour TTL)
- ✅ API response time < 100ms (cached)
- ✅ Sync job completes in < 15 minutes
- ✅ External API calls respect rate limits

### Quality
- ✅ Unit tests (80%+ coverage)
- ✅ Integration tests with mocked external APIs
- ✅ 0 TypeScript errors
- ✅ All builds passing

### Security
- ✅ API credentials encrypted in database
- ✅ OAuth token refresh implemented
- ✅ Cron job authenticated with secret
- ✅ Admin-only access to sync endpoints

### Documentation
- ✅ API documentation complete
- ✅ External connector setup guides
- ✅ CMO Agent integration docs
- ✅ Troubleshooting guide

---

## 📊 ESTIMATED TIMELINE

**Total Effort**: 60-72 hours (~7-9 working days for 1 developer)

**Week-by-Week Breakdown**:

### Week 11 (Database & Connectors)
- Day 1-2: Task #1 - Database schema & materialized views
- Day 3: Task #2 - Marketing queries module
- Day 4-5: Tasks #3, #4 - Facebook & Google connectors

### Week 12 (Connectors & Service)
- Day 1-2: Tasks #5, #6 - TikTok & Zalo connectors
- Day 3-4: Task #7 - MarketingIntelligenceService
- Day 5: Task #8 - API routes

### Week 13 (Sync Jobs & UI)
- Day 1-2: Task #9 - Daily sync jobs
- Day 3-5: Task #10 - Dashboard UI (start)

### Week 14 (UI & Integration)
- Day 1-2: Task #10 - Dashboard UI (finish)
- Day 3: CMO Agent integration
- Day 4: Testing & bug fixes
- Day 5: Documentation & sign-off

---

## 🚀 NEXT STEPS

### Immediate (Week 11 - Day 1):
1. **Task #1**: Create database migrations
   - Start with `external_ads_data` table
   - Test data insertion
   - Verify indexes

### This Week (Week 11):
2. **Task #2**: Implement marketing queries module
3. **Tasks #3-4**: Build Facebook & Google connectors

### Next Week (Week 12):
4. **Tasks #5-7**: Complete connectors & service layer
5. **Task #8**: Create API routes

---

## ✅ SIGN-OFF

**Phase 3 Status**: 🚀 **PLANNING COMPLETE - READY TO START**

**Tasks**: 0/10 completed (0%)  
**Estimated Timeline**: 4 weeks (Week 11-14)  
**Next Milestone**: Complete Task #1 (Database Schema) by end of Week 11 Day 2

**Report Generated**: 2026-06-22 (Phase 3, Planning)  
**Author**: Kiro AI Agent  
**Status**: 🚀 APPROVED TO START PHASE 3

