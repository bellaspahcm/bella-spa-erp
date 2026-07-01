/**
 * Marketing Intelligence Module
 * 
 * Centralized exports for Marketing Intelligence functionality
 * 
 * Components:
 * - Queries: Query builders for campaign/channel analytics, ROI reports, ad spend tracking
 * - Connectors: Platform integrations (Facebook Ads, Google Ads, TikTok, Zalo)
 * - Types: TypeScript type definitions for all marketing intelligence data
 * 
 * Usage:
 * ```typescript
 * import { 
 *   getCampaignAnalytics, 
 *   getChannelPerformance,
 *   FacebookAdsConnector 
 * } from '@/services/intelligence/marketing';
 * ```
 */

// ─── Service ────────────────────────────────────────────────────────────────

export {
  MarketingIntelligenceService,
  getMarketingIntelligenceService,
} from './service';

export type {
  SyncPlatformResult,
  TenantSyncResult,
  TenantAdsCredentials,
} from './service';

// ─── Queries ────────────────────────────────────────────────────────────────

export {
  getCampaignAnalytics,
  getChannelPerformance,
  getROIReport,
  getAdSpendSummary,
  getTopPerformingAds,
} from './queries';

// ─── Connectors ─────────────────────────────────────────────────────────────

export { BaseConnector, ConnectorError } from './connectors/base';
export type {
  ConnectorConfig,
  SyncParams,
  SyncResult,
  SyncError,
  ConnectorErrorCode,
} from './connectors/base';

export { FacebookAdsConnector } from './connectors/facebook-ads';

// ─── Types ──────────────────────────────────────────────────────────────────

export type {
  // Common
  Platform,
  CampaignStatus,
  DateRange,
  
  // Campaign Analytics
  CampaignAnalytics,
  DailyMetrics,
  PlatformMetrics,
  CampaignAnalyticsParams,
  
  // Channel Performance
  ChannelPerformance,
  ChannelPerformanceComparison,
  ChannelPerformanceParams,
  
  // ROI Report
  ROIReport,
  ROIReportItem,
  ROISummary,
  ROIGroupBy,
  ROIReportParams,
  
  // Ad Spend
  AdSpendSummary,
  DailySpend,
  PlatformSpend,
  AdSpendSummaryParams,
  
  // Top Performing Ads
  TopPerformingAd,
  TopPerformingAdsResult,
  PerformanceMetric,
  TopPerformingAdsParams,
  
  // Database Row Types
  ExternalAdsDataRow,
  MarketingCampaignRow,
  CampaignPerformanceRow,
  ChannelPerformanceRow,
} from './types';
