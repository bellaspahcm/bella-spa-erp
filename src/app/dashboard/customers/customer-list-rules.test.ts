import {
  calculateCustomerBookingProgress,
  isActiveCareBooking,
  selectCustomerDisplayBooking,
} from './customer-list-rules';

describe('customer-list-rules', () => {
  it('calculates booking progress from completed and total sessions', () => {
    expect(calculateCustomerBookingProgress({
      package_name: 'Tam Be Chuan Y Khoa Tai Nha',
      completed_sessions: 3,
      total_sessions: 12,
    })).toEqual({
      completedSessions: 3,
      totalSessions: 12,
      percent: 25,
    });
  });

  it('clamps invalid progress instead of returning a hardcoded value', () => {
    expect(calculateCustomerBookingProgress({
      package_name: 'Tam Be Chuan Y Khoa Tai Nha',
      completed_sessions: 18,
      total_sessions: 12,
    }).percent).toBe(100);

    expect(calculateCustomerBookingProgress({
      package_name: 'Tam Be Chuan Y Khoa Tai Nha',
      completed_sessions: 4,
      total_sessions: 0,
    }).percent).toBe(0);
  });

  it('selects the active booking used by the customer card', () => {
    const selected = selectCustomerDisplayBooking([
      {
        package_name: 'Old package',
        status: 'completed',
        is_in_care: false,
        completed_sessions: 12,
        total_sessions: 12,
        created_at: '2026-10-06T01:00:00.000Z',
      },
      {
        package_name: 'Active package',
        status: 'in_progress',
        is_in_care: true,
        completed_sessions: 4,
        total_sessions: 10,
        created_at: '2026-10-05T01:00:00.000Z',
      },
    ]);

    expect(selected?.package_name).toBe('Active package');
    expect(isActiveCareBooking(selected)).toBe(true);
    expect(calculateCustomerBookingProgress(selected).percent).toBe(40);
  });
});
