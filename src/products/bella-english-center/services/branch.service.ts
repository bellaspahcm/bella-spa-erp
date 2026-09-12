/**
 * @fileoverview English Center Branch Service
 * 
 * Product-specific wrapper around Platform Org Unit contract.
 * Handles English Center branch operations with academic context.
 * 
 * Architecture:
 * - Consumes: Platform IOrgUnitContract (E0.1D-R)
 * - Provides: English Center branch business logic
 * - Bounded: English-specific metadata, validation, queries
 * 
 * NOTE: orgUnitEngine imported lazily to avoid build-time Supabase initialization
 */

import type {
  OrgUnit,
  OrgUnitHierarchy,
  CreateOrgUnitInput,
  UpdateOrgUnitInput,
} from '@/platform';

// Lazy import to avoid build-time initialization
let _orgUnitEngine: any = null;
function getOrgUnitEngine() {
  if (!_orgUnitEngine) {
    const platform = require('@/platform');
    _orgUnitEngine = platform.orgUnitEngine;
  }
  return _orgUnitEngine;
}

// ============================================================================
// TYPES
// ============================================================================

export interface CreateEnglishBranchInput {
  tenantId: string;
  name: string;
  code: string;
  regionId?: string;
  address?: string;
  phone?: string;
  email?: string;
  capacity?: number;
  openingHours?: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
}

export interface UpdateEnglishBranchInput {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  capacity?: number;
  openingHours?: {
    weekdays?: string;
    saturday?: string;
    sunday?: string;
  };
}

export interface EnglishBranchStats {
  branchId: string;
  branchName: string;
  totalStudents: number;
  totalClasses: number;
  totalTeachers: number;
  activeEnrollments: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class EnglishBranchService {
  /**
   * Create English Center branch
   * 
   * Wraps Platform orgUnitEngine with English-specific metadata.
   */
  async createBranch(input: CreateEnglishBranchInput): Promise<OrgUnit> {
    const orgUnitEngine = getOrgUnitEngine();
    
    const platformInput: CreateOrgUnitInput = {
      tenantId: input.tenantId,
      unitType: 'branch',
      name: input.name,
      code: input.code,
      parentId: input.regionId,
      metadata: {
        type: 'english_center',
        address: input.address,
        phone: input.phone,
        email: input.email,
        capacity: input.capacity,
        openingHours: input.openingHours,
      },
    };

    return orgUnitEngine.createOrgUnit(platformInput);
  }

  /**
   * Update English Center branch
   */
  async updateBranch(
    branchId: string,
    tenantId: string,
    input: UpdateEnglishBranchInput
  ): Promise<OrgUnit> {
    const orgUnitEngine = getOrgUnitEngine();
    
    // Get existing branch to merge metadata
    const existing = await orgUnitEngine.getOrgUnit(branchId, tenantId);
    if (!existing) {
      const { OrgUnitNotFoundError } = require('@/platform');
      throw new OrgUnitNotFoundError(branchId);
    }

    const platformInput: UpdateOrgUnitInput = {
      name: input.name,
      metadata: {
        ...existing.metadata,
        address: input.address ?? existing.metadata?.address,
        phone: input.phone ?? existing.metadata?.phone,
        email: input.email ?? existing.metadata?.email,
        capacity: input.capacity ?? existing.metadata?.capacity,
        openingHours: input.openingHours
          ? { ...existing.metadata?.openingHours, ...input.openingHours }
          : existing.metadata?.openingHours,
      },
    };

    return orgUnitEngine.updateOrgUnit(branchId, tenantId, platformInput);
  }

  /**
   * Archive English Center branch
   * 
   * Note: Does not delete academic data (enrollments, classes).
   * Only marks branch as inactive.
   */
  async archiveBranch(branchId: string, tenantId: string): Promise<void> {
    const orgUnitEngine = getOrgUnitEngine();
    return orgUnitEngine.archiveOrgUnit(branchId, tenantId);
  }

  /**
   * Get single branch
   */
  async getBranch(branchId: string, tenantId: string): Promise<OrgUnit | null> {
    const orgUnitEngine = getOrgUnitEngine();
    return orgUnitEngine.getOrgUnit(branchId, tenantId);
  }

  /**
   * Get all active branches for tenant
   */
  async getActiveBranches(tenantId: string): Promise<OrgUnit[]> {
    const orgUnitEngine = getOrgUnitEngine();
    return orgUnitEngine.getOrgUnits({
      tenantId,
      unitType: 'branch',
      isActive: true,
    });
  }

  /**
   * Get branch hierarchy (company → region → branch)
   */
  async getBranchHierarchy(
    rootId: string | null,
    tenantId: string
  ): Promise<OrgUnitHierarchy[]> {
    const orgUnitEngine = getOrgUnitEngine();
    return orgUnitEngine.getHierarchy(rootId, tenantId);
  }

  /**
   * Get branches by region
   */
  async getBranchesByRegion(
    regionId: string,
    tenantId: string
  ): Promise<OrgUnit[]> {
    const orgUnitEngine = getOrgUnitEngine();
    return orgUnitEngine.getChildren(regionId, tenantId);
  }

  /**
   * Validate branch exists and is active
   * 
   * Used before creating enrollments/classes at branch.
   */
  async validateActiveBranch(branchId: string, tenantId: string): Promise<boolean> {
    const branch = await this.getBranch(branchId, tenantId);
    return branch !== null && branch.isActive;
  }

  /**
   * Get branch statistics (placeholder - will implement with academic queries)
   * 
   * Note: Requires JOIN with enrollments/classes/teachers tables.
   * Implementation deferred until schema migration complete.
   */
  async getBranchStats(branchId: string, tenantId: string): Promise<EnglishBranchStats> {
    const orgUnitEngine = getOrgUnitEngine();
    const branch = await orgUnitEngine.getOrgUnit(branchId, tenantId);
    
    if (!branch) {
      const { OrgUnitNotFoundError } = require('@/platform');
      throw new OrgUnitNotFoundError(branchId);
    }

    // TODO: Implement actual queries after branch_id added to academic tables
    return {
      branchId: branch.id,
      branchName: branch.name,
      totalStudents: 0,
      totalClasses: 0,
      totalTeachers: 0,
      activeEnrollments: 0,
    };
  }
}

// Singleton instance
export const englishBranchService = new EnglishBranchService();
