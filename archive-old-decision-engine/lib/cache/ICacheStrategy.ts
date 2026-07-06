/**
 * Decision Engine Platform - Cache Strategy Interface
 * 
 * Defines cache behavior strategies for different use cases.
 * Strategies determine when to cache, how long to cache, and when to invalidate.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 15
 */

import type { DecisionContext, DecisionResult } from '../types';

/**
 * Cache strategy interface
 * 
 * Determines caching behavior for decision results.
 */
export interface ICacheStrategy {
  /**
   * Strategy name (for logging and identification)
   */
  readonly name: string;

  /**
   * Determine if this decision should be cached
   * 
   * @param context - Decision context
   * @returns True if result should be cached
   * 
   * @example
   * ```typescript
   * // Don't cache user-specific decisions
   * shouldCache(context) {
   *   return !context.user; // Only cache if no user context
   * }
   * ```
   */
  shouldCache(context: DecisionContext): boolean;

  /**
   * Determine TTL (time-to-live) for cached result
   * 
   * @param context - Decision context
   * @param result - Decision result
   * @returns TTL in seconds, or undefined for no expiration
   * 
   * @example
   * ```typescript
   * // Cache high-confidence results longer
   * getTTL(context, result) {
   *   return result.confidence > 0.9 ? 600 : 300; // 10 min vs 5 min
   * }
   * ```
   */
  getTTL(context: DecisionContext, result: DecisionResult): number | undefined;

  /**
   * Determine if cached result should be invalidated
   * 
   * @param context - Decision context
   * @param cachedResult - Cached decision result
   * @returns True if cached result should be invalidated
   * 
   * @example
   * ```typescript
   * // Invalidate if result is too old
   * shouldInvalidate(context, cachedResult) {
   *   const age = Date.now() - cachedResult.timestamp.getTime();
   *   return age > 300000; // Older than 5 minutes
   * }
   * ```
   */
  shouldInvalidate(
    context: DecisionContext,
    cachedResult: DecisionResult
  ): boolean;
}

/**
 * Default cache strategy
 * 
 * - Caches all decisions
 * - Default TTL: 300 seconds (5 minutes)
 * - No custom invalidation logic
 */
export class DefaultCacheStrategy implements ICacheStrategy {
  readonly name = 'default';

  constructor(private readonly defaultTTL: number = 300) {}

  shouldCache(context: DecisionContext): boolean {
    // Cache all decisions by default
    return true;
  }

  getTTL(context: DecisionContext, result: DecisionResult): number {
    return this.defaultTTL;
  }

  shouldInvalidate(
    context: DecisionContext,
    cachedResult: DecisionResult
  ): boolean {
    // Rely on TTL for expiration
    return false;
  }
}

/**
 * Conservative cache strategy
 * 
 * - Only caches high-confidence decisions
 * - Shorter TTL for fallback results
 * - Invalidates on low confidence
 */
export class ConservativeCacheStrategy implements ICacheStrategy {
  readonly name = 'conservative';

  constructor(
    private readonly normalTTL: number = 300,
    private readonly fallbackTTL: number = 60
  ) {}

  shouldCache(context: DecisionContext): boolean {
    // Don't cache user-specific decisions (require fresh evaluation)
    if (context.user) {
      return false;
    }

    // Don't cache dry-run decisions
    if (context.options?.dryRun) {
      return false;
    }

    return true;
  }

  getTTL(context: DecisionContext, result: DecisionResult): number {
    // Shorter TTL for fallback results (they may be transient errors)
    if (result.isFallback) {
      return this.fallbackTTL;
    }

    // Shorter TTL for low-confidence results
    if (result.confidence < 0.7) {
      return this.normalTTL / 2;
    }

    return this.normalTTL;
  }

  shouldInvalidate(
    context: DecisionContext,
    cachedResult: DecisionResult
  ): boolean {
    // Invalidate fallback results (they should be re-evaluated)
    if (cachedResult.isFallback) {
      return true;
    }

    // Invalidate low-confidence results
    if (cachedResult.confidence < 0.5) {
      return true;
    }

    return false;
  }
}

