import {
  calculateBookingPaymentState,
  calculatePriceAfterDiscount,
  calculateSessionRevenueRecognition,
  validatePaymentAmountAgainstState,
} from '@/lib/business-rules/payment';
import {
  buildPromotionPayload,
  buildVoucherPromotionPayload,
  normalizePromotionCode,
  normalizePromotionDiscountPercent,
  validatePromotionDateRange,
} from '@/lib/business-rules/promotion';
import {
  buildAttendanceTimestamp,
  calculateCheckInAttendanceStatus,
  calculateAttendanceBreakdown,
  calculateAttendancePenalty,
  calculateProRataBaseSalaryFromActualDays,
  getLeaveAttendanceStatus,
  normalizeAttendanceStatus,
} from '@/lib/business-rules/attendance';
import {
  INVENTORY_REASONS,
  buildSessionConsumptionPlan,
  calculateInventorySummary,
  calculateMonthlyReconciliationEntry,
  calculateConsumptionMovement,
  calculateRestockMovement,
  calculateRollbackStock,
  classifyInventoryMovementReason,
  normalizePackageMaterialRows,
} from '@/lib/business-rules/inventory';
import {
  buildSalaryDisplayComponents,
  calculateSalaryReconciliationDiffPercent,
  calculateLiveAttendanceSalaryComponents,
  calculateSalaryDetails,
  calculateSalaryTotal,
  hasSalaryLegacyReconciliationRecord,
  resolveSalaryReconciliationStatus,
} from '@/lib/business-rules/salary';
import {
  buildCompletionRollbackPayload,
  calculateBookingCompletionUpdate,
  formatRollbackAppend,
  shouldCreateSingleSessionRevenue,
} from '@/lib/business-rules/session-completion';
import {
  assertOutboxEnqueued,
  buildExpenseRecordedOutboxEvent,
  buildInventoryConsumedOutboxEvent,
  buildPackageSaleOutboxEvent,
  buildRefundIssuedOutboxEvent,
  buildSalaryPaidOutboxEvent,
  buildSessionDoneOutboxEvent,
  isPackageSaleRevenueType,
} from '@/lib/business-rules/accounting-outbox';
import { evaluateBookingFinancialIntegrity } from '@/lib/business-rules/financial-integrity';

