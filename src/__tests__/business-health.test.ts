jest.mock('server-only', () => ({}), { virtual: true });

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockSupabase = { from: mockFrom, rpc: mockRpc };

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockAutoConsumeForSession = jest.fn();
jest.mock('@/services/inventory-actions', () => ({
  autoConsumeForSession: (...args: unknown[]) => mockAutoConsumeForSession(...args),
}));

const mockEnqueueWithAutoClient = jest.fn();
jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: unknown[]) => mockEnqueueWithAutoClient(...args),
}));

import {
  getBusinessHealthSummary,
  runBusinessHealthRepairAction,
} from '../services/accounting-actions';

const ADMIN_USER = { id: 'admin-1', role: 'admin', tenant_id: 'tenant-a' };

let tableRows: Record<string, unknown[] | null>;
let tableErrors: Record<string, { message: string } | null>;

function setupTableMocks() {
  mockFrom.mockImplementation((table: string) => {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      neq: jest.fn(() => chain),
      or: jest.fn(() => chain),
      in: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      update: jest.fn((payload: unknown) => {
        mockUpdate(table, payload);
        return chain;
      }),
      insert: jest.fn((payload: unknown) => {
        mockInsert(table, payload);
        return Promise.resolve({
          data: null,
          error: tableErrors[table] ?? null,
        });
      }),
      single: jest.fn(() => Promise.resolve({
        data: tableRows[table]?.[0] ?? { id: `${table}-updated` },
        error: tableErrors[table] ?? null,
      })),
      maybeSingle: jest.fn(() => Promise.resolve({
        data: tableRows[table]?.[0] ?? null,
        error: tableErrors[table] ?? null,
      })),
      then: (cb: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) => Promise.resolve({
        data: tableRows[table] ?? [],
        error: tableErrors[table] ?? null,
      }).then(cb, onRejected),
    };
    return chain;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
  mockAutoConsumeForSession.mockResolvedValue({
    success: true,
    processed: 1,
    totalCost: 50000,
  });
  mockEnqueueWithAutoClient.mockResolvedValue(true);
  mockRpc.mockImplementation((fnName: string) => {
    if (fnName === 'backfill_accounting_metadata') {
      return Promise.resolve({
        data: [
          {
            source_table: 'revenue',
            scanned_records: 5,
            classified_records: 4,
            review_created: 1,
          },
        ],
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: null });
  });
  tableRows = {
    bookings: [],
    revenue: [],
    session_logs: [],
    salary_records: [],
    packages: [],
    package_materials: [],
    inventory_items: [],
    inventory_logs: [],
    journal_entries: [],
    journal_lines: [],
    accounting_outbox: [],
    customers: [],
    audit_logs: [],
  };
  tableErrors = {
    bookings: null,
    revenue: null,
    session_logs: null,
    salary_records: null,
    packages: null,
    package_materials: null,
    inventory_items: null,
    inventory_logs: null,
    journal_entries: null,
    journal_lines: null,
    accounting_outbox: null,
    customers: null,
    audit_logs: null,
  };
  setupTableMocks();
});

describe('business health summary', () => {
  it('surfaces booking payment, salary, and side-effect invariant findings', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'deposit_pending',
        deposit_amount: 200000,
        full_price: 6000000,
        discount_percent: 25,
        total_sessions: 15,
        completed_sessions: 0,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
        package_id: 'package-1',
        package_name: 'Combo Mẹ & Bé VIP Toàn Diện',
      },
    ];
    tableRows.customers = [
      {
        id: 'customer-1',
        tenant_id: 'tenant-a',
        name_mother: 'Mẹ Test',
        phone: '0900000000',
      },
    ];
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        completed_by_ktv_id: 'ktv-1',
        tenant_id: 'tenant-a',
        session_number: 1,
        business_event_type: 'SESSION_REVENUE_RECOGNIZED',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'draft',
        total_sessions: 26,
        base_salary: 0,
        session_bonus: 0,
        rating_bonus: 0,
        kpi_bonus: 0,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 0,
        business_event_type: 'SALARY_ACCRUAL',
        accounting_review_status: 'NEEDS_REVIEW',
      },
    ];
    tableRows.packages = [
      {
        id: 'package-1',
        name: 'Combo Mẹ & Bé VIP Toàn Diện',
        tenant_id: 'tenant-a',
        session_multiplier: 2,
        total_sessions: 15,
      },
    ];
    tableRows.package_materials = [
      {
        id: 'pm-1',
        tenant_id: 'tenant-a',
        package_id: 'package-1',
        item_id: 'item-1',
        quantity_per_session: 2,
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
      },
    ];

    const summary = await getBusinessHealthSummary('2026-06-01');

    expect(summary.severity).toBe('critical');
    expect(summary.critical_count).toBeGreaterThan(0);
    expect(summary.dataset_counts.bookings).toBe(1);
    expect(summary.groups).toHaveLength(9);
    expect(summary.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'deposit_paid_but_booking_still_pending',
      'portal_deposit_qr_should_be_closed',
      'booking_revenue_ledger_gap',
      'booking_completed_sessions_drift',
      'completed_session_missing_inventory_consumption',
      'draft_salary_session_count_drift',
      'confirmed_package_revenue_missing_accounting_side_effect',
      'completed_session_missing_session_done_side_effect',
    ]));
    expect(summary.findings.find((finding) => finding.code === 'deposit_paid_but_booking_still_pending')).toEqual(
      expect.objectContaining({
        title: 'Khách đã cọc nhưng booking vẫn chờ cọc',
        href: '/dashboard/finance/reconciliation',
        repair_action: 'sync_paid_deposit_booking_status',
        repair_requires_confirmation: true,
      })
    );
    expect(summary.findings.find((finding) => finding.code === 'portal_deposit_qr_should_be_closed')).toEqual(
      expect.objectContaining({
        title: 'Portal phải đóng QR cọc của booking này',
        href: '/dashboard/finance/reconciliation',
        details: expect.arrayContaining([
          expect.objectContaining({ label: 'Cọc còn phải thu', value: '0đ' }),
          expect.objectContaining({ label: 'QR/Portal yêu cầu', value: '4.300.000đ' }),
          expect.objectContaining({ label: 'Chế độ QR/Portal', value: 'full' }),
        ]),
      })
    );
    expect(summary.findings.find((finding) => finding.code === 'booking_revenue_ledger_gap')).toEqual(
      expect.objectContaining({
        title: 'Booking có doanh thu nhưng thiếu side-effect hạch toán',
        href: '/dashboard/finance/reconciliation',
      })
    );
    expect(summary.findings.find((finding) => finding.code === 'booking_completed_sessions_drift')).toEqual(
      expect.objectContaining({
        href: '/dashboard/sessions',
        repair_action: 'sync_booking_completed_sessions',
        repair_requires_confirmation: true,
      })
    );
    expect(summary.findings.find((finding) => finding.code === 'completed_session_missing_inventory_consumption')).toEqual(
      expect.objectContaining({
        href: '/dashboard/inventory',
        repair_action: 'create_missing_inventory_consumption',
        repair_requires_confirmation: true,
        details: expect.arrayContaining([
          expect.objectContaining({ label: 'Vật tư cần trừ', value: 'Tinh dầu tắm bé: 2 chai' }),
        ]),
      })
    );
    expect(summary.findings.find((finding) => finding.code === 'completed_session_missing_session_done_side_effect')).toEqual(
      expect.objectContaining({
        href: '/dashboard/accounting/outbox',
        repair_action: 'enqueue_missing_session_done_accounting',
        repair_requires_confirmation: true,
      })
    );
    expect(summary.findings.find((finding) => finding.code === 'confirmed_package_revenue_missing_accounting_side_effect')).toEqual(
      expect.objectContaining({
        repair_action: 'enqueue_missing_package_sale_accounting',
        repair_label: 'Tạo PACKAGE_SALE',
        repair_requires_confirmation: true,
        details: expect.arrayContaining([
          expect.objectContaining({ label: 'Booking', value: 'B-001' }),
          expect.objectContaining({ label: 'Loại thu', value: 'deposit' }),
          expect.objectContaining({ label: 'Số tiền thu', value: '200.000đ' }),
          expect.objectContaining({ label: 'Ngày thu', value: '2026-06-02' }),
        ]),
      })
    );
  });

  it('surfaces missing inventory accounting side-effect with a safe repair action', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        deposit_amount: 200000,
        full_price: 6000000,
        discount_percent: 0,
        total_sessions: 15,
        completed_sessions: 1,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
      },
    ];
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        completed_by_ktv_id: 'ktv-1',
        tenant_id: 'tenant-a',
        session_number: 1,
        business_event_type: 'SESSION_DONE',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableRows.package_materials = [
      {
        id: 'pm-1',
        tenant_id: 'tenant-a',
        package_id: 'package-1',
        item_id: 'item-1',
        quantity_per_session: 2,
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
        price_per_unit: 10000,
      },
    ];
    tableRows.inventory_logs = [
      {
        id: 'log-1',
        tenant_id: 'tenant-a',
        item_id: 'item-1',
        change_amount: -2,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        created_at: '2026-06-03T00:00:00.000Z',
        business_event_type: 'INVENTORY_CONSUMED',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    const summary = await getBusinessHealthSummary('2026-06-01');
    const finding = summary.findings.find((item) => item.code === 'inventory_consumption_missing_accounting_side_effect');

    expect(finding).toEqual(expect.objectContaining({
      href: '/dashboard/inventory',
      repair_action: 'enqueue_missing_inventory_consumed_accounting',
      repair_label: 'Tạo INVENTORY_CONSUMED',
      repair_requires_confirmation: true,
      details: expect.arrayContaining([
        expect.objectContaining({ label: 'Log kho', value: '1' }),
        expect.objectContaining({ label: 'Vật tư đã trừ', value: 'Tinh dầu tắm bé: 2 chai' }),
        expect.objectContaining({ label: 'Giá trị tiêu hao', value: '20.000đ' }),
      ]),
    }));
  });

  it('surfaces missing salary paid accounting side-effect with a safe repair action', async () => {
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'paid',
        paid_date: '2026-06-30',
        paid_method: 'bank_transfer',
        notes: 'Thanh toán lương tháng 6',
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 500000,
        rating_bonus: 200000,
        kpi_bonus: 300000,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7000000,
        business_event_type: 'SALARY_PAYMENT',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    const summary = await getBusinessHealthSummary('2026-06-01');
    const finding = summary.findings.find((item) => item.code === 'paid_salary_missing_accounting_side_effect');

    expect(finding).toEqual(expect.objectContaining({
      href: '/dashboard/salary',
      repair_action: 'enqueue_missing_salary_paid_accounting',
      repair_label: 'Tạo SALARY_PAID',
      repair_requires_confirmation: true,
      details: expect.arrayContaining([
        expect.objectContaining({ label: 'KTV', value: 'ktv-1' }),
        expect.objectContaining({ label: 'Kỳ lương', value: '2026-06-01' }),
        expect.objectContaining({ label: 'Lương đã trả', value: '7.000.000đ' }),
        expect.objectContaining({ label: 'Ngày trả lương', value: '2026-06-30' }),
        expect.objectContaining({ label: 'Phương thức trả', value: 'bank_transfer' }),
      ]),
    }));
  });

  it('propagates database failures instead of returning a fake healthy summary', async () => {
    tableErrors.bookings = { message: 'permission denied for bookings' };

    await expect(getBusinessHealthSummary('2026-06-01')).rejects.toThrow(/permission denied for bookings/);
  });

  it('replays outbox events through the whitelisted repair action', async () => {
    tableRows.accounting_outbox = [
      {
        id: 'outbox-1',
        tenant_id: 'tenant-a',
        event_type: 'PACKAGE_SALE',
        reference_type: 'REVENUE',
        reference_id: 'revenue-1',
        status: 'DEAD',
        retry_count: 3,
        max_retries: 3,
        last_error: 'posting failed',
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'replay_outbox',
      targetId: 'outbox-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'replay_outbox',
    }));
    expect(mockUpdate).toHaveBeenCalledWith('accounting_outbox', expect.objectContaining({
      status: 'PENDING',
      retry_count: 0,
      last_error: null,
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'accounting_outbox',
      record_id: 'outbox-1',
    }));
  });

  it('runs metadata backfill through the whitelisted repair action', async () => {
    const result = await runBusinessHealthRepairAction({
      action: 'run_metadata_backfill',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'run_metadata_backfill',
    }));
    expect(result.message).toContain('5');
    expect(mockRpc).toHaveBeenCalledWith('backfill_accounting_metadata', {
      p_tenant_id: 'tenant-a',
      p_limit: 500,
    });
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'accounting_metadata_backfill',
      record_id: 'tenant-a',
    }));
  });

  it('syncs a deposit-paid booking status after revalidating confirmed payment state', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'deposit_pending',
        deposit_amount: 200000,
        full_price: 6000000,
        discount_percent: 25,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'sync_paid_deposit_booking_status',
      targetId: 'booking-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'sync_paid_deposit_booking_status',
    }));
    expect(mockUpdate).toHaveBeenCalledWith('bookings', expect.objectContaining({
      status: 'booked',
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'bookings',
      record_id: 'booking-1',
      old_data: expect.objectContaining({ status: 'deposit_pending' }),
      new_data: expect.objectContaining({
        status: 'booked',
        reason: 'business_health_sync_paid_deposit',
      }),
    }));
  });

  it('rolls back booking status when deposit repair audit logging fails', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'deposit_pending',
        deposit_amount: 200000,
        full_price: 6000000,
        discount_percent: 25,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'sync_paid_deposit_booking_status',
      targetId: 'booking-1',
    })).rejects.toThrow(/rollback.*audit/i);

    expect(mockUpdate).toHaveBeenCalledWith('bookings', expect.objectContaining({
      status: 'booked',
    }));
    expect(mockUpdate).toHaveBeenCalledWith('bookings', expect.objectContaining({
      status: 'deposit_pending',
    }));
  });

  it('syncs booking completed session count after re-reading completed logs', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        completed_sessions: 0,
        total_sessions: 15,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        tenant_id: 'tenant-a',
      },
      {
        id: 'session-2',
        booking_id: 'booking-1',
        status: 'completed',
        tenant_id: 'tenant-a',
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'sync_booking_completed_sessions',
      targetId: 'booking-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'sync_booking_completed_sessions',
    }));
    expect(mockUpdate).toHaveBeenCalledWith('bookings', expect.objectContaining({
      completed_sessions: 2,
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'bookings',
      record_id: 'booking-1',
      old_data: expect.objectContaining({ completed_sessions: 0 }),
      new_data: expect.objectContaining({
        completed_sessions: 2,
        completed_session_logs: 2,
        reason: 'business_health_sync_completed_sessions',
      }),
    }));
  });

  it('rolls back booking completed sessions when progress repair audit logging fails', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        completed_sessions: 0,
        total_sessions: 15,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        tenant_id: 'tenant-a',
      },
      {
        id: 'session-2',
        booking_id: 'booking-1',
        status: 'completed',
        tenant_id: 'tenant-a',
      },
    ];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'sync_booking_completed_sessions',
      targetId: 'booking-1',
    })).rejects.toThrow(/rollback.*audit/i);

    expect(mockUpdate).toHaveBeenCalledWith('bookings', expect.objectContaining({
      completed_sessions: 2,
    }));
    expect(mockUpdate).toHaveBeenCalledWith('bookings', expect.objectContaining({
      completed_sessions: 0,
    }));
  });

  it('blocks completed session sync for cancelled or completed bookings', async () => {
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'completed',
        completed_sessions: 0,
        total_sessions: 15,
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'sync_booking_completed_sessions',
      targetId: 'booking-1',
    })).rejects.toThrow(/không được đồng bộ số buổi tự động/i);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('creates missing inventory consumption through the central inventory engine after audit', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.package_materials = [
      {
        id: 'pm-1',
        tenant_id: 'tenant-a',
        package_id: 'package-1',
        item_id: 'item-1',
        quantity_per_session: 2,
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'create_missing_inventory_consumption',
      targetId: 'session-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'create_missing_inventory_consumption',
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'inventory_logs',
      record_id: 'session-1',
      old_data: expect.objectContaining({ existing_consumption_logs: 0 }),
      new_data: expect.objectContaining({
        reason: 'business_health_create_missing_inventory_consumption',
        session_log_id: 'session-1',
        booking_number: 'B-001',
        planned_materials: expect.arrayContaining([
          expect.objectContaining({
            item_id: 'item-1',
            item_name: 'Tinh dầu tắm bé',
            quantity_per_session: 2,
          }),
        ]),
      }),
    }));
    expect(mockAutoConsumeForSession).toHaveBeenCalledWith('package-1', 'session-1', {
      force: true,
      source: 'business_health_repair',
    });
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockAutoConsumeForSession.mock.invocationCallOrder[0]);
  });

  it('does not create duplicate inventory consumption logs', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.inventory_logs = [
      {
        id: 'log-1',
        tenant_id: 'tenant-a',
        item_id: 'item-1',
        change_amount: -2,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        created_at: '2026-06-03T00:00:00.000Z',
        business_event_type: 'INVENTORY_CONSUMED',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'create_missing_inventory_consumption',
      targetId: 'session-1',
    })).rejects.toThrow(/đã có log trừ kho/i);

    expect(mockAutoConsumeForSession).not.toHaveBeenCalled();
  });

  it('does not call the inventory engine when inventory repair audit logging fails', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.package_materials = [
      {
        id: 'pm-1',
        tenant_id: 'tenant-a',
        package_id: 'package-1',
        item_id: 'item-1',
        quantity_per_session: 2,
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
      },
    ];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'create_missing_inventory_consumption',
      targetId: 'session-1',
    })).rejects.toThrow(/audit insert failed/i);

    expect(mockAutoConsumeForSession).not.toHaveBeenCalled();
  });

  it('enqueues missing PACKAGE_SALE accounting outbox after audit', async () => {
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        notes: 'Cọc gói mẹ bé',
        payment_method: 'bank_transfer',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'enqueue_missing_package_sale_accounting',
      targetId: 'revenue-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'enqueue_missing_package_sale_accounting',
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'accounting_outbox',
      record_id: 'revenue-1',
      old_data: expect.objectContaining({
        existing_package_sale_outbox: 0,
        existing_active_journal: false,
      }),
      new_data: expect.objectContaining({
        reason: 'business_health_enqueue_missing_package_sale',
        event_type: 'PACKAGE_SALE',
        reference_type: 'REVENUE',
        reference_id: 'revenue-1',
        booking_number: 'B-001',
        revenue_type: 'deposit',
        amount: 200000,
      }),
    }));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockFrom, rpc: mockRpc }),
      expect.objectContaining({
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: 'revenue-1',
        payload: expect.objectContaining({
          totalAmount: 200000,
          description: 'Cọc gói mẹ bé',
          branchId: 'tenant-a',
        }),
      }),
      '[businessHealth.packageSaleRepair]'
    );
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockEnqueueWithAutoClient.mock.invocationCallOrder[0]);
  });

  it('does not enqueue duplicate PACKAGE_SALE outbox when one already exists', async () => {
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        notes: null,
        payment_method: 'bank_transfer',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.accounting_outbox = [
      {
        id: 'outbox-1',
        tenant_id: 'tenant-a',
        event_type: 'PACKAGE_SALE',
        reference_type: 'REVENUE',
        reference_id: 'revenue-1',
        status: 'PENDING',
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        created_at: '2026-06-02T00:00:00.000Z',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_package_sale_accounting',
      targetId: 'revenue-1',
    })).rejects.toThrow(/đã có outbox PACKAGE_SALE/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue PACKAGE_SALE when revenue has no booking', async () => {
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: null,
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        notes: null,
        payment_method: 'bank_transfer',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_package_sale_accounting',
      targetId: 'revenue-1',
    })).rejects.toThrow(/chưa gắn với booking/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue PACKAGE_SALE when audit logging fails', async () => {
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        notes: null,
        payment_method: 'bank_transfer',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_package_sale_accounting',
      targetId: 'revenue-1',
    })).rejects.toThrow(/audit insert failed/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('propagates PACKAGE_SALE enqueue failure explicitly', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-02',
        notes: null,
        payment_method: 'bank_transfer',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_package_sale_accounting',
      targetId: 'revenue-1',
    })).rejects.toThrow(/Không thể tạo outbox PACKAGE_SALE/i);
  });

  it('enqueues missing SALARY_PAID accounting outbox after audit', async () => {
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'paid',
        paid_date: '2026-06-30',
        paid_method: 'bank_transfer',
        notes: 'Thanh toán lương tháng 6',
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 500000,
        rating_bonus: 200000,
        kpi_bonus: 300000,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7000000,
        business_event_type: 'SALARY_PAYMENT',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'enqueue_missing_salary_paid_accounting',
      targetId: 'salary-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'enqueue_missing_salary_paid_accounting',
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'accounting_outbox',
      record_id: 'salary-1',
      old_data: expect.objectContaining({
        existing_salary_paid_outbox: 0,
        existing_active_journal: false,
      }),
      new_data: expect.objectContaining({
        reason: 'business_health_enqueue_missing_salary_paid',
        event_type: 'SALARY_PAID',
        reference_type: 'SALARY_RECORD',
        reference_id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        paid_method: 'bank_transfer',
        total_salary: 7000000,
      }),
    }));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockFrom, rpc: mockRpc }),
      expect.objectContaining({
        eventType: 'SALARY_PAID',
        referenceType: 'SALARY_RECORD',
        referenceId: 'salary-1',
        payload: expect.objectContaining({
          amount: 7000000,
          paymentMethod: 'bank_transfer',
          description: 'Thanh toán lương tháng 6',
          ktvId: 'ktv-1',
          branchId: 'tenant-a',
        }),
      }),
      '[businessHealth.salaryPaidRepair]'
    );
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockEnqueueWithAutoClient.mock.invocationCallOrder[0]);
  });

  it('does not enqueue duplicate SALARY_PAID outbox when one already exists', async () => {
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'paid',
        paid_date: '2026-06-30',
        paid_method: 'bank_transfer',
        notes: null,
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 500000,
        rating_bonus: 200000,
        kpi_bonus: 300000,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7000000,
        business_event_type: 'SALARY_PAYMENT',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableRows.accounting_outbox = [
      {
        id: 'outbox-1',
        tenant_id: 'tenant-a',
        event_type: 'SALARY_PAID',
        reference_type: 'SALARY_RECORD',
        reference_id: 'salary-1',
        status: 'PENDING',
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        created_at: '2026-06-30T00:00:00.000Z',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_salary_paid_accounting',
      targetId: 'salary-1',
    })).rejects.toThrow(/đã có outbox SALARY_PAID/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue SALARY_PAID when salary is not paid', async () => {
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'published',
        paid_date: null,
        paid_method: null,
        notes: null,
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 500000,
        rating_bonus: 200000,
        kpi_bonus: 300000,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7000000,
        business_event_type: 'SALARY_ACCRUAL',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_salary_paid_accounting',
      targetId: 'salary-1',
    })).rejects.toThrow(/đã trả/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue SALARY_PAID when paid salary amount is zero', async () => {
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'paid',
        paid_date: '2026-06-30',
        paid_method: 'bank_transfer',
        notes: null,
        total_sessions: 0,
        base_salary: 0,
        session_bonus: 0,
        rating_bonus: 0,
        kpi_bonus: 0,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 0,
        business_event_type: 'SALARY_PAYMENT',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_salary_paid_accounting',
      targetId: 'salary-1',
    })).rejects.toThrow(/tổng lương dương/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue SALARY_PAID when audit logging fails', async () => {
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'paid',
        paid_date: '2026-06-30',
        paid_method: 'bank_transfer',
        notes: null,
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 500000,
        rating_bonus: 200000,
        kpi_bonus: 300000,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7000000,
        business_event_type: 'SALARY_PAYMENT',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_salary_paid_accounting',
      targetId: 'salary-1',
    })).rejects.toThrow(/audit insert failed/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('propagates SALARY_PAID enqueue failure explicitly', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    tableRows.salary_records = [
      {
        id: 'salary-1',
        ktv_id: 'ktv-1',
        month_year: '2026-06-01',
        tenant_id: 'tenant-a',
        status: 'paid',
        paid_date: '2026-06-30',
        paid_method: 'bank_transfer',
        notes: null,
        total_sessions: 12,
        base_salary: 6000000,
        session_bonus: 500000,
        rating_bonus: 200000,
        kpi_bonus: 300000,
        violations_deduction: 0,
        service_percentage_bonus: 0,
        total_salary: 7000000,
        business_event_type: 'SALARY_PAYMENT',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_salary_paid_accounting',
      targetId: 'salary-1',
    })).rejects.toThrow(/Không thể tạo outbox SALARY_PAID/i);
  });

  it('enqueues missing SESSION_DONE accounting outbox after audit and revenue recognition recalculation', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        completed_by_ktv_id: 'ktv-1',
        session_number: 2,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        total_sessions: 5,
        status: 'booked',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        ktv_commission: 50000,
        assigned_ktv_id: 'ktv-assigned',
        tenant_id: 'tenant-a',
        full_price: 500000,
        deposit_amount: 100000,
        discount_percent: 0,
        customer_id: 'customer-1',
      },
    ];
    tableRows.revenue = [
      {
        id: 'revenue-1',
        booking_id: 'booking-1',
        amount: 200000,
        status: 'confirmed',
        revenue_type: 'deposit',
        tenant_id: 'tenant-a',
        received_date: '2026-06-01',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'AUTO_POSTED',
        accounting_metadata: {},
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'enqueue_missing_session_done_accounting',
      targetId: 'session-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'enqueue_missing_session_done_accounting',
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'accounting_outbox',
      record_id: 'session-1',
      old_data: expect.objectContaining({
        existing_session_done_outbox: 0,
        existing_active_journal: false,
      }),
      new_data: expect.objectContaining({
        reason: 'business_health_enqueue_missing_session_done',
        event_type: 'SESSION_DONE',
        reference_id: 'session-1',
        booking_number: 'B-001',
      }),
    }));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockFrom, rpc: mockRpc }),
      expect.objectContaining({
        eventType: 'SESSION_DONE',
        referenceType: 'SESSION_LOG',
        referenceId: 'session-1',
        payload: expect.objectContaining({
          earnedRevenueAmount: 100000,
          deferredRevenueAmount: 100000,
          receivableAmount: 0,
          bookingId: 'booking-1',
          commissionAmount: 50000,
          ktvId: 'ktv-1',
          branchId: 'tenant-a',
        }),
      }),
      '[businessHealth.sessionDoneRepair]'
    );
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockEnqueueWithAutoClient.mock.invocationCallOrder[0]);
  });

  it('does not enqueue duplicate SESSION_DONE outbox when one already exists', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        completed_by_ktv_id: 'ktv-1',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        total_sessions: 5,
        status: 'booked',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        ktv_commission: 50000,
        assigned_ktv_id: 'ktv-1',
        tenant_id: 'tenant-a',
        full_price: 500000,
        deposit_amount: 100000,
        discount_percent: 0,
        customer_id: 'customer-1',
      },
    ];
    tableRows.accounting_outbox = [
      {
        id: 'outbox-1',
        tenant_id: 'tenant-a',
        event_type: 'SESSION_DONE',
        reference_type: 'SESSION_LOG',
        reference_id: 'session-1',
        status: 'PENDING',
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        created_at: '2026-06-03T00:00:00.000Z',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_session_done_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/đã có outbox SESSION_DONE/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue SESSION_DONE when audit logging fails', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        completed_by_ktv_id: 'ktv-1',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        total_sessions: 5,
        status: 'booked',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        ktv_commission: 50000,
        assigned_ktv_id: 'ktv-1',
        tenant_id: 'tenant-a',
        full_price: 500000,
        deposit_amount: 100000,
        discount_percent: 0,
        customer_id: 'customer-1',
      },
    ];
    tableRows.revenue = [];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_session_done_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/audit insert failed/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('propagates SESSION_DONE enqueue failure explicitly', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        completed_by_ktv_id: 'ktv-1',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        total_sessions: 5,
        status: 'booked',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        ktv_commission: 50000,
        assigned_ktv_id: 'ktv-1',
        tenant_id: 'tenant-a',
        full_price: 500000,
        deposit_amount: 100000,
        discount_percent: 0,
        customer_id: 'customer-1',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_session_done_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/Không thể tạo outbox SESSION_DONE/i);
  });

  it('enqueues missing INVENTORY_CONSUMED accounting outbox after audit and cost calculation', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.inventory_logs = [
      {
        id: 'log-1',
        tenant_id: 'tenant-a',
        item_id: 'item-1',
        change_amount: -2,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        created_at: '2026-06-03T00:00:00.000Z',
        business_event_type: 'INVENTORY_CONSUMED',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
        price_per_unit: 10000,
      },
    ];

    const result = await runBusinessHealthRepairAction({
      action: 'enqueue_missing_inventory_consumed_accounting',
      targetId: 'session-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      action: 'enqueue_missing_inventory_consumed_accounting',
    }));
    expect(mockInsert).toHaveBeenCalledWith('audit_logs', expect.objectContaining({
      table_name: 'accounting_outbox',
      record_id: 'session-1',
      old_data: expect.objectContaining({
        existing_inventory_consumed_outbox: 0,
        existing_active_journal: false,
        inventory_log_count: 1,
      }),
      new_data: expect.objectContaining({
        reason: 'business_health_enqueue_missing_inventory_consumed',
        event_type: 'INVENTORY_CONSUMED',
        reference_id: 'session-1',
        booking_number: 'B-001',
        total_cost: 20000,
        consumption_summary: 'Tinh dầu tắm bé: 2 chai',
        consumption_items: expect.arrayContaining([
          expect.objectContaining({
            item_id: 'item-1',
            quantity: 2,
            unit_cost: 10000,
            cost: 20000,
          }),
        ]),
      }),
    }));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockFrom, rpc: mockRpc }),
      expect.objectContaining({
        eventType: 'INVENTORY_CONSUMED',
        referenceType: 'SESSION_LOG',
        referenceId: 'session-1',
        payload: expect.objectContaining({
          amount: 20000,
          branchId: 'tenant-a',
        }),
      }),
      '[businessHealth.inventoryConsumedRepair]'
    );
    expect(mockInsert.mock.invocationCallOrder[0]).toBeLessThan(mockEnqueueWithAutoClient.mock.invocationCallOrder[0]);
  });

  it('does not enqueue duplicate INVENTORY_CONSUMED outbox when one already exists', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.accounting_outbox = [
      {
        id: 'outbox-1',
        tenant_id: 'tenant-a',
        event_type: 'INVENTORY_CONSUMED',
        reference_type: 'SESSION_LOG',
        reference_id: 'session-1',
        status: 'PENDING',
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        created_at: '2026-06-03T00:00:00.000Z',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_inventory_consumed_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/đã có outbox INVENTORY_CONSUMED/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue INVENTORY_CONSUMED when consumption logs are missing', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_inventory_consumed_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/chưa có log trừ kho/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('does not enqueue INVENTORY_CONSUMED when audit logging fails', async () => {
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.inventory_logs = [
      {
        id: 'log-1',
        tenant_id: 'tenant-a',
        item_id: 'item-1',
        change_amount: -2,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        created_at: '2026-06-03T00:00:00.000Z',
        business_event_type: 'INVENTORY_CONSUMED',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
        price_per_unit: 10000,
      },
    ];
    tableErrors.audit_logs = { message: 'audit insert failed' };

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_inventory_consumed_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/audit insert failed/i);

    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('propagates INVENTORY_CONSUMED enqueue failure explicitly', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    tableRows.session_logs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'completed',
        completed_date: '2026-06-03',
        session_number: 1,
        tenant_id: 'tenant-a',
      },
    ];
    tableRows.bookings = [
      {
        id: 'booking-1',
        booking_number: 'B-001',
        status: 'booked',
        package_id: 'package-1',
        package_name: 'Tắm Bé Chuẩn Y Khoa',
        tenant_id: 'tenant-a',
        customer_id: 'customer-1',
      },
    ];
    tableRows.inventory_logs = [
      {
        id: 'log-1',
        tenant_id: 'tenant-a',
        item_id: 'item-1',
        change_amount: -2,
        reason: 'session_consumption',
        session_log_id: 'session-1',
        created_at: '2026-06-03T00:00:00.000Z',
        business_event_type: 'INVENTORY_CONSUMED',
        accounting_review_status: 'AUTO_POSTED',
      },
    ];
    tableRows.inventory_items = [
      {
        id: 'item-1',
        tenant_id: 'tenant-a',
        name: 'Tinh dầu tắm bé',
        stock_level: 10,
        min_stock_level: 2,
        unit: 'chai',
        price_per_unit: 10000,
      },
    ];

    await expect(runBusinessHealthRepairAction({
      action: 'enqueue_missing_inventory_consumed_accounting',
      targetId: 'session-1',
    })).rejects.toThrow(/Không thể tạo outbox INVENTORY_CONSUMED/i);
  });
});
