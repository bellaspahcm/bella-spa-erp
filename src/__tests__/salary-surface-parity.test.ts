import * as XLSX from 'xlsx';
import { getKtvSalaryForConfirmation } from '@/modules/hr-salary/actions/base-salary-actions';
import { getSalaryData } from '@/modules/hr-salary/actions/query-salary-actions';
import { exportSalaryToExcel } from '@/core/services/analytics/export-actions';
import { getMonthlyPnL } from '@/core/services/finance/monthly-pnl-report';
import { getSalaryReconciliationReport } from '@/core/services/accounting/reports';
import { createClient } from '@/lib/supabase-server';
import { createAccountingDataClient } from '@/core/services/accounting/client';

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/core/services/accounting/client', () => ({
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
  unstable_noStore: jest.fn(),
}));

const mockCreateClient = createClient as jest.Mock;
const mockCreateAccountingDataClient = createAccountingDataClient as jest.Mock;

const TENANT_ID = 'tenant-1';
const KTV_ID = 'ktv-1';
const MONTH = '2026-06-01';
const CENTRAL_TOTAL = 6_825_000;

const adminUser = {
  id: 'admin-1',
  role: 'admin',
  tenant_id: TENANT_ID,
};

const ktvUser = {
  id: KTV_ID,
  role: 'ktv',
  tenant_id: TENANT_ID,
};

const savedSalaryRecord = {
  id: 'salary-1',
  ktv_id: KTV_ID,
  tenant_id: TENANT_ID,
  month_year: MONTH,
  status: 'published',
  total_sessions: 4,
  base_salary: 6_000_000,
  session_bonus: 400_000,
  rating_bonus: 75_000,
  kpi_bonus: 500_000,
  violations_deduction: 100_000,
  service_percentage_bonus: 50_000,
  total_salary: CENTRAL_TOTAL,
  published_at: '2026-06-06T00:00:00.000Z',
};

const centralSalarySheetRow = {
  ktv_id: KTV_ID,
  ktv_name: 'KTV One',
  base_salary: 6_000_000,
  session_bonus: 400_000,
  rating_bonus: 75_000,
  kpi_bonus: 500_000,
  deductions: 100_000,
  advances: 50_000,
  total_salary: CENTRAL_TOTAL,
  total_sessions: 4,
  status: 'published',
};

type Filter = {
  kind: 'eq' | 'gte' | 'lt' | 'in';
  field: string;
  value: unknown;
};

type Store = Record<string, unknown[]>;

function getPath(row: unknown, field: string) {
  return field.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}

function applyFilters(rows: unknown[], filters: Filter[]) {
  return rows.filter((row) => filters.every((filter) => {
    const value = getPath(row, filter.field);
    if (filter.kind === 'eq') return value === filter.value;
    if (filter.kind === 'gte') return String(value) >= String(filter.value);
    if (filter.kind === 'in') {
      const arr = Array.isArray(filter.value) ? filter.value : [filter.value];
      return arr.includes(value);
    }
    return String(value) < String(filter.value);
  }));
}

class StoreQueryBuilder {
  private filters: Filter[] = [];
  private limitCount: number | null = null;

