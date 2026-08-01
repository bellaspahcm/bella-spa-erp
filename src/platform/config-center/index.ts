/**
 * @fileoverview Platform Config Center
 *
 * Tenant-scoped, reactive configuration management.
 * Supports: feature flags, module toggles, tenant preferences, system defaults.
 * Layers: system default → tenant override → runtime override (highest priority)
 *
 * @module platform/config-center
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConfigSource = 'system_default' | 'tenant' | 'runtime_override';

export interface ConfigEntry<T = unknown> {
  key: string;
  value: T;
  tenantId: string | '__system__';
  source: ConfigSource;
  updatedAt: string;
  updatedBy?: string;
  description?: string;
  /** Whether this config is a feature flag (boolean) */
  isFeatureFlag?: boolean;
  /** Whether this key is protected (cannot be deleted, only updated) */
  protected?: boolean;
}

export type ConfigChangeHandler<T = unknown> = (params: {
  key: string;
  tenantId: string;
  oldValue: T | undefined;
  newValue: T;
  source: ConfigSource;
}) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Config Center
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM = '__system__';

class ConfigCenterClass {
  /** System-wide defaults: key → ConfigEntry */
  private readonly systemDefaults = new Map<string, ConfigEntry>();
  /** Per-tenant overrides: `tenantId:key` → ConfigEntry */
  private readonly tenantStore = new Map<string, ConfigEntry>();
  /** Runtime overrides (in-memory, highest priority): `tenantId:key` → value */
  private readonly runtimeOverrides = new Map<string, unknown>();
  /** Change subscribers: `tenantId:key` → Set<handler> */
  private readonly subscribers = new Map<string, Set<ConfigChangeHandler>>();

  // ── System Defaults ───────────────────────────────────────────────────────

  /**
   * Register a system-wide default. Applies to all tenants unless overridden.
   */
  setDefault<T>(key: string, value: T, meta?: Partial<Pick<ConfigEntry, 'description' | 'isFeatureFlag' | 'protected'>>): void {
    this.systemDefaults.set(key, {
      key,
      value,
      tenantId: SYSTEM,
      source: 'system_default',
      updatedAt: new Date().toISOString(),
      ...meta,
    });
  }

  // ── Tenant Config ─────────────────────────────────────────────────────────

  /**
   * Set a tenant-specific config value.
   */
  set<T>(key: string, value: T, tenantId: string, options?: { updatedBy?: string; description?: string }): void {
    const storeKey = `${tenantId}:${key}`;
    const old = this.get<T>(key, tenantId);
    this.tenantStore.set(storeKey, {
      key,
      value,
      tenantId,
      source: 'tenant',
      updatedAt: new Date().toISOString(),
      updatedBy: options?.updatedBy,
      description: options?.description,
    });
    this.notifySubscribers(key, tenantId, old, value, 'tenant');
  }

  /**
   * Set a runtime override (in-memory, highest priority, survives until cleared).
   */
  setRuntime<T>(key: string, value: T, tenantId: string): void {
    const old = this.get<T>(key, tenantId);
    this.runtimeOverrides.set(`${tenantId}:${key}`, value);
    this.notifySubscribers(key, tenantId, old, value, 'runtime_override');
  }

  /**
   * Get config value. Priority: runtime_override > tenant > system_default.
   * Returns defaultValue if key is not found.
   */
  get<T>(key: string, tenantId: string, defaultValue?: T): T | undefined {
    const runtimeKey = `${tenantId}:${key}`;

    // 1. Runtime override
    if (this.runtimeOverrides.has(runtimeKey)) {
      return this.runtimeOverrides.get(runtimeKey) as T;
    }

    // 2. Tenant override
    const tenantEntry = this.tenantStore.get(runtimeKey);
    if (tenantEntry) return tenantEntry.value as T;

    // 3. System default
    const sysEntry = this.systemDefaults.get(key);
    if (sysEntry) return sysEntry.value as T;

    return defaultValue;
  }

  /**
   * Get typed entry with full metadata.
   */
  getEntry(key: string, tenantId: string): ConfigEntry | undefined {
    const runtimeKey = `${tenantId}:${key}`;
    if (this.runtimeOverrides.has(runtimeKey)) {
      return {
        key, value: this.runtimeOverrides.get(runtimeKey), tenantId,
        source: 'runtime_override', updatedAt: new Date().toISOString(),
      } as ConfigEntry;
    }
    return this.tenantStore.get(runtimeKey) ?? this.systemDefaults.get(key);
  }

