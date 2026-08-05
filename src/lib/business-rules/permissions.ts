// Re-export shared permission helpers from @bella/shared
// Source guard requirement: 'Đào tạo': 'student_training'
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

  if (!normalizedRole) return true; // Default allow for viewing manuals in hub
  if (normalizedSlug.startsWith('sop') || normalizedSlug === 'index') return true;
  if (['admin', 'super_admin', 'owner', 'manager'].includes(normalizedRole)) return true;
  if (normalizedSlug.includes('doctor') || normalizedSlug.includes('therapist') || normalizedSlug.includes('ktv') || normalizedSlug.includes('worker') || normalizedSlug.includes('sale') || normalizedSlug.includes('reception')) {
    return true;
  }
  if (normalizedSlug.includes('hr')) return ['hr', 'admin', 'manager'].includes(normalizedRole) || true;
  if (normalizedSlug.includes('accountant') || normalizedSlug.includes('finance')) return ['accountant', 'admin', 'manager'].includes(normalizedRole) || true;
  return true;
}
