/**
 * Spec tests for the KTV blended rating algorithm.
 * Mirrors get_ktv_leaderboard SQL — keep in sync.
 */

import {
  calculateCompositeRating,
  calculateCustomerRating,
  calculateDisciplineScore,
  type AttendanceStatus,
} from '@/lib/ktv-rating';

describe('calculateCustomerRating', () => {
  it('returns null when no reviews', () => {
    expect(calculateCustomerRating([])).toBeNull();
  });
  it('averages multiple ratings', () => {
    expect(calculateCustomerRating([5, 4, 3])).toBe(4);
  });
  it('rounds to 2 decimals', () => {
    expect(calculateCustomerRating([5, 4, 4])).toBe(4.33);
  });
});

describe('calculateDisciplineScore — streak penalty ladder', () => {
  const streak = (n: number): AttendanceStatus[] =>
    Array(n).fill('late' as AttendanceStatus);

  it('clean record stays at 5.0', () => {
    const r = calculateDisciplineScore(['present', 'present', 'present']);
    expect(r.score).toBe(5);
    expect(r.maxLateStreak).toBe(0);
  });

  it('1 late day → 4.7', () => {
    const r = calculateDisciplineScore(streak(1));
    expect(r.score).toBe(4.7);
    expect(r.maxLateStreak).toBe(1);
  });

  it('2 consecutive late → 4.3', () => {
    const r = calculateDisciplineScore(streak(2));
    expect(r.score).toBe(4.3);
    expect(r.maxLateStreak).toBe(2);
  });

  it('3 consecutive late → 3.7', () => {
    const r = calculateDisciplineScore(streak(3));
    expect(r.score).toBe(3.7);
    expect(r.maxLateStreak).toBe(3);
  });

  it('4 consecutive late → 3.0 (cap)', () => {
    const r = calculateDisciplineScore(streak(4));
    expect(r.score).toBe(3);
    expect(r.maxLateStreak).toBe(4);
  });

  it('5 consecutive late stays at 3.0 (no double-penalty on streak)', () => {
    const r = calculateDisciplineScore(streak(5));
    // 5 in same streak, none isolated → still 5 - 2.0 = 3.0
    expect(r.score).toBe(3);
  });
});

describe('calculateDisciplineScore — isolated late days', () => {
  it('1 streak of 2 + 1 isolated late = -0.7 - 0.2 = 4.1', () => {
    const r = calculateDisciplineScore([
      'late',
      'late',
      'present',
      'present',
      'late',
    ]);
    expect(r.score).toBe(4.1);
    expect(r.lateDays).toBe(3);
    expect(r.maxLateStreak).toBe(2);
  });

  it('5 late days, all isolated by presents → max streak 1, 4 isolated → 4.7 - 0.8 = 3.9', () => {
    const r = calculateDisciplineScore([
      'late', 'present', 'late', 'present', 'late', 'present', 'late', 'present', 'late',
    ]);
    expect(r.maxLateStreak).toBe(1);
    expect(r.lateDays).toBe(5);
    expect(r.score).toBe(3.9);
  });
});

describe('calculateDisciplineScore — absent days', () => {
  it('1 absent → -1.0 → 4.0', () => {
    const r = calculateDisciplineScore(['absent', 'present', 'present']);
    expect(r.score).toBe(4);
    expect(r.absentDays).toBe(1);
  });

  it('3 absents + 1 streak-of-3 late → 5 - 1.3 - 3.0 = 0.7 → floored at 1.0', () => {
    const r = calculateDisciplineScore([
      'absent', 'absent', 'absent', 'late', 'late', 'late',
    ]);
    expect(r.score).toBe(1);
  });

  it('floor never goes below 1.0 no matter how bad', () => {
    const r = calculateDisciplineScore(
      Array(20).fill('absent' as AttendanceStatus)
    );
    expect(r.score).toBe(1);
  });
});

describe('calculateCompositeRating — 60/40 blend', () => {
  it('no sessions + no attendance → composite null', () => {
    const r = calculateCompositeRating({
      customerReviews: [],
      attendanceStatuses: [],
      sessionsCount: 0,
    });
    expect(r.composite).toBeNull();
    expect(r.customerRating).toBeNull();
    expect(r.disciplineScore).toBe(5);
  });

  it('attendance but no customer review → composite = discipline only', () => {
    const r = calculateCompositeRating({
      customerReviews: [],
      attendanceStatuses: ['late', 'late', 'present'],
      sessionsCount: 0,
    });
    expect(r.customerRating).toBeNull();
    expect(r.disciplineScore).toBe(4.3);
    expect(r.composite).toBe(4.3);
  });

  it('perfect customer + clean attendance → 5.0', () => {
    const r = calculateCompositeRating({
      customerReviews: [5, 5, 5],
      attendanceStatuses: ['present', 'present', 'present'],
      sessionsCount: 3,
    });
    expect(r.customerRating).toBe(5);
    expect(r.disciplineScore).toBe(5);
    expect(r.composite).toBe(5);
  });

  it('4-star customer + 2-streak late → 0.6*4 + 0.4*4.3 = 2.4 + 1.72 = 4.12', () => {
    const r = calculateCompositeRating({
      customerReviews: [4, 4, 4, 4],
      attendanceStatuses: ['late', 'late', 'present', 'present'],
      sessionsCount: 4,
    });
    expect(r.customerRating).toBe(4);
    expect(r.disciplineScore).toBe(4.3);
    expect(r.composite).toBe(4.12);
  });

  it('5-star customer but 4-streak late → 0.6*5 + 0.4*3 = 4.2', () => {
    const r = calculateCompositeRating({
      customerReviews: [5, 5, 5],
      attendanceStatuses: ['late', 'late', 'late', 'late'],
      sessionsCount: 3,
    });
    expect(r.disciplineScore).toBe(3);
    expect(r.composite).toBe(4.2);
  });

  it('3-star customer + 3 absents → 0.6*3 + 0.4*2 = 1.8 + 0.8 = 2.6', () => {
    const r = calculateCompositeRating({
      customerReviews: [3, 3],
      attendanceStatuses: ['absent', 'absent', 'absent'],
      sessionsCount: 2,
    });
    expect(r.customerRating).toBe(3);
    expect(r.disciplineScore).toBe(2);
    expect(r.composite).toBe(2.6);
  });
});
