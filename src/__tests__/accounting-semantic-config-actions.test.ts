jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockCreateAccountingDataClient = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/core/services/accounting/client', () => ({
  createAccountingDataClient: () => mockCreateAccountingDataClient(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

import {
  getAccountingSemanticConfig,
  saveAccountingSemanticMapping,
} from '@/core/services/accounting/semantic-config';

function createQuery(data: unknown[] = [], error: unknown = null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
    then: (resolve: (value: { data: unknown[]; error: unknown }) => unknown) => (
      Promise.resolve({ data, error }).then(resolve)
    ),
  };
  return query;
}

describe('accounting semantic config server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
  });

  it('blocks users without accounting configuration permissions before DB writes', async () => {
    const rpc = jest.fn();
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-a',
      role: 'staff',
    });
    mockCreateAccountingDataClient.mockResolvedValue({ rpc });

    const result = await saveAccountingSemanticMapping({
      semantic_key: 'SERVICE_REVENUE',
      account_code: '5113',
      effective_from: '2026-01-01',
    });

    expect(result.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('saves through the atomic RPC using the current user tenant only', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{
        id: 'mapping-1',
        semantic_key: 'GOODS_REVENUE',
        account_code: '5112',
        effective_from: '2026-01-01',
        effective_to: null,
        authority_version: 'TENANT_CONFIG:UI:v1',
      }],
      error: null,
    });
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-a',
      role: 'accountant',
    });
    mockCreateAccountingDataClient.mockResolvedValue({ rpc });

    const result = await saveAccountingSemanticMapping({
      semantic_key: 'GOODS_REVENUE',
      account_code: '5112',
      effective_from: '2026-01-01',
    });

    expect(result.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'finance_save_accounting_semantic_gl_mapping',
      expect.objectContaining({
        p_tenant_id: 'tenant-a',
        p_semantic_key: 'GOODS_REVENUE',
        p_account_code: '5112',
        p_effective_from: '2026-01-01',
      })
    );
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      table_name: 'finance_control_account_mappings',
      record_id: 'mapping-1',
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('loads active account options and mappings scoped to the current tenant', async () => {
    const accountsQuery = createQuery([
      { code: '5113', name: 'Doanh thu dịch vụ', type: 'REVENUE' },
    ]);
    const mappingsQuery = createQuery([
      {
        id: 'mapping-1',
        control_type: 'SERVICE_REVENUE',
        account_code: '5113',
        effective_from: '2026-01-01',
        effective_to: null,
        authority_version: 'TENANT_CONFIG:UI:v1',
      },
    ]);
    const from = jest.fn((table: string) => {
      if (table === 'finance_accounts') return accountsQuery;
      if (table === 'finance_control_account_mappings') return mappingsQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-a',
      role: 'accountant',
    });
    mockCreateAccountingDataClient.mockResolvedValue({ from });

    const snapshot = await getAccountingSemanticConfig();

    expect(accountsQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(accountsQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(mappingsQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(snapshot.accountOptions).toEqual([
      { code: '5113', name: 'Doanh thu dịch vụ', type: 'REVENUE' },
    ]);
    expect(snapshot.mappings[0]).toMatchObject({
      semantic_key: 'SERVICE_REVENUE',
      account_code: '5113',
    });
  });
});
