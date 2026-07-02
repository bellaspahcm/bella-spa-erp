/**
 * Intelligence Layer API Hooks - Central Export
 * 
 * This file exports all Intelligence Layer React Query hooks for easy import.
 * 
 * USAGE:
 * ```tsx
 * // Import specific hooks
 * import { useRevenueForecast, useMonthlyPnL } from '@/hooks/intelligence'
 * 
 * // Or import entire modules
 * import * as ForecastHooks from '@/hooks/intelligence/use-forecast'
 * ```
 * 
 * AGENTS.MD COMPLIANCE:
 * - Cache-first strategy with appropriate TTL
 * - Tenant isolation at all layers
 * - IntelligenceResponse format for APIs
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

// ============================================================================
// FORECAST HOOKS
// ============================================================================
export {
  // Revenue Forecast
  useRevenueForecast,
  
  // Churn Forecast
  useChurnForecast,
  
  // Demand Forecast
  useDemandForecast,
  
  // Forecast Accuracy
  useForecastAccuracy,
  
  // Convenience Hooks
  useAllForecasts,
  
  // Cache Management
  useRefreshForecast,
  useForecastCacheStatus,
  
  // Query Keys (for advanced cache management)
  forecastKeys,
} from './use-forecast'

// ============================================================================
// FINANCE HOOKS
// ============================================================================
export {
  // P&L Analysis
  useMonthlyPnL,
  
  // Cash Flow Analysis
  useCashFlowAnalysis,
  
  // Budget Variance
  useBudgetVariance,
  
  // Expense Breakdown
  useExpenseBreakdown,
  
  // Revenue Breakdown
  useRevenueBreakdown,
  
  // Financial Ratios
  useFinancialRatios,
  
  // Convenience Hooks
  useAllFinanceData,
  
  // Cache Management
  useRefreshFinanceData,
  useFinanceCacheStatus,
  
  // Query Keys
  financeKeys,
} from './use-finance'

// ============================================================================
// RECOMMENDATION HOOKS
// ============================================================================
export {
  // Service Recommendations
  useServiceRecommendations,
  
  // Package Recommendations
  usePackageRecommendations,
  
  // Upsell Recommendations
  useUpsellRecommendations,
  
  // Convenience Hooks
  useAllRecommendations,
  
  // Cache Management
  useRefreshRecommendations,
  useRecommendationCacheStatus,
  
  // Query Keys
  recommendationKeys,
} from './use-recommendation'

// ============================================================================
// OPERATIONAL HOOKS
// ============================================================================
export {
  // KTV Performance
  useKTVPerformance,
  
  // Inventory Optimization
  useInventoryOptimization,
  
  // Session Utilization
  useSessionUtilization,
  
  // Convenience Hooks
  useAllOperationalData,
  
  // Cache Management
  useRefreshOperationalData,
  useOperationalCacheStatus,
  
  // Query Keys
  operationalKeys,
} from './use-operational'

// ============================================================================
// MARKETING HOOKS
// ============================================================================
export {
  // Campaign Performance
  useCampaignPerformance,
  
  // Marketing ROI
  useMarketingROI,
  
  // Ad Spend Optimization
  useAdSpendOptimization,
  
  // Channel Effectiveness
  useChannelEffectiveness,
  
  // Convenience Hooks
  useAllMarketingData,
  
  // Cache Management
  useRefreshMarketingData,
  useMarketingCacheStatus,
  
  // Query Keys
  marketingKeys,
} from './use-marketing'

// ============================================================================
// CUSTOMER HOOKS
// ============================================================================
export {
  // Customer Segmentation
  useCustomerSegmentation,
  
  // Customer Lifetime Value
  useCustomerCLV,
  
  // Churn Risk
  useChurnRisk,
  
  // Customer Behavior Insights
  useCustomerBehaviorInsights,
  
  // Convenience Hooks
  useAllCustomerData,
  
  // Cache Management
  useRefreshCustomerData,
  useCustomerCacheStatus,
  
  // Query Keys
  customerKeys,
} from './use-customer'

// ============================================================================
// HR HOOKS
// ============================================================================
export {
  // Workforce Analytics
  useWorkforceAnalytics,
  
  // Attendance Insights
  useAttendanceInsights,
  
  // Payroll Summary
  usePayrollSummary,
  
  // Employee Performance
  useEmployeePerformance,
  
  // Convenience Hooks
  useAllHRData,
  
  // Cache Management
  useRefreshHRData,
  useHRCacheStatus,
  
  // Query Keys
  hrKeys,
} from './use-hr'
