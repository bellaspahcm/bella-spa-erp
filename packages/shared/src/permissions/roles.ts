/**
 * Permission helpers - Di chuyển từ src/lib/business-rules/permissions.ts
 */

export type RolePermissions = Record<string, boolean>;

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

export function isAdminRole(role: string | null | undefined) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

export const SIDEBAR_MODULE_BY_LABEL: Record<string, string> = {
  Dashboard: 'dashboard',
  'AI Copilot': 'ai_copilot',
  'Khách hàng': 'customers',
  'Lịch hẹn': 'bookings',
  'POS / In bill': 'bookings',
  'Thẻ liệu trình': 'sessions',
  'Tin nhắn': 'chat',
  'CRM & Zalo': 'crm',
  'Dịch vụ': 'services',
  'Đào tạo': 'student_training',
  'Meta Ads': 'marketing_ads',
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
    'Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát Tài chính',
    'Trung tâm giám sát', 'Nhật ký hệ thống', 'Kho hàng',
    'Kế toán sổ cái', 'Meta Ads', 'Đào tạo', 'AI Copilot',
  ]),
  ktv_lead: new Set([
    'Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát Tài chính',
    'Trung tâm giám sát', 'Nhật ký hệ thống', 'Kho hàng', 'Khách hàng',
    'Kế toán sổ cái', 'Meta Ads', 'Đào tạo', 'AI Copilot',
  ]),
  accountant: new Set([
    'Khách hàng', 'Lịch hẹn', 'POS / In bill', 'Thẻ liệu trình',
    'Tin nhắn', 'CRM & Zalo', 'Trung tâm giám sát', 'Nhật ký hệ thống',
    'Cài đặt', 'Meta Ads', 'Đào tạo', 'AI Copilot',
  ]),
};

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
