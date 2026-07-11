/**
 * Policy Registry - Barrel Export (Modular Monolith)
 * 
 * Simplified export structure for Phase 1 implementation
 */

// Main Registry Façade
export { PolicyRegistry } from './PolicyRegistry';

// Repository (Infrastructure boundary - keep separate)
export { PolicyRepository } from './PolicyRepository';

// Audit Utilities (Cross-cutting concern - keep separate)
export * from './audit';

// Validation Utilities (Reusable - keep separate)
export * from './validation';

// Types (preserve all concepts, even if not yet implemented as services)
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
  PolicyRegistryFilters,
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
} from './constants';

export type { PolicyCategory, OwnerDepartment } from './constants';
