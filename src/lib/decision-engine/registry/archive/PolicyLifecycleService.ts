/**
 * PolicyLifecycleService - Policy Status Lifecycle Management
 * 
 * Handles status transitions with validation and audit logging
 */

import type { PolicyRegistryEntry, PolicyStatus } from './types';
import { InvalidStatusTransitionError, GovernanceValidationError } from './types';
import { VALID_STATUS_TRANSITIONS, POLICY_STATUSES } from './constants';
import { PolicyRepository } from './PolicyRepository';
import { PolicyAuditService } from './PolicyAuditService';
import { PolicyGovernanceService } from './PolicyGovernanceService';
import { validateStatusTransition } from './validation';

export class PolicyLifecycleService {
  /**
   * Publish a policy (draft → active)
   * 
   * Validates governance before publishing
   */
  static async publish(
    policyId: string,
    version: string,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (policy.status !== 'draft') {
      throw new InvalidStatusTransitionError(policy.status, 'active');
    }

    // Check governance eligibility
    const governanceCheck = await PolicyGovernanceService.checkPublishEligibility(
      policyId,
      version
    );

    if (!governanceCheck.passed) {
      throw new GovernanceValidationError(
        'Policy does not meet governance requirements for publishing',
        governanceCheck.errors
      );
    }

    // Deactivate other versions of this policy
    const existingVersions = await PolicyRepository.findAllVersions(policyId);
    for (const existingVersion of existingVersions) {
      if (existingVersion.isActive && existingVersion.version !== version) {
        await PolicyRepository.setActive(policyId, existingVersion.version, false);
        
        // Log deactivation
        await PolicyAuditService.logChange({
          policyId,
          version: existingVersion.version,
          action: 'updated',
          fieldChanged: 'is_active',
          oldValue: { is_active: true },
          newValue: { is_active: false },
          reason: `Deactivated when v${version} was published`,
          userId,
        });
      }
    }

    // Update status to active and set as active version
    const updates: { status: string; publishedAt: string; publishedBy: string } = {
      status: 'active',
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);
    await PolicyRepository.setActive(policyId, version, true);

    // Log status change
    await PolicyAuditService.logStatusChange(
      policyId,
      version,
      policy.status,
      'active',
      userId,
      reason || `Published policy v${version}`
    );

    // Log publish action
    await PolicyAuditService.logChange({
      policyId,
      version,
      action: 'published',
      oldValue: null,
      newValue: { status: 'active', is_active: true },
      reason: reason || `Published policy v${version}`,
      userId,
    });

    return {
      ...updated,
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
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'deprecated')) {
      throw new InvalidStatusTransitionError(policy.status, 'deprecated');
    }

    // Validate reason is provided
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Deprecation reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // Update status
    const updates: { status: string; deprecatedAt: string } = {
      status: 'deprecated',
      deprecatedAt: new Date().toISOString(),
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // If this was the active version, deactivate it
    if (policy.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }

    // Log status change
    await PolicyAuditService.logStatusChange(
      policyId,
      version,
      policy.status,
      'deprecated',
      userId,
      reason
    );

    // Log deprecate action
    await PolicyAuditService.logChange({
      policyId,
      version,
      action: 'deprecated',
      oldValue: { status: policy.status },
      newValue: { status: 'deprecated' },
      reason,
      userId,
    });

    return {
      ...updated,
      status: 'deprecated',
      deprecatedAt: updates.deprecatedAt,
      isActive: false,
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
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'archived')) {
      throw new InvalidStatusTransitionError(policy.status, 'archived');
    }

