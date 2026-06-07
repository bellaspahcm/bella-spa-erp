/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FinancePnLSummary } from '@/components/features/FinancePnLSummary';
import { getMonthClosePreflight } from '@/services/accounting-actions';
import { lockMonth } from '@/services/finance-actions';
import { toast } from 'sonner';
import type { AccountingHealthCheck, AccountingHealthSummary } from '@/services/accounting-actions';

jest.mock('next/link', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: ({ href, children, ...props }: any) =>
      React.createElement('a', { href, ...props }, children),
  };
});

jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_target, element) => {
      const MotionComponent = ({
        children,
        initial,
        animate,
        exit,
        transition,
        whileHover,
        whileTap,
        ...props
      }: any) => React.createElement(String(element), props, children);

      return MotionComponent;
    },
  });

  return {
    motion,
    AnimatePresence: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/components/ui/PremiumSelect', () => {
  const React = require('react');

  return {
    PremiumSelect: ({
      options,
      value,
      onChange,
      label,
    }: any) => React.createElement(
      'select',
      {
        'aria-label': label ?? 'premium-select',
        value,
        onChange: (event: any) => onChange(event.target.value),
      },
      options.map((option) =>
        React.createElement('option', { key: option.value, value: option.value }, option.label)
      )
    ),
  };
});

jest.mock('@/services/accounting-actions', () => ({
  getMonthClosePreflight: jest.fn(),
}));

jest.mock('@/services/finance-actions', () => ({
  lockMonth: jest.fn(),
  unlockMonth: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockGetMonthClosePreflight = getMonthClosePreflight as jest.MockedFunction<typeof getMonthClosePreflight>;
const mockLockMonth = lockMonth as jest.MockedFunction<typeof lockMonth>;
const mockToast = toast as jest.Mocked<typeof toast>;

const baseMetrics: AccountingHealthSummary['metrics'] = {
  outbox_pending: 0,
  outbox_processing: 0,
  outbox_completed: 0,
  outbox_failed: 0,
  outbox_dead: 0,
  journal_draft: 0,
  journal_posted: 0,
  journal_canceled: 0,
  duplicate_active_references: 0,
  readiness_score: 100,
  missing_business_event: 0,
  needs_review: 0,
  posting_failed: 0,
  legacy_pending_revenue: 0,
  legacy_pending_expense: 0,
  legacy_pending_salary: 0,
  legacy_journal_entries_to_create: 0,
  worker_last_run_at: null,
  worker_minutes_since_last_run: null,
  worker_runs_24h: 0,
  worker_failed_runs_24h: 0,
  worker_failure_rate_24h: 0,
  worker_silent_with_pending: 0,
};

const basePnl = {
  month_year: '2026-05',
  total_revenue: 120000000,
  total_operating_expenses: 25000000,
  total_ktv_salaries: 30000000,
  net_profit: 65000000,
  total_bookings: 20,
  total_sessions_completed: 42,
  is_locked: false,
};

const failedOutboxCheck: AccountingHealthCheck = {
  id: 'outbox_failed',
  label: 'Outbox FAILED',
  status: 'fail',
  count: 2,
  message: '2 sự kiện hạch toán đang FAILED, cần replay hoặc sửa lỗi trước khi khóa tháng.',
  href: '/dashboard/accounting/outbox',
};

const pendingOutboxCheck: AccountingHealthCheck = {
  id: 'outbox_pending_processing',
  label: 'Outbox đang chờ',
  status: 'warn',
  count: 1,
  message: '1 PENDING và 0 PROCESSING đang chờ worker.',
  href: '/dashboard/accounting/outbox',
};

function makeSummary(overrides: Partial<AccountingHealthSummary> = {}): AccountingHealthSummary {
  const blockers = overrides.blockers ?? [];
  const warnings = overrides.warnings ?? [];

  return {
    generated_at: '2026-06-04T00:00:00.000Z',
    month: '2026-05',
    severity: blockers.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy',
    can_close_month: blockers.length === 0,
    blocker_count: blockers.length,
    warning_count: warnings.length,
    metrics: baseMetrics,
    checks: [...blockers, ...warnings],
    blockers,
    warnings,
    duplicate_journal_references: [],
    ...overrides,
  };
}

function renderSummary(onRefresh = jest.fn()) {
  render(
    <FinancePnLSummary
      pnl={basePnl}
      performance={[]}
      selectedMonth="2026-05-01"
      onMonthChange={jest.fn()}
      onRefresh={onRefresh}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    writable: true,
    value: jest.fn(() => true),
  });
});

describe('FinancePnLSummary month-close preflight guard', () => {
  it('không gọi lockMonth khi preflight có blocker', async () => {
    mockGetMonthClosePreflight.mockResolvedValue(makeSummary({
      blockers: [failedOutboxCheck],
      blocker_count: 1,
      metrics: {
        ...baseMetrics,
        outbox_failed: 2,
      },
    }));

    renderSummary();

    expect(await screen.findByText('Đang bị chặn')).toBeInTheDocument();
    expect(screen.getByText('Outbox FAILED')).toBeInTheDocument();

    const lockButton = screen.getByRole('button', { name: /Chốt sổ tháng/i });
    expect(lockButton).toBeDisabled();

    fireEvent.click(lockButton);

    expect(mockLockMonth).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('cho phép lockMonth khi chỉ có warning và admin xác nhận', async () => {
    const onRefresh = jest.fn();
    const warningSummary = makeSummary({
      warnings: [pendingOutboxCheck],
      warning_count: 1,
      metrics: {
        ...baseMetrics,
        outbox_pending: 1,
      },
    });

    mockGetMonthClosePreflight
      .mockResolvedValueOnce(warningSummary)
      .mockResolvedValueOnce(warningSummary);
    mockLockMonth.mockResolvedValue({ success: true });

    renderSummary(onRefresh);

    expect(await screen.findByText('Có cảnh báo')).toBeInTheDocument();

    const lockButton = screen.getByRole('button', { name: /Chốt sổ tháng/i });
    await waitFor(() => expect(lockButton).not.toBeDisabled());

    fireEvent.click(lockButton);

    await waitFor(() => {
      expect(mockLockMonth).toHaveBeenCalledWith('2026-05-01');
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Cảnh báo đang mở'));
    expect(mockToast.success).toHaveBeenCalledWith('Tháng đã được chốt sổ thành công!');
    expect(onRefresh).toHaveBeenCalled();
  });

  it('fail-closed khi không tải được preflight', async () => {
    mockGetMonthClosePreflight.mockRejectedValue(new Error('Health service unavailable'));

    renderSummary();

    expect(await screen.findByText('Không kiểm tra được')).toBeInTheDocument();
    expect(screen.getAllByText('Health service unavailable').length).toBeGreaterThan(0);

    const lockButton = screen.getByRole('button', { name: /Chốt sổ tháng/i });
    expect(lockButton).toBeDisabled();
    expect(mockLockMonth).not.toHaveBeenCalled();
  });
});
