/**
 * PolicyRegistry - Policy Management Façade (Modular Monolith)
 * 
 * Orchestrates policy lifecycle, governance, and statistics.
 * 
 * Architecture:
 * - Façade pattern for public API
 * - Repository for data access
 * - Audit utilities for trail logging
 * - Private methods for Lifecycle, Governance, Statistics
 * 
 * Logical Boundaries (not yet services):
 * - Lifecycle → private methods (publish, deprecate, archive, activate)
 * - Governance → private methods (checkGovernance, validatePublishEligibility)
 * - Statistics → private methods (updateStatistics)
 * 
 * Extraction Rule (Rule of Three):
 * Extract to separate service when:
 * 1. Module exceeds ~300 LOC, OR
 * 2. Module is reused by multiple other modules, OR
 * 3. Module has independent lifecycle/scaling needs
 * 
 * Extension Points:
 * - EventBus integration (TODO)
 * - Cache layer (TODO)
 * - External policy engine integration (TODO)
 */

import type {
  Policy,
  PolicyRegistryEntry,
  RegisterPolicyInput,
  UpdatePolicyMetadataInput,
  PolicyRegistryFilters,
  PolicyListResult,
  PolicyVersionsResult,
  PolicyStatistics,
  PolicyHistoryEntry,
  GovernanceCheckResult,
  DecisionOutcome,
  PolicyStatus,
} from './types';
import {
  PolicyNotFoundError,
  InvalidStatusTransitionError,
  GovernanceValidationError,
} from './types';
import { PolicyRepository } from './PolicyRepository';
import { writeAudit, getHistory, queryHistory, getRecentChanges } from './audit';
import {
  validatePolicy,
  validateVersion,
  validateEmail,
  validateISODate,
  validateStatusTransition,
} from './validation';
import { VALID_STATUS_TRANSITIONS, GOVERNANCE_DEFAULTS } from './constants';
import { createClient } from '@/lib/supabase-server';

/**
 * PolicyRegistry
 * 
 * Main entry point for policy management operations.
 * Orchestrates lifecycle, governance, and statistics.
 */
export class PolicyRegistry {
  // ==========================================================================
  // PUBLIC API - Registration & Retrieval
  // ==========================================================================

