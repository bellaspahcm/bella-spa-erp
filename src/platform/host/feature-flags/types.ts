/**
 * Feature Flag Platform Types
 * 
 * Type definitions for feature flags, rollout strategies, and A/B testing.
 * Supports Constitution Law 9 (Zero Regression Guarantee).
 * 
 * @module platform/host/feature-flags/types
 */

// ============================================================================
// Feature Flag Core Types
// ============================================================================

export interface FeatureFlag {
  key: string; // Unique identifier (e.g., 'healthcare.new-engine-architecture')
  name: string; // Human-readable name
  description: string;
  enabled: boolean; // Global default state
  rolloutStrategy: RolloutStrategy;
  rolloutPercentage?: number; // For progressive/canary rollout (0-100)
  enabledTenants?: string[]; // Tenant IDs with flag enabled
  disabledTenants?: string[]; // Tenant IDs with flag explicitly disabled
  enabledUsers?: string[]; // User IDs with flag enabled
  disabledUsers?: string[]; // User IDs with flag explicitly disabled
  tags?: string[]; // Tags for grouping (e.g., 'phase-0', 'hospital', 'critical')
  owner: string; // Team or person responsible
  createdAt: string;
  updatedAt: string;
  expiresAt?: string; // Auto-expire date (for temporary flags)
}

/**
 * Rollout Strategy Types
 * - instant: Enable/disable immediately for all
 * - canary: Enable for small percentage, monitor, then expand
 * - progressive: Gradual rollout over time (0% → 100%)
 * - dark: Feature deployed but hidden (for testing)
 * - manual: Explicit tenant/user whitelist only
 */
export type RolloutStrategy = 
  | 'instant' 
  | 'canary' 
  | 'progressive' 
  | 'dark' 
  | 'manual';

// ============================================================================
// Feature Flag Evaluation Context
// ============================================================================

export interface FeatureFlagContext {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  userRole?: string;
  userAttributes?: Record<string, unknown>;
  tenantAttributes?: Record<string, unknown>;
}

// ============================================================================
// Feature Flag Evaluation Result
// ============================================================================

export interface FeatureFlagEvaluationResult {
  flagKey: string;
  enabled: boolean;
  reason: EvaluationReason;
  variant?: string; // For A/B testing
  metadata?: {
    rolloutPercentage?: number;
    strategy?: RolloutStrategy;
    evaluatedAt: string;
  };
}

export type EvaluationReason = 
  | 'default-enabled' 
  | 'default-disabled' 
  | 'tenant-whitelist' 
  | 'tenant-blacklist' 
  | 'user-whitelist' 
  | 'user-blacklist' 
  | 'rollout-percentage' 
  | 'expired' 
  | 'not-found';

// ============================================================================
// Feature Flag Query Filters
// ============================================================================

export interface FeatureFlagQueryFilter {
  key?: string;
  enabled?: boolean;
  strategy?: RolloutStrategy;
  tags?: string[];
  owner?: string;
  expiresAfter?: string; // ISO 8601 datetime
  expiresBefore?: string; // ISO 8601 datetime
}

// ============================================================================
// Feature Flag Update Request
// ============================================================================

export interface FeatureFlagUpdateRequest {
  enabled?: boolean;
  rolloutStrategy?: RolloutStrategy;
  rolloutPercentage?: number;
  enabledTenants?: string[];
  disabledTenants?: string[];
  enabledUsers?: string[];
  disabledUsers?: string[];
  tags?: string[];
  expiresAt?: string;
}

// ============================================================================
// Feature Flag Events
// ============================================================================

export interface FeatureFlagCreatedEvent {
  eventType: 'FeatureFlagCreated';
  timestamp: string;
  flagKey: string;
  enabled: boolean;
  strategy: RolloutStrategy;
  createdBy: string;
}

export interface FeatureFlagUpdatedEvent {
  eventType: 'FeatureFlagUpdated';
  timestamp: string;
  flagKey: string;
  changes: Partial<FeatureFlag>;
  updatedBy: string;
}

export interface FeatureFlagEvaluatedEvent {
  eventType: 'FeatureFlagEvaluated';
  timestamp: string;
  flagKey: string;
  enabled: boolean;
  reason: EvaluationReason;
  context: FeatureFlagContext;
}

// ============================================================================
// A/B Testing Support
// ============================================================================

export interface ABTestConfig {
  flagKey: string;
  variants: ABTestVariant[];
  trafficAllocation: Record<string, number>; // variant → percentage
  metrics: string[]; // Metric keys to track
  startDate: string;
  endDate?: string;
  winningVariant?: string; // Set after test concludes
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  configuration: Record<string, unknown>;
}

// ============================================================================
// Note: Types already exported inline above, no need for re-export block
// ============================================================================
