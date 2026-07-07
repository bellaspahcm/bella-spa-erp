/**
 * RBAC (Role-Based Access Control) Utilities
 * 
 * Permission checking for policy registry operations
 */

import { createClient } from '@/lib/supabase/server';
import type { PolicyPermission } from './constants';
import { POLICY_PERMISSIONS, ROLE_PERMISSIONS } from './constants';
import { PermissionDeniedError } from './types';

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if user has a specific permission
 * 
 * Returns true/false without throwing
 */
export async function hasPermission(
  userId: string,
  permission: PolicyPermission
): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId);
    
    // Check if any of the user's roles have this permission
    for (const role of roles) {
      const rolePermissions = ROLE_PERMISSIONS[role] || [];
      if (rolePermissions.includes(permission)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking permission for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check permission and throw if denied
 * 
 * Use this for enforcing permissions before operations
 */
export async function checkPermission(
  userId: string,
  permission: PolicyPermission
): Promise<void> {
  const allowed = await hasPermission(userId, permission);
  
  if (!allowed) {
    throw new PermissionDeniedError(permission, userId);
  }
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: PolicyPermission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: PolicyPermission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, permission))) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// USER ROLE MANAGEMENT
// ============================================================================

/**
 * Get user roles from database
 * 
 * This assumes a user_roles table exists with columns:
 * - user_id: uuid
 * - role: text (e.g., 'admin', 'manager', 'user')
 * 
 * If your auth system is different, modify this function accordingly.
 */
async function getUserRoles(userId: string): Promise<string[]> {
  const supabase = await createClient();
  
  // Try to get roles from user_roles table
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  
  if (error) {
    console.error(`Error fetching roles for user ${userId}:`, error);
    // Fallback to default role
    return ['user'];
  }
  
  if (!data || data.length === 0) {
    // No roles found - default to 'user'
    return ['user'];
  }
  
  return data.map((row) => row.role);
}

/**
 * Get all permissions for a user (across all roles)
 */
export async function getUserPermissions(userId: string): Promise<PolicyPermission[]> {
  const roles = await getUserRoles(userId);
  const permissions = new Set<PolicyPermission>();
  
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach((p) => permissions.add(p));
  }
  
  return Array.from(permissions);
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('admin');
}

/**
 * Check if user is manager or admin
 */
export async function isManagerOrAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('admin') || roles.includes('manager');
}

// ============================================================================
// PERMISSION HELPERS FOR SPECIFIC ACTIONS
// ============================================================================

/**
 * Check if user can create policies
 */
export async function canCreatePolicy(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.CREATE);
}

/**
 * Check if user can publish policies
 */
export async function canPublishPolicy(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.PUBLISH);
}

/**
 * Check if user can deprecate policies
 */
export async function canDeprecatePolicy(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.DEPRECATE);
}

/**
 * Check if user can archive policies
 */
export async function canArchivePolicy(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.ARCHIVE);
}

/**
 * Check if user can delete policies
 */
export async function canDeletePolicy(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.DELETE);
}

/**
 * Check if user can update policies
 */
export async function canUpdatePolicy(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.UPDATE);
}

/**
 * Check if user can view policy history
 */
export async function canViewHistory(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.VIEW_HISTORY);
}

/**
 * Check if user can view policy statistics
 */
export async function canViewStatistics(userId: string): Promise<boolean> {
  return hasPermission(userId, POLICY_PERMISSIONS.VIEW_STATISTICS);
}

// ============================================================================
// PERMISSION ENFORCEMENT (throws on denial)
// ============================================================================

/**
 * Enforce create permission
 */
export async function enforceCreatePermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.CREATE);
}

/**
 * Enforce publish permission
 */
export async function enforcePublishPermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.PUBLISH);
}

/**
 * Enforce deprecate permission
 */
export async function enforceDeprecatePermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.DEPRECATE);
}

/**
 * Enforce archive permission
 */
export async function enforceArchivePermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.ARCHIVE);
}

/**
 * Enforce delete permission
 */
export async function enforceDeletePermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.DELETE);
}

/**
 * Enforce update permission
 */
export async function enforceUpdatePermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.UPDATE);
}

/**
 * Enforce view history permission
 */
export async function enforceViewHistoryPermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.VIEW_HISTORY);
}

/**
 * Enforce view statistics permission
 */
export async function enforceViewStatisticsPermission(userId: string): Promise<void> {
  await checkPermission(userId, POLICY_PERMISSIONS.VIEW_STATISTICS);
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Get permission summary for debugging
 */
export async function getPermissionSummary(userId: string): Promise<{
  userId: string;
  roles: string[];
  permissions: PolicyPermission[];
  canCreate: boolean;
  canPublish: boolean;
  canDeprecate: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  canViewHistory: boolean;
  canViewStatistics: boolean;
}> {
  const roles = await getUserRoles(userId);
  const permissions = await getUserPermissions(userId);
  
  return {
    userId,
    roles,
    permissions,
    canCreate: await canCreatePolicy(userId),
    canPublish: await canPublishPolicy(userId),
    canDeprecate: await canDeprecatePolicy(userId),
    canArchive: await canArchivePolicy(userId),
    canDelete: await canDeletePolicy(userId),
    canUpdate: await canUpdatePolicy(userId),
    canViewHistory: await canViewHistory(userId),
    canViewStatistics: await canViewStatistics(userId),
  };
}
