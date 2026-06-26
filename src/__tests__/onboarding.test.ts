/**
 * Tests for Branch Onboarding, Owned vs Franchise Selection, and post-onboarding updates.
 * Mocks: next/cache, @sentry/nextjs, @/lib/supabase-server, and audit actions.
 */

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

// Bypass Next.js server-only check
jest.mock('server-only', () => ({}), { virtual: true });

// Setup global spies and mocks
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockCheckHqAuth = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

jest.mock('@/services/hq-actions', () => ({
  checkHqAuth: () => mockCheckHqAuth(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

// Helper class for mock query builders
class MockQueryBuilder {
  public data: any;
  public error: any;
  public updateSpy = jest.fn().mockReturnThis();
  public eqSpy = jest.fn().mockReturnThis();

  constructor(data: any = null, error: any = null) {
    this.data = data;
    this.error = error;
  }

  select() { return this; }
  eq(...args: any[]) { this.eqSpy(...args); return this; }
  update(...args: any[]) { this.updateSpy(...args); return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

import { registerNewTenant } from '../services/onboarding-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { safeRevalidatePath } from '@/lib/revalidate';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

const mockRecordAuditLog = recordAuditLog as jest.Mock;
const mockSafeRevalidatePath = safeRevalidatePath as jest.Mock;
const mockCreateSupabaseJsClient = createSupabaseJsClient as jest.Mock;
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();

describe('Branch Onboarding System (Owned vs Franchise)', () => {
  let tenantQueryMock: MockQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default setup: mock service role key for bypassing email signup
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'mock-auth-user-id' } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
    mockCheckHqAuth.mockResolvedValue({
      authorized: true,
      user: { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant' },
    });
    mockCreateSupabaseJsClient.mockReturnValue({
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: mockDeleteUser,
        },
      },
    });

    tenantQueryMock = new MockQueryBuilder({ success: true });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return tenantQueryMock;
      return new MockQueryBuilder();
    });

    // Mock successful RPC calls
    mockRpc.mockImplementation((name: string) => {
      if (name === 'onboard_tenant') {
        return Promise.resolve({ data: 'mock-tenant-id-123', error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it('should successfully onboard an Owned branch without updating franchise details', async () => {
    const input = {
      spaName: 'Bella Spa Quận 2',
      contactPhone: '0912345678',
      address: '123 Trần Não, Quận 2',
      email: 'q2@bellaspa.vn',
      adminName: 'Vy Nguyễn',
      adminEmail: 'vy.nguyen@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned' as const,
    };

    const result = await registerNewTenant(input);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.tenantId).toBe('mock-tenant-id-123');

    // Verify onboard_tenant RPC was called
    expect(mockRpc).toHaveBeenCalledWith('onboard_tenant', expect.objectContaining({
      p_spa_name: 'Bella Spa Quận 2',
      p_admin_name: 'Vy Nguyễn',
    }));

    // Verify that the table was NOT updated (since it is owned, not franchise)
    expect(mockFrom).not.toHaveBeenCalledWith('tenants');
    expect(tenantQueryMock.updateSpy).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INSERT',
      table_name: 'tenants',
      record_id: 'mock-tenant-id-123',
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRecordAuditLog.mock.invocationCallOrder[0]).toBeLessThan(
      mockSafeRevalidatePath.mock.invocationCallOrder[0],
    );
    expect(mockCheckHqAuth).not.toHaveBeenCalled();
  });

  it('should block Beauty Spa onboarding outside Admin HQ before auth and database writes', async () => {
    mockCheckHqAuth.mockResolvedValueOnce({
      authorized: false,
      error: 'Trang này chỉ dành cho quản trị viên Bella Spa Headquarter.',
    });

    const result = await registerNewTenant({
      spaName: 'Beauty Spa External',
      contactPhone: '0912345678',
      address: '123 Beauty',
      email: 'beauty@external.vn',
      adminName: 'Beauty Admin',
      adminEmail: 'beauty.admin@external.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
      businessModule: 'beauty_spa',
    });

    expect(result).toEqual({
      success: false,
      error: 'Chỉ Admin HQ mới được setup tenant Beauty Spa.',
    });
    expect(mockCheckHqAuth).toHaveBeenCalledTimes(1);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should allow Admin HQ to onboard a Beauty Spa tenant locked to Beauty Spa only', async () => {
    const result = await registerNewTenant({
      spaName: 'Beauty Spa Premium',
      contactPhone: '0912345678',
      address: '123 Beauty',
      email: 'beauty@spa.vn',
      adminName: 'Beauty Admin',
      adminEmail: 'beauty.admin@spa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
      businessModule: 'beauty_spa',
    });

    expect(result.success).toBe(true);
    expect(mockCheckHqAuth).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      enabled_modules: { babycare: false, beauty_spa: true, student_training: false, industrial_cleaning: false },
    }));
    expect(tenantQueryMock.updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      enabled_modules: expect.objectContaining({ babycare: true }),
    }));
    expect(tenantQueryMock.eqSpy).toHaveBeenCalledWith('id', 'mock-tenant-id-123');
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      new_data: expect.objectContaining({
        business_module: 'beauty_spa',
        enabled_modules: { babycare: false, beauty_spa: true, student_training: false, industrial_cleaning: false },
      }),
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('should successfully onboard a Franchise branch and update agreement date and royalty type', async () => {
    const input = {
      spaName: 'Bella Spa Thủ Đức',
      contactPhone: '0987654321',
      address: '456 Võ Văn Ngân, Thủ Đức',
      email: 'thuduc@bellaspa.vn',
      adminName: 'Trang Phạm',
      adminEmail: 'trang.pham@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'franchise' as const,
    };

    const result = await registerNewTenant(input);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.tenantId).toBe('mock-tenant-id-123');

    // Verify the tenants table was queried for updates
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    
    // Verify the update contained correct franchise values
    const today = new Date().toISOString().split('T')[0];
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      franchise_agreement_date: today,
      royalty_type: 'percentage',
    }));

    // Verify the correct tenant ID was targeted
    expect(tenantQueryMock.eqSpy).toHaveBeenCalledWith('id', 'mock-tenant-id-123');
  });

  it('should correctly propagate errors and fail the onboarding if the franchise post-update query fails', async () => {
    const input = {
      spaName: 'Bella Spa Bình Thạnh',
      contactPhone: '0909090909',
      address: '789 Điện Biên Phủ, Bình Thạnh',
      email: 'binhthanh@bellaspa.vn',
      adminName: 'Hương Lê',
      adminEmail: 'huong.le@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'franchise' as const,
    };

    // Configure the update mock to fail
    tenantQueryMock = new MockQueryBuilder(null, { message: 'Database constraint violation' });

    const result = await registerNewTenant(input);

    // Verify failure propagation (Zero Silent Database Failures)
    expect(result.success).toBe(false);
    expect(result.error).toContain('Lỗi cập nhật cấu hình nhượng quyền: Database constraint violation');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should roll back the admin auth user when database onboarding fails after auth creation', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'onboard_tenant') {
        return Promise.resolve({ data: null, error: { message: 'onboard tenant failed' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await registerNewTenant({
      spaName: 'Bella Spa Test',
      contactPhone: '0912345678',
      address: '123 Test',
      email: 'test@bellaspa.vn',
      adminName: 'Admin Test',
      adminEmail: 'admin.test@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('onboard tenant failed');
    expect(mockDeleteUser).toHaveBeenCalledWith('mock-auth-user-id');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should report auth cleanup failure when database onboarding and cleanup both fail', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'onboard_tenant') {
        return Promise.resolve({ data: null, error: { message: 'onboard tenant failed' } });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockDeleteUser.mockResolvedValueOnce({ error: { message: 'delete auth failed' } });

    const result = await registerNewTenant({
      spaName: 'Bella Spa Cleanup Fail',
      contactPhone: '0912345678',
      address: '123 Test',
      email: 'cleanup@bellaspa.vn',
      adminName: 'Admin Cleanup',
      adminEmail: 'cleanup.admin@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('onboard tenant failed');
    expect(result.error).toContain('auth cleanup failed: delete auth failed');
    expect(mockDeleteUser).toHaveBeenCalledWith('mock-auth-user-id');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should fail onboarding explicitly when audit logging fails after tenant creation', async () => {
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await registerNewTenant({
      spaName: 'Bella Spa Audit Fail',
      contactPhone: '0912345678',
      address: '123 Test',
      email: 'audit@bellaspa.vn',
      adminName: 'Admin Audit',
      adminEmail: 'audit.admin@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to record onboarding audit log: audit unavailable');
    expect(result.data).toEqual({
      tenantId: 'mock-tenant-id-123',
      userId: 'mock-auth-user-id',
      email: 'audit.admin@bellaspa.vn',
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
