/**
 * Forecast Intelligence Service - Main Entry Point
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Exports all forecasting functions and types
 */

// Export types
export * from './types';

// Export forecast functions
export { forecastRevenue } from './revenue-forecast';
export { forecastChurn } from './churn-forecast';
export { forecastDemand } from './demand-forecast';

// Export service wrapper (class and singleton instance)
export { ForecastService, forecastService } from './service';
