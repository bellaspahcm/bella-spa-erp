/**
 * Policy Registry - Barrel Export
 * 
 * Centralized export for all registry modules
 */

// Main Registry Façade
export { PolicyRegistry } from './PolicyRegistry';

// Service Classes
export { PolicyRepository } from './PolicyRepository';
export { PolicyAuditService } from './PolicyAuditService';
export { PolicyStatisticsService } from './PolicyStatisticsService';
export { PolicyGovernanceService } from './PolicyGovernanceService';
export { PolicyLifecycleService } from './PolicyLifecycleService';

// RBAC Utilities
export * from './rbac';

// Validation Utilities
export * from './validation';

// Types
export type {
  PolicyStatus,
  PolicyAction,
  DecisionOutcome,
  PolicyRegistryEntry,
  PolicyMetadata,
  PolicyHistoryEntry,
  PolicyStatistics,
  RegisterPolicyInput,
  UpdatePolicyMetadataInput,
  LogAuditInput,
  PolicyRegistryFilters,
  PolicyHistoryFilters,
  PolicyListResult,
  PolicyVersionsResult,
  GovernanceCheckResult,
} from './types';

// Error Classes
export {
  PolicyRegistryError,
  PolicyNotFoundError,
  PolicyVersionConflictError,
  InvalidStatusTransitionError,
  GovernanceValidationError,
  PermissionDeniedError,
} from './types';

// Constants
export {
  POLICY_STATUSES,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
  VALID_STATUS_TRANSITIONS,
  POLICY_ACTIONS,
  POLICY_ACTION_LABELS,
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABELS,
  OWNER_DEPARTMENTS,
  GOVERNANCE_DEFAULTS,
  VALIDATION_RULES,
  PAGINATION_DEFAULTS,
  CACHE_TTL,
  ERROR_CODES,
  POLICY_PERMISSIONS,
  ROLE_PERMISSIONS,
} from './constants';

export type { PolicyCategory, OwnerDepartment, PolicyPermission } from './constants';
