/**
 * PolicyRepository - Data Access Layer
 * 
 * Handles all database operations for policy registry
 * No business logic - pure data access
 */

import { createClient } from '@/lib/supabase-server';
import type {
  PolicyRegistryEntry,
  PolicyRegistryFilters,
  PolicyListResult,
  PolicyVersionsResult,
} from './types';
import { PolicyNotFoundError, PolicyVersionConflictError } from './types';
import { PAGINATION_DEFAULTS } from './constants';

export class PolicyRepository {
  /**
   * Create a new policy version
   */
  static async create(
    data: Omit<PolicyRegistryEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PolicyRegistryEntry> {
    const supabase = await createClient();

    // Check for duplicate (policy_id, version)
    const existing = await this.findByIdAndVersion(data.policyId, data.version);
    if (existing) {
      throw new PolicyVersionConflictError(data.policyId, data.version);
    }

    const { data: policy, error } = await supabase
      .from('policy_registry')
      .insert({
        policy_id: data.policyId,
        version: data.version,
        name: data.name,
        description: data.description,
        status: data.status,
        category: data.category,
        tenant_id: data.tenantId,
        is_active: data.isActive,
        parent_version: data.parentVersion,
        created_by: data.createdBy,
        updated_by: data.updatedBy,
        published_at: data.publishedAt,
        published_by: data.publishedBy,
        owner_department: data.ownerDepartment,
        business_owner: data.businessOwner,
        business_owner_email: data.businessOwnerEmail,
        technical_owner: data.technicalOwner,
        technical_owner_email: data.technicalOwnerEmail,
        review_date: data.reviewDate,
        effective_date: data.effectiveDate,
        expire_date: data.expireDate,
        config: data.config,
        metadata: data.metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return mapDbToEntry(policy);
  }

  /**
   * Find policy by ID and version
   */
  static async findByIdAndVersion(
    policyId: string,
    version: string
  ): Promise<PolicyRegistryEntry | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_registry')
      .select('*')
      .eq('policy_id', policyId)
      .eq('version', version)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data ? mapDbToEntry(data) : null;
  }

  /**
   * Find latest version of a policy
   */
  static async findLatestVersion(policyId: string): Promise<PolicyRegistryEntry | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_registry')
      .select('*')
      .eq('policy_id', policyId)
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapDbToEntry(data) : null;
  }

  /**
   * Find active version of a policy
   */
  static async findActiveVersion(policyId: string): Promise<PolicyRegistryEntry | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_registry')
      .select('*')
      .eq('policy_id', policyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapDbToEntry(data) : null;
  }

  /**
   * Find all versions of a policy
   */
  static async findAllVersions(policyId: string): Promise<PolicyVersionsResult> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('policy_registry')
      .select('*')
      .eq('policy_id', policyId)
      .is('deleted_at', null)
      .order('version', { ascending: false });

    if (error) throw error;

    const versions = data.map(mapDbToEntry);
    const activeVersion = versions.find(v => v.isActive)?.version;
    const latestVersion = versions[0]?.version;

    return {
      policyId,
      versions,
      activeVersion,
      latestVersion,
    };
  }

