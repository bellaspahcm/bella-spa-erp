import { createClient } from '@/lib/supabase-server';
import { createAccountingDataClient } from '@/services/accounting/client';
import { getKtvSalaryForConfirmation } from '@/modules/hr-salary/actions/base-salary-actions';

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/services/accounting/client', () => ({
  createAccountingDataClient: jest.fn(),
}));

const mockGetCurrentUser = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockCreateClient = createClient as jest.Mock;
const mockCreateAccountingDataClient = createAccountingDataClient as jest.Mock;

function mockSingleQuery(result: { data: unknown; error: Error | null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return query;
}

function mockListQuery(result: { data: unknown[] | null; error: Error | null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    gte: jest.fn(() => query),
    lt: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve(result)),
  };
  return query;
}

function mockSalarySheetClient(result: { data: unknown[] | null; error: Error | null }) {
  return {
    rpc: jest.fn((name: string) => {
      if (name === 'set_session_tenant') {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === 'calculate_ktv_salary_sheet') {
        return Promise.resolve(result);
      }
      throw new Error(`Unexpected RPC ${name}`);
    }),
  };
}

describe('getKtvSalaryForConfirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-1',
    });
  });

  it('overlays published salary records with the central salary sheet amounts', async () => {
    const savedRecord = {
      id: 'salary-1',
      ktv_id: 'ktv-1',
      tenant_id: 'tenant-1',
      month_year: '2026-06-01',
      status: 'published',
      base_salary: 1,
      session_bonus: 1,
      rating_bonus: 1,
      kpi_bonus: 1,
      violations_deduction: 1,
      service_percentage_bonus: 1,
      total_salary: 1,
      total_sessions: 1,
      published_at: '2026-06-06T00:00:00.000Z',
    };
    const salaryRecordQuery = mockSingleQuery({ data: savedRecord, error: null });
    const sessionsQuery = mockListQuery({
      data: [{
        id: 'session-1',
        completed_date: '2026-06-05',
        session_number: 1,
        bookings: {
          package_name: 'VIP Package',
          ktv_commission: 200000,
          customers: { name_mother: 'Customer A' },
        },
      }],
      error: null,
    });
    const from = jest.fn((table: string) => {
      if (table === 'salary_records') return salaryRecordQuery;
      if (table === 'session_logs') return sessionsQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    const salarySheetClient = mockSalarySheetClient({
      data: [{
        ktv_id: 'ktv-1',
        base_salary: 6000000,
        session_bonus: 400000,
        rating_bonus: 75000,
        kpi_bonus: 500000,
        deductions: 100000,
        advances: 50000,
        total_salary: 6825000,
        total_sessions: 4,
        status: 'draft',
      }],
      error: null,
    });
    mockCreateClient.mockResolvedValueOnce({ from });
    mockCreateAccountingDataClient.mockResolvedValueOnce(salarySheetClient);

    const result = await getKtvSalaryForConfirmation('2026-06-01');

    expect(result?.record).toMatchObject({
      id: 'salary-1',
      status: 'published',
      published_at: '2026-06-06T00:00:00.000Z',
      base_salary: 6000000,
      session_bonus: 400000,
      rating_bonus: 75000,
      kpi_bonus: 500000,
      violations_deduction: 100000,
      service_percentage_bonus: 50000,
      total_salary: 6825000,
      total_sessions: 4,
    });
    expect(salarySheetClient.rpc).toHaveBeenCalledWith('set_session_tenant', {
      p_tenant_id: 'tenant-1',
    });
    expect(salarySheetClient.rpc).toHaveBeenCalledWith('calculate_ktv_salary_sheet', {
      p_month_year: '2026-06-01',
    });
    expect(result?.sessions).toHaveLength(1);
  });

  it('does not create a virtual confirmation record when no salary record exists', async () => {
    const salaryRecordQuery = mockSingleQuery({ data: null, error: null });
    const sessionsQuery = mockListQuery({ data: [], error: null });
    const from = jest.fn((table: string) => {
      if (table === 'salary_records') return salaryRecordQuery;
      if (table === 'session_logs') return sessionsQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockCreateClient.mockResolvedValueOnce({ from });

    const result = await getKtvSalaryForConfirmation('2026-06-01');

    expect(result).toEqual({ record: null, sessions: [] });
    expect(mockCreateAccountingDataClient).not.toHaveBeenCalled();
  });

  it('propagates central salary sheet failures instead of falling back to stale saved amounts', async () => {
    const salaryRecordQuery = mockSingleQuery({
      data: {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        tenant_id: 'tenant-1',
        month_year: '2026-06-01',
        status: 'published',
        total_salary: 1,
      },
      error: null,
    });
    const from = jest.fn((table: string) => {
      if (table === 'salary_records') return salaryRecordQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    const salarySheetClient = mockSalarySheetClient({
      data: null,
      error: new Error('salary sheet failed'),
    });
    mockCreateClient.mockResolvedValueOnce({ from });
    mockCreateAccountingDataClient.mockResolvedValueOnce(salarySheetClient);

    await expect(getKtvSalaryForConfirmation('2026-06-01')).rejects.toThrow(
      'Failed to fetch central KTV salary sheet: salary sheet failed',
    );
  });
});
