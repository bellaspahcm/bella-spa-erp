/**
 * Decision Engine Platform - Public API
 * 
 * Main entry point for Decision Engine Platform.
 * All public APIs are exported from this file.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md
 */

// ============ Types ============
export type {
  DecisionContext,
  DecisionUser,
  DecisionOptions,
  DecisionResult,
  DecisionAction,
  DecisionError,
} from './types';

export {
  createDecisionContext,
  validateDecisionContext,
  sanitizeDecisionContext,
  createSuccessResult,
  createFallbackResult,
  createErrorResult,
  interpretResult,
  validateDecisionResult,
  sanitizeDecisionResult,
} from './types';

// ============ Abstractions ============
export type {
  IDecisionProvider,
  IDecisionProviderMetadata,
  ProviderFactory,
  ProviderRegistrationOptions,
} from './abstractions';

export { BaseDecisionProvider } from './abstractions';

// ============ Core Components ============
export {
  DecisionEngine,
  DecisionProviderRegistry,
  createDecisionEngine,
  createProviderRegistry,
} from './core';

// ============ Providers ============
export { RuleProvider } from './providers';
export type { IfThenRule } from './providers';

// Future providers (commented out for now)
// export { BIProvider } from './providers';
// export { AIProvider } from './providers';
// export { ExternalProvider } from './providers';
// export { ManualProvider } from './providers';
// export { CompositeProvider } from './providers';

// ============ Errors ============
export {
  DecisionEngineError,
  ValidationError,
  ConfigurationError,
  ProviderEvaluationError,
  RuleParsingError,
  ProviderConflictError,
  ProviderNotFoundError,
  TimeoutError,
  DecisionEngineErrorCode,
  ErrorRecoveryStrategies,
  isDecisionEngineError,
  isErrorOfType,
  getErrorCode,
  formatErrorMessage,
  createErrorDetails,
  wrapError,
  safeErrorHandler,
  retryWithBackoff,
  getRecoveryStrategy,
} from './errors';

export type { ErrorRecoveryStrategy, ErrorHandler } from './errors';

// ============ Bootstrap & DI ============
export {
  bootstrapDecisionEngine,
  bootstrapForTesting,
  bootstrapForProduction,
  getDecisionEngine,
  resetDecisionEngine,
  createDecisionEngineManual,
  registerProvider,
  subscribeToDecisions,
} from './bootstrap';

export type { BootstrapOptions, DecisionEngineInstance } from './bootstrap';

// ============ Cache Layer ============
export type {
  ICache,
  CacheStats,
  CacheConfig,
  CacheEntry,
  ICacheStrategy,
} from './cache';

export {
  createCacheConfig,
  InMemoryCache,
  createInMemoryCache,
  RedisCache,
  createRedisCache,
  createRedisCacheFromUrl,
  DefaultCacheStrategy,
  ConservativeCacheStrategy,
  AggressiveCacheStrategy,
  NoCacheStrategy,
  RuleBasedCacheStrategy,
  createCacheStrategy,
  generateDecisionCacheKey,
  generateRuleCacheKey,
  generateBIQueryCacheKey,
  generateMLModelCacheKey,
  generateInvalidationPattern,
  generateTimedCacheKey,
  hashObject,
  sortObjectKeys,
  parseCacheKey,
  matchesCachePattern,
  calculateValueSize,
  formatBytes,
} from './cache';

export type { RedisCacheConfig } from './cache/RedisCache';

// ============ Re-exports (for convenience) ============

/**
 * Quick start example
 * 
 * @example
 * ```typescript
 * import { bootstrapDecisionEngine, type DecisionContext } from '@/lib/decision-engine';
 * 
 * // Bootstrap engine
 * const { engine } = bootstrapDecisionEngine();
 * 
 * // Create context
 * const context: DecisionContext = {
 *   tenantId: 'bella-spa-vn',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'if-then',
 *   rule: {
 *     condition: { field: 'amount', operator: '<', value: 5000000 },
 *     action: { approve: true }
 *   },
 *   data: { amount: 3000000 }
 * };
 * 
 * // Evaluate decision
 * const result = await engine.evaluate(context);
 * 
 * if (result.approved) {
 *   console.log('Booking approved!');
 * } else {
 *   console.log('Booking rejected:', result.reason);
 * }
 * ```
 */

/**
 * Advanced usage example
 * 
 * @example
 * ```typescript
 * import {
 *   bootstrapDecisionEngine,
 *   registerProvider,
 *   subscribeToDecisions,
 *   type DecisionContext,
 *   type DecisionResult,
 * } from '@/lib/decision-engine';
 * 
 * // Bootstrap with custom configuration
 * const instance = bootstrapDecisionEngine({
 *   debug: true,
 *   providers: [new RuleProvider()]
 * });
 * 
 * // Subscribe to decision events
 * subscribeToDecisions(instance, 'decision.evaluated', async (event) => {
 *   console.log('Decision made:', event.data);
 *   await auditLog.save(event);
 * });
 * 
 * // Evaluate decisions
 * const result = await instance.engine.evaluate(context);
 * ```
 */

/**
 * Testing example
 * 
 * @example
 * ```typescript
 * import { bootstrapForTesting } from '@/lib/decision-engine';
 * 
 * describe('Booking Approval', () => {
 *   it('should approve small bookings', async () => {
 *     const { engine } = bootstrapForTesting();
 *     
 *     const result = await engine.evaluate({
 *       tenantId: 'test',
 *       module: 'booking',
 *       decisionType: 'auto-approval',
 *       ruleType: 'if-then',
 *       rule: {
 *         condition: { field: 'amount', operator: '<', value: 5000000 },
 *         action: { approve: true }
 *       },
 *       data: { amount: 3000000 }
 *     });
 *     
 *     expect(result.approved).toBe(true);
 *   });
 * });
 * ```
 */