  /**
   * Find all policies with filters
   */
  static async findAll(filters?: PolicyRegistryFilters): Promise<PolicyListResult> {
    const supabase = await createClient();

    let query = supabase
      .from('policy_registry')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.tenantId) {
      query = query.eq('tenant_id', filters.tenantId);
    }
    if (filters?.ownerDepartment) {
      query = query.eq('owner_department', filters.ownerDepartment);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    // Governance filters
    if (filters?.expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      query = query
        .lte('expire_date', thirtyDaysFromNow.toISOString())
        .gte('expire_date', new Date().toISOString());
    }
    if (filters?.needsReview) {
      query = query.lt('review_date', new Date().toISOString());
    }
    if (filters?.expired) {
      query = query.lt('expire_date', new Date().toISOString());
    }

    // Text search
    if (filters?.searchQuery) {
      query = query.or(
        `name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
      );
    }

    // Sorting
    const sortBy = filters?.sortBy || 'created_at';
    const sortOrder = filters?.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const limit = Math.min(
      filters?.limit || PAGINATION_DEFAULTS.pageSize,
      PAGINATION_DEFAULTS.maxPageSize
    );
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const policies = (data || []).map(mapDbToEntry);
    const total = count || 0;
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < total;

    return {
      policies,
      total,
      page,
      pageSize: limit,
      hasMore,
    };
  }

  /**
   * Update policy version
   */
  static async update(
    policyId: string,
    version: string,
    updates: Partial<PolicyRegistryEntry>
  ): Promise<PolicyRegistryEntry> {
    const supabase = await createClient();

    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    // Map camelCase to snake_case
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.category) dbUpdates.category = updates.category;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.publishedAt) dbUpdates.published_at = updates.publishedAt;
    if (updates.publishedBy) dbUpdates.published_by = updates.publishedBy;
    if (updates.deprecatedAt) dbUpdates.deprecated_at = updates.deprecatedAt;
    if (updates.archivedAt) dbUpdates.archived_at = updates.archivedAt;
    if (updates.deletedAt) dbUpdates.deleted_at = updates.deletedAt;
    if (updates.deletedBy) dbUpdates.deleted_by = updates.deletedBy;
    if (updates.ownerDepartment) dbUpdates.owner_department = updates.ownerDepartment;
    if (updates.businessOwner) dbUpdates.business_owner = updates.businessOwner;
    if (updates.businessOwnerEmail) dbUpdates.business_owner_email = updates.businessOwnerEmail;
    if (updates.technicalOwner) dbUpdates.technical_owner = updates.technicalOwner;
    if (updates.technicalOwnerEmail) dbUpdates.technical_owner_email = updates.technicalOwnerEmail;
    if (updates.reviewDate) dbUpdates.review_date = updates.reviewDate;
    if (updates.effectiveDate) dbUpdates.effective_date = updates.effectiveDate;
    if (updates.expireDate) dbUpdates.expire_date = updates.expireDate;
    if (updates.config) dbUpdates.config = updates.config;
    if (updates.metadata) dbUpdates.metadata = updates.metadata;
    if (updates.updatedBy) dbUpdates.updated_by = updates.updatedBy;

    const { data, error } = await supabase
      .from('policy_registry')
      .update(dbUpdates)
      .eq('policy_id', policyId)
      .eq('version', version)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new PolicyNotFoundError(policyId, version);

    return mapDbToEntry(data);
  }

  /**
   * Set active version (deactivate all others)
   */
  static async setActive(policyId: string, version: string): Promise<void> {
    const supabase = await createClient();

    // Deactivate all versions
    await supabase
      .from('policy_registry')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('policy_id', policyId)
      .is('deleted_at', null);

    // Activate specified version
    const { error } = await supabase
      .from('policy_registry')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('policy_id', policyId)
      .eq('version', version)
      .is('deleted_at', null);

    if (error) throw error;
  }

  /**
   * Soft delete policy version
   */
  static async softDelete(
    policyId: string,
    version: string,
    deletedBy: string
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('policy_registry')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        is_active: false, // Can't be active if deleted
        updated_at: new Date().toISOString(),
      })
      .eq('policy_id', policyId)
      .eq('version', version)
      .is('deleted_at', null);

    if (error) throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database snake_case to TypeScript camelCase
 */
function mapDbToEntry(dbRow: any): PolicyRegistryEntry {
  return {
    id: dbRow.id,
    policyId: dbRow.policy_id,
    version: dbRow.version,
    name: dbRow.name,
    description: dbRow.description,
    status: dbRow.status,
    category: dbRow.category,
    tenantId: dbRow.tenant_id,
    isActive: dbRow.is_active,
    parentVersion: dbRow.parent_version,
    createdAt: dbRow.created_at,
    createdBy: dbRow.created_by,
    updatedAt: dbRow.updated_at,
    updatedBy: dbRow.updated_by,
    publishedAt: dbRow.published_at,
    publishedBy: dbRow.published_by,
    deprecatedAt: dbRow.deprecated_at,
    archivedAt: dbRow.archived_at,
    deletedAt: dbRow.deleted_at,
    deletedBy: dbRow.deleted_by,
    ownerDepartment: dbRow.owner_department,
    businessOwner: dbRow.business_owner,
    businessOwnerEmail: dbRow.business_owner_email,
    technicalOwner: dbRow.technical_owner,
    technicalOwnerEmail: dbRow.technical_owner_email,
    reviewDate: dbRow.review_date,
    effectiveDate: dbRow.effective_date,
    expireDate: dbRow.expire_date,
    config: dbRow.config,
    metadata: dbRow.metadata,
  };
}
