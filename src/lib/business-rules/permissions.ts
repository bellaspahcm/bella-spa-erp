export type RolePermissions = Record<string, boolean>;

const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const AI_COPILOT_ROLES = new Set(['admin', 'super_admin', 'accountant']);

export const SIDEBAR_MODULE_BY_LABEL: Record<string, string> = {
  Dashboard: 'dashboard',
  'AI Copilot': 'ai_copilot',
  'Khách hàng': 'customers',
  'Lịch hẹn': 'bookings',
  'Thẻ liệu trình': 'sessions',
  'Tin nhắn': 'chat',
  'CRM & Zalo': 'crm',
  'Dịch vụ': 'services',
  'Tài chính': 'finance',
  'Đối soát Tài chính': 'reconciliation',
  'Kế toán sổ cái': 'accounting',
  'Kho hàng': 'inventory',
  'Bảng lương': 'salary',
  'Trung tâm giám sát': 'system_monitor',
  'Nhật ký hệ thống': 'audit',
  'Cài đặt': 'settings',
};

const DEFAULT_DENIED_SIDEBAR_LABELS_BY_ROLE: Record<string, Set<string>> = {
  ktv: new Set([
    'Tài chính',
    'Cài đặt',
    'Bảng lương',
    'Đối soát Tài chính',
    'Trung tâm giám sát',
    'Nhật ký hệ thống',
    'Kho hàng',
    'Kế toán sổ cái',
    'AI Copilot',
    'Đối soát Lương (AI)',
  ]),
  ktv_lead: new Set([
    'Tài chính',
    'Cài đặt',
    'Bảng lương',
    'Đối soát Tài chính',
    'Trung tâm giám sát',
    'Nhật ký hệ thống',
    'Kho hàng',
    'Khách hàng',
    'Kế toán sổ cái',
    'AI Copilot',
    'Đối soát Lương (AI)',
  ]),
  admin_staff: new Set([
    'Đối soát Tài chính',
    'Bảng lương',
    'Trung tâm giám sát',
    'Nhật ký hệ thống',
    'Cài đặt',
    'Kế toán sổ cái',
    'AI Copilot',
    'Đối soát Lương (AI)',
  ]),
  accountant: new Set([
    'Khách hàng',
    'Lịch hẹn',
    'Thẻ liệu trình',
    'Tin nhắn',
    'CRM & Zalo',
    'Trung tâm giám sát',
    'Nhật ký hệ thống',
    'Cài đặt',
    'AI Copilot',
  ]),
  hr: new Set([
    'Khách hàng',
    'Lịch hẹn',
    'Tin nhắn',
    'CRM & Zalo',
    'Dịch vụ',
    'Tài chính',
    'Đối soát Tài chính',
    'Kho hàng',
    'Kế toán sổ cái',
    'Trung tâm giám sát',
    'Nhật ký hệ thống',
    'Cài đặt',
    'AI Copilot',
    'Đối soát Lương (AI)',
  ]),
};

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

export function isAdminRole(role: string | null | undefined) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

export function resolveSidebarModuleId(label: string) {
  return SIDEBAR_MODULE_BY_LABEL[label] ?? null;
}

export function isSidebarItemAllowed(input: {
  role: string | null | undefined;
  label: string;
  rolePermissions?: RolePermissions | null;
}) {
  const role = normalizeRole(input.role);
  if (!role || role === 'customer' || isAdminRole(role)) return true;

  const moduleId = resolveSidebarModuleId(input.label);
  if (input.rolePermissions && moduleId && input.rolePermissions[moduleId] === false) {
    return false;
  }

  if (input.rolePermissions) return true;

  return !(DEFAULT_DENIED_SIDEBAR_LABELS_BY_ROLE[role]?.has(input.label) ?? false);
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
