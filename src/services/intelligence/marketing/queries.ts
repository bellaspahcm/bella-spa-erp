/**
 * Marketing Intelligence Queries Module
 * 
 * Query builders for Marketing Intelligence metrics:
 * - Campaign Analytics (performance, daily breakdown, platform split)
 * - Channel Performance (platform comparison, month-over-month trends)
 * - ROI Report (aggregated by campaign/platform/month)
 * - Ad Spend Summary (budget tracking, daily spend, platform breakdown)
 * - Top Performing Ads (ranked by ROI/ROAS/CTR/conversions)
 * 
 * Architecture:
 * - Read-only operations (no mutations)
 * - Query materialized views for performance
 * - Tenant isolation (tenant_id filter on all queries)
 * - Date range filtering
 * - TypeScript types for all return values
 * - In-memory caching with TTL (5 minutes default)
 * 
 * Data Sources:
 * - mv_campaign_performance (materialized view)
 * - mv_channel_performance (materialized view)
 * - external_ads_data (raw ad data)
 * - marketing_campaigns (campaign metadata)
 * 
 * Cache Strategy:
 * - All queries use marketingCache with 5-minute TTL
 * - Cache keys follow pattern: 'marketing:{queryName}:{tenantId}:{params}'
 * - Cache is automatically invalidated on data updates
 */

import type { Database } from '@/types/database.types';
import { QueryError } from '../shared/types';
import { marketingCache, createCacheKey } from './cache';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create server-side Supabase client with service role key (bypasses RLS).
 * 
 * Marketing Intelligence queries need service role access to read materialized views
 * and aggregate campaign/ad data without RLS restrictions.
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error(
      'Marketing Intelligence requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Service role key grants admin access to bypass RLS for analytics queries.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
import type {
  CampaignAnalytics,
  ChannelPerformance,
  ROIReport,
  AdSpendSummary,
  TopPerformingAdsResult,
  CampaignAnalyticsParams,
  ChannelPerformanceParams,
  ROIReportParams,
  AdSpendSummaryParams,
  TopPerformingAdsParams,
  CampaignPerformanceRow,
  ChannelPerformanceRow,
  ExternalAdsDataRow,
  DailyMetrics,
  PlatformMetrics,
  ROIReportItem,
  ROISummary,
  DailySpend,
  PlatformSpend,
  TopPerformingAd,
  Platform,
} from './types';

// ─── Supabase Query Response Types ─────────────────────────────────────────

// These types represent the actual response from Supabase queries
// Using unknown and then type assertions for safety
type SupabaseQueryResult<T> = {
  data: T | null;
  error: Error | null;
};

type CampaignPerformanceQueryResult = Record<string, unknown>;
type ChannelPerformanceQueryResult = Record<string, unknown>;
type ExternalAdsDataQueryResult = Record<string, unknown>;
type MarketingCampaignQueryResult = Record<string, unknown>;

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Map database row (snake_case) to camelCase
 */
function mapCampaignPerformanceRow(row: CampaignPerformanceRow): Partial<CampaignAnalytics> {
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    status: row.campaign_status,
    budget: row.campaign_budget ?? 0,
    startDate: row.campaign_start_date ?? '',
    endDate: row.campaign_end_date ?? '',
    platform: (row.platforms_list ?? []) as Platform[],
    totalImpressions: Number(row.total_impressions) || 0,
    totalClicks: Number(row.total_clicks) || 0,
    totalSpend: Number(row.total_spend) || 0,
    totalConversions: Number(row.total_conversions) || 0,
    totalRevenue: Number(row.total_revenue) || 0,
    avgCTR: Number(row.avg_ctr) || 0,
    avgCPC: Number(row.avg_cpc) || 0,
    avgCPA: Number(row.avg_cpa) || 0,
    avgROAS: Number(row.avg_roas) || 0,
    roiPct: Number(row.roi_pct) || 0,
    platformsCount: row.platforms_count,
    firstAdDate: row.first_ad_date,
    lastAdDate: row.last_ad_date,
  };
}