  /**
   * Register a new policy
   */
  static async register(
    input: RegisterPolicyInput,
    userId: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:create');

    // Validate policy
    const policyValidation = validatePolicy(input.policy);
    if (!policyValidation.valid) {
      throw new Error(`Policy validation failed: ${policyValidation.errors.join(', ')}`);
    }

    // Validate version format
    const version = input.policy.version || '1.0.0';
    const versionValidation = validateVersion(version);
    if (!versionValidation.valid) {
      throw new Error(`Version validation failed: ${versionValidation.errors.join(', ')}`);
    }

    // Validate governance input
    const governanceValidation = this.validateGovernanceInput({
      businessOwnerEmail: input.businessOwnerEmail,
      technicalOwnerEmail: input.technicalOwnerEmail,
      reviewDate: input.reviewDate,
      effectiveDate: input.effectiveDate,
      expireDate: input.expireDate,
    });

    if (!governanceValidation.valid) {
      throw new Error(`Governance validation failed: ${governanceValidation.errors.join(', ')}`);
    }

    // Create policy via repository
    const policy = await PolicyRepository.create(
      {
        policy: input.policy,
        category: input.category,
        tenantId: input.tenantId,
        parentVersion: input.parentVersion,
        ownerDepartment: input.ownerDepartment,
        businessOwner: input.businessOwner,
        businessOwnerEmail: input.businessOwnerEmail,
        technicalOwner: input.technicalOwner,
        technicalOwnerEmail: input.technicalOwnerEmail,
        reviewDate: input.reviewDate,
        effectiveDate: input.effectiveDate,
        expireDate: input.expireDate,
        metadata: {
          tags: input.tags,
          documentation: input.documentation,
        },
      },
      userId
    );

    // Log creation
    await writeAudit({
      policyId: policy.policyId,
      version: policy.version,
      action: 'created',
      oldValue: null,
      newValue: input.policy,
      reason: `Created policy ${policy.policyId} v${policy.version}`,
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyCreated', { policyId: policy.policyId, version: policy.version });

    return policy;
  }

  /**
   * Get policy by ID and version
   */
  static async get(policyId: string, version?: string): Promise<PolicyRegistryEntry> {
    if (version) {
      return PolicyRepository.findByIdAndVersion(policyId, version);
    } else {
      const active = await PolicyRepository.findActiveVersion(policyId);
      if (!active) {
        throw new PolicyNotFoundError(policyId);
      }
      return active;
    }
  }

  /**
   * Get active version of a policy
   */
  static async getActive(policyId: string): Promise<PolicyRegistryEntry | null> {
    return PolicyRepository.findActiveVersion(policyId);
  }

  /**
   * Get latest version (by semantic version, not necessarily active)
   */
  static async getLatest(policyId: string): Promise<PolicyRegistryEntry | null> {
    return PolicyRepository.findLatestVersion(policyId);
  }

  /**
   * Get all versions of a policy
   */
  static async getVersions(policyId: string): Promise<PolicyVersionsResult> {
    const versions = await PolicyRepository.findAllVersions(policyId);
    const active = versions.find((v) => v.isActive);
    const latest = await PolicyRepository.findLatestVersion(policyId);

    return {
      policyId,
      versions,
      activeVersion: active?.version,
      latestVersion: latest?.version,
    };
  }

  /**
   * List policies with filters
   */
  static async list(filters?: PolicyRegistryFilters): Promise<PolicyListResult> {
    return PolicyRepository.findAll(filters);
  }

  // ==========================================================================
  // PUBLIC API - Lifecycle Management
  // ==========================================================================

  /**
   * Publish a policy (draft → active)
   */
  static async publish(
    policyId: string,
    version: string,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:publish');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'active')) {
      throw new InvalidStatusTransitionError(policy.status, 'active');
    }

    // Check governance eligibility
    const governanceCheck = await this.checkPublishEligibility(policyId, version);
    if (!governanceCheck.passed) {
      throw new GovernanceValidationError(
        'Policy does not meet governance requirements for publishing',
        governanceCheck.errors
      );
    }

    // Deactivate other versions
    await this.deactivateOtherVersions(policyId, version, userId);

    // Update status to active
    const updates: any = {
      status: 'active',
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);
    await PolicyRepository.setActive(policyId, version, true);

    // Log status change
    await writeAudit({
      policyId,
      version,
      action: 'published',
      fieldChanged: 'status',
      oldValue: { status: policy.status },
      newValue: { status: 'active', is_active: true },
      reason: reason || `Published policy v${version}`,
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyPublished', { policyId, version });

    // Invalidate cache
    await this.invalidatePolicyCache(policyId);

    return {
      ...updated,
      status: 'active',
      isActive: true,
      publishedAt: updates.publishedAt,
      publishedBy: updates.publishedBy,
    };
  }

  /**
   * Deprecate a policy (active → deprecated)
   */
  static async deprecate(
    policyId: string,
    version: string,
    userId: string,
    reason: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:deprecate');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'deprecated')) {
      throw new InvalidStatusTransitionError(policy.status, 'deprecated');
    }

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Deprecation reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // Update status
    const updates: any = {
      status: 'deprecated',
      deprecatedAt: new Date().toISOString(),
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // Deactivate if currently active
    if (policy.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }

    // Log status change
    await writeAudit({
      policyId,
      version,
      action: 'deprecated',
      fieldChanged: 'status',
      oldValue: { status: policy.status },
      newValue: { status: 'deprecated' },
      reason,
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyDeprecated', { policyId, version, reason });

    return {
      ...updated,
      status: 'deprecated',
      deprecatedAt: updates.deprecatedAt,
      isActive: false,
    };
  }

  /**
   * Reactivate a deprecated policy (deprecated → active)
   */
  static async activate(
    policyId: string,
    version: string,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:activate');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'active')) {
      throw new InvalidStatusTransitionError(policy.status, 'active');
    }

    // Validate governance before reactivation
    const governanceCheck = await this.checkPublishEligibility(policyId, version);
    if (!governanceCheck.passed) {
      throw new GovernanceValidationError(
        'Policy does not meet governance requirements for reactivation',
        governanceCheck.errors
      );
    }

    // Deactivate other versions
    await this.deactivateOtherVersions(policyId, version, userId);

    // Update status
    const updates: any = {
      status: 'active',
      deprecatedAt: null, // Clear deprecation timestamp
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // Activate this version
    await PolicyRepository.setActive(policyId, version, true);

    // Log status change
    await writeAudit({
      policyId,
      version,
      action: 'restored',
      fieldChanged: 'status',
      oldValue: { status: policy.status },
      newValue: { status: 'active' },
      reason: reason || 'Policy reactivated',
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyRestored', { policyId, version, reason });

    return {
      ...updated,
      status: 'active',
      deprecatedAt: null,
      isActive: true,
    };
  }

  /**
   * Archive a policy (active/deprecated → archived)
   */
  static async archive(
    policyId: string,
    version: string,
    userId: string,
    reason: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:archive');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'archived')) {
      throw new InvalidStatusTransitionError(policy.status, 'archived');
    }

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Archive reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // Update status
    const updates: any = {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // Deactivate if currently active
    if (policy.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }

    // Log status change
    await writeAudit({
      policyId,
      version,
      action: 'archived',
      fieldChanged: 'status',
      oldValue: { status: policy.status },
      newValue: { status: 'archived' },
      reason,
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyArchived', { policyId, version, reason });

    return {
      ...updated,
      status: 'archived',
      archivedAt: updates.archivedAt,
      isActive: false,
    };
  }

  /**
   * Activate a deprecated policy (deprecated → active)
   */
  static async activate(
    policyId: string,
    version: string,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:publish');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'active')) {
      throw new InvalidStatusTransitionError(policy.status, 'active');
    }

    // Check governance before reactivating
    const governanceCheck = await this.checkPublishEligibility(policyId, version);
    if (!governanceCheck.passed) {
      throw new GovernanceValidationError(
        'Policy does not meet governance requirements for activation',
        governanceCheck.errors
      );
    }

    // Deactivate other versions
    await this.deactivateOtherVersions(policyId, version, userId);

    // Update status to active
    const updates: any = {
      status: 'active',
      publishedAt: policy.publishedAt || new Date().toISOString(),
      publishedBy: policy.publishedBy || userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);
    await PolicyRepository.setActive(policyId, version, true);

    // Log status change
    await writeAudit({
      policyId,
      version,
      action: 'restored',
      fieldChanged: 'status',
      oldValue: { status: policy.status },
      newValue: { status: 'active', is_active: true },
      reason: reason || `Reactivated policy v${version}`,
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyActivated', { policyId, version });

    return {
      ...updated,
      status: 'active',
      isActive: true,
    };
  }

  /**
   * Soft delete a policy
   */
  static async delete(
    policyId: string,
    version: string,
    userId: string,
    reason: string
  ): Promise<void> {
    // Check permission
    await this.requirePermission(userId, 'policy:delete');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Deletion reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // Deactivate if currently active
    if (policy.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }

    // Soft delete
    await PolicyRepository.softDelete(policyId, version, userId);

    // Log deletion
    await writeAudit({
      policyId,
      version,
      action: 'deleted',
      oldValue: { status: policy.status, deleted_at: null },
      newValue: { deleted_at: new Date().toISOString() },
      reason,
      userId,
    });

    // Emit event
    await this.emitPolicyEvent('PolicyDeleted', { policyId, version, reason });
  }

  // ==========================================================================
  // PUBLIC API - Metadata & Governance
  // ==========================================================================

  /**
   * Update policy metadata
   */
  static async updateMetadata(
    policyId: string,
    version: string,
    updates: UpdatePolicyMetadataInput,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    // Check permission
    await this.requirePermission(userId, 'policy:update');

    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate governance updates
    const governanceValidation = this.validateGovernanceInput(updates);
    if (!governanceValidation.valid) {
      throw new GovernanceValidationError(
        'Governance validation failed',
        governanceValidation.errors
      );
    }

    // Update policy
    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // Log changes (simplified - log all updates as single audit entry)
    await writeAudit({
      policyId,
      version,
      action: 'updated',
      fieldChanged: 'metadata',
      oldValue: policy,
      newValue: updated,
      reason: reason || 'Updated policy metadata',
      userId,
    });

    return updated;
  }

  /**
   * Check governance compliance
   */
  static async checkGovernance(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    return this.performGovernanceCheck(policyId, version);
  }

  /**
   * Get policies needing review
   */
  static async getPoliciesNeedingReview(): Promise<PolicyRegistryEntry[]> {
    return PolicyRepository.findAll({
      status: 'active',
      needsReview: true,
    });
  }

  /**
   * Get policies expiring soon
   */
  static async getExpiringPolicies(
    daysThreshold: number = GOVERNANCE_DEFAULTS.expiryWarningDays
  ): Promise<PolicyRegistryEntry[]> {
    return PolicyRepository.findAll({
      status: 'active',
      expiringSoon: true,
    });
  }

  // ==========================================================================
  // PUBLIC API - Statistics
  // ==========================================================================

  /**
   * Record a decision
   * 
   * This method is NON-BLOCKING - statistics failures should not break decisions
   */
  static async recordDecision(
    policyId: string,
    version: string,
    outcome: DecisionOutcome,
    confidence?: number,
    latencyMs?: number
  ): Promise<void> {
    try {
      await this.updateStatistics(policyId, version, outcome, confidence);
      
      // Publish metrics
      await this.publishMetric('policy.decision', 1, {
        policy_id: policyId,
        version,
        outcome,
        latency_ms: latencyMs?.toString() || 'unknown',
      });
    } catch (error) {
      // Silently log error - stats are non-critical
      console.error(`Failed to record decision for policy ${policyId} v${version}:`, error);
    }
  }

  /**
   * Get statistics for a policy version
   */
  static async getStatistics(
    policyId: string,
    version?: string
  ): Promise<PolicyStatistics | null> {
    // Extension Point: Authorization
    // if (userId) await AuthService.requirePermission(userId, 'policy:view_statistics');

    const policy = version
      ? await PolicyRepository.findByIdAndVersion(policyId, version)
      : await PolicyRepository.findActiveVersion(policyId);

    if (!policy) return null;

    return {
      policyId: policy.policyId,
      version: policy.version,
      totalDecisions: policy.config?.total_decisions || 0,
      totalApprovals: policy.config?.total_approvals || 0,
      totalRejections: policy.config?.total_rejections || 0,
      approvalRate:
        (policy.config?.total_decisions || 0) > 0
          ? Math.round(
              ((policy.config?.total_approvals || 0) / policy.config.total_decisions) * 10000
            ) / 100
          : 0,
      rejectionRate:
        (policy.config?.total_decisions || 0) > 0
          ? Math.round(
              ((policy.config?.total_rejections || 0) / policy.config.total_decisions) * 10000
            ) / 100
          : 0,
      avgConfidence: policy.config?.avg_confidence,
      lastDecisionAt: policy.config?.last_decision_at,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }

  // ==========================================================================
  // PUBLIC API - Audit Trail
  // ==========================================================================

  /**
   * Get full history for a policy
   */
  static async getHistory(
    policyId: string,
    version?: string
  ): Promise<PolicyHistoryEntry[]> {
    // Extension Point: Authorization
    // if (userId) await AuthService.requirePermission(userId, 'policy:view_history');

    return getHistory({ policyId, version });
  }

  /**
   * Get recent changes across all policies
   */
  static async getRecentChanges(limit: number = 50): Promise<PolicyHistoryEntry[]> {
    return getRecentChanges(limit);
  }

  // ==========================================================================
  // PUBLIC API - Helpers
  // ==========================================================================

  /**
   * Check if policy exists
   */
  static async exists(policyId: string, version?: string): Promise<boolean> {
    try {
      if (version) {
        await PolicyRepository.findByIdAndVersion(policyId, version);
      } else {
        const versions = await PolicyRepository.findAllVersions(policyId);
        return versions.length > 0;
      }
      return true;
    } catch (error) {
      if (error instanceof PolicyNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get policy for execution (returns Policy object)
   */
  static async getForExecution(policyId: string): Promise<Policy> {
    const entry = await this.getActive(policyId);
    if (!entry) {
      throw new PolicyNotFoundError(policyId);
    }
    return entry.config as Policy;
  }

  // ==========================================================================
  // PRIVATE METHODS - Lifecycle
  // ==========================================================================

  /**
   * Deactivate other versions of the same policy
   * 
   * Extension Point: Extract to PolicyLifecycleService when:
   * - Lifecycle logic exceeds 300 LOC
   * - Requires workflow engine integration
   * - Needs complex approval workflows
   */
  private static async deactivateOtherVersions(
    policyId: string,
    currentVersion: string,
    userId: string
  ): Promise<void> {
    const existingVersions = await PolicyRepository.findAllVersions(policyId);
    
    for (const existingVersion of existingVersions) {
      if (existingVersion.isActive && existingVersion.version !== currentVersion) {
        await PolicyRepository.setActive(policyId, existingVersion.version, false);
        
        await writeAudit({
          policyId,
          version: existingVersion.version,
          action: 'updated',
          fieldChanged: 'is_active',
          oldValue: { is_active: true },
          newValue: { is_active: false },
          reason: `Deactivated when v${currentVersion} was activated`,
          userId,
        });
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - Governance
  // ==========================================================================

  /**
   * Perform governance compliance check
   * 
   * Extension Point: Extract to PolicyGovernanceService when:
   * - Governance rules exceed 300 LOC
   * - Requires integration with external policy engines
   * - Needs complex approval workflows
   */
  private static async performGovernanceCheck(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    const warnings: string[] = [];
    const errors: string[] = [];
    const checks = {
      reviewDateValid: true,
      expireDateValid: true,
      ownershipComplete: true,
      governanceComplete: true,
    };

    // Check review date
    if (policy.reviewDate) {
      const reviewDate = new Date(policy.reviewDate);
      const now = new Date();
      
      if (reviewDate < now) {
        checks.reviewDateValid = false;
        warnings.push(`Review date has passed: ${policy.reviewDate}`);
      }
    } else {
      checks.reviewDateValid = false;
      warnings.push('No review date set');
    }

    // Check expire date
    if (policy.expireDate) {
      const expireDate = new Date(policy.expireDate);
      const now = new Date();
      
      if (expireDate < now) {
        checks.expireDateValid = false;
        errors.push(`Policy has expired: ${policy.expireDate}`);
      }
    }

    // Check ownership
    if (!policy.businessOwner || !policy.businessOwnerEmail) {
      checks.ownershipComplete = false;
      errors.push('Business owner information is incomplete');
    }
    
    if (!policy.technicalOwner || !policy.technicalOwnerEmail) {
      checks.ownershipComplete = false;
      warnings.push('Technical owner information is incomplete');
    }

    // Check governance fields
    if (!policy.ownerDepartment) {
      checks.governanceComplete = false;
      warnings.push('Owner department not set');
    }
    
    if (!policy.effectiveDate) {
      checks.governanceComplete = false;
      warnings.push('Effective date not set');
    }

    return {
      policyId,
      version,
      passed: errors.length === 0,
      warnings,
      errors,
      checks,
    };
  }

  /**
   * Check if policy is eligible for publishing
   */
  private static async checkPublishEligibility(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    const result = await this.performGovernanceCheck(policyId, version);
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Add strict publish checks
    if (!policy.businessOwner || !policy.businessOwnerEmail) {
      result.errors.push('Business owner is required for publishing');
      result.passed = false;
    }

    if (!policy.technicalOwner || !policy.technicalOwnerEmail) {
      result.errors.push('Technical owner is required for publishing');
      result.passed = false;
    }

    if (!policy.ownerDepartment) {
      result.errors.push('Owner department is required for publishing');
      result.passed = false;
    }

    if (!policy.effectiveDate) {
      result.errors.push('Effective date is required for publishing');
      result.passed = false;
    }

    return result;
  }

  /**
   * Validate governance input fields
   */
  private static validateGovernanceInput(
    input: UpdatePolicyMetadataInput
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (input.businessOwnerEmail && !validateEmail(input.businessOwnerEmail)) {
      errors.push('Invalid business owner email format');
    }

    if (input.technicalOwnerEmail && !validateEmail(input.technicalOwnerEmail)) {
      errors.push('Invalid technical owner email format');
    }

    if (input.reviewDate && !validateISODate(input.reviewDate)) {
      errors.push('Invalid review date format (must be ISO date string)');
    }

    if (input.effectiveDate && !validateISODate(input.effectiveDate)) {
      errors.push('Invalid effective date format (must be ISO date string)');
    }

    if (input.expireDate && !validateISODate(input.expireDate)) {
      errors.push('Invalid expire date format (must be ISO date string)');
    }

    // Check date logic
    if (input.effectiveDate && input.expireDate) {
      const effectiveDate = new Date(input.effectiveDate);
      const expireDate = new Date(input.expireDate);
      
      if (expireDate <= effectiveDate) {
        errors.push('Expire date must be after effective date');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Statistics
  // ==========================================================================

  /**
   * Update decision statistics
   * 
   * Simple direct UPDATE - no SQL function needed at current scale (<1M decisions/month).
   * 
   * Extension Point: Extract to PolicyStatisticsService when:
   * - Decision volume exceeds ~1M/month
   * - Requires real-time aggregation or complex queries
   * - Needs separate scaling/optimization
   * - Migration path: Extract to policy_statistics table with partitioning
   */
  private static async updateStatistics(
    policyId: string,
    version: string,
    outcome: DecisionOutcome,
    confidence?: number
  ): Promise<void> {
    const supabase = await createClient();

    // Get current policy to calculate new average confidence
    const { data: currentPolicy } = await supabase
      .from('policy_registry')
      .select('total_decisions, avg_confidence')
      .eq('policy_id', policyId)
      .eq('version', version)
      .is('deleted_at', null)
      .single();

    // Calculate new average confidence (if provided)
    let newAvgConfidence = currentPolicy?.avg_confidence;
    if (confidence !== undefined && confidence !== null) {
      const currentTotal = currentPolicy?.total_decisions || 0;
      const currentSum = (currentPolicy?.avg_confidence || 0) * currentTotal;
      newAvgConfidence = Math.round(((currentSum + confidence) / (currentTotal + 1)) * 100) / 100;
    }

    // Simple direct UPDATE - sufficient for Phase 1 scale
    const updates: any = {
      last_decision_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Use Postgres increment operators
    if (outcome === 'approve') {
      const { error } = await supabase.rpc('increment_column', {
        table_name: 'policy_registry',
        column_names: ['total_decisions', 'total_approvals'],
        policy_id: policyId,
        policy_version: version,
        new_avg_confidence: newAvgConfidence,
      });
      
      if (error) {
        // Fallback to simple UPDATE if RPC fails
        console.warn('RPC failed, using fallback UPDATE:', error);
        await supabase
          .from('policy_registry')
          .update({
            ...updates,
            total_decisions: (currentPolicy?.total_decisions || 0) + 1,
            total_approvals: (currentPolicy?.total_approvals || 0) + 1,
            avg_confidence: newAvgConfidence,
          })
          .eq('policy_id', policyId)
          .eq('version', version)
          .is('deleted_at', null);
      }
    } else if (outcome === 'reject') {
      const { error } = await supabase.rpc('increment_column', {
        table_name: 'policy_registry',
        column_names: ['total_decisions', 'total_rejections'],
        policy_id: policyId,
        policy_version: version,
        new_avg_confidence: newAvgConfidence,
      });
      
      if (error) {
        // Fallback to simple UPDATE
        console.warn('RPC failed, using fallback UPDATE:', error);
        await supabase
          .from('policy_registry')
          .update({
            ...updates,
            total_decisions: (currentPolicy?.total_decisions || 0) + 1,
            total_rejections: (currentPolicy?.total_rejections || 0) + 1,
            avg_confidence: newAvgConfidence,
          })
          .eq('policy_id', policyId)
          .eq('version', version)
          .is('deleted_at', null);
      }
    }
  }

  // ==========================================================================
  // EXTENSION POINTS - Integration Wrappers
  // ==========================================================================

  /**
   * Check user permission
   * 
   * Extension Point: AuthService integration
   * Currently: No-op (tests can mock this)
   * Future: await AuthService.requirePermission(userId, permission)
   */
  private static async requirePermission(userId: string, permission: string): Promise<void> {
    // Extension Point: Authorization
    // TODO: Integrate with AuthService when available
    // Example: await AuthService.requirePermission(userId, permission);
    
    // For now, no-op (always allow in development)
    return Promise.resolve();
  }

  /**
   * Emit policy event
   * 
   * Extension Point: EventBus integration
   * Currently: No-op
   * Future: await EventBus.emit(eventName, payload)
   */
  private static async emitPolicyEvent(eventName: string, payload: any): Promise<void> {
    // Extension Point: Event Bus
    // TODO: Integrate with EventBus when available
    // Example: await EventBus.emit(eventName, payload);
    
    // For now, no-op
    return Promise.resolve();
  }

  /**
   * Invalidate policy cache
   * 
   * Extension Point: Cache layer integration
   * Currently: No-op
   * Future: await CacheService.invalidate(`policy:${policyId}`)
   */
  private static async invalidatePolicyCache(policyId: string): Promise<void> {
    // Extension Point: Cache Layer
    // TODO: Integrate with CacheService when available
    // Example: await CacheService.invalidate(`policy:${policyId}`);
    
    // For now, no-op
    return Promise.resolve();
  }

  /**
   * Publish metric
   * 
   * Extension Point: Metrics/observability integration
   * Currently: No-op
   * Future: await MetricsService.publish(metricName, value, tags)
   */
  private static async publishMetric(
    metricName: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    // Extension Point: Metrics/Observability
    // TODO: Integrate with MetricsService when available
    // Example: await MetricsService.publish(metricName, value, tags);
    
    // For now, no-op
    return Promise.resolve();
  }
}
