/**
 * Feature Flag Service
 * 
 * Manages feature flags, rollout strategies, and A/B testing.
 * Enforces Constitution Law 9 (Zero Regression Guarantee).
 * 
 * Key Responsibilities:
 * - Feature flag evaluation (tenant/user context)
 * - Rollout strategy execution (instant, canary, progressive, dark, manual)
 * - A/B testing support
 * - Flag lifecycle management
 * 
 * @module platform/host/feature-flags
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FeatureFlag,
  FeatureFlagContext,
  FeatureFlagEvaluationResult,
  EvaluationReason,
  FeatureFlagQueryFilter,
  FeatureFlagUpdateRequest,
  RolloutStrategy,
} from './types';

/**
 * Feature Flag Service
 * 
 * Singleton service managing feature flags with database persistence.
 */
export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private cache: Map<string, FeatureFlag>;
  private cacheExpiry: number = 60000; // 60 seconds
  private lastCacheUpdate: number = 0;

  private constructor(private readonly supabase: SupabaseClient) {
    this.cache = new Map();
  }

  /**
   * Initialize singleton instance
   * 
   * @param supabase - Supabase client
   */
  public static initialize(supabase: SupabaseClient): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService(supabase);
    }
    return FeatureFlagService.instance;
  }

  /**
   * Get singleton instance
   * 
   * @throws Error if not initialized
   */
  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      throw new Error('FeatureFlagService not initialized. Call initialize() first.');
    }
    return FeatureFlagService.instance;
  }

  // ==========================================================================
  // Feature Flag Evaluation (Primary Use Case)
  // ==========================================================================

  /**
   * Check if a feature flag is enabled for given context
   * 
   * @param flagKey - Feature flag key
   * @param context - Evaluation context (tenant, user, etc.)
   * @returns True if flag is enabled
   */
  public async isEnabled(
    flagKey: string,
    context: FeatureFlagContext = {}
  ): Promise<boolean> {
    const result = await this.evaluate(flagKey, context);
    return result.enabled;
  }

  /**
   * Evaluate a feature flag with full details
   * 
   * @param flagKey - Feature flag key
   * @param context - Evaluation context
   * @returns Evaluation result with reason and metadata
   */
  public async evaluate(
    flagKey: string,
    context: FeatureFlagContext = {}
  ): Promise<FeatureFlagEvaluationResult> {
    // Get flag from cache or database
    const flag = await this.getFlag(flagKey);

    if (!flag) {
      return {
        flagKey,
        enabled: false,
        reason: 'not-found',
        metadata: { evaluatedAt: new Date().toISOString() },
      };
    }

    // Check expiration
    if (flag.expiresAt && new Date(flag.expiresAt) < new Date()) {
      return {
        flagKey,
        enabled: false,
        reason: 'expired',
        metadata: { evaluatedAt: new Date().toISOString() },
      };
    }

    // Evaluate based on strategy
    const evaluation = this.evaluateStrategy(flag, context);

    // Log evaluation (for analytics)
    this.logEvaluation(flagKey, evaluation, context);

    return evaluation;
  }

  /**
   * Batch evaluate multiple flags
   * 
   * @param flagKeys - Array of flag keys
   * @param context - Evaluation context
   * @returns Map of flag key to evaluation result
   */
  public async evaluateBatch(
    flagKeys: string[],
    context: FeatureFlagContext = {}
  ): Promise<Map<string, FeatureFlagEvaluationResult>> {
    const results = new Map<string, FeatureFlagEvaluationResult>();

    await Promise.all(
      flagKeys.map(async (key) => {
        const result = await this.evaluate(key, context);
        results.set(key, result);
      })
    );

    return results;
  }

  // ==========================================================================
  // Feature Flag Management
  // ==========================================================================

  /**
   * Create a new feature flag
   * 
   * @param flag - Feature flag definition
   * @returns Created flag
   */
  public async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    // Validate flag
    this.validateFlag(flag);

    const now = new Date().toISOString();
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: now,
      updatedAt: now,
    };

    // Insert into database
    const { data, error } = await this.supabase
      .from('feature_flags')
      .insert({
        key: newFlag.key,
        name: newFlag.name,
        description: newFlag.description,
        enabled: newFlag.enabled,
        rollout_strategy: newFlag.rolloutStrategy,
        rollout_percentage: newFlag.rolloutPercentage,
        enabled_tenants: newFlag.enabledTenants,
        disabled_tenants: newFlag.disabledTenants,
        enabled_users: newFlag.enabledUsers,
        disabled_users: newFlag.disabledUsers,
        tags: newFlag.tags,
        owner: newFlag.owner,
        expires_at: newFlag.expiresAt,
        created_at: newFlag.createdAt,
        updated_at: newFlag.updatedAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create feature flag: ${error.message}`);
    }

    // Update cache
    this.cache.set(newFlag.key, newFlag);

    console.log(`[FeatureFlags] Created: ${newFlag.key}`);
    return newFlag;
  }

  /**
   * Update an existing feature flag
   * 
   * @param flagKey - Flag key to update
   * @param updates - Partial flag updates
   * @returns Updated flag
   */
  public async updateFlag(
    flagKey: string,
    updates: FeatureFlagUpdateRequest
  ): Promise<FeatureFlag> {
    const flag = await this.getFlag(flagKey);
    if (!flag) {
      throw new Error(`Feature flag ${flagKey} not found`);
    }

    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      key: flag.key, // Immutable
      createdAt: flag.createdAt, // Immutable
      updatedAt: new Date().toISOString(),
    };

    // Update database
    const { error } = await this.supabase
      .from('feature_flags')
      .update({
        enabled: updatedFlag.enabled,
        rollout_strategy: updatedFlag.rolloutStrategy,
        rollout_percentage: updatedFlag.rolloutPercentage,
        enabled_tenants: updatedFlag.enabledTenants,
        disabled_tenants: updatedFlag.disabledTenants,
        enabled_users: updatedFlag.enabledUsers,
        disabled_users: updatedFlag.disabledUsers,
        tags: updatedFlag.tags,
        expires_at: updatedFlag.expiresAt,
        updated_at: updatedFlag.updatedAt,
      })
      .eq('key', flagKey);

    if (error) {
      throw new Error(`Failed to update feature flag: ${error.message}`);
    }

    // Update cache
    this.cache.set(flagKey, updatedFlag);

    console.log(`[FeatureFlags] Updated: ${flagKey}`);
    return updatedFlag;
  }

  /**
   * Delete a feature flag
   * 
   * @param flagKey - Flag key to delete
   */
  public async deleteFlag(flagKey: string): Promise<void> {
    const { error } = await this.supabase
      .from('feature_flags')
      .delete()
      .eq('key', flagKey);

    if (error) {
      throw new Error(`Failed to delete feature flag: ${error.message}`);
    }

    // Remove from cache
    this.cache.delete(flagKey);

    console.log(`[FeatureFlags] Deleted: ${flagKey}`);
  }

  // ==========================================================================
  // Feature Flag Retrieval
  // ==========================================================================

  /**
   * Get a feature flag by key
   * 
   * @param flagKey - Flag key
   * @returns Feature flag or undefined if not found
   */
  public async getFlag(flagKey: string): Promise<FeatureFlag | undefined> {
    // Check cache first
    if (this.cache.has(flagKey) && this.isCacheValid()) {
      return this.cache.get(flagKey);
    }

    // Query database
    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('key', flagKey)
      .single();

    if (error || !data) {
      return undefined;
    }

    const flag = this.mapDatabaseToFlag(data);
    this.cache.set(flagKey, flag);

    return flag;
  }

  /**
   * Query feature flags by filters
   * 
   * @param filter - Query filter
   * @returns Array of matching flags
   */
  public async queryFlags(filter: FeatureFlagQueryFilter = {}): Promise<FeatureFlag[]> {
    let query = this.supabase.from('feature_flags').select('*');

    if (filter.key) {
      query = query.eq('key', filter.key);
    }
    if (filter.enabled !== undefined) {
      query = query.eq('enabled', filter.enabled);
    }
    if (filter.strategy) {
      query = query.eq('rollout_strategy', filter.strategy);
    }
    if (filter.owner) {
      query = query.eq('owner', filter.owner);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query feature flags: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToFlag);
  }

  /**
   * Get all feature flags
   * 
   * @returns Array of all flags
   */
  public async getAllFlags(): Promise<FeatureFlag[]> {
    return this.queryFlags();
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private evaluateStrategy(
    flag: FeatureFlag,
    context: FeatureFlagContext
  ): FeatureFlagEvaluationResult {
    const metadata = {
      rolloutPercentage: flag.rolloutPercentage,
      strategy: flag.rolloutStrategy,
      evaluatedAt: new Date().toISOString(),
    };

    // User blacklist (highest priority)
    if (context.userId && flag.disabledUsers?.includes(context.userId)) {
      return {
        flagKey: flag.key,
        enabled: false,
        reason: 'user-blacklist',
        metadata,
      };
    }

    // User whitelist
    if (context.userId && flag.enabledUsers?.includes(context.userId)) {
      return {
        flagKey: flag.key,
        enabled: true,
        reason: 'user-whitelist',
        metadata,
      };
    }

    // Tenant blacklist
    if (context.tenantId && flag.disabledTenants?.includes(context.tenantId)) {
      return {
        flagKey: flag.key,
        enabled: false,
        reason: 'tenant-blacklist',
        metadata,
      };
    }

    // Tenant whitelist
    if (context.tenantId && flag.enabledTenants?.includes(context.tenantId)) {
      return {
        flagKey: flag.key,
        enabled: true,
        reason: 'tenant-whitelist',
        metadata,
      };
    }

    // Strategy-based evaluation
    switch (flag.rolloutStrategy) {
      case 'instant':
        return {
          flagKey: flag.key,
          enabled: flag.enabled,
          reason: flag.enabled ? 'default-enabled' : 'default-disabled',
          metadata,
        };

      case 'manual':
        // Manual strategy: only enabled via whitelist (already checked above)
        return {
          flagKey: flag.key,
          enabled: false,
          reason: 'default-disabled',
          metadata,
        };

      case 'progressive':
      case 'canary':
        // Percentage-based rollout
        if (flag.rolloutPercentage !== undefined) {
          const enabled = this.isInRolloutPercentage(
            flag.key,
            context.tenantId || context.userId || '',
            flag.rolloutPercentage
          );
          return {
            flagKey: flag.key,
            enabled,
            reason: 'rollout-percentage',
            metadata,
          };
        }
        // Fallback to default
        return {
          flagKey: flag.key,
          enabled: flag.enabled,
          reason: flag.enabled ? 'default-enabled' : 'default-disabled',
          metadata,
        };

      case 'dark':
        // Dark launch: always disabled (feature hidden but deployed)
        return {
          flagKey: flag.key,
          enabled: false,
          reason: 'default-disabled',
          metadata,
        };

      default:
        return {
          flagKey: flag.key,
          enabled: flag.enabled,
          reason: flag.enabled ? 'default-enabled' : 'default-disabled',
          metadata,
        };
    }
  }

  private isInRolloutPercentage(
    flagKey: string,
    identifier: string,
    percentage: number
  ): boolean {
    // Deterministic hash-based rollout
    // Same identifier always gets same result for same flag
    const hash = this.hashString(`${flagKey}:${identifier}`);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private validateFlag(flag: Partial<FeatureFlag>): void {
    if (!flag.key || flag.key.trim() === '') {
      throw new Error('Feature flag key is required');
    }
    if (!flag.name || flag.name.trim() === '') {
      throw new Error('Feature flag name is required');
    }
    if (!flag.description) {
      throw new Error('Feature flag description is required');
    }
    if (flag.rolloutPercentage !== undefined) {
      if (flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100) {
        throw new Error('Rollout percentage must be between 0 and 100');
      }
    }
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  private mapDatabaseToFlag(data: Record<string, unknown>): FeatureFlag {
    return {
      key: data.key as string,
      name: data.name as string,
      description: data.description as string,
      enabled: data.enabled as boolean,
      rolloutStrategy: data.rollout_strategy as RolloutStrategy,
      rolloutPercentage: data.rollout_percentage as number | undefined,
      enabledTenants: data.enabled_tenants as string[] | undefined,
      disabledTenants: data.disabled_tenants as string[] | undefined,
      enabledUsers: data.enabled_users as string[] | undefined,
      disabledUsers: data.disabled_users as string[] | undefined,
      tags: data.tags as string[] | undefined,
      owner: data.owner as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      expiresAt: data.expires_at as string | undefined,
    };
  }

  private logEvaluation(
    flagKey: string,
    result: FeatureFlagEvaluationResult,
    context: FeatureFlagContext
  ): void {
    // In production, send to analytics service
    console.log(
      `[FeatureFlags] Evaluated: ${flagKey} = ${result.enabled} (${result.reason})`,
      { context }
    );
  }
}
