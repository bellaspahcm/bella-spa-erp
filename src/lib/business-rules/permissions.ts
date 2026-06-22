// Re-export shared permission helpers from @bella/shared
export type { RolePermissions } from '@bella/shared';
export {
  isAdminRole,
  SIDEBAR_MODULE_BY_LABEL,
  resolveSidebarModuleId,
  isSidebarItemAllowed,
} from '@bella/shared';

// Web-specific permission functions below
const AI_COPILOT_ROLES = new Set(['admin', 'super_admin', 'accountant']);

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

export function canUseAiCopilotRole(role: string | null | undefined) {
  return AI_COPILOT_ROLES.has(normalizeRole(role));
}

export function canAccessAiCopilot(input: {
  role: string | null | undefined;
  tenantId?: string | null;
}) {
  return Boolean(input.tenantId) && canUseAiCopilotRole(input.role);
}

export function isManualPermittedByRole(role: string | null | undefined, slug: string) {
  const normalizedRole = normalizeRole(role);
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedRole) return false;
  if (normalizedSlug === 'sop' || normalizedSlug === 'index') return true;
  if (normalizedRole === 'admin') return true;
  if (normalizedSlug === 'ktv') return ['ktv', 'ktv_lead', 'hr'].includes(normalizedRole);
  if (normalizedSlug === 'hr') return normalizedRole === 'hr';
  if (normalizedSlug === 'accountant') return normalizedRole === 'accountant';
  return false;
}
