const {
  calculateBookingPaymentState,
  checkBookingFinancialIntegrity,
  checkCrossModuleSideEffects,
  checkInventory,
  checkLedger,
  checkPaymentBookingRevenue,
  checkSalary,
  getBusinessDateContext,
  runBusinessInvariantChecksOnDataset,
  summarizeBusinessInvariantResults,
} = require('../../scripts/check-business-invariants.cjs');

const emptyDataset = {
  bookings: [],
  revenue: [],
  sessionLogs: [],
  salaryRecords: [],
  packages: [],
  packageMaterials: [],
  inventoryItems: [],
  inventoryLogs: [],
  journalEntries: [],
  journalLines: [],
  accountingOutbox: [],
};

describe('business invariant check script', () => {
  it('uses the same payment state semantics as the customer portal', () => {
    expect(
      calculateBookingPaymentState({
        fullPrice: 6000000,
        discountPercent: 25,
        depositAmount: 200000,
        bookingStatus: 'deposit_pending',
        revenues: [{ amount: 200000, status: 'confirmed', revenue_type: 'deposit' }],
      })
    ).toEqual(
      expect.objectContaining({
        priceAfterDiscount: 4500000,
        totalPaid: 200000,
        remainingDebt: 4300000,
        depositTarget: 200000,
        depositDue: 0,
        showDepositRequest: false,
      })
    );
  });

  it('flags a booking that already has enough deposit but remains deposit_pending', () => {
    const result = checkPaymentBookingRevenue({
      ...emptyDataset,
      bookings: [
        {
          id: 'booking-1',
          booking_number: 'B-001',
          status: 'deposit_pending',
          deposit_amount: 200000,
          full_price: 6000000,
          discount_percent: 25,
          tenant_id: 'tenant-1',
        },
      ],
      revenue: [
        {
          id: 'rev-1',
          booking_id: 'booking-1',
          amount: 200000,
          status: 'confirmed',
          revenue_type: 'deposit',
          tenant_id: 'tenant-1',
        },
      ],
    });

    expect(result.criticalCount).toBe(1);
    expect(result.findings[0].code).toBe('deposit_paid_but_booking_still_pending');
  });

  it('checks booking financial integrity across booking, revenue, portal, and ledger layers', () => {
    const result = checkBookingFinancialIntegrity({
      ...emptyDataset,
      bookings: [
        {
          id: 'booking-me-tien',
          booking_number: 'B-ME-TIEN',
          status: 'deposit_pending',
          deposit_amount: 200000,
          full_price: 6000000,
          discount_percent: 25,
          tenant_id: 'tenant-1',
        },
      ],
      revenue: [
        {
          id: 'revenue-deposit',
          booking_id: 'booking-me-tien',
          amount: 200000,
          status: 'confirmed',
          revenue_type: 'deposit',
          tenant_id: 'tenant-1',
        },
      ],
      accountingOutbox: [
        {
          id: 'outbox-deposit',
          event_type: 'PACKAGE_SALE',
          reference_type: 'REVENUE',
          reference_id: 'revenue-deposit',
          status: 'COMPLETED',
        },
      ],
    });

    expect(result.name).toBe('booking_financial_integrity');
    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'portal_deposit_qr_should_be_closed',
        totalPaid: 200000,
        depositDue: 0,
        remainingDebt: 4300000,
        portalAmountToPay: 4300000,
        portalMode: 'full',
      }),
    ]);
  });

  it('flags booking revenue without ledger side effects in financial integrity checks', () => {
    const result = checkBookingFinancialIntegrity({
      ...emptyDataset,
      bookings: [
        {
          id: 'booking-1',
          booking_number: 'B-001',
          status: 'booked',
          deposit_amount: 450000,
          full_price: 450000,
          discount_percent: 0,
          tenant_id: 'tenant-1',
        },
      ],
      revenue: [
        {
          id: 'revenue-1',
          booking_id: 'booking-1',
          amount: 450000,
          status: 'confirmed',
          revenue_type: 'package_payment',
          tenant_id: 'tenant-1',
        },
      ],
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        code: 'booking_revenue_ledger_gap',
        revenueIds: ['revenue-1'],
        missingLedgerCount: 1,
      }),
    ]);
  });

  it('flags unbalanced posted journal entries', () => {
    const result = checkLedger({
      ...emptyDataset,
      journalEntries: [{ id: 'entry-1', status: 'POSTED' }],
      journalLines: [
        { id: 'line-1', entry_id: 'entry-1', debit_amount: 1000, credit_amount: 0 },
        { id: 'line-2', entry_id: 'entry-1', debit_amount: 0, credit_amount: 900 },
      ],
    });

    expect(result.criticalCount).toBe(1);
    expect(result.findings[0].code).toBe('posted_journal_unbalanced');
  });

  it('flags draft salary session drift against live weighted completed sessions', () => {
    const result = checkSalary(
      {
        ...emptyDataset,
        bookings: [{ id: 'booking-1', tenant_id: 'tenant-1', package_id: 'package-1', package_name: 'VIP' }],
        packages: [{ id: 'package-1', name: 'VIP', tenant_id: 'tenant-1', session_multiplier: 2 }],
        sessionLogs: [
          {
            id: 'session-1',
            booking_id: 'booking-1',
            status: 'completed',
            completed_date: '2026-06-05',
            completed_by_ktv_id: 'ktv-1',
            tenant_id: 'tenant-1',
          },
        ],
        salaryRecords: [
          {
            id: 'salary-1',
            ktv_id: 'ktv-1',
            tenant_id: 'tenant-1',
            month_year: '2026-06-01',
            status: 'draft',
            total_sessions: 26,
            base_salary: 0,
            session_bonus: 0,
            rating_bonus: 0,
            kpi_bonus: 0,
            violations_deduction: 0,
            service_percentage_bonus: 0,
            total_salary: 0,
          },
        ],
      },
      { monthDate: '2026-06-01', nextMonthDate: '2026-07-01' }
    );

    expect(result.criticalCount).toBe(1);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({
        code: 'draft_salary_session_count_drift',
        savedSessions: 26,
        liveSessions: 2,
      })
    );
  });

  it('flags invalid inventory stock and consumption logs', () => {
    const result = checkInventory({
      ...emptyDataset,
      inventoryItems: [{ id: 'item-1', name: 'Oil', stock_level: -1 }],
      sessionLogs: [{ id: 'session-1', status: 'scheduled', booking_id: 'booking-1' }],
      inventoryLogs: [
        {
          id: 'log-1',
          item_id: 'item-1',
          reason: 'session_consumption',
          change_amount: 1,
          session_log_id: 'session-1',
        },
      ],
    });

    expect(result.findings.map((finding: { code: string }) => finding.code)).toEqual(
      expect.arrayContaining(['negative_inventory_stock', 'consumption_log_not_negative', 'orphan_consumption_log'])
    );
  });

  it('passes cross-module side-effect checks when outbox events are present', () => {
    const result = checkCrossModuleSideEffects({
      ...emptyDataset,
      bookings: [
        {
          id: 'booking-1',
          booking_number: 'B-001',
          tenant_id: 'tenant-1',
          package_id: 'package-1',
          completed_sessions: 1,
        },
      ],
      revenue: [
        {
          id: 'rev-1',
          booking_id: 'booking-1',
          amount: 200000,
          status: 'confirmed',
          revenue_type: 'deposit',
          tenant_id: 'tenant-1',
        },
      ],
      sessionLogs: [
        {
          id: 'session-1',
          booking_id: 'booking-1',
          status: 'completed',
          completed_by_ktv_id: 'ktv-1',
          tenant_id: 'tenant-1',
        },
      ],
      packageMaterials: [
        {
          id: 'material-1',
          package_id: 'package-1',
          item_id: 'item-1',
          quantity_per_session: 1,
        },
      ],
      inventoryLogs: [
        {
          id: 'inventory-log-1',
          item_id: 'item-1',
          session_log_id: 'session-1',
          reason: 'session_consumption',
          change_amount: -1,
        },
      ],
      salaryRecords: [
        {
          id: 'salary-1',
          ktv_id: 'ktv-1',
          tenant_id: 'tenant-1',
          month_year: '2026-06-01',
          status: 'paid',
        },
      ],
      accountingOutbox: [
        { id: 'outbox-1', event_type: 'PACKAGE_SALE', reference_type: 'REVENUE', reference_id: 'rev-1', status: 'COMPLETED' },
        { id: 'outbox-2', event_type: 'SESSION_DONE', reference_type: 'SESSION_LOG', reference_id: 'session-1', status: 'COMPLETED' },
        { id: 'outbox-3', event_type: 'INVENTORY_CONSUMED', reference_type: 'SESSION_LOG', reference_id: 'session-1', status: 'COMPLETED' },
        { id: 'outbox-4', event_type: 'SALARY_PAID', reference_type: 'SALARY_RECORD', reference_id: 'salary-1', status: 'COMPLETED' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
  });

  it('flags missing cross-module accounting side effects and booking progress drift', () => {
    const result = checkCrossModuleSideEffects({
      ...emptyDataset,
      bookings: [
        {
          id: 'booking-1',
          booking_number: 'B-001',
          tenant_id: 'tenant-1',
          package_id: 'package-1',
          completed_sessions: 0,
        },
      ],
      revenue: [
        {
          id: 'rev-package',
          booking_id: 'booking-1',
          amount: 200000,
          status: 'confirmed',
          revenue_type: 'deposit',
          tenant_id: 'tenant-1',
          accounting_review_status: 'AUTO_POSTED',
        },
        {
          id: 'rev-refund',
          booking_id: 'booking-1',
          amount: 100000,
          status: 'confirmed',
          revenue_type: 'refund',
          tenant_id: 'tenant-1',
          accounting_review_status: 'AUTO_POSTED',
        },
      ],
      sessionLogs: [
        {
          id: 'session-1',
          booking_id: 'booking-1',
          status: 'completed',
          completed_by_ktv_id: 'ktv-1',
          tenant_id: 'tenant-1',
          accounting_review_status: 'AUTO_POSTED',
        },
      ],
      packageMaterials: [
        {
          id: 'material-1',
          package_id: 'package-1',
          item_id: 'item-1',
          quantity_per_session: 1,
        },
      ],
      inventoryLogs: [
        {
          id: 'inventory-log-1',
          item_id: 'item-1',
          session_log_id: 'session-1',
          reason: 'session_consumption',
          change_amount: -1,
        },
      ],
      salaryRecords: [
        {
          id: 'salary-1',
          ktv_id: 'ktv-1',
          tenant_id: 'tenant-1',
          month_year: '2026-06-01',
          status: 'paid',
          paid_date: '2026-06-30',
          paid_method: 'bank_transfer',
          total_salary: 7000000,
          accounting_review_status: 'AUTO_POSTED',
        },
      ],
    });

    expect(result.criticalCount).toBe(6);
    expect(result.findings.map((finding: { code: string }) => finding.code)).toEqual(
      expect.arrayContaining([
        'confirmed_package_revenue_missing_accounting_side_effect',
        'confirmed_refund_missing_accounting_side_effect',
        'completed_session_missing_session_done_side_effect',
        'inventory_consumption_missing_accounting_side_effect',
        'booking_completed_sessions_drift',
        'paid_salary_missing_accounting_side_effect',
      ])
    );
  });

  it('warns but does not block for unreviewed legacy side-effect gaps', () => {
    const result = checkCrossModuleSideEffects({
      ...emptyDataset,
      bookings: [
        {
          id: 'booking-1',
          booking_number: 'B-001',
          tenant_id: 'tenant-1',
          completed_sessions: 1,
        },
      ],
      sessionLogs: [
        {
          id: 'session-legacy',
          booking_id: 'booking-1',
          status: 'completed',
          completed_by_ktv_id: 'ktv-1',
          tenant_id: 'tenant-1',
          accounting_review_status: 'UNREVIEWED',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.findings[0].code).toBe('completed_session_missing_session_done_side_effect');
  });

  it('warns when accounting outbox events stay pending too long', () => {
    const result = checkLedger(
      {
        ...emptyDataset,
        accountingOutbox: [
          {
            id: 'outbox-stale',
            event_type: 'PACKAGE_SALE',
            reference_type: 'REVENUE',
            reference_id: 'rev-1',
            status: 'PENDING',
            retry_count: 0,
            max_retries: 3,
            created_at: '2026-06-05T00:00:00.000Z',
          },
        ],
      },
      { now: new Date('2026-06-07T00:30:00.000Z') }
    );

    expect(result.warningCount).toBe(1);
    expect(result.findings[0].code).toBe('stale_accounting_outbox');
  });

  it('summarizes all check groups with warnings as non-blocking by default', () => {
    const results = runBusinessInvariantChecksOnDataset(
      {
        ...emptyDataset,
        revenue: [
          {
            id: 'rev-1',
            booking_id: null,
            amount: 1000,
            status: 'confirmed',
            revenue_type: 'additional',
            tenant_id: 'tenant-1',
            business_event_type: null,
            accounting_review_status: 'UNREVIEWED',
          },
        ],
      },
      { now: new Date(Date.UTC(2026, 5, 6)) }
    );
    const summary = summarizeBusinessInvariantResults(results);

    expect(getBusinessDateContext(new Date(Date.UTC(2026, 5, 6)))).toEqual({
      monthDate: '2026-06-01',
      nextMonthDate: '2026-07-01',
    });
    expect(summary.isHealthy).toBe(true);
    expect(summary.warningCount).toBe(1);
  });
});
