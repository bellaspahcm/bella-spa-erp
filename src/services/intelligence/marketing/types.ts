/**
 * Marketing Intelligence - Type Definitions
 * Phase 3: Marketing Intelligence Layer
 * 
 * Defines interfaces for marketing analytics queries including:
 * - Campaign analytics
 * - Channel performance
 * - ROI reporting
 * - Ad spend tracking
 */

// ==========================================
// Common Types
// ==========================================

export type Platform = 'facebook' | 'google' | 'tiktok' | 'zalo';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// ==========================================
// Campaign Analytics
// ==========================================

export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  platform: Platform[];
  dateRange: DateRange;
  status: CampaignStatus;
  
  // Budget tracking
  budget: number;
  startDate: string;
  endDate: string;
  
  // Aggregated metrics
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  
  // Calculated metrics
  avgCTR: number;     // Click-through rate (%)
  avgCPC: number;     // Cost per click (VND)
  avgCPA: number;     // Cost per acquisition (VND)
  avgROAS: number;    // Return on ad spend (ratio)
  roiPct: number;     // Return on investment (%)
  
  // Breakdowns
  dailyBreakdown: DailyMetrics[];
  platformBreakdown: PlatformMetrics[];
  
  // Metadata
  platformsCount: number;
  firstAdDate: string | null;
  lastAdDate: string | null;
}

export interface DailyMetrics {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface PlatformMetrics {
  platform: Platform;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  roiPct: number;
  shareOfSpend: number;    // % of total spend
  shareOfRevenue: number;  // % of total revenue
}


// ==========================================
// Channel Performance
// ==========================================

export interface ChannelPerformance {
  platform: Platform;
  month: string; // YYYY-MM format
  
  // Aggregated metrics
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  
  // Calculated metrics
  avgCTR: number;
  avgCPC: number;
  avgCPA: number;
  avgROAS: number;
  roiPct: number;
  
  // Insights
  campaignsCount: number;
  shareOfSpend: number;    // % of total spend across all platforms
  shareOfRevenue: number;  // % of total revenue across all platforms
  
  // Metadata
  recordsCount: number;    // Number of raw ad records
}

export interface ChannelPerformanceComparison {
  dateRange: DateRange;
  platforms: ChannelPerformance[];
  totalSpend: number;
  totalRevenue: number;
  totalROI: number;
  bestPerformer: {
    platform: Platform;
    metric: 'roi' | 'roas' | 'conversions' | 'revenue';
    value: number;
  };
}

// ==========================================
// ROI Report
// ==========================================

export type ROIGroupBy = 'campaign' | 'platform' | 'month';

export interface ROIReport {
  groupBy: ROIGroupBy;
  dateRange: DateRange;
  items: ROIReportItem[];
  summary: ROISummary;
}

export interface ROIReportItem {
  id: string;           // campaign_id, platform, or month depending on groupBy
  name: string;         // campaign_name, platform name, or month label
  spend: number;
  revenue: number;
  roi: number;          // ROI percentage
  roas: number;         // Return on ad spend ratio
  conversions: number;
  impressions: number;
  clicks: number;
}

export interface ROISummary {
  totalSpend: number;
  totalRevenue: number;
  totalROI: number;
  avgROAS: number;
  totalConversions: number;
  totalImpressions: number;
  totalClicks: number;
}


// ==========================================
// Ad Spend Summary
// ==========================================

export interface AdSpendSummary {
  dateRange: DateRange;
  totalSpend: number;
  totalBudget: number;
  budgetUtilization: number; // %
  
  // Time series
  dailySpend: DailySpend[];
  
  // Platform breakdown
  spendByPlatform: PlatformSpend[];
  
  // Trends
  avgDailySpend: number;
  peakSpendDate: string;
  peakSpendAmount: number;
}

export interface DailySpend {
  date: string;
  spend: number;
  budget: number; // Prorated daily budget
}

export interface PlatformSpend {
  platform: Platform;
  spend: number;
  share: number; // % of total spend
  trend: 'up' | 'down' | 'stable'; // Month-over-month trend
}

// ==========================================
// Top Performing Ads
// ==========================================

export type PerformanceMetric = 'roi' | 'roas' | 'ctr' | 'conversions' | 'revenue';

export interface TopPerformingAd {
  adId: string;
  externalAdId: string;
  platform: Platform;
  campaignId: string | null;
  campaignName: string | null;
  date: string;
  
  // Metrics
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  roi: number;
  
  // Ranking
  rank: number;
  score: number; // Value of the metric being ranked by
}

export interface TopPerformingAdsResult {
  metric: PerformanceMetric;
  dateRange: DateRange;
  limit: number;
  ads: TopPerformingAd[];
}


// ==========================================
// Query Parameters
// ==========================================

export interface CampaignAnalyticsParams {
  campaignId: string;
  dateRange?: DateRange;
  tenantId?: string; // Auto-filled from context if not provided
}

export interface ChannelPerformanceParams {
  tenantId: string;
  dateRange: DateRange;
  platforms?: Platform[]; // Filter by specific platforms
}

export interface ROIReportParams {
  tenantId: string;
  dateRange: DateRange;
  groupBy: ROIGroupBy;
  platforms?: Platform[]; // Filter by specific platforms
  minSpend?: number;      // Filter out low-spend items
}

export interface AdSpendSummaryParams {
  tenantId: string;
  dateRange: DateRange;
  platforms?: Platform[]; // Filter by specific platforms
}

export interface TopPerformingAdsParams {
  tenantId: string;
  metric: PerformanceMetric;
  dateRange?: DateRange; // Default: last 30 days
  platforms?: Platform[]; // Filter by specific platforms
  limit?: number;         // Default: 10
}

// ==========================================
// Database Row Types (snake_case from DB)
// ==========================================

export interface ExternalAdsDataRow {
  id: string;
  tenant_id: string;
  platform: Platform;
  date: string;
  internal_campaign_id: string | null;
  external_campaign_id: string;
  external_ad_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  roi: number | null;
  raw_data: Record<string, unknown>;
  sync_status: 'pending' | 'success' | 'failed';
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingCampaignRow {
  id: string;
  tenant_id: string;
  name: string;
  status: CampaignStatus;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  external_mappings: Record<Platform, string>;
  goals: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignPerformanceRow {
  campaign_id: string;
  tenant_id: string;
  campaign_name: string;
  campaign_budget: number | null;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  campaign_status: CampaignStatus;
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_conversions: number;
  total_revenue: number;
  avg_ctr: number | null;
  avg_cpc: number | null;
  avg_cpa: number | null;
  avg_roas: number | null;
  roi_pct: number | null;
  platforms_count: number;
  platforms_list: Platform[] | null;
  first_ad_date: string | null;
  last_ad_date: string | null;
  computed_at: string;
}

export interface ChannelPerformanceRow {
  tenant_id: string;
  platform: Platform;
  month: string;
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_conversions: number;
  total_revenue: number;
  avg_ctr: number | null;
  avg_cpc: number | null;
  avg_cpa: number | null;
  avg_roas: number | null;
  roi_pct: number | null;
  campaigns_count: number;
  records_count: number;
  computed_at: string;
}
