const {
  calculateBookingPaymentState,
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
