/**
 * Payroll Configuration Service
 * 
 * Centralized service for managing per-tenant payroll configuration.
 * Implements caching to reduce database load.
 * 
 * Usage:
 * ```typescript
 * const configService = PayrollConfigService.getInstance();
 * const commissionConfig = await configService.getProviderConfig(tenantId, 'commission');
 * 
 * if (commissionConfig.enabled) {
 *   const strategy = getStrategy(commissionConfig.strategy);
 *   const result = strategy.calculate(context, commissionConfig.config);
 * }
 * ```
 * 
 * @see src/types/payroll-config.ts
 */

import { createClient } from '@/lib/supabase-server';
import type {
  ProviderKey,
  ProviderConfig,
  TenantPayrollConfig,
  TenantPayrollConfigHistory,
  UpdateProviderConfigRequest,
  DEFAULT_CONFIGS
} from '@/types/payroll-config';
import { DEFAULT_CONFIGS as DEFAULT_CONFIG_MAP } from '@/types/payroll-config';

// =====================================================
// CACHE CONFIGURATION
// =====================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// =====================================================
// PAYROLL CONFIG SERVICE (Singleton)
// =====================================================

export class PayrollConfigService {
  private static instance: PayrollConfigService | null = null;
  private cache = new Map<string, CacheEntry<ProviderConfig>>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PayrollConfigService {
    if (!PayrollConfigService.instance) {
      PayrollConfigService.instance = new PayrollConfigService();
    }
    return PayrollConfigService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    PayrollConfigService.instance = null;
  }

  // =====================================================
  // PUBLIC METHODS
  // =====================================================

