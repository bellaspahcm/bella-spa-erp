/**
 * @bella/shared - Source of truth for Bella ERP shared code
 * 
 * Export order:
 * 1. Types
 * 2. Constants
 * 3. Validators
 * 4. Utils
 * 5. Permissions
 */

// Types
export type { CurrentUser, AuthState } from './types/auth';
export type { TenantInfo, BookingSummary, StaffRecord } from './types/domain';

// Constants
export { BUSINESS_RULES } from './constants/business-rules';
export type { BusinessRules, SessionMultiplier } from './constants/business-rules';

// Validators
export type { ValidationResult, PasswordStrengthOpts } from './validators/form';
export {
  normalizePhone,
  isVnPhone,
  validateVnPhone,
  isEmail,
  validateEmail,
  validatePassword,
  parseVnd,
} from './validators/form';

// Utils
export {
  formatCurrency,
  parseMoneyInput,
  getLocalDateString,
  formatMoneyInput,
  resolvePackageName,
  sanitizeTime,
} from './utils/format';
export type { BookingForPackageName } from './utils/format';

// Permissions
export type { RolePermissions } from './permissions/roles';
export {
  isAdminRole,
  isTechnicianRole,
  isManagerOrAbove,
  ROLE_GROUPS,
  SIDEBAR_MODULE_BY_LABEL,
  resolveSidebarModuleId,
  isSidebarItemAllowed,
} from './permissions/roles';

// Tenant
export type {
  TenantModuleKey,
  TenantPrimaryBusinessModuleKey,
  TenantEnabledModules,
} from './tenant/module-keys';
export { TENANT_MODULE_KEYS, DEFAULT_ENABLED_MODULES } from './tenant/module-keys';
export {
  normalizeEnabledModules,
  normalizeEnabledModulesForSave,
  getDefaultTenantModuleKey,
  isTenantModuleEnabled,
} from './tenant/module-resolver';