describe('shared business rule engines', () => {
  it('calculates customer payment state from confirmed revenue records', () => {
    const state = calculateBookingPaymentState({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 200000,
      bookingStatus: 'deposit_pending',
      revenues: [
        { amount: 200000, status: 'confirmed', revenue_type: 'deposit' },
        { amount: 100000, status: 'pending', revenue_type: 'remaining_payment' },
      ],
    });

    expect(state.priceAfterDiscount).toBe(4500000);
    expect(state.totalPaid).toBe(200000);
    expect(state.depositDue).toBe(0);
    expect(state.remainingDebt).toBe(4300000);
    expect(state.showDepositRequest).toBe(false);
  });

  it('rounds fractional discount math to integer VND amounts for 33 and 34 percent discounts', () => {
    expect(calculatePriceAfterDiscount({ fullPrice: 450000, discountPercent: 33 })).toBe(301500);
    expect(calculatePriceAfterDiscount({ fullPrice: 450000, discountPercent: 34 })).toBe(297000);

    const thirtyThreePercentState = calculateBookingPaymentState({
      fullPrice: 450000,
      discountPercent: 33,
      depositAmount: 0,
      revenues: [],
    });

    expect(thirtyThreePercentState.priceAfterDiscount).toBe(301500);
    expect(450000 - thirtyThreePercentState.priceAfterDiscount).toBe(148500);
    expect(thirtyThreePercentState.remainingDebt).toBe(301500);
  });

  it('normalizes promotion and voucher payloads without changing booking pricing rules', () => {
    expect(normalizePromotionCode(' bella baby 10 ')).toBe('BELLABABY10');
    expect(normalizePromotionDiscountPercent(150)).toBe(100);
    expect(normalizePromotionDiscountPercent(-5)).toBe(0);
    expect(normalizePromotionDiscountPercent(null)).toBeNull();

    expect(buildPromotionPayload({
      title: '  Thang cua me  ',
      description: '  Uu dai dich vu  ',
      discount_code: ' me 33 ',
      discount_percent: 33.4,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
    })).toEqual({
      success: true,
      payload: {
        title: 'Thang cua me',
        description: 'Uu dai dich vu',
        image_url: null,
        discount_code: 'ME33',
        discount_percent: 33.4,
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        is_active: true,
      },
    });

    expect(buildVoucherPromotionPayload({
      code: ' baby 10 ',
      target: 'Be tron 1 tuoi',
      discount: 10,
      status: 'paused',
    })).toEqual({
      success: true,
      payload: expect.objectContaining({
        title: 'BABY10',
        discount_code: 'BABY10',
        discount_percent: 10,
        is_active: false,
      }),
    });
  });

  it('rejects invalid promotion date ranges in the shared promotion rules', () => {
    expect(validatePromotionDateRange({
      startDate: '2026-07-01',
      endDate: '2026-06-30',
    })).toEqual({
      success: false,
      error: 'Ngay bat dau khong duoc sau ngay ket thuc.',
    });
  });

  it('rejects overpayment against the shared remaining debt state', () => {
    const state = calculateBookingPaymentState({
      fullPrice: 5000000,
      discountPercent: 0,
      depositAmount: 1000000,
      revenues: [{ amount: 1000000, status: 'confirmed', revenue_type: 'deposit' }],
    });

    expect(validatePaymentAmountAgainstState(state, 4000000)).toEqual({ success: true });
    expect(validatePaymentAmountAgainstState(state, 4000001)).toEqual({
      error: 'Số tiền thanh toán vượt quá số tiền còn nợ của gói (4.000.000 đ)',
    });
  });

  it('evaluates booking financial integrity across payment, portal, and ledger layers', () => {
    const meTien = evaluateBookingFinancialIntegrity({
      booking: {
        id: 'booking-me-tien',
        booking_number: 'B-ME-TIEN',
        status: 'deposit_pending',
        deposit_amount: 200000,
        full_price: 6000000,
        discount_percent: 25,
        tenant_id: 'tenant-1',
      },
      revenues: [
        {
          id: 'revenue-deposit',
          booking_id: 'booking-me-tien',
          tenant_id: 'tenant-1',
          amount: 200000,
          status: 'confirmed',
          revenue_type: 'deposit',
        },
      ],
      outboxEvents: [
        {
          id: 'outbox-deposit',
          event_type: 'PACKAGE_SALE',
          reference_type: 'REVENUE',
          reference_id: 'revenue-deposit',
        },
      ],
    });

    expect(meTien.totalPaid).toBe(200000);
    expect(meTien.remainingDebt).toBe(4300000);
    expect(meTien.portalShouldShowDepositQr).toBe(false);
    expect(meTien.portalMode).toBe('full');
    expect(meTien.portalAmountToPay).toBe(4300000);
    expect(meTien.issues.map((issue) => issue.code)).toContain('portal_deposit_qr_should_be_closed');
    expect(meTien.issues.map((issue) => issue.code)).not.toContain('booking_revenue_ledger_gap');
  });

  it('flags confirmed booking revenue missing PACKAGE_SALE side effects', () => {
    const result = evaluateBookingFinancialIntegrity({
      booking: {
        id: 'booking-ledger-gap',
        booking_number: 'B-GAP',
        status: 'booked',
        deposit_amount: 450000,
        full_price: 450000,
        discount_percent: 0,
        tenant_id: 'tenant-1',
      },
      revenues: [
        {
          id: 'revenue-paid',
          booking_id: 'booking-ledger-gap',
          tenant_id: 'tenant-1',
          amount: 450000,
          status: 'confirmed',
          revenue_type: 'package_payment',
        },
      ],
      outboxEvents: [],
      journalEntries: [],
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'booking_revenue_ledger_gap',
        revenueIds: ['revenue-paid'],
        missingLedgerCount: 1,
      }),
    ]);
  });

  it('splits completed-session revenue from confirmed paid amount, not booking deposit field', () => {
    const recognition = calculateSessionRevenueRecognition({
      fullPrice: 500000,
      discountPercent: 0,
      totalSessions: 5,
      currentSessionNumber: 2,
      totalPaid: 200000,
    });

    expect(recognition.earnedRevenueAmount).toBe(100000);
    expect(recognition.revenueRecognizedBefore).toBe(100000);
    expect(recognition.deferredRevenueAmount).toBe(100000);
    expect(recognition.receivableAmount).toBe(0);
  });

  it('calculates attendance workdays, pro-rata salary, and automatic penalties', () => {
    const breakdown = calculateAttendanceBreakdown([
      { status: 'present' },
      { status: 'late' },
      { status: 'half_day' },
      { status: 'absent' },
    ]);

    expect(breakdown).toEqual({ present: 1, late: 1, absent: 1, halfDay: 1, workDays: 2.5 });
    expect(calculateProRataBaseSalaryFromActualDays(5200000, breakdown.workDays)).toBe(500000);
    expect(calculateAttendancePenalty({
      lateDays: breakdown.late,
      absentDays: breakdown.absent,
      penaltyLatePerDay: 50000,
      penaltyAbsentPerDay: 200000,
    }).totalPenalty).toBe(250000);
  });

  it('centralizes attendance lifecycle rules for check-in, leave, and timestamps', () => {
    expect(calculateCheckInAttendanceStatus({ localTime: '08:30:00' })).toBe('present');
    expect(calculateCheckInAttendanceStatus({ localTime: '08:30:01' })).toBe('late');
    expect(getLeaveAttendanceStatus('full_day')).toBe('absent');
    expect(getLeaveAttendanceStatus('morning')).toBe('half_day');
    expect(normalizeAttendanceStatus('unknown')).toBe('present');
    expect(buildAttendanceTimestamp('2026-06-07T08:00:00')).toBe('2026-06-07T01:00:00.000Z');
  });

  it('uses one live attendance salary helper for draft payroll components', () => {
    const components = calculateLiveAttendanceSalaryComponents({
      attendanceLogs: [
        { status: 'present' },
        { status: 'late' },
        { status: 'half_day' },
        { status: 'absent' },
      ],
      rawBaseSalary: 5200000,
      lateDays: 1,
      absentDays: 1,
      penaltyLatePerDay: 50000,
      penaltyAbsentPerDay: 200000,
    });

    expect(components).toMatchObject({
      actualDays: 2.5,
      baseSalary: 500000,
      deductions: 250000,
      hasAutoPenalty: true,
      proRataNote: 'Cong thuc te: 2.5/26 ngay. ',
    });
    expect(components.attendancePenalty).toMatchObject({
      lateDays: 1,
      absentDays: 1,
      totalPenalty: 250000,
    });
  });

  it('calculates salary details and final total through the shared salary engine', () => {
    const salaryConfig = {
      bonus_5_star: 50000,
      bonus_4_5_star: 30000,
      bonus_4_star: 10000,
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000,
    };

    expect(calculateSalaryDetails(35, 5, salaryConfig, 6000000, 200000, 300000, 2000000))
      .toMatchObject({
        bonusPerSession: 50000,
        ratingBonus: 1750000,
        kpiBonus: 1000000,
        totalSalary: 10250000,
      });
    expect(calculateSalaryTotal({
      baseSalary: 1000000,
      sessionBonus: 100000,
      ratingBonus: 50000,
      kpiBonus: 0,
      deductions: 2000000,
      advances: 0,
    })).toBe(0);
  });

  it('uses one salary display contract for draft live data and saved non-draft records', () => {
    expect(buildSalaryDisplayComponents({
      record: null,
      liveSessionsCount: 2,
      liveSessionBonus: 300000,
      liveRatingBonus: 100000,
      liveBaseSalary: 1000000,
      liveKpiBonus: 200000,
      liveDeductions: 50000,
      liveAdvances: 0,
    })).toMatchObject({
      status: 'draft',
      isDraft: true,
      sessions: 2,
      baseSalary: 1000000,
      totalSalary: 1550000,
    });

    expect(buildSalaryDisplayComponents({
      record: {
        status: 'published',
        total_sessions: 26,
        base_salary: 6000000,
        session_bonus: 1000000,
        rating_bonus: 500000,
        kpi_bonus: 300000,
        violations_deduction: 100000,
        service_percentage_bonus: 200000,
        total_salary: 7500000,
      },
      liveSessionsCount: 1,
      liveSessionBonus: 100000,
      liveRatingBonus: 0,
      liveBaseSalary: 100000,
      liveKpiBonus: 0,
      liveDeductions: 0,
      liveAdvances: 0,
    })).toMatchObject({
      status: 'published',
      isDraft: false,
      sessions: 26,
      baseSalary: 6000000,
      totalSalary: 7500000,
    });
  });

  it('centralizes salary reconciliation status rules and missing legacy semantics', () => {
    const thresholds = {
      MATCH_ABS_VND: 5000,
      MATCH_PERCENT: 1,
      MAJOR_DIFF_PERCENT: 5,
    };

    expect(hasSalaryLegacyReconciliationRecord({
      status: 'PENDING_LEGACY',
      legacyStatus: 'missing',
    })).toBe(false);
    expect(calculateSalaryReconciliationDiffPercent({
      legacyTotal: 0,
      aiTotal: 6800000,
      hasLegacyRecord: false,
    })).toBeNull();
    expect(resolveSalaryReconciliationStatus({
      status: 'PENDING_LEGACY',
      legacyStatus: 'missing',
      legacyTotal: 0,
      aiTotal: 6800000,
      thresholds,
    })).toBe('NO_LEGACY');
    expect(resolveSalaryReconciliationStatus({
      legacyTotal: 10000000,
      aiTotal: 10003000,
      thresholds,
    })).toBe('MATCH');
    expect(resolveSalaryReconciliationStatus({
      legacyTotal: 10000000,
      aiTotal: 10200000,
      thresholds,
    })).toBe('MINOR_DIFF');
    expect(resolveSalaryReconciliationStatus({
      legacyTotal: 10000000,
      aiTotal: 10600000,
      thresholds,
    })).toBe('MAJOR_DIFF');
  });

  it('classifies inventory movements and calculates stock changes', () => {
    expect(classifyInventoryMovementReason(INVENTORY_REASONS.sessionConsumption)).toBe('consumption');
    expect(classifyInventoryMovementReason(INVENTORY_REASONS.restock)).toBe('purchase');

    expect(calculateRestockMovement({ stockLevel: 3, amount: 2 })).toEqual({
      previousStock: 3,
      changeAmount: 2,
      newStock: 5,
      reason: INVENTORY_REASONS.restock,
    });
    expect(calculateConsumptionMovement({ itemName: 'Gel', stockLevel: 5, amount: 2 })).toEqual({
      previousStock: 5,
      changeAmount: -2,
      newStock: 3,
      reason: INVENTORY_REASONS.sessionConsumption,
    });
    expect(calculateRollbackStock({ stockLevel: 3, changeAmount: -2 })).toBe(5);
  });

  it('centralizes inventory summary, material normalization, reconciliation, and consumption plan', () => {
    expect(calculateInventorySummary([
      { stock_level: 3, min_stock_level: 5, price_per_unit: 10000 },
      { stock_level: 10, min_stock_level: 5, price_per_unit: 20000 },
    ])).toEqual({ totalItems: 2, lowStockCount: 1, totalValue: 230000 });

    expect(normalizePackageMaterialRows([
      { item_id: ' item-1 ', quantity_per_session: '2' },
      { item_id: 'item-2', quantity_per_session: 0 },
      { item_id: '', quantity_per_session: 4 },
    ])).toEqual([{ item_id: 'item-1', quantity_per_session: 2 }]);

    expect(calculateMonthlyReconciliationEntry({
      actualStock: 12,
      expectedStock: 10,
      unit: 'chai',
      periodLabel: '06/2026',
      notes: 'counted',
    })).toMatchObject({
      actualStock: 12,
      expectedStock: 10,
      variance: 2,
      reason: INVENTORY_REASONS.monthlyReconciliation,
    });

    expect(buildSessionConsumptionPlan([
      { quantity_per_session: 2, inventory_items: { id: 'oil', price_per_unit: 50000 } },
      { quantity_per_session: 0, inventory_items: { id: 'skip', price_per_unit: 10000 } },
    ])).toEqual({
      items: [{ itemId: 'oil', quantity: 2, unitCost: 50000, cost: 100000 }],
      totalCost: 100000,
    });
  });

  it('centralizes session completion orchestration rules', () => {
    expect(shouldCreateSingleSessionRevenue('Gói dịch vụ lẻ')).toBe(true);
    expect(shouldCreateSingleSessionRevenue('Goi dich vu le')).toBe(true);
    expect(shouldCreateSingleSessionRevenue('Combo Mẹ & Bé')).toBe(false);

    expect(calculateBookingCompletionUpdate({
      completedSessionCount: 1,
      currentBooking: { total_sessions: 3, status: 'booked' },
      today: '2026-06-07',
      nowIso: '2026-06-07T01:00:00.000Z',
    })).toEqual({
      completed_sessions: 1,
      last_updated_date: '2026-06-07',
      updated_at: '2026-06-07T01:00:00.000Z',
      status: 'in_progress',
    });

    expect(calculateBookingCompletionUpdate({
      completedSessionCount: 3,
      currentBooking: { total_sessions: 3, status: 'in_progress' },
      today: '2026-06-07',
      nowIso: '2026-06-07T01:00:00.000Z',
    }).status).toBe('completed');

    expect(buildCompletionRollbackPayload({ completed_sessions: 2, status: 'in_progress' }))
      .toEqual({ completed_sessions: 2, status: 'in_progress' });
    expect(formatRollbackAppend({ success: true })).toBe('');
    expect(formatRollbackAppend({ error: 'inventory rollback failed' }))
      .toBe('; rollback failed: inventory rollback failed');
  });

  it('centralizes accounting outbox event payloads', () => {
    expect(isPackageSaleRevenueType(' Remaining_Payment ')).toBe(true);
    expect(isPackageSaleRevenueType('session_completed')).toBe(false);

    expect(buildPackageSaleOutboxEvent({
      tenantId: 'tenant-1',
      revenueId: 'revenue-1',
      totalAmount: 200000,
      description: 'Deposit package',
    })).toEqual({
      tenantId: 'tenant-1',
      eventType: 'PACKAGE_SALE',
      referenceType: 'REVENUE',
      referenceId: 'revenue-1',
      payload: {
        totalAmount: 200000,
        vatRate: 0,
        description: 'Deposit package',
        branchId: 'tenant-1',
      },
    });

    expect(buildRefundIssuedOutboxEvent({
      tenantId: 'tenant-1',
      revenueId: 'refund-1',
      amount: -120000,
      paymentMethod: 'cash',
      description: 'Refund customer',
    }).payload).toMatchObject({
      amount: 120000,
      deferredRefundAmount: 0,
      revenueReductionAmount: 120000,
      paymentMethod: 'cash',
      branchId: 'tenant-1',
    });

    expect(buildExpenseRecordedOutboxEvent({
      tenantId: 'tenant-1',
      expenseId: 'expense-1',
      amount: -50000,
      category: 'materials',
    })).toMatchObject({
      eventType: 'EXPENSE_RECORDED',
      referenceType: 'EXPENSE',
      referenceId: 'expense-1',
      payload: { amount: 50000, category: 'materials', branchId: 'tenant-1' },
    });

    expect(buildSalaryPaidOutboxEvent({
      tenantId: 'tenant-1',
      salaryRecordId: 'salary-1',
      amount: 6000000,
      ktvId: 'ktv-1',
    })).toMatchObject({
      eventType: 'SALARY_PAID',
      referenceType: 'SALARY_RECORD',
      referenceId: 'salary-1',
      payload: { amount: 6000000, ktvId: 'ktv-1', branchId: 'tenant-1' },
    });

    expect(buildInventoryConsumedOutboxEvent({
      tenantId: 'tenant-1',
      sessionLogId: 'session-1',
      amount: 75000,
    })).toMatchObject({
      eventType: 'INVENTORY_CONSUMED',
      referenceType: 'SESSION_LOG',
      referenceId: 'session-1',
      payload: { amount: 75000, branchId: 'tenant-1' },
    });

    expect(buildSessionDoneOutboxEvent({
      tenantId: 'tenant-1',
      sessionLogId: 'session-1',
      bookingId: 'booking-1',
      ktvId: 'ktv-1',
      earnedRevenueAmount: 300000,
      deferredRevenueAmount: 2700000,
      receivableAmount: 0,
      commissionAmount: 50000,
      description: 'Session done',
    })).toMatchObject({
      eventType: 'SESSION_DONE',
      referenceType: 'SESSION_LOG',
      referenceId: 'session-1',
      payload: {
        earnedRevenueAmount: 300000,
        deferredRevenueAmount: 2700000,
        receivableAmount: 0,
        bookingId: 'booking-1',
        ktvId: 'ktv-1',
        commissionAmount: 50000,
        branchId: 'tenant-1',
        description: 'Session done',
      },
    });

    expect(() => assertOutboxEnqueued(true, 'PACKAGE_SALE')).not.toThrow();
    expect(() => assertOutboxEnqueued(false, 'PACKAGE_SALE'))
      .toThrow('Failed to enqueue PACKAGE_SALE accounting event');
  });
});
