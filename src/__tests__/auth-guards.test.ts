const mockGetCurrentUser = jest.fn();

jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import {
  getAuthorizedTenantUser,
  isRoleAllowed,
  normalizeAuthRole,
} from '../services/auth-guards';

describe('auth guard helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes roles before comparing allowed roles', () => {
    expect(normalizeAuthRole(' Admin ')).toBe('admin');
    expect(isRoleAllowed(' HR ', ['admin', 'hr'])).toBe(true);
    expect(isRoleAllowed('ktv', ['admin', 'hr'])).toBe(false);
    expect(isRoleAllowed('ktv')).toBe(true);
  });

  it('returns an explicit unauthenticated result when user or tenant is missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const result = await getAuthorizedTenantUser({ allowedRoles: ['admin'] });

    expect(result).toEqual({
      ok: false,
      user: null,
      tenantId: null,
      error: 'Yeu cau dang nhap.',
      reason: 'UNAUTHENTICATED',
    });
  });

  it('returns an explicit forbidden result when role is not allowed', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'ktv-1',
      email: 'ktv@example.com',
      full_name: 'KTV',
      role: 'ktv',
      tenant_id: 'tenant-1',
    });

    const result = await getAuthorizedTenantUser({ allowedRoles: ['admin', 'hr'] });

    expect(result).toEqual({
      ok: false,
      user: null,
      tenantId: null,
      error: 'Yeu cau dang nhap.',
      reason: 'FORBIDDEN',
    });
  });

  it('returns a tenant-scoped user with normalized role when authorized', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'hr-1',
      email: 'hr@example.com',
      full_name: 'HR',
      role: ' HR ',
      tenant_id: 'tenant-1',
    });

    const result = await getAuthorizedTenantUser({ allowedRoles: ['admin', 'hr'] });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      tenantId: 'tenant-1',
      error: null,
      reason: null,
    }));
    if (result.ok) {
      expect(result.user.role).toBe('hr');
      expect(result.user.tenant_id).toBe('tenant-1');
    }
  });
});