  /** Get all config entries for a tenant (merged with system defaults) */
  getAll(tenantId: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // 1. System defaults as base
    for (const [k, v] of this.systemDefaults) {
      result[k] = v.value;
    }

    // 2. Tenant overrides
    const prefix = `${tenantId}:`;
    for (const [k, v] of this.tenantStore) {
      if (k.startsWith(prefix)) {
        result[k.replace(prefix, '')] = v.value;
      }
    }

    // 3. Runtime overrides
    for (const [k, v] of this.runtimeOverrides) {
      if (k.startsWith(prefix)) {
        result[k.replace(prefix, '')] = v;
      }
    }

    return result;
  }

  /**
   * Feature flag helper — returns boolean (defaults to false if not set).
   */
  isEnabled(flagKey: string, tenantId: string): boolean {
    return this.get<boolean>(flagKey, tenantId, false) === true;
  }

  /**
   * Delete a tenant config override (falls back to system default).
   */
  delete(key: string, tenantId: string): boolean {
    const entry = this.tenantStore.get(`${tenantId}:${key}`);
    if (entry?.protected) {
      throw new Error(`[ConfigCenter] Cannot delete protected config key: ${key}`);
    }
    return this.tenantStore.delete(`${tenantId}:${key}`);
  }

  /** Clear runtime override for a key */
  clearRuntime(key: string, tenantId: string): void {
    this.runtimeOverrides.delete(`${tenantId}:${key}`);
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /**
   * Subscribe to config changes for a specific key+tenant.
   * Returns unsubscribe function.
   */
  subscribe<T = unknown>(key: string, tenantId: string, handler: ConfigChangeHandler<T>): () => void {
    const subKey = `${tenantId}:${key}`;
    if (!this.subscribers.has(subKey)) {
      this.subscribers.set(subKey, new Set());
    }
    this.subscribers.get(subKey)!.add(handler as ConfigChangeHandler);
    return () => this.subscribers.get(subKey)?.delete(handler as ConfigChangeHandler);
  }

  private notifySubscribers<T>(key: string, tenantId: string, oldValue: T | undefined, newValue: T, source: ConfigSource): void {
    const handlers = this.subscribers.get(`${tenantId}:${key}`);
    if (!handlers) return;
    for (const h of handlers) {
      try { h({ key, tenantId, oldValue, newValue, source }); } catch { /* non-fatal */ }
    }
  }
}

export const configCenter = new ConfigCenterClass();

// ─────────────────────────────────────────────────────────────────────────────
// Built-in System Defaults
// ─────────────────────────────────────────────────────────────────────────────

// Module feature flags
configCenter.setDefault('feature.commission_provider', false, { isFeatureFlag: true, description: 'Enable new commission provider engine' });
configCenter.setDefault('feature.payroll_provider', false, { isFeatureFlag: true, description: 'Enable new payroll provider engine' });
configCenter.setDefault('feature.decision_engine', false, { isFeatureFlag: true, description: 'Enable Decision Engine routing' });
configCenter.setDefault('feature.ai_orchestrator', false, { isFeatureFlag: true, description: 'Enable AI Platform Orchestrator' });
configCenter.setDefault('feature.notification_hub', true, { isFeatureFlag: true, description: 'Enable Notification Hub' });
configCenter.setDefault('feature.search_engine', false, { isFeatureFlag: true, description: 'Enable platform Search Engine' });
configCenter.setDefault('feature.kpi_engine', false, { isFeatureFlag: true, description: 'Enable KPI Engine compute' });
configCenter.setDefault('feature.activity_stream', true, { isFeatureFlag: true, description: 'Enable Activity Stream recording' });

// System limits
configCenter.setDefault('limits.max_notifications_per_batch', 100, { description: 'Max notifications to send in one batch' });
configCenter.setDefault('limits.activity_stream.max_per_tenant', 1000, { description: 'Max activity entries stored per tenant' });
configCenter.setDefault('limits.search.max_results', 50, { description: 'Max search results per query' });
configCenter.setDefault('limits.dlq.max_attempts', 5, { description: 'Max retry attempts for DLQ jobs' });

// Locale defaults
configCenter.setDefault('locale.default', 'vi-VN', { description: 'Default locale' });
configCenter.setDefault('locale.currency', 'VND', { description: 'Default currency code' });
configCenter.setDefault('locale.timezone', 'Asia/Ho_Chi_Minh', { description: 'Default timezone' });