    // Validate reason is provided
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Archive reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // Update status
    const updates: { status: string; archivedAt: string } = {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // If this was the active version, deactivate it
    if (policy.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }

    // Log status change
    await PolicyAuditService.logStatusChange(
      policyId,
      version,
      policy.status,
      'archived',
      userId,
      reason
    );

    // Log archive action
    await PolicyAuditService.logChange({
      policyId,
      version,
      action: 'archived',
      oldValue: { status: policy.status },
      newValue: { status: 'archived' },
      reason,
      userId,
    });

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
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate transition
    if (!validateStatusTransition(policy.status, 'active')) {
      throw new InvalidStatusTransitionError(policy.status, 'active');
    }

    // Check governance before reactivating
    const governanceCheck = await PolicyGovernanceService.checkPublishEligibility(
      policyId,
      version
    );

    if (!governanceCheck.passed) {
      throw new GovernanceValidationError(
        'Policy does not meet governance requirements for activation',
        governanceCheck.errors
      );
    }

    // Deactivate other versions
    const existingVersions = await PolicyRepository.findAllVersions(policyId);
    for (const existingVersion of existingVersions) {
      if (existingVersion.isActive && existingVersion.version !== version) {
        await PolicyRepository.setActive(policyId, existingVersion.version, false);
        
        await PolicyAuditService.logChange({
          policyId,
          version: existingVersion.version,
          action: 'updated',
          fieldChanged: 'is_active',
          oldValue: { is_active: true },
          newValue: { is_active: false },
          reason: `Deactivated when v${version} was reactivated`,
          userId,
        });
      }
    }

    // Update status to active
    const updates: { status: string; publishedAt: string; publishedBy: string } = {
      status: 'active',
      publishedAt: policy.publishedAt || new Date().toISOString(),
      publishedBy: policy.publishedBy || userId,
    };

    const updated = await PolicyRepository.update(policyId, version, updates, userId);
    await PolicyRepository.setActive(policyId, version, true);

    // Log status change
    await PolicyAuditService.logStatusChange(
      policyId,
      version,
      policy.status,
      'active',
      userId,
      reason || `Reactivated policy v${version}`
    );

    // Log restore action
    await PolicyAuditService.logChange({
      policyId,
      version,
      action: 'restored',
      oldValue: { status: policy.status },
      newValue: { status: 'active', is_active: true },
      reason: reason || `Reactivated policy v${version}`,
      userId,
    });

    return {
      ...updated,
      status: 'active',
      isActive: true,
    };
  }

  /**
   * Soft delete a policy
   */
  static async softDelete(
    policyId: string,
    version: string,
    userId: string,
    reason: string
  ): Promise<void> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate reason is provided
    if (!reason || reason.trim().length < 10) {
      throw new GovernanceValidationError(
        'Deletion reason is required (minimum 10 characters)',
        ['reason']
      );
    }

    // If active, must deactivate first
    if (policy.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }

    // Soft delete
    await PolicyRepository.softDelete(policyId, version, userId);

    // Log deletion
    await PolicyAuditService.logChange({
      policyId,
      version,
      action: 'deleted',
      oldValue: { status: policy.status, deleted_at: null },
      newValue: { deleted_at: new Date().toISOString() },
      reason,
      userId,
    });
  }

  /**
   * Get current lifecycle status summary
   */
  static async getLifecycleStatus(
    policyId: string,
    version: string
  ): Promise<{
    policy: PolicyRegistryEntry;
    canPublish: boolean;
    canDeprecate: boolean;
    canArchive: boolean;
    canActivate: boolean;
    canDelete: boolean;
    governanceCheck: unknown;
  }> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);
    const governanceCheck = await PolicyGovernanceService.checkGovernance(policyId, version);

    return {
      policy,
      canPublish: validateStatusTransition(policy.status, 'active') && policy.status === 'draft',
      canDeprecate: validateStatusTransition(policy.status, 'deprecated'),
      canArchive: validateStatusTransition(policy.status, 'archived'),
      canActivate: validateStatusTransition(policy.status, 'active') && policy.status === 'deprecated',
      canDelete: true, // Can delete from any status
      governanceCheck,
    };
  }

  /**
   * Get available actions for current status
   */
  static getAvailableActions(status: PolicyStatus): string[] {
    const actions: string[] = [];

    if (status === 'draft') {
      actions.push('publish', 'delete');
    } else if (status === 'active') {
      actions.push('deprecate', 'archive', 'delete');
    } else if (status === 'deprecated') {
      actions.push('activate', 'archive', 'delete');
    } else if (status === 'archived') {
      actions.push('delete');
    }

    return actions;
  }

  /**
   * Validate if transition is allowed
   */
  static isTransitionAllowed(currentStatus: PolicyStatus, newStatus: PolicyStatus): boolean {
    return validateStatusTransition(currentStatus, newStatus);
  }
}