/**
 * Aggressive cache strategy
 * 
 * - Caches everything (including user-specific decisions)
 * - Longer TTL for high-confidence results
 * - No invalidation (rely on TTL)
 */
export class AggressiveCacheStrategy implements ICacheStrategy {
  readonly name = 'aggressive';

  constructor(
    private readonly normalTTL: number = 600,
    private readonly highConfidenceTTL: number = 1800
  ) {}

  shouldCache(context: DecisionContext): boolean {
    // Cache everything (aggressive)
    return true;
  }

  getTTL(context: DecisionContext, result: DecisionResult): number {
    // Longer TTL for high-confidence results
    if (result.confidence >= 0.9) {
      return this.highConfidenceTTL;
    }

    return this.normalTTL;
  }

  shouldInvalidate(
    context: DecisionContext,
    cachedResult: DecisionResult
  ): boolean {
    // Never invalidate (rely on TTL)
    return false;
  }
}

/**
 * No-cache strategy
 * 
 * - Never caches (for audit-critical decisions)
 * - Always requires fresh evaluation
 */
export class NoCacheStrategy implements ICacheStrategy {
  readonly name = 'no-cache';

  shouldCache(context: DecisionContext): boolean {
    return false;
  }

  getTTL(context: DecisionContext, result: DecisionResult): number | undefined {
    return undefined;
  }

  shouldInvalidate(
    context: DecisionContext,
    cachedResult: DecisionResult
  ): boolean {
    // Always invalidate (force fresh evaluation)
    return true;
  }
}

/**
 * Rule-based cache strategy
 * 
 * - Custom rules for each decision type
 * - Flexible TTL based on decision characteristics
 */
export class RuleBasedCacheStrategy implements ICacheStrategy {
  readonly name = 'rule-based';

  constructor(
    private readonly rules: Map<
      string,
      {
        shouldCache?: (context: DecisionContext) => boolean;
        ttl?: number | ((context: DecisionContext, result: DecisionResult) => number);
      }
    >
  ) {}

  shouldCache(context: DecisionContext): boolean {
    const rule = this.rules.get(context.decisionType);

    if (rule?.shouldCache) {
      return rule.shouldCache(context);
    }

    // Default: cache
    return true;
  }

  getTTL(context: DecisionContext, result: DecisionResult): number {
    const rule = this.rules.get(context.decisionType);

    if (rule?.ttl) {
      if (typeof rule.ttl === 'function') {
        return rule.ttl(context, result);
      }
      return rule.ttl;
    }

    // Default: 5 minutes
    return 300;
  }

  shouldInvalidate(
    context: DecisionContext,
    cachedResult: DecisionResult
  ): boolean {
    // Rely on TTL
    return false;
  }
}

/**
 * Create default cache strategy
 * 
 * @param type - Strategy type
 * @param options - Strategy options
 * @returns ICacheStrategy instance
 * 
 * @example
 * ```typescript
 * const strategy = createCacheStrategy('conservative');
 * ```
 */
export function createCacheStrategy(
  type: 'default' | 'conservative' | 'aggressive' | 'no-cache' = 'default',
  options?: {
    defaultTTL?: number;
    normalTTL?: number;
    fallbackTTL?: number;
    highConfidenceTTL?: number;
  }
): ICacheStrategy {
  switch (type) {
    case 'conservative':
      return new ConservativeCacheStrategy(
        options?.normalTTL,
        options?.fallbackTTL
      );
    case 'aggressive':
      return new AggressiveCacheStrategy(
        options?.normalTTL,
        options?.highConfidenceTTL
      );
    case 'no-cache':
      return new NoCacheStrategy();
    case 'default':
    default:
      return new DefaultCacheStrategy(options?.defaultTTL);
  }
}
