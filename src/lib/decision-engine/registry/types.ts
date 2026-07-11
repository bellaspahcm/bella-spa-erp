/**
 * Policy Registry Types (Enterprise-Grade v2.0)
 * 
 * Multi-version support, audit trail, governance fields
 */

// ============================================================================
// POLICY TYPE (Temporary - should be imported from decision engine)
// ============================================================================

import type { Policy as EnginePolicy } from '../types';

export interface Policy extends EnginePolicy {
  config?: Record<string, unknown>;
}

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type PolicyStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export type PolicyAction = 
  | 'created'
  | 'updated'
  | 'published'
  | 'deprecated'
  | 'archived'
  | 'deleted'
  | 'restored';

export type DecisionOutcome = 'approve' | 'reject';

// ============================================================================
// POLICY REGISTRY ENTRY
// ============================================================================

export interface PolicyRegistryEntry {
  id: string;
  
  // Policy Identification (Composite Key)
  policyId: string; // Policy family ID (e.g., "leave-approval")
  version: string; // Semver version (e.g., "1.0.0", "1.1.0", "2.0.0")
  
  // Basic Info
  name: string;
  description?: string;
  status: PolicyStatus;
  category?: string;
  tenantId?: string;
  
  // Multi-Version Management
  isActive: boolean; // Only one version can be active
  parentVersion?: string; // Previous version (e.g., "1.0.0")
  
  // Timestamps
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  publishedAt?: string;
  publishedBy?: string;
  deprecatedAt?: string;
  archivedAt?: string;
  
  // Soft Delete
  deletedAt?: string;
  deletedBy?: string;
  
  // Governance
  ownerDepartment?: string;
  businessOwner?: string;
  businessOwnerEmail?: string;
  technicalOwner?: string;
  technicalOwnerEmail?: string;
  reviewDate?: string; // ISO date string
  effectiveDate?: string;
  expireDate?: string;
  
  // Config
  config?: Record<string, unknown>;
  metadata?: PolicyMetadata;
}

export interface PolicyMetadata {
  tags?: string[];
  documentation?: string; // URL or markdown
  changelog?: string;
  sla?: {
    maxLatency: number; // ms
    targetAvailability: number; // percentage (99.9)
  };
}

// ============================================================================
// POLICY HISTORY (AUDIT TRAIL)
// ============================================================================

export interface PolicyHistoryEntry {
  id: string;
  policyId: string;
  version: string;
  action: PolicyAction;
  fieldChanged?: string; // 'status', 'business_owner', etc.
  oldValue?: unknown; // JSONB
  newValue?: unknown; // JSONB
  reason?: string;
  createdAt: string;
  createdBy: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// POLICY STATISTICS
// ============================================================================

export interface PolicyStatistics {
  policyId: string;
  version: string;
  totalDecisions: number;
  totalApprovals: number;
  totalRejections: number;
  
  // Calculated fields (not stored)
  approvalRate?: number; // percentage
  rejectionRate?: number; // percentage
  avgConfidence?: number; // 0-1
  
  // Performance Metrics
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  
  lastDecisionAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface RegisterPolicyInput {
  policy: Policy; // From existing Policy type
  createdBy: string;
  
  // Optional fields
  category?: string;
  tenantId?: string;
  parentVersion?: string; // For creating new version from existing
  
  // Governance
  ownerDepartment?: string;
  businessOwner?: string;
  businessOwnerEmail?: string;
  technicalOwner?: string;
  technicalOwnerEmail?: string;
  reviewDate?: string; // ISO date string
  effectiveDate?: string;
  expireDate?: string;
  
  // Metadata
  tags?: string[];
  documentation?: string;
}

export interface UpdatePolicyMetadataInput {
  name?: string;
  description?: string;
  ownerDepartment?: string;
  businessOwner?: string;
  businessOwnerEmail?: string;
  technicalOwner?: string;
  technicalOwnerEmail?: string;
  reviewDate?: string;
  effectiveDate?: string;
  expireDate?: string;
  metadata?: Partial<PolicyMetadata>;
}

export interface LogAuditInput {
  policyId: string;
  version: string;
  action: PolicyAction;
  fieldChanged?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface PolicyRegistryFilters {
  status?: PolicyStatus;
  category?: string;
  tenantId?: string;
  ownerDepartment?: string;
  isActive?: boolean;
  
  // Governance filters
  expiringSoon?: boolean; // expires within 30 days
  needsReview?: boolean; // review date passed
  expired?: boolean; // past expire date
  
  // Text search
  searchQuery?: string; // Search in name, description
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'review_date' | 'expire_date';
  sortOrder?: 'asc' | 'desc';
}

export interface PolicyHistoryFilters {
  policyId?: string;
  version?: string;
  action?: PolicyAction;
  createdBy?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface PolicyListResult {
  policies: PolicyRegistryEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PolicyVersionsResult {
  policyId: string;
  versions: PolicyRegistryEntry[];
  activeVersion?: string;
  latestVersion?: string;
}

export interface GovernanceCheckResult {
  policyId: string;
  version: string;
  passed: boolean;
  warnings: string[];
  errors: string[];
  checks: {
    reviewDateValid: boolean;
    expireDateValid: boolean;
    ownershipComplete: boolean;
    governanceComplete: boolean;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class PolicyRegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PolicyRegistryError';
  }
}

export class PolicyNotFoundError extends PolicyRegistryError {
  constructor(policyId: string, version?: string) {
    super(
      `Policy not found: ${policyId}${version ? ` v${version}` : ''}`,
      'POLICY_NOT_FOUND',
      { policyId, version }
    );
  }
}

export class PolicyVersionConflictError extends PolicyRegistryError {
  constructor(policyId: string, version: string) {
    super(
      `Policy version already exists: ${policyId} v${version}`,
      'VERSION_CONFLICT',
      { policyId, version }
    );
  }
}

export class InvalidStatusTransitionError extends PolicyRegistryError {
  constructor(currentStatus: PolicyStatus, newStatus: PolicyStatus) {
    super(
      `Invalid status transition: ${currentStatus} → ${newStatus}`,
      'INVALID_STATUS_TRANSITION',
      { currentStatus, newStatus }
    );
  }
}

export class GovernanceValidationError extends PolicyRegistryError {
  constructor(message: string, failures: string[]) {
    super(message, 'GOVERNANCE_VALIDATION_FAILED', { failures });
  }
}

export class PermissionDeniedError extends PolicyRegistryError {
  constructor(action: string, userId: string) {
    super(
      `Permission denied: ${action}`,
      'PERMISSION_DENIED',
      { action, userId }
    );
  }
}
