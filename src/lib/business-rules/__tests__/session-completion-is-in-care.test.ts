import { calculateBookingCompletionUpdate } from '../session-completion';

describe('calculateBookingCompletionUpdate - is_in_care flag', () => {
  it('should set is_in_care=false when package completes all sessions', () => {
    const result = calculateBookingCompletionUpdate({
      completedSessionCount: 15,
      currentBooking: {
        total_sessions: 15,
        completed_sessions: 14,
        status: 'in_progress',
      },
      today: '2026-08-23',
    });

    expect(result.status).toBe('completed');
    expect(result.is_in_care).toBe(false);
    expect(result.completed_sessions).toBe(15);
  });

  it('should NOT set is_in_care when package is not yet complete', () => {
    const result = calculateBookingCompletionUpdate({
      completedSessionCount: 10,
      currentBooking: {
        total_sessions: 15,
        completed_sessions: 9,
        status: 'in_progress',
      },
      today: '2026-08-23',
    });

    expect(result.status).toBeUndefined(); // Status doesn't change
    expect(result.is_in_care).toBeUndefined(); // Flag not touched
    expect(result.completed_sessions).toBe(10);
  });

  it('should handle single-session package completion', () => {
    const result = calculateBookingCompletionUpdate({
      completedSessionCount: 1,
      currentBooking: {
        total_sessions: 1,
        completed_sessions: 0,
        status: 'booked',
      },
      today: '2026-08-23',
    });

    expect(result.status).toBe('completed'); // Transitions directly to completed
    expect(result.is_in_care).toBe(false); // Cleared immediately
    expect(result.completed_sessions).toBe(1);
  });

  it('should handle babycare 21-session package completion', () => {
    const result = calculateBookingCompletionUpdate({
      completedSessionCount: 21,
      currentBooking: {
        total_sessions: 21,
        completed_sessions: 20,
        status: 'in_progress',
      },
      today: '2026-08-23',
    });

    expect(result.status).toBe('completed');
    expect(result.is_in_care).toBe(false); // KTV should no longer be blocked by this package
    expect(result.completed_sessions).toBe(21);
  });

  it('should not set is_in_care=false if status is not changing to completed', () => {
    const result = calculateBookingCompletionUpdate({
      completedSessionCount: 5,
      currentBooking: {
        total_sessions: 0, // Unlimited or pay-per-session
        completed_sessions: 4,
        status: 'in_progress',
      },
      today: '2026-08-23',
    });

    expect(result.status).toBeUndefined();
    expect(result.is_in_care).toBeUndefined(); // Should NOT be set
    expect(result.completed_sessions).toBe(5);
  });
});
