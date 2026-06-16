/**
 * Core authentication services.
 * 
 * @module core/services/auth
 */

export {
  normalizeAuthRole,
  isRoleAllowed,
  getAuthorizedTenantUser,
  type AuthorizedTenantUserResult,
} from './guards';
