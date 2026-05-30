import {
  calculateReadinessScore,
  findMissingRequiredFields,
  inferBusinessEventType,
} from '../services/accounting/template-rules';

describe('accounting template rules', () => {
  it('maps SIMPLE revenue types to Vietnamese accounting business events', () => {
    expect(inferBusinessEventType({ sourceTable: 'revenue', revenueType: 'deposit' }))
      .toBe('CUSTOMER_DEPOSIT');
    expect(inferBusinessEventType({ sourceTable: 'revenue', revenueType: 'remaining_payment' }))
      .toBe('CUSTOMER_REMAINING_PAYMENT');
    expect(inferBusinessEventType({ sourceTable: 'revenue', revenueType: 'package_payment' }))
      .toBe('CUSTOMER_FULL_PAYMENT');
    expect(inferBusinessEventType({ sourceTable: 'revenue', revenueType: 'session_completed' }))
      .toBe('SESSION_REVENUE_RECOGNIZED');
  });

  it('maps expense categories to controlled accounting business events', () => {
    expect(inferBusinessEventType({ sourceTable: 'expenses', category: 'rent' }))
      .toBe('EXPENSE_RENT');
    expect(inferBusinessEventType({ sourceTable: 'expenses', category: 'utilities' }))
      .toBe('EXPENSE_UTILITIES');
    expect(inferBusinessEventType({ sourceTable: 'expenses', category: 'marketing' }))
      .toBe('EXPENSE_MARKETING');
    expect(inferBusinessEventType({ sourceTable: 'expenses', category: 'unknown' }))
      .toBe('EXPENSE_OTHER');
  });

  it('detects missing fields before auto-posting a template', () => {
    expect(findMissingRequiredFields('CUSTOMER_DEPOSIT', {
      amount: 1_000_000,
      payment_method: 'bank_transfer',
    })).toEqual(['booking_id']);

    expect(findMissingRequiredFields('SALARY_PAYMENT', {
      amount: 8_000_000,
      payment_method: 'bank_transfer',
      ktv_id: 'ktv-1',
      month_year: '2026-05',
    })).toEqual([]);
  });

  it('scores readiness with higher penalty for review and posting failures', () => {
    expect(calculateReadinessScore({
      totalRecords: 100,
      missingBusinessEvent: 5,
      needsReview: 4,
      postingFailed: 2,
    })).toBe(85);

    expect(calculateReadinessScore({
      totalRecords: 0,
      missingBusinessEvent: 0,
      needsReview: 0,
      postingFailed: 0,
    })).toBe(100);
  });
});
