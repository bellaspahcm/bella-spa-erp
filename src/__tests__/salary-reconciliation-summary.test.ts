jest.mock('server-only', () => ({}), { virtual: true });

import fs from 'fs';
import path from 'path';

const mockGetUser = jest.fn();
const mockRpc = jest.fn();
const mockGetCurrentUser = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    auth: {
      getUser: () => mockGetUser(),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getSalaryReconciliation } from '../services/salary-reconciliation-actions';

describe('getSalaryReconciliation summary semantics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      tenant_id: 'tenant-1',
      full_name: 'Admin',
      avatar_url: null,
    });
  });

  it('keeps NO_LEGACY rows separate from major discrepancies and total diff', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          ktv_id: 'ktv-match',
          ktv_name: 'KTV Match',
          legacy_total: 8000000,
          ai_total: 8000000,
          diff_amount: 0,
          diff_percent: 0,
          status: 'MATCH',
          legacy_status: 'paid',
          has_legacy_record: true,
        },
        {
          ktv_id: 'ktv-major',
          ktv_name: 'KTV Major',
          legacy_total: 7000000,
          ai_total: 7600000,
          diff_amount: 600000,
          diff_percent: 8.57,
          status: 'MAJOR_DIFF',
          legacy_status: 'paid',
          has_legacy_record: true,
        },
        {
          ktv_id: 'ktv-no-legacy',
          ktv_name: 'KTV Chua Chot',
          legacy_total: 0,
          ai_total: 6800000,
          diff_amount: -6800000,
          diff_percent: null,
          status: 'NO_LEGACY',
          legacy_status: 'missing',
          has_legacy_record: false,
        },
      ],
      error: null,
    });

    const result = await getSalaryReconciliation('2026-05-01');

    expect(result.error).toBeNull();
    expect(result.data).toEqual(expect.objectContaining({
      totalKtv: 3,
      matchCount: 1,
      minorCount: 0,
      majorCount: 1,
      noLegacyCount: 1,
      totalDiffAbs: 600000,
    }));
    expect(result.data?.rows.find((row) => row.ktv_id === 'ktv-no-legacy')?.status).toBe('NO_LEGACY');
    expect(mockRpc).toHaveBeenCalledWith('get_salary_reconciliation', {
      p_month_year: '2026-05-01',
    });
  });

  it('does not report a salary diff when all rows are missing legacy records', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          ktv_id: 'ktv-no-legacy',
          ktv_name: 'KTV Chua Chot',
          legacy_total: 0,
          ai_total: 6800000,
          diff_amount: -6800000,
          diff_percent: null,
          status: 'NO_LEGACY',
          legacy_status: 'missing',
          has_legacy_record: false,
        },
      ],
      error: null,
    });

    const result = await getSalaryReconciliation('2026-05-01');

    expect(result.error).toBeNull();
    expect(result.data).toEqual(expect.objectContaining({
      totalKtv: 1,
      majorCount: 0,
      noLegacyCount: 1,
      totalDiffAbs: 0,
    }));
  });

  it('uses the tenant-scoped report RPC when local dev-bypass has no auth session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing' } });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          ktv_id: 'ktv-pending',
          ktv_name: 'KTV Pending',
          legacy_total: 0,
          ai_total: 6800000,
          diff_total: -6800000,
          diff_percent: 100,
          status: 'PENDING_LEGACY',
          legacy_status: 'missing',
        },
      ],
      error: null,
    });

    const result = await getSalaryReconciliation('2026-05-01');

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('get_salary_reconciliation_report', {
      p_tenant_id: 'tenant-1',
      p_month_year: '2026-05-01',
    });
    expect(result.data).toEqual(expect.objectContaining({
      totalKtv: 1,
      noLegacyCount: 1,
      majorCount: 0,
      totalDiffAbs: 0,
    }));
    expect(result.data?.rows[0]).toEqual(expect.objectContaining({
      status: 'NO_LEGACY',
      has_legacy_record: false,
      diff_percent: null,
    }));
  });
});

describe('salary reconciliation SQL regression guards', () => {
  const aiCopilotSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260530030000_add_session_multiplier_to_packages.sql'),
    'utf8'
  );
  const accountingReportSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260604091000_allow_service_role_salary_reconciliation_report.sql'),
    'utf8'
  );
  const realtimeComponentsSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260606093000_fix_salary_realtime_components.sql'),
    'utf8'
  );

  it('keeps all saved salary components in legacy totals', () => {
    for (const sql of [aiCopilotSql, accountingReportSql]) {
      expect(sql).toMatch(/COALESCE\(\s*r\.total_salary/);
      expect(sql).toMatch(/COALESCE\(\s*r\.base_salary/);
      expect(sql).toMatch(/COALESCE\(\s*r\.session_bonus/);
      expect(sql).toMatch(/COALESCE\(\s*r\.kpi_bonus/);
      expect(sql).toMatch(/COALESCE\(\s*r\.rating_bonus/);
      expect(sql).toMatch(/COALESCE\(\s*r\.violations_deduction/);
      expect(sql).toMatch(/COALESCE\(\s*r\.service_percentage_bonus/);
    }
  });

  it('keeps missing legacy salary records as pending statuses, not major differences', () => {
    expect(aiCopilotSql).toContain("WHEN lg.total_legacy IS NULL                            THEN 'NO_LEGACY'");
    expect(accountingReportSql).toContain("WHEN lr.legacy_tot IS NULL THEN 'PENDING_LEGACY'");
  });

  it('does not default realtime draft salary calculations to full-month attendance', () => {
    expect(realtimeComponentsSql).not.toContain('COALESCE(aw.work_days, 26.0)');
    expect(realtimeComponentsSql).toContain('COALESCE(aw.work_days, 0.0)');
    expect(realtimeComponentsSql).toContain('saved_total_salary');
    expect(realtimeComponentsSql).toContain('is_saved_financial_record');
    expect(realtimeComponentsSql).toContain('public.get_ktv_leaderboard');
  });
});
