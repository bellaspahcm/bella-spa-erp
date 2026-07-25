/**
 * PolicyRegistry - Policy Management Façade (Modular Monolith)
 * 
 * Orchestrates policy lifecycle, governance, and statistics.
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
} from './types';
import {
  PolicyNotFoundError,
  InvalidStatusTransitionError,
  GovernanceValidationError,
} from './types';
import { createClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PolicyRepository } from './PolicyRepository';
import { writeAudit, getHistory, getRecentChanges } from './audit';
import {
  validatePolicy,
  validateVersion,
  validateStatusTransition,
  validateEmail,
  validateISODate,
} from './validation';
import { GOVERNANCE_DEFAULTS } from './constants';

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
    const policy = await PolicyRepository.create({
      policyId: input.policy.id,
      version: version,
      name: input.policy.name,
      description: input.policy.description,
      status: 'draft', // Initial status is always draft
      category: input.category,
      tenantId: input.tenantId,
      isActive: false,
      parentVersion: input.parentVersion,
      createdBy: userId,
      updatedBy: userId,
      ownerDepartment: input.ownerDepartment,
      businessOwner: input.businessOwner,
      businessOwnerEmail: input.businessOwnerEmail,
      technicalOwner: input.technicalOwner,
      technicalOwnerEmail: input.technicalOwnerEmail,
      reviewDate: input.reviewDate,
      effectiveDate: input.effectiveDate,
      expireDate: input.expireDate,
      config: input.policy.config,
      metadata: {
        tags: input.tags,
        documentation: input.documentation,
      },
    });

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
      const entry = await PolicyRepository.findByIdAndVersion(policyId, version);
      if (!entry) {
        throw new PolicyNotFoundError(policyId, version);
      }
      return entry;
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
    const versionsResult = await PolicyRepository.findAllVersions(policyId);
    return versionsResult;
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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

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
    const updates: Partial<PolicyRegistryEntry> = {
      status: 'active',
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
      updatedBy: userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates);
    await PolicyRepository.setActive(policyId, version);

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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

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
    const updates: Partial<PolicyRegistryEntry> = {
      status: 'deprecated',
      deprecatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates);

    // Deactivate if currently active
    if (policy.isActive) {
      // Set active to false (setActive updates all versions matching policyId, but here we just deactivate)
      // Actually Repository's setActive activates one and deactivates others. To deactivate all, we use repository softDelete or updates
      await PolicyRepository.update(policyId, version, { isActive: false });
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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

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
    const updates: Partial<PolicyRegistryEntry> = {
      status: 'active',
      deprecatedAt: undefined, // Clear deprecation timestamp in DB (mapped to null in update helper)
      updatedBy: userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates);

    // Activate this version
    await PolicyRepository.setActive(policyId, version);

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
      deprecatedAt: undefined,
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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

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
    const updates: Partial<PolicyRegistryEntry> = {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates);

    // Deactivate if currently active
    if (policy.isActive) {
      await PolicyRepository.update(policyId, version, { isActive: false });
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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Deletion reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // Deactivate if currently active
    if (policy.isActive) {
      await PolicyRepository.update(policyId, version, { isActive: false });
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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

    // Validate governance updates
    const governanceValidation = this.validateGovernanceInput(updates);
    if (!governanceValidation.valid) {
      throw new GovernanceValidationError(
        'Governance validation failed',
        governanceValidation.errors
      );
    }

    // Map Updates input to entry fields
    const registryUpdates: Partial<PolicyRegistryEntry> = {
      name: updates.name,
      description: updates.description,
      ownerDepartment: updates.ownerDepartment,
      businessOwner: updates.businessOwner,
      businessOwnerEmail: updates.businessOwnerEmail,
      technicalOwner: updates.technicalOwner,
      technicalOwnerEmail: updates.technicalOwnerEmail,
      reviewDate: updates.reviewDate,
      effectiveDate: updates.effectiveDate,
      expireDate: updates.expireDate,
      metadata: updates.metadata ? {
        tags: updates.metadata.tags,
        documentation: updates.metadata.documentation,
        changelog: updates.metadata.changelog,
        sla: updates.metadata.sla,
      } : undefined,
      updatedBy: userId,
    };

    // Update policy
    const updated = await PolicyRepository.update(policyId, version, registryUpdates);

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
    const result = await PolicyRepository.findAll({
      status: 'active',
      needsReview: true,
    });
    return result.policies;
  }

  /**
   * Get policies expiring soon
   */
  static async getExpiringPolicies(
    _daysThreshold: number = GOVERNANCE_DEFAULTS.expiryWarningDays
  ): Promise<PolicyRegistryEntry[]> {
    const result = await PolicyRepository.findAll({
      status: 'active',
      expiringSoon: true,
    });
    return result.policies;
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
    const policy = version
      ? await PolicyRepository.findByIdAndVersion(policyId, version)
      : await PolicyRepository.findActiveVersion(policyId);

    if (!policy) return null;

    return {
      policyId: policy.policyId,
      version: policy.version,
      totalDecisions: policy.config?.total_decisions as number || 0,
      totalApprovals: policy.config?.total_approvals as number || 0,
      totalRejections: policy.config?.total_rejections as number || 0,
      approvalRate:
        (policy.config?.total_decisions as number || 0) > 0
          ? Math.round(
              ((policy.config?.total_approvals as number || 0) / (policy.config?.total_decisions as number)) * 10000
            ) / 100
          : 0,
      rejectionRate:
        (policy.config?.total_decisions as number || 0) > 0
          ? Math.round(
              ((policy.config?.total_rejections as number || 0) / (policy.config?.total_decisions as number)) * 10000
            ) / 100
          : 0,
      avgConfidence: policy.config?.avg_confidence as number,
      lastDecisionAt: policy.config?.last_decision_at as string,
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
        const found = await PolicyRepository.findByIdAndVersion(policyId, version);
        return found !== null;
      } else {
        const versionsResult = await PolicyRepository.findAllVersions(policyId);
        return versionsResult.versions.length > 0;
      }
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
    return entry.config as unknown as Policy;
  }

  // ==========================================================================
  // PRIVATE METHODS - Lifecycle
  // ==========================================================================

  /**
   * Deactivate other versions of the same policy
   */
  private static async deactivateOtherVersions(
    policyId: string,
    currentVersion: string,
    userId: string
  ): Promise<void> {
    const versionsResult = await PolicyRepository.findAllVersions(policyId);
    
    for (const existingVersion of versionsResult.versions) {
      if (existingVersion.isActive && existingVersion.version !== currentVersion) {
        await PolicyRepository.update(policyId, existingVersion.version, { isActive: false });
        
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
   */
  private static async performGovernanceCheck(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

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
    if (!policy) {
      throw new PolicyNotFoundError(policyId, version);
    }

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
   */
  private static async updateStatistics(
    policyId: string,
    version: string,
    outcome: DecisionOutcome,
    confidence?: number
  ): Promise<void> {
    // Use base SupabaseClient (no schema generic) since policy_registry is not
    // in the auto-generated database types. Results are type-asserted below.
    const supabase = (await createClient()) as unknown as SupabaseClient;

    /** Shape of the stats columns we SELECT */
    interface PolicyStatsRow {
      total_decisions: number;
      total_approvals: number;
      total_rejections: number;
      avg_confidence: number;
    }

    // Get current policy to calculate new average confidence
    const { data: rawPolicy } = await supabase
      .from('policy_registry')
      .select('total_decisions, avg_confidence')
      .eq('policy_id', policyId)
      .eq('version', version)
      .is('deleted_at', null)
      .single();

    const currentPolicy = rawPolicy as PolicyStatsRow | null;

    // Calculate new average confidence (if provided)
    let newAvgConfidence: number | undefined = currentPolicy?.avg_confidence;
    if (confidence !== undefined && confidence !== null) {
      const currentTotal = currentPolicy?.total_decisions || 0;
      const currentSum = (currentPolicy?.avg_confidence || 0) * currentTotal;
      newAvgConfidence = Math.round(((currentSum + confidence) / (currentTotal + 1)) * 100) / 100;
    }

    const updates: Record<string, unknown> = {
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
   */
  private static async requirePermission(_userId: string, _permission: string): Promise<void> {
    // For now, no-op (always allow in development)
    return Promise.resolve();
  }

  /**
   * Emit policy event
   */
  private static async emitPolicyEvent(_eventName: string, _payload: unknown): Promise<void> {
    // For now, no-op
    return Promise.resolve();
  }

  /**
   * Invalidate policy cache
   */
  private static async invalidatePolicyCache(_policyId: string): Promise<void> {
    // For now, no-op
    return Promise.resolve();
  }

  /**
   * Publish metric
   */
  private static async publishMetric(
    _metricName: string,
    _value: number,
    _tags?: Record<string, string>
  ): Promise<void> {
    // For now, no-op
    return Promise.resolve();
  }
}
