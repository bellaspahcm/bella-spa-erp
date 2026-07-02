/**
 * Recommendation Engine - Main Entry Point
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Exports all recommendation functions and types
 */

// Export types
export * from './types';

// Export recommendation functions
export { getServiceRecommendations } from './service-recommendation';
export { getUpsellRecommendations } from './upsell-recommendation';
export { getPackageRecommendations } from './package-recommendation';

// Export utilities
export * from './utils';

// Export service wrapper (class and singleton instance)
export { RecommendationService, recommendationService } from './service';