  /**
   * Get provider config for tenant
   * Returns default config if not configured yet
   * 
   * @param tenantId - Tenant UUID
   * @param providerKey - Provider identifier (commission, kpi, etc.)
   * @returns Provider config or default
   */
  async getProviderConfig(
    tenantId: string,
    providerKey: ProviderKey
  ): Promise<ProviderConfig> {
    const cacheKey = `${tenantId}:${providerKey}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[PayrollConfigService] Cache HIT: ${cacheKey}`);
      return cached.value;
    }

    console.log(`[PayrollConfigService] Cache MISS: ${cacheKey}, fetching from DB...`);

    // Load from database
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tenant_payroll_config')
        .select('enabled, strategy, config')
        .eq('tenant_id', tenantId)
        .eq('provider_key', providerKey)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found → return default
          console.log(`[PayrollConfigService] Config not found for ${cacheKey}, using default`);
          return this.getDefaultConfig(providerKey);
        }
        throw error;
      }

      const config: ProviderConfig = {
        enabled: data.enabled,
        strategy: data.strategy,
        config: data.config || {}
      };

      // Cache for TTL
      this.cache.set(cacheKey, {
        value: config,
        expiresAt: Date.now() + CACHE_TTL_MS
      });

      return config;
    } catch (error) {
      console.error(`[PayrollConfigService] Error loading config for ${cacheKey}:`, error);
      // Fallback to default on error
      return this.getDefaultConfig(providerKey);
    }
  }

  /**
   * Get all provider configs for tenant
   * 
   * @param tenantId - Tenant UUID
   * @returns Map of provider configs
   */
  async getAllProviderConfigs(tenantId: string): Promise<Record<ProviderKey, ProviderConfig>> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tenant_payroll_config')
        .select('provider_key, enabled, strategy, config')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const configMap: Record<string, ProviderConfig> = {};

      // Convert array to map
      data?.forEach((row) => {
        configMap[row.provider_key] = {
          enabled: row.enabled,
          strategy: row.strategy,
          config: row.config || {}
        };
      });

      // Fill in defaults for missing providers
      const allProviderKeys: ProviderKey[] = [
        'commission', 'kpi', 'attendance', 'rating', 
        'bonus', 'deduction', 'insurance', 'tax', 
        'advance', 'position', 'seniority', 'shift', 'overtime'
      ];

      allProviderKeys.forEach((key) => {
        if (!configMap[key]) {
          configMap[key] = this.getDefaultConfig(key);
        }
      });

      return configMap as Record<ProviderKey, ProviderConfig>;
    } catch (error) {
      console.error(`[PayrollConfigService] Error loading all configs for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Update provider config
   * Invalidates cache
   * 
   * @param tenantId - Tenant UUID
   * @param providerKey - Provider identifier
   * @param update - Fields to update
   * @param userId - User making the change
   * @returns Updated config
   */
  async updateProviderConfig(
    tenantId: string,
    providerKey: ProviderKey,
    update: UpdateProviderConfigRequest,
    userId: string
  ): Promise<ProviderConfig> {
    try {
      const supabase = createClient();

      // Build update payload
      const payload: Partial<TenantPayrollConfig> = {
        tenant_id: tenantId,
        provider_key: providerKey,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };

      if (update.enabled !== undefined) payload.enabled = update.enabled;
      if (update.strategy !== undefined) payload.strategy = update.strategy;
      if (update.config !== undefined) payload.config = update.config;
      if (update.notes !== undefined) payload.notes = update.notes;

      // Upsert (insert or update)
      const { data, error } = await supabase
        .from('tenant_payroll_config')
        .upsert(payload, {
          onConflict: 'tenant_id,provider_key'
        })
        .select('enabled, strategy, config')
        .single();

      if (error) throw error;

      const config: ProviderConfig = {
        enabled: data.enabled,
        strategy: data.strategy,
        config: data.config || {}
      };

      // Invalidate cache
      const cacheKey = `${tenantId}:${providerKey}`;
      this.cache.delete(cacheKey);
      console.log(`[PayrollConfigService] Cache invalidated: ${cacheKey}`);

      return config;
    } catch (error) {
      console.error(`[PayrollConfigService] Error updating config:`, error);
      throw error;
    }
  }

  /**
   * Enable provider
   * 
   * @param tenantId - Tenant UUID
   * @param providerKey - Provider identifier
   * @param userId - User making the change
   */
  async enableProvider(
    tenantId: string,
    providerKey: ProviderKey,
    userId: string
  ): Promise<void> {
    await this.updateProviderConfig(tenantId, providerKey, { enabled: true }, userId);
  }

  /**
   * Disable provider
   * 
   * @param tenantId - Tenant UUID
   * @param providerKey - Provider identifier
   * @param userId - User making the change
   */
  async disableProvider(
    tenantId: string,
    providerKey: ProviderKey,
    userId: string
  ): Promise<void> {
    await this.updateProviderConfig(tenantId, providerKey, { enabled: false }, userId);
  }

  /**
   * Get config change history
   * 
   * @param tenantId - Tenant UUID
   * @param providerKey - Provider identifier (optional, all if not provided)
   * @param limit - Max records to return
   * @returns Array of history records
   */
  async getConfigHistory(
    tenantId: string,
    providerKey?: ProviderKey,
    limit: number = 50
  ): Promise<TenantPayrollConfigHistory[]> {
    try {
      const supabase = createClient();
      let query = supabase
        .from('tenant_payroll_config_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (providerKey) {
        query = query.eq('provider_key', providerKey);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error(`[PayrollConfigService] Error loading config history:`, error);
      throw error;
    }
  }

  /**
   * Rollback to previous config
   * Uses history table to restore old value
   * 
   * @param tenantId - Tenant UUID
   * @param providerKey - Provider identifier
   * @param historyId - History record ID to rollback to
   * @param userId - User performing rollback
   */
  async rollbackConfig(
    tenantId: string,
    providerKey: ProviderKey,
    historyId: string,
    userId: string
  ): Promise<ProviderConfig> {
    try {
      const supabase = createClient();

      // Get history record
      const { data: history, error: historyError } = await supabase
        .from('tenant_payroll_config_history')
        .select('old_value')
        .eq('id', historyId)
        .eq('tenant_id', tenantId)
        .eq('provider_key', providerKey)
        .single();

      if (historyError) throw historyError;

      if (!history || !history.old_value) {
        throw new Error('Cannot rollback: old value not found');
      }

      // Restore old value
      const oldValue = history.old_value as any;
      return await this.updateProviderConfig(
        tenantId,
        providerKey,
        {
          enabled: oldValue.enabled,
          strategy: oldValue.strategy,
          config: oldValue.config,
          notes: `Rolled back to history ID: ${historyId}`
        },
        userId
      );
    } catch (error) {
      console.error(`[PayrollConfigService] Error rolling back config:`, error);
      throw error;
    }
  }

  /**
   * Clear all cache
   * Useful after bulk updates or in testing
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[PayrollConfigService] Cache cleared');
  }

  /**
   * Clear cache for specific tenant
   * 
   * @param tenantId - Tenant UUID
   */
  clearTenantCache(tenantId: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(`${tenantId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
    console.log(`[PayrollConfigService] Cache cleared for tenant ${tenantId}: ${keysToDelete.length} entries`);
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  /**
   * Get default config for provider
   * Returns sensible defaults if tenant hasn't configured yet
   * 
   * @param providerKey - Provider identifier
   * @returns Default config
   */
  private getDefaultConfig(providerKey: ProviderKey): ProviderConfig {
    const defaultConfig = DEFAULT_CONFIG_MAP[providerKey];

    if (defaultConfig) {
      return defaultConfig;
    }

    // Fallback: disabled by default
    return {
      enabled: false,
      strategy: null,
      config: {}
    };
  }
}

// =====================================================
// EXPORT SINGLETON INSTANCE
// =====================================================

export const payrollConfigService = PayrollConfigService.getInstance();