  constructor(
    private table: string,
    private store: Store,
  ) {}

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ kind: 'eq', field, value });
    return this;
  }

  in(field: string, value: unknown) {
    this.filters.push({ kind: 'in', field, value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ kind: 'gte', field, value });
    return this;
  }

  lt(field: string, value: unknown) {
    this.filters.push({ kind: 'lt', field, value });
    return this;
  }

  or() {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  order() {
    return this;
  }

  single() {
    const rows = this.rows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  maybeSingle() {
    const rows = this.rows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then(
    onfulfilled: (value: { data: unknown[]; error: null }) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private rows() {
    const rows = applyFilters(this.store[this.table] ?? [], this.filters);
    return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
  }

  private resolve() {
    return Promise.resolve({ data: this.rows(), error: null });
  }
}

function createMockStore() {
  return {
    tenants: [{ id: TENANT_ID, salary_config: null }],
    users: [{
      id: KTV_ID,
      full_name: 'KTV One',
      role: 'ktv',
      tenant_id: TENANT_ID,
      base_salary: 6_000_000,
      hire_date: '2026-01-01',
      resignation_date: null,
      status: 'active',
    }],
    salary_records: [savedSalaryRecord],
    session_logs: [
      {
        id: 'session-1',
        tenant_id: TENANT_ID,
        completed_by_ktv_id: KTV_ID,
        status: 'completed',
        is_confirmed: true,
        completed_date: '2026-06-03',
        session_number: 1,
        booking_id: 'booking-1',
        rating: 5,
        bookings: {
          tenant_id: TENANT_ID,
          package_name: 'VIP Package',
          ktv_commission: 200_000,
          packages: { name: 'VIP Package', session_multiplier: 2 },
          customers: { name_mother: 'Customer A' },
        },
        session_reviews: [{ rating: 5, status: 'published' }],
      },
      {
        id: 'session-2',
        tenant_id: TENANT_ID,
        completed_by_ktv_id: KTV_ID,
        status: 'completed',
        is_confirmed: true,
        completed_date: '2026-06-04',
        session_number: 2,
        booking_id: 'booking-2',
        rating: 5,
        bookings: {
          tenant_id: TENANT_ID,
          package_name: 'VIP Package',
          ktv_commission: 200_000,
          packages: { name: 'VIP Package', session_multiplier: 2 },
          customers: { name_mother: 'Customer B' },
        },
        session_reviews: [{ rating: 5, status: 'published' }],
      },
    ],
    attendance: [{ id: 'att-1', ktv_id: KTV_ID, tenant_id: TENANT_ID, date: '2026-06-03', status: 'present' }],
    packages: [{ id: 'pkg-1', tenant_id: TENANT_ID, name: 'VIP Package', session_multiplier: 2 }],
    kpi_records: [{ ktv_id: KTV_ID, tenant_id: TENANT_ID, month_year: MONTH, bonus_amount: 500_000 }],
    revenue: [{ tenant_id: TENANT_ID, amount: 10_000_000, status: 'confirmed', revenue_type: 'package_sale', received_date: '2026-06-04' }],
    expenses: [],
    bookings: [{ id: 'booking-1', tenant_id: TENANT_ID, status: 'completed', full_price: 6_000_000, completed_sessions: 2, total_sessions: 2, ktv_commission: 200_000 }],
  } satisfies Store;
}

function createMockSupabase(store: Store) {
  return {
    from: jest.fn((table: string) => new StoreQueryBuilder(table, store)),
    rpc: jest.fn((name: string) => {
      if (name === 'get_ktv_leaderboard') {
        return Promise.resolve({
          data: [{
            ktv_id: KTV_ID,
            average_rating: 5,
            late_days: 1,
            absent_days: 0,
            total_kpi_bonus: 500_000,
          }],
          error: null,
        });
      }

      if (name === 'set_session_tenant') {
        return Promise.resolve({ data: null, error: null });
      }

      if (name === 'calculate_ktv_salary_sheet') {
        return Promise.resolve({ data: [centralSalarySheetRow], error: null });
      }

      if (name === 'get_salary_reconciliation_report') {
        return Promise.resolve({
          data: [{
            ktv_id: KTV_ID,
            ktv_name: 'KTV One',
            legacy_total: CENTRAL_TOTAL,
            ai_total: CENTRAL_TOTAL,
            diff_total: 0,
            diff_percent: 0,
            status: 'MATCH',
            legacy_status: 'published',
          }],
          error: null,
        });
      }

      throw new Error(`Unexpected RPC ${name}`);
    }),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: adminUser.id, email: 'admin@example.com' } }, error: null })),
    },
  };
}

function workbookRows(base64: string) {
  const workbook = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer' });
  const sheet = workbook.Sheets['Bang Luong Chi Tiet'];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
}

describe('salary surface parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));

    const store = createMockStore();
    const supabase = createMockSupabase(store);
    mockCreateClient.mockResolvedValue(supabase);
    mockCreateAccountingDataClient.mockResolvedValue(supabase);
    mockGetCurrentUser.mockResolvedValue(adminUser);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps admin salary, KTV confirmation, export, reconciliation, and P&L on one saved total', async () => {
    const adminRows = await getSalaryData();
    const adminSalary = adminRows.find((row) => row.id === KTV_ID);

    mockGetCurrentUser.mockResolvedValue(ktvUser);
    const ktvConfirmation = await getKtvSalaryForConfirmation(MONTH);

    mockGetCurrentUser.mockResolvedValue(adminUser);
    const salaryWorkbook = await exportSalaryToExcel(KTV_ID, 'KTV One', MONTH);
    const exportRows = workbookRows(salaryWorkbook);
    const monthlyPnl = await getMonthlyPnL(MONTH);
    const reconciliationRows = await getSalaryReconciliationReport(MONTH);

    expect(adminSalary).toMatchObject({
      id: KTV_ID,
      status: 'published',
      sessions: 4,
      baseSalary: 6_000_000,
      sessionBonus: 400_000,
      ratingBonus: 75_000,
      kpiBonus: 500_000,
      deductions: 100_000,
      advances: 50_000,
      totalSalary: CENTRAL_TOTAL,
    });
    expect(ktvConfirmation?.record).toMatchObject({
      id: 'salary-1',
      status: 'published',
      total_sessions: 4,
      base_salary: 6_000_000,
      session_bonus: 400_000,
      rating_bonus: 75_000,
      kpi_bonus: 500_000,
      violations_deduction: 100_000,
      service_percentage_bonus: 50_000,
      total_salary: CENTRAL_TOTAL,
    });
    expect(exportRows.some((row) => String(row[4]).includes('6.825.000'))).toBe(true);
    expect(monthlyPnl.total_ktv_salaries).toBe(CENTRAL_TOTAL);
    expect(reconciliationRows).toEqual([expect.objectContaining({
      ktv_id: KTV_ID,
      legacy_total: CENTRAL_TOTAL,
      ai_total: CENTRAL_TOTAL,
      diff_total: 0,
      status: 'MATCH',
    })]);
  });
});
