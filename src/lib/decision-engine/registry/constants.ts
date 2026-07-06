/**
 * Policy Registry Constants
 * 
 * Centralized constants for policy registry
 */

import type { PolicyStatus, PolicyAction } from './types';

// ============================================================================
// STATUS CONSTANTS
// ============================================================================

export const POLICY_STATUSES: Record<PolicyStatus, PolicyStatus> = {
  draft: 'draft',
  active: 'active',
  deprecated: 'deprecated',
  archived: 'archived',
} as const;

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  deprecated: 'Deprecated',
  archived: 'Archived',
};

export const POLICY_STATUS_COLORS: Record<PolicyStatus, string> = {
  draft: 'gray',
  active: 'green',
  deprecated: 'yellow',
  archived: 'red',
};

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

/**
 * Valid status transitions
 * Key: current status
 * Value: array of allowed next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  draft: ['active'],
  active: ['deprecated', 'archived'],
  deprecated: ['active', 'archived'],
  archived: [], // Cannot transition from archived
};

// ============================================================================
// ACTION CONSTANTS
// ============================================================================

export const POLICY_ACTIONS: Record<PolicyAction, PolicyAction> = {
  created: 'created',
  updated: 'updated',
  published: 'published',
  deprecated: 'deprecated',
  archived: 'archived',
  deleted: 'deleted',
  restored: 'restored',
} as const;

export const POLICY_ACTION_LABELS: Record<PolicyAction, string> = {
  created: 'Created',
  updated: 'Updated',
  published: 'Published',
  deprecated: 'Deprecated',
  archived: 'Archived',
  deleted: 'Deleted',
  restored: 'Restored',
};

// ============================================================================
// CATEGORIES
// ============================================================================

export const POLICY_CATEGORIES = [
  'leave',
  'booking',
  'pricing',
  'discount',
  'payroll',
  'commission',
  'inventory',
  'compliance',
  'approval',
  'kpi',
] as const;

export type PolicyCategory = typeof POLICY_CATEGORIES[number];

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  leave: 'Leave Management',
  booking: 'Booking & Reservations',
  pricing: 'Dynamic Pricing',
  discount: 'Discount & Promotion',
  payroll: 'Payroll & Salary',
  commission: 'Commission Calculation',
  inventory: 'Inventory Management',
  compliance: 'Compliance & Regulations',
  approval: 'Approval Workflows',
  kpi: 'KPI & Performance',
};

// ============================================================================
// DEPARTMENTS
// ============================================================================

export const OWNER_DEPARTMENTS = [
  'HR',
  'Finance',
  'Operations',
  'Sales',
  'Marketing',
  'IT',
  'Legal',
  'Customer Service',
] as const;

export type OwnerDepartment = typeof OWNER_DEPARTMENTS[number];

// ============================================================================
// GOVERNANCE DEFAULTS
// ============================================================================

export const GOVERNANCE_DEFAULTS = {
  reviewPeriodDays: 180, // 6 months
  expiryWarningDays: 30, // Warn 30 days before expiry
  defaultSLA: {
    maxLatency: 100, // ms
    targetAvailability: 99.9, // percentage
  },
};

// ============================================================================
// VALIDATION RULES
// ============================================================================

export const VALIDATION_RULES = {
  version: {
    pattern: /^\d+\.\d+\.\d+$/, // Semver format
    examples: ['1.0.0', '1.1.0', '2.0.0'],
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255,
  },
  policyId: {
    pattern: /^[a-z0-9_-]+$/i,
    minLength: 3,
    maxLength: 100,
  },
  name: {
    minLength: 3,
    maxLength: 200,
  },
  description: {
    maxLength: 1000,
  },
  reason: {
    minLength: 10,
    maxLength: 500,
  },
};

// ============================================================================
// PAGINATION DEFAULTS
// ============================================================================

export const PAGINATION_DEFAULTS = {
  pageSize: 20,
  maxPageSize: 100,
};

// ============================================================================
// CACHE SETTINGS
// ============================================================================

export const CACHE_TTL = {
  policyRegistry: 300, // 5 minutes
  policyStatistics: 60, // 1 minute
  policyHistory: 600, // 10 minutes
  activeVersion: 180, // 3 minutes
};

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  GOVERNANCE_VALIDATION_FAILED: 'GOVERNANCE_VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_VERSION_FORMAT: 'INVALID_VERSION_FORMAT',
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  POLICY_EXPIRED: 'POLICY_EXPIRED',
  REVIEW_DATE_PASSED: 'REVIEW_DATE_PASSED',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
} as const;

// ============================================================================
// RBAC PERMISSIONS
// ============================================================================

export const POLICY_PERMISSIONS = {
  CREATE: 'policy:create',
  READ: 'policy:read',
  UPDATE: 'policy:update',
  DELETE: 'policy:delete',
  PUBLISH: 'policy:publish',
  DEPRECATE: 'policy:deprecate',
  ARCHIVE: 'policy:archive',
  VIEW_HISTORY: 'policy:view_history',
  VIEW_STATISTICS: 'policy:view_statistics',
} as const;

export type PolicyPermission = typeof POLICY_PERMISSIONS[keyof typeof POLICY_PERMISSIONS];

// ============================================================================
// ROLE PERMISSIONS MAPPING
// ============================================================================

export const ROLE_PERMISSIONS: Record<string, PolicyPermission[]> = {
  admin: [
    POLICY_PERMISSIONS.CREATE,
    POLICY_PERMISSIONS.READ,
    POLICY_PERMISSIONS.UPDATE,
    POLICY_PERMISSIONS.DELETE,
    POLICY_PERMISSIONS.PUBLISH,
    POLICY_PERMISSIONS.DEPRECATE,
    POLICY_PERMISSIONS.ARCHIVE,
    POLICY_PERMISSIONS.VIEW_HISTORY,
    POLICY_PERMISSIONS.VIEW_STATISTICS,
  ],
  manager: [
    POLICY_PERMISSIONS.CREATE,
    POLICY_PERMISSIONS.READ,
    POLICY_PERMISSIONS.UPDATE,
    POLICY_PERMISSIONS.PUBLISH,
    POLICY_PERMISSIONS.VIEW_HISTORY,
    POLICY_PERMISSIONS.VIEW_STATISTICS,
  ],
  user: [
    POLICY_PERMISSIONS.READ,
    POLICY_PERMISSIONS.VIEW_STATISTICS,
  ],
};
