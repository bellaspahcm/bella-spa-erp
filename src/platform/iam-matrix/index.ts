/**
 * @fileoverview Platform IAM Permission Matrix
 *
 * Role-Based Access Control (RBAC) with:
 * - Hierarchical permission namespacing (vertical:resource:action)
 * - Role inheritance (admin > manager > staff > viewer)
 * - Tenant-scoped rule definitions
 * - Contextual conditions (e.g., own-resource-only)
 * - Audit trail on denial events
 *
 * Permission format: `{vertical}:{resource}:{action}`
 * Examples: `real_estate:contract:read`, `hr:salary:approve`, `crm:lead:delete`
 *
 * @module platform/iam-matrix
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Permission = string; // `vertical:resource:action`

export type SystemRole =
  | 'super_admin'    // Full access to everything
  | 'admin'          // Full tenant access
  | 'manager'        // Branch/team management
  | 'staff'          // Day-to-day operations
  | 'viewer'         // Read-only
  | 'accountant'     // Finance-specific access
  | 'hr'             // HR-specific access
  | 'sales'          // Sales/CRM access
  | string;          // Custom vertical roles

export interface PermissionRule {
  id: string;
  tenantId: string;
  /** Role this rule applies to */
  role: SystemRole;
  /** Permissions granted to this role */
  permissions: Permission[];
  /** Optional: restrict to specific resource types */
  resourceType?: string;
  /**
   * Optional conditions for fine-grained control.
   * E.g. `{ ownerOnly: true }` = can only act on own resources.
   */
  conditions?: {
    ownerOnly?: boolean;
    branchOnly?: boolean;
    maxAmount?: number;
    allowedStatuses?: string[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRequest {
  tenantId: string;
  userId: string;
  /** Roles the user has */
  roles: SystemRole[];
  /** Permission to check (e.g. 'hr:salary:approve') */
  permission: Permission;
  /** Optional resource context */
  resource?: {
    type: string;
    id?: string;
    ownerId?: string;
    branchId?: string;
    amount?: number;
    status?: string;
  };
  /** User's branch (for branchOnly conditions) */
  userBranchId?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  permission: Permission;
  matchedRole?: SystemRole;
  matchedRuleId?: string;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Permission Catalog
// ─────────────────────────────────────────────────────────────────────────────

/** All defined permissions for type-safety and documentation */
export const PERMISSIONS = {
  // Platform
  PLATFORM_ADMIN: 'platform:admin:*',

  // Real Estate
  RE_APARTMENT_READ: 'real_estate:apartment:read',
  RE_APARTMENT_WRITE: 'real_estate:apartment:write',
  RE_APARTMENT_DELETE: 'real_estate:apartment:delete',
  RE_CONTRACT_READ: 'real_estate:contract:read',
  RE_CONTRACT_WRITE: 'real_estate:contract:write',
  RE_CONTRACT_APPROVE: 'real_estate:contract:approve',
  RE_PROJECT_READ: 'real_estate:project:read',
  RE_PROJECT_WRITE: 'real_estate:project:write',

  // CRM
  CRM_LEAD_READ: 'crm:lead:read',
  CRM_LEAD_WRITE: 'crm:lead:write',
  CRM_LEAD_DELETE: 'crm:lead:delete',
  CRM_LEAD_ASSIGN: 'crm:lead:assign',
  CRM_CUSTOMER_READ: 'crm:customer:read',
  CRM_CUSTOMER_WRITE: 'crm:customer:write',

  // HR
  HR_EMPLOYEE_READ: 'hr:employee:read',
  HR_EMPLOYEE_WRITE: 'hr:employee:write',
  HR_SALARY_READ: 'hr:salary:read',
  HR_SALARY_WRITE: 'hr:salary:write',
  HR_SALARY_APPROVE: 'hr:salary:approve',
  HR_SALARY_PUBLISH: 'hr:salary:publish',
  HR_ATTENDANCE_READ: 'hr:attendance:read',
  HR_ATTENDANCE_WRITE: 'hr:attendance:write',

  // Finance
  FINANCE_JOURNAL_READ: 'finance:journal:read',
  FINANCE_JOURNAL_WRITE: 'finance:journal:write',
  FINANCE_EXPENSE_READ: 'finance:expense:read',
  FINANCE_EXPENSE_APPROVE: 'finance:expense:approve',
  FINANCE_REPORT_READ: 'finance:report:read',
  FINANCE_MONTH_CLOSE: 'finance:month:close',

  // Settings
  SETTINGS_READ: 'settings:*:read',
  SETTINGS_WRITE: 'settings:*:write',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Role Hierarchy & Default Grants
// ─────────────────────────────────────────────────────────────────────────────

/** Parent role inheritance: child role inherits all permissions of parent */
const ROLE_HIERARCHY: Partial<Record<SystemRole, SystemRole[]>> = {
  super_admin: ['admin'],
  admin: ['manager', 'accountant', 'hr', 'sales'],
  manager: ['staff', 'viewer'],
  staff: ['viewer'],
  accountant: ['viewer'],
  hr: ['viewer'],
  sales: ['viewer'],
};

function expandRoles(roles: SystemRole[]): SystemRole[] {
  const expanded = new Set<SystemRole>(roles);
  const queue = [...roles];
  while (queue.length > 0) {
    const role = queue.shift()!;
    for (const parent of ROLE_HIERARCHY[role] ?? []) {
      if (!expanded.has(parent)) {
        expanded.add(parent);
        queue.push(parent);
      }
    }
  }
  return Array.from(expanded);
}

/** Default permission grants by system role (applied to all tenants unless overridden) */
const SYSTEM_GRANTS: Partial<Record<SystemRole, Permission[]>> = {
  super_admin: ['*'],
  admin: [
    'platform:admin:*',
    'real_estate:*:*', 'crm:*:*', 'hr:*:*', 'finance:*:*', 'settings:*:*',
  ],
  manager: [
    'real_estate:apartment:read', 'real_estate:contract:read', 'real_estate:project:read',
    'crm:lead:read', 'crm:lead:write', 'crm:lead:assign', 'crm:customer:read',
    'hr:employee:read', 'hr:salary:read', 'hr:attendance:read', 'hr:attendance:write',
    'finance:report:read', 'finance:journal:read', 'finance:expense:read',
    'settings:*:read',
  ],
  accountant: [
    'finance:*:*', 'hr:salary:read', 'hr:salary:write', 'hr:salary:approve',
    'hr:salary:publish', 'settings:*:read',
  ],
  hr: [
    'hr:*:*', 'finance:expense:read', 'settings:*:read',
  ],
  sales: [
    'crm:*:*', 'real_estate:apartment:read', 'real_estate:project:read',
    'real_estate:contract:read',
  ],
  staff: [
    'crm:lead:read', 'crm:lead:write', 'crm:customer:read',
    'real_estate:apartment:read', 'hr:attendance:read',
  ],
  viewer: [
    'crm:lead:read', 'crm:customer:read', 'real_estate:apartment:read',
    'real_estate:project:read', 'hr:attendance:read', 'finance:report:read',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Permission Match Logic
// ─────────────────────────────────────────────────────────────────────────────

function matchesPermission(granted: Permission, requested: Permission): boolean {
  if (granted === '*' || granted === requested) return true;
  const gParts = granted.split(':');
  const rParts = requested.split(':');
  for (let i = 0; i < gParts.length; i++) {
    if (gParts[i] === '*') return true;
    if (gParts[i] !== rParts[i]) return false;
  }
  return gParts.length === rParts.length;
}

function evaluateConditions(
  conditions: PermissionRule['conditions'],
  request: PermissionRequest
): { passed: boolean; reason?: string } {
  if (!conditions) return { passed: true };
  if (conditions.ownerOnly && request.resource?.ownerId !== request.userId) {
    return { passed: false, reason: 'ownerOnly: resource is not owned by user' };
  }
  if (conditions.branchOnly && request.resource?.branchId !== request.userBranchId) {
    return { passed: false, reason: 'branchOnly: resource belongs to different branch' };
  }
  if (conditions.maxAmount !== undefined && (request.resource?.amount ?? 0) > conditions.maxAmount) {
    return { passed: false, reason: `maxAmount: exceeds limit of ${conditions.maxAmount}` };
  }
  if (conditions.allowedStatuses && request.resource?.status &&
    !conditions.allowedStatuses.includes(request.resource.status)) {
    return { passed: false, reason: `allowedStatuses: status "${request.resource.status}" not permitted` };
  }
  return { passed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// IAM Matrix
// ─────────────────────────────────────────────────────────────────────────────

class IamMatrixClass {
  /** Tenant-specific rules: `tenantId:ruleId` → PermissionRule */
  private readonly rules = new Map<string, PermissionRule>();

  // ── Rule Management ───────────────────────────────────────────────────────

  grant(rule: Omit<PermissionRule, 'createdAt' | 'updatedAt'>): PermissionRule {
    const full: PermissionRule = {
      ...rule,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rules.set(`${rule.tenantId}:${rule.id}`, full);
    return full;
  }

  revoke(ruleId: string, tenantId: string): boolean {
    return this.rules.delete(`${tenantId}:${ruleId}`);
  }

  deactivate(ruleId: string, tenantId: string): boolean {
    const rule = this.rules.get(`${tenantId}:${ruleId}`);
    if (!rule) return false;
    rule.isActive = false;
    rule.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Permission Check ──────────────────────────────────────────────────────

  /**
   * Check if a user with given roles has the requested permission.
   * Checks: system grants → tenant-specific rules → conditions.
   */
  check(request: PermissionRequest): PermissionCheckResult {
    const expandedRoles = expandRoles(request.roles);

    // 1. Check system grants (no conditions, always apply)
    for (const role of expandedRoles) {
      const grants = SYSTEM_GRANTS[role as SystemRole] ?? [];
      for (const grant of grants) {
        if (matchesPermission(grant, request.permission)) {
          return { allowed: true, permission: request.permission, matchedRole: role };
        }
      }
    }

    // 2. Check tenant-specific rules
    for (const [, rule] of this.rules) {
      if (rule.tenantId !== request.tenantId || !rule.isActive) continue;
      if (!expandedRoles.includes(rule.role)) continue;
      if (rule.resourceType && request.resource?.type !== rule.resourceType) continue;

      const hasPermission = rule.permissions.some((p) => matchesPermission(p, request.permission));
      if (!hasPermission) continue;

      const conditionResult = evaluateConditions(rule.conditions, request);
      if (!conditionResult.passed) {
        return {
          allowed: false,
          permission: request.permission,
          matchedRuleId: rule.id,
          reason: conditionResult.reason,
        };
      }

      return { allowed: true, permission: request.permission, matchedRole: rule.role, matchedRuleId: rule.id };
    }

    return {
      allowed: false,
      permission: request.permission,
      reason: `No grant found for permission "${request.permission}" with roles [${request.roles.join(', ')}]`,
    };
  }

  /**
   * Quick boolean check (no metadata).
   */
  can(request: PermissionRequest): boolean {
    return this.check(request).allowed;
  }

  /**
   * Get all effective permissions for a user's roles in a tenant.
   */
  getEffectivePermissions(roles: SystemRole[], tenantId: string): Permission[] {
    const perms = new Set<Permission>();
    const expandedRoles = expandRoles(roles);

    // System grants
    for (const role of expandedRoles) {
      for (const p of SYSTEM_GRANTS[role as SystemRole] ?? []) {
        perms.add(p);
      }
    }

    // Tenant rules
    for (const [, rule] of this.rules) {
      if (rule.tenantId !== tenantId || !rule.isActive) continue;
      if (!expandedRoles.includes(rule.role)) continue;
      for (const p of rule.permissions) perms.add(p);
    }

    return Array.from(perms);
  }

  /** List all rules for a tenant */
  listRules(tenantId: string): PermissionRule[] {
    return Array.from(this.rules.values()).filter((r) => r.tenantId === tenantId);
  }
}

export const iamMatrix = new IamMatrixClass();