function mapChannelPerformanceRow(row: ChannelPerformanceRow): ChannelPerformance {
  return {
    platform: row.platform,
    month: row.month,
    totalImpressions: Number(row.total_impressions) || 0,
    totalClicks: Number(row.total_clicks) || 0,
    totalSpend: Number(row.total_spend) || 0,
    totalConversions: Number(row.total_conversions) || 0,
    totalRevenue: Number(row.total_revenue) || 0,
    avgCTR: Number(row.avg_ctr) || 0,
    avgCPC: Number(row.avg_cpc) || 0,
    avgCPA: Number(row.avg_cpa) || 0,
    avgROAS: Number(row.avg_roas) || 0,
    roiPct: Number(row.roi_pct) || 0,
    campaignsCount: row.campaigns_count,
    shareOfSpend: 0, // Calculated after fetching all rows
    shareOfRevenue: 0, // Calculated after fetching all rows
    recordsCount: row.records_count,
  };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get default date range (last 30 days)
 */
function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

// ─── Query #1: Campaign Analytics ──────────────────────────────────────────

/**
 * Get detailed analytics for a specific campaign
 * 
 * Returns:
 * - Campaign overview (budget, dates, platforms, status)
 * - Aggregated metrics (impressions, clicks, spend, conversions, revenue)
 * - Calculated metrics (CTR, CPC, CPA, ROAS, ROI)
 * - Daily breakdown of metrics
 * - Platform breakdown with share percentages
 * 
 * Data sources:
 * - mv_campaign_performance (materialized view for overview)
 * - external_ads_data (raw data for daily/platform breakdowns)
 * 
 * Cache: 5 minutes TTL
 */
export async function getCampaignAnalytics(
  params: CampaignAnalyticsParams
): Promise<CampaignAnalytics> {
  const { campaignId, dateRange, tenantId } = params;
  
  // Create cache key
  const cacheKey = createCacheKey(
    'marketing',
    'campaign-analytics',
    tenantId || 'notenant',
    campaignId,
    dateRange?.start || 'all',
    dateRange?.end || 'all'
  );
  
  // Try to get from cache first
  return marketingCache.getOrSet(cacheKey, async () => {
    return _getCampaignAnalyticsUncached(params);
  });
}

/**
 * Internal uncached implementation of getCampaignAnalytics
 */
async function _getCampaignAnalyticsUncached(
  params: CampaignAnalyticsParams
): Promise<CampaignAnalytics> {
  const supabase = await createServiceRoleClient();
  const { campaignId, dateRange, tenantId } = params;

  try {
    // Step 1: Get campaign overview from materialized view
    const { data: campaignData, error: campaignError } = await supabase
      .from('mv_campaign_performance' as any)
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (campaignError) {
      throw new QueryError('Failed to fetch campaign performance', campaignError);
    }

    if (!campaignData) {
      throw new QueryError(
        `Campaign not found: ${campaignId}`,
        new Error('Campaign not found')
      );
    }

    // Check tenant isolation if tenantId provided
    const typedCampaignData = campaignData as unknown as CampaignPerformanceRow;
    if (tenantId && typedCampaignData.tenant_id !== tenantId) {
      throw new QueryError(
        `Campaign not found in tenant: ${campaignId}`,
        new Error('Tenant mismatch')
      );
    }

    const overview = mapCampaignPerformanceRow(typedCampaignData);


    // Step 2: Get daily breakdown from external_ads_data
    let dailyQuery = supabase
      .from('external_ads_data' as any)
      .select('date, impressions, clicks, spend, conversions, revenue, ctr, cpc, roas')
      .eq('internal_campaign_id', campaignId)
      .eq('sync_status', 'success')
      .order('date', { ascending: true });

    // Apply date range filter if provided
    if (dateRange) {
      dailyQuery = dailyQuery.gte('date', dateRange.start).lte('date', dateRange.end);
    }

    const { data: dailyData, error: dailyError } = await dailyQuery;

    if (dailyError) {
      throw new QueryError('Failed to fetch daily breakdown', dailyError);
    }

    // Type assertion and aggregate daily metrics by date
    const typedDailyData = dailyData as unknown as ExternalAdsDataRow[];
    const dailyMap = new Map<string, DailyMetrics>();
    for (const row of typedDailyData || []) {
      const existing = dailyMap.get(row.date) || {
        date: row.date,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        revenue: 0,
        ctr: 0,
        cpc: 0,
        roas: 0,
      };
      existing.impressions += Number(row.impressions) || 0;
      existing.clicks += Number(row.clicks) || 0;
      existing.spend += Number(row.spend) || 0;
      existing.conversions += Number(row.conversions) || 0;
      existing.revenue += Number(row.revenue) || 0;
      dailyMap.set(row.date, existing);
    }

    // Recalculate daily metrics
    const dailyBreakdown: DailyMetrics[] = Array.from(dailyMap.values()).map(day => ({
      ...day,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
      cpc: day.clicks > 0 ? day.spend / day.clicks : 0,
      roas: day.spend > 0 ? day.revenue / day.spend : 0,
    }));

    // Step 3: Get platform breakdown from external_ads_data
    const { data: platformData, error: platformError } = await supabase
      .from('external_ads_data' as any)
      .select('platform, impressions, clicks, spend, conversions, revenue')
      .eq('internal_campaign_id', campaignId)
      .eq('sync_status', 'success');

    if (platformError) {
      throw new QueryError('Failed to fetch platform breakdown', platformError);
    }

    // Type assertion and aggregate by platform
    const typedPlatformData = platformData as unknown as ExternalAdsDataRow[];
    const platformMap = new Map<Platform, PlatformMetrics>();
    for (const row of typedPlatformData || []) {
      const existing = platformMap.get(row.platform as Platform) || {
        platform: row.platform as Platform,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        revenue: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
        roiPct: 0,
        shareOfSpend: 0,
        shareOfRevenue: 0,
      };
      existing.impressions += Number(row.impressions) || 0;
      existing.clicks += Number(row.clicks) || 0;
      existing.spend += Number(row.spend) || 0;
      existing.conversions += Number(row.conversions) || 0;
      existing.revenue += Number(row.revenue) || 0;
      platformMap.set(row.platform as Platform, existing);
    }

    const totalSpend = overview.totalSpend || 0;
    const totalRevenue = overview.totalRevenue || 0;

    // Calculate platform metrics and shares
    const platformBreakdown: PlatformMetrics[] = Array.from(platformMap.values()).map(platform => ({
      ...platform,
      ctr: platform.impressions > 0 ? (platform.clicks / platform.impressions) * 100 : 0,
      cpc: platform.clicks > 0 ? platform.spend / platform.clicks : 0,
      cpa: platform.conversions > 0 ? platform.spend / platform.conversions : 0,
      roas: platform.spend > 0 ? platform.revenue / platform.spend : 0,
      roiPct: platform.spend > 0 ? ((platform.revenue - platform.spend) / platform.spend) * 100 : 0,
      shareOfSpend: totalSpend > 0 ? (platform.spend / totalSpend) * 100 : 0,
      shareOfRevenue: totalRevenue > 0 ? (platform.revenue / totalRevenue) * 100 : 0,
    }));

    // Return complete campaign analytics
    return {
      ...overview,
      campaignId,
      campaignName: overview.campaignName || '',
      platform: overview.platform || [],
      status: overview.status || 'active',
      dateRange: dateRange || { start: overview.startDate || '', end: overview.endDate || '' },
      dailyBreakdown,
      platformBreakdown,
    } as CampaignAnalytics;

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getCampaignAnalytics', errorObj);
  }
}


// ─── Query #2: Channel Performance ─────────────────────────────────────────

/**
 * Get platform-level performance comparison
 * 
 * Returns:
 * - Metrics by platform (Facebook, Google, TikTok, Zalo)
 * - Month-over-month trends
 * - Share of spend and revenue percentages
 * - Campaign counts per platform
 * 
 * Data source:
 * - mv_channel_performance (materialized view)
 * 
 * Cache: 5 minutes TTL
 */
export async function getChannelPerformance(
  params: ChannelPerformanceParams
): Promise<ChannelPerformance[]> {
  const { tenantId, dateRange, platforms } = params;
  
  // Create cache key
  const cacheKey = createCacheKey(
    'marketing',
    'channel-performance',
    tenantId,
    dateRange.start,
    dateRange.end,
    platforms ? platforms.join(',') : 'all'
  );
  
  // Try to get from cache first
  return marketingCache.getOrSet(cacheKey, async () => {
    return _getChannelPerformanceUncached(params);
  });
}

/**
 * Internal uncached implementation of getChannelPerformance
 */
async function _getChannelPerformanceUncached(
  params: ChannelPerformanceParams
): Promise<ChannelPerformance[]> {
  const supabase = await createServiceRoleClient();
  const { tenantId, dateRange, platforms } = params;

  try {
    // Query channel performance materialized view
    let query = supabase
      .from('mv_channel_performance' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', `${dateRange.start.slice(0, 7)}-01`) // YYYY-MM-01 (first day of month)
      .lte('month', `${dateRange.end.slice(0, 7)}-01`)   // YYYY-MM-01 (first day of month)
      .order('month', { ascending: false })
      .order('platform', { ascending: true });

    // Filter by platforms if specified
    if (platforms && platforms.length > 0) {
      query = query.in('platform', platforms);
    }

    const { data, error } = await query;

    if (error) {
      throw new QueryError('Failed to fetch channel performance', error);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Type assertion for query result from materialized view
    const typedData = data as unknown as ChannelPerformanceRow[];

    // Calculate total spend and revenue across all platforms for share calculation
    const totalSpend = typedData.reduce((sum, row) => sum + Number(row.total_spend || 0), 0);
    const totalRevenue = typedData.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0);

    // Map rows and calculate shares
    const results = typedData.map(row => {
      const mapped = mapChannelPerformanceRow(row);
      return {
        ...mapped,
        shareOfSpend: totalSpend > 0 ? (mapped.totalSpend / totalSpend) * 100 : 0,
        shareOfRevenue: totalRevenue > 0 ? (mapped.totalRevenue / totalRevenue) * 100 : 0,
      };
    });

    return results;

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getChannelPerformance', errorObj);
  }
}

// ─── Query #3: ROI Report ───────────────────────────────────────────────────

/**
 * Get ROI report aggregated by campaign, platform, or month
 * 
 * Returns:
 * - List of items with spend, revenue, ROI, ROAS
 * - Summary totals
 * - Sorted by ROI descending
 * 
 * Data sources:
 * - mv_campaign_performance (for groupBy='campaign')
 * - mv_channel_performance (for groupBy='platform' or 'month')
 */
export async function getROIReport(params: ROIReportParams): Promise<ROIReport> {
  const supabase = await createServiceRoleClient();
  const { tenantId, dateRange, groupBy, platforms, minSpend } = params;

  try {
    let items: ROIReportItem[] = [];

    if (groupBy === 'campaign') {
      // Query campaigns from mv_campaign_performance
      const { data, error } = await supabase
        .from('mv_campaign_performance' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('roi_pct', { ascending: false, nullsFirst: false });

      if (error) {
        throw new QueryError('Failed to fetch campaign ROI data', error);
      }

      // Type assertion for materialized view result
      const typedData = data as unknown as CampaignPerformanceRow[];
      items = (typedData || [])
        .filter(row => !minSpend || Number(row.total_spend || 0) >= minSpend)
        .map((row) => ({
          id: row.campaign_id,
          name: row.campaign_name,
          spend: Number(row.total_spend) || 0,
          revenue: Number(row.total_revenue) || 0,
          roi: Number(row.roi_pct) || 0,
          roas: Number(row.avg_roas) || 0,
          conversions: Number(row.total_conversions) || 0,
          impressions: Number(row.total_impressions) || 0,
          clicks: Number(row.total_clicks) || 0,
        }));

    } else if (groupBy === 'platform') {
      // Query platforms from mv_channel_performance
      let query = supabase
        .from('mv_channel_performance' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('month', dateRange.start.slice(0, 7))
        .lte('month', dateRange.end.slice(0, 7));

      if (platforms && platforms.length > 0) {
        query = query.in('platform', platforms);
      }

      const { data, error } = await query;

      if (error) {
        throw new QueryError('Failed to fetch platform ROI data', error);
      }

      // Type assertion and aggregate by platform
      const typedData = data as unknown as ChannelPerformanceRow[];
      const platformMap = new Map<string, ROIReportItem>();
      for (const row of typedData || []) {
        const platform = row.platform;
        const existing = platformMap.get(platform) || {
          id: platform,
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          spend: 0,
          revenue: 0,
          roi: 0,
          roas: 0,
          conversions: 0,
          impressions: 0,
          clicks: 0,
        };
        existing.spend += Number(row.total_spend) || 0;
        existing.revenue += Number(row.total_revenue) || 0;
        existing.conversions += Number(row.total_conversions) || 0;
        existing.impressions += Number(row.total_impressions) || 0;
        existing.clicks += Number(row.total_clicks) || 0;
        platformMap.set(platform, existing);
      }

      // Recalculate ROI and ROAS
      items = Array.from(platformMap.values())
        .map(item => ({
          ...item,
          roi: item.spend > 0 ? ((item.revenue - item.spend) / item.spend) * 100 : 0,
          roas: item.spend > 0 ? item.revenue / item.spend : 0,
        }))
        .filter(item => !minSpend || item.spend >= minSpend)
        .sort((a, b) => b.roi - a.roi);

    } else {
      // groupBy === 'month'
      let query = supabase
        .from('mv_channel_performance' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('month', dateRange.start.slice(0, 7))
        .lte('month', dateRange.end.slice(0, 7));

      if (platforms && platforms.length > 0) {
        query = query.in('platform', platforms);
      }

      const { data, error } = await query;

      if (error) {
        throw new QueryError('Failed to fetch monthly ROI data', error);
      }

      // Type assertion and aggregate by month
      const typedData = data as unknown as ChannelPerformanceRow[];
      const monthMap = new Map<string, ROIReportItem>();
      for (const row of typedData || []) {
        const month = row.month;
        const existing = monthMap.get(month) || {
          id: month,
          name: month,
          spend: 0,
          revenue: 0,
          roi: 0,
          roas: 0,
          conversions: 0,
          impressions: 0,
          clicks: 0,
        };
        existing.spend += Number(row.total_spend) || 0;
        existing.revenue += Number(row.total_revenue) || 0;
        existing.conversions += Number(row.total_conversions) || 0;
        existing.impressions += Number(row.total_impressions) || 0;
        existing.clicks += Number(row.total_clicks) || 0;
        monthMap.set(month, existing);
      }

      // Recalculate ROI and ROAS
      items = Array.from(monthMap.values())
        .map(item => ({
          ...item,
          roi: item.spend > 0 ? ((item.revenue - item.spend) / item.spend) * 100 : 0,
          roas: item.spend > 0 ? item.revenue / item.spend : 0,
        }))
        .filter(item => !minSpend || item.spend >= minSpend)
        .sort((a, b) => b.roi - a.roi);
    }

    // Calculate summary
    const summary: ROISummary = {
      totalSpend: items.reduce((sum, item) => sum + item.spend, 0),
      totalRevenue: items.reduce((sum, item) => sum + item.revenue, 0),
      totalROI: 0,
      avgROAS: 0,
      totalConversions: items.reduce((sum, item) => sum + item.conversions, 0),
      totalImpressions: items.reduce((sum, item) => sum + item.impressions, 0),
      totalClicks: items.reduce((sum, item) => sum + item.clicks, 0),
    };
    summary.totalROI = summary.totalSpend > 0
      ? ((summary.totalRevenue - summary.totalSpend) / summary.totalSpend) * 100
      : 0;
    summary.avgROAS = summary.totalSpend > 0 ? summary.totalRevenue / summary.totalSpend : 0;

    return {
      groupBy,
      dateRange,
      items,
      summary,
    };

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getROIReport', errorObj);
  }
}


// ─── Query #4: Ad Spend Summary ────────────────────────────────────────────

/**
 * Get ad spend summary with budget tracking
 * 
 * Returns:
 * - Total spend vs budget
 * - Budget utilization percentage
 * - Daily spend breakdown
 * - Spend by platform with share percentages
 * - Peak spend date and trends
 * 
 * Data sources:
 * - external_ads_data (for daily spend)
 * - marketing_campaigns (for budget)
 * - mv_channel_performance (for platform breakdown)
 */
export async function getAdSpendSummary(
  params: AdSpendSummaryParams
): Promise<AdSpendSummary> {
  const supabase = await createServiceRoleClient();
  const { tenantId, dateRange, platforms } = params;

  try {
    // Step 1: Get daily spend from external_ads_data
    let dailyQuery = supabase
      .from('external_ads_data' as any)
      .select('date, spend, platform')
      .eq('tenant_id', tenantId)
      .eq('sync_status', 'success')
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true });

    if (platforms && platforms.length > 0) {
      dailyQuery = dailyQuery.in('platform', platforms);
    }

    const { data: dailyData, error: dailyError } = await dailyQuery;

    if (dailyError) {
      throw new QueryError('Failed to fetch daily spend', dailyError);
    }

    // Type assertion and aggregate daily spend
    const typedDailyData = dailyData as unknown as ExternalAdsDataRow[];
    const dailyMap = new Map<string, number>();
    const platformMap = new Map<Platform, number>();
    let totalSpend = 0;

    for (const row of typedDailyData || []) {
      const date = row.date;
      const spend = Number(row.spend) || 0;
      const platform = row.platform as Platform;

      dailyMap.set(date, (dailyMap.get(date) || 0) + spend);
      platformMap.set(platform, (platformMap.get(platform) || 0) + spend);
      totalSpend += spend;
    }

    // Step 2: Get total budget from active campaigns
    const { data: campaignData, error: campaignError } = await supabase
      .from('marketing_campaigns' as any)
      .select('budget')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'completed'])
      .not('budget', 'is', null);

    if (campaignError) {
      throw new QueryError('Failed to fetch campaign budgets', campaignError);
    }

    // Type assertion for campaign budget query
    type BudgetRow = { budget: number | null };
    const typedCampaignData = campaignData as unknown as BudgetRow[];
    const totalBudget = (typedCampaignData || []).reduce(
      (sum, c) => sum + (Number(c.budget) || 0),
      0
    );

    // Step 3: Build daily spend array
    const dailySpend: DailySpend[] = [];
    const dayCount = dailyMap.size || 1;
    const dailyBudget = totalBudget / dayCount;

    for (const [date, spend] of dailyMap.entries()) {
      dailySpend.push({
        date,
        spend,
        budget: dailyBudget,
      });
    }

    // Step 4: Build platform spend array with trends
    const spendByPlatform: PlatformSpend[] = Array.from(platformMap.entries())
      .map(([platform, spend]) => ({
        platform,
        spend,
        share: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
        trend: 'stable' as const, // TODO: Calculate month-over-month trend
      }))
      .sort((a, b) => b.spend - a.spend);

    // Step 5: Calculate additional metrics
    const avgDailySpend = totalSpend / (dailySpend.length || 1);
    const peakDay = dailySpend.reduce(
      (max, day) => (day.spend > max.spend ? day : max),
      dailySpend[0] || { date: '', spend: 0, budget: 0 }
    );

    return {
      dateRange,
      totalSpend,
      totalBudget,
      budgetUtilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      dailySpend,
      spendByPlatform,
      avgDailySpend,
      peakSpendDate: peakDay.date,
      peakSpendAmount: peakDay.spend,
    };

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getAdSpendSummary', errorObj);
  }
}


// ─── Query #5: Top Performing Ads ──────────────────────────────────────────

/**
 * Get top N ads ranked by specified metric
 * 
 * Returns:
 * - Top ads sorted by ROI/ROAS/CTR/conversions/revenue
 * - Rank and score for each ad
 * - Campaign and platform info
 * - All key metrics
 * 
 * Data source:
 * - external_ads_data (raw ad data)
 */
export async function getTopPerformingAds(
  params: TopPerformingAdsParams
): Promise<TopPerformingAdsResult> {
  const supabase = await createServiceRoleClient();
  const {
    tenantId,
    metric,
    dateRange = getDefaultDateRange(),
    platforms,
    limit = 10,
  } = params;

  try {
    // Build query
    let query = supabase
      .from('external_ads_data' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('sync_status', 'success')
      .gte('date', dateRange.start)
      .lte('date', dateRange.end);

    // Filter by platforms if specified
    if (platforms && platforms.length > 0) {
      query = query.in('platform', platforms);
    }

    // Order by metric (descending, best first)
    switch (metric) {
      case 'roi':
        query = query.order('roi', { ascending: false, nullsFirst: false });
        break;
      case 'roas':
        query = query.order('roas', { ascending: false, nullsFirst: false });
        break;
      case 'ctr':
        query = query.order('ctr', { ascending: false, nullsFirst: false });
        break;
      case 'conversions':
        query = query.order('conversions', { ascending: false, nullsFirst: false });
        break;
      case 'revenue':
        query = query.order('revenue', { ascending: false, nullsFirst: false });
        break;
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new QueryError('Failed to fetch top performing ads', error);
    }

    if (!data || data.length === 0) {
      return {
        metric,
        dateRange,
        limit,
        ads: [],
      };
    }

    // Type assertion for external ads data
    const typedData = data as unknown as ExternalAdsDataRow[];

    // Get campaign names for ads (if linked)
    const campaignIds = typedData
      .map(row => row.internal_campaign_id)
      .filter(id => id !== null) as string[];

    let campaignNames = new Map<string, string>();
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('marketing_campaigns' as any)
        .select('id, name')
        .in('id', campaignIds);

      // Type assertion for campaign name query
      type CampaignRow = { id: string; name: string };
      const typedCampaigns = campaigns as unknown as CampaignRow[];
      if (typedCampaigns) {
        for (const c of typedCampaigns) {
          campaignNames.set(c.id, c.name);
        }
      }
    }

    // Map results
    const ads: TopPerformingAd[] = typedData.map((row, index) => {
      const scoreValue =
        metric === 'roi' ? Number(row.roi) || 0 :
        metric === 'roas' ? Number(row.roas) || 0 :
        metric === 'ctr' ? Number(row.ctr) || 0 :
        metric === 'conversions' ? Number(row.conversions) || 0 :
        Number(row.revenue) || 0;

      return {
        adId: row.id,
        externalAdId: row.external_ad_id,
        platform: row.platform as Platform,
        campaignId: row.internal_campaign_id,
        campaignName: row.internal_campaign_id
          ? campaignNames.get(row.internal_campaign_id) || null
          : null,
        date: row.date,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        spend: Number(row.spend) || 0,
        conversions: Number(row.conversions) || 0,
        revenue: Number(row.revenue) || 0,
        ctr: Number(row.ctr) || 0,
        cpc: Number(row.cpc) || 0,
        cpa: Number(row.cpa) || 0,
        roas: Number(row.roas) || 0,
        roi: Number(row.roi) || 0,
        rank: index + 1,
        score: scoreValue,
      };
    });

    return {
      metric,
      dateRange,
      limit,
      ads,
    };

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getTopPerformingAds', errorObj);
  }
}
