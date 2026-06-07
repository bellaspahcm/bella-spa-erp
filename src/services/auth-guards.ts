import type { CurrentUser } from '@/types/domain';
import { getCurrentUser } from './user-actions';

type TenantUser = CurrentUser & { tenant_id: string };

export type AuthorizedTenantUserResult =
  | { ok: true; user: TenantUser; tenantId: string; error: null; reason: null }
  | {
      ok: false;
      user: null;
      tenantId: null;
      error: string;
      reason: 'UNAUTHENTICATED' | 'FORBIDDEN';
    };

export function normalizeAuthRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

export function isRoleAllowed(
  role: string | null | undefined,
  allowedRoles?: readonly string[],
) {
  if (!allowedRoles?.length) return true;
  const normalizedRole = normalizeAuthRole(role);
  return allowedRoles.some((allowedRole) => normalizeAuthRole(allowedRole) === normalizedRole);
}

export async function getAuthorizedTenantUser(options: {
  allowedRoles?: readonly string[];
  errorMessage?: string;
} = {}): Promise<AuthorizedTenantUserResult> {
  const currentUser = await getCurrentUser();
  const errorMessage = options.errorMessage ?? 'Yeu cau dang nhap.';

  if (!currentUser?.tenant_id) {
    return {
      ok: false,
      user: null,
      tenantId: null,
      error: errorMessage,
      reason: 'UNAUTHENTICATED',
    };
  }

  if (!isRoleAllowed(currentUser.role, options.allowedRoles)) {
    return {
      ok: false,
      user: null,
      tenantId: null,
      error: errorMessage,
      reason: 'FORBIDDEN',
    };
  }

  return {
    ok: true,
    user: {
      ...currentUser,
      role: normalizeAuthRole(currentUser.role),
      tenant_id: currentUser.tenant_id,
    },
    tenantId: currentUser.tenant_id,
    error: null,
    reason: null,
  };
}
