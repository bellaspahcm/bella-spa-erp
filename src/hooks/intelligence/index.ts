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
  
  // Types
  type FinanceIntelligenceResponse,
  type MonthlyPnLData,
  type CashFlowData,
  type BudgetVarianceData,
  type ExpenseBreakdownData,
  type RevenueBreakdownData,
  type FinancialRatiosData,
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
  
  // Types
  type RecommendationItem,
  type RecommendationResponse,
  type RecommendationOptions,
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
} from './use-hr'
