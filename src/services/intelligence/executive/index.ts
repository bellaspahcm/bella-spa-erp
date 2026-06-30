/**
 * Executive Intelligence Module
 * 
 * Exports:
 * - Service: getExecutiveIntelligence() singleton
 * - Queries: Direct query functions (for testing)
 * - Types: Response types for all metrics
 */

export {
  ExecutiveIntelligenceService,
  getExecutiveIntelligence,
  resetExecutiveIntelligence,
} from './service';

export type {
  MonthlyRevenueSummary,
  OperationalEfficiency,
  CustomerMetrics,
  FinancialHealth,
  GrowthIndicators,
} from './queries';

export {
  getMonthlyRevenueSummary,
  getOperationalEfficiency,
  getCustomerMetrics,
  getFinancialHealth,
  getGrowthIndicators,
} from './queries';

// Default export: singleton service
export { default } from './service';
