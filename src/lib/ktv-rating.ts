/**
 * KTV monthly rating algorithm — reference implementation in TypeScript.
 *
 * The SOURCE OF TRUTH is the SQL function `get_ktv_leaderboard` in
 * supabase/migrations/20260527000000_ktv_leaderboard_blended_rating.sql.
 * This module mirrors that formula so the same numbers can be computed
 * client-side (eg. to preview a KTV's rating, or in unit tests that
 * verify the spec without hitting Postgres).
 *
 * Formula:
 *   composite = 0.6 * customer_rating + 0.4 * discipline_score
 *
 * Customer rating  (60%): AVG of approved session_reviews.rating in the
 *                         month. NULL if no reviews yet.
 *
 * Discipline score (40%): starts at 5.0, penalised by attendance:
 *   - max consecutive 'late' streak:
 *       1 day  → -0.3
 *       2 days → -0.7
 *       3 days → -1.3
 *       ≥4 days → -2.0
 *   - each isolated late day OUTSIDE the longest streak → -0.2
 *   - each 'absent' day → -1.0
 *   - floor at 1.0
 *
 * Edge cases:
 *   - No sessions AND no attendance records → composite is null.
 *   - Has attendance/sessions but no review yet → composite = discipline only.
 */

export interface RatingInputs {
  /** Per-session approved review ratings (1-5). Empty array = no reviews. */
  customerReviews: number[];
  /** Attendance status ordered chronologically by date. */
  attendanceStatuses: AttendanceStatus[];
  /** Did the KTV complete any sessions this month? */
  sessionsCount: number;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day';

export interface RatingBreakdown {
  composite: number | null;
  customerRating: number | null;
  disciplineScore: number;
  lateDays: number;
  absentDays: number;
  maxLateStreak: number;
}

const STREAK_PENALTIES: Record<number, number> = {
  0: 0,
  1: 0.3,
  2: 0.7,
  3: 1.3,
};
const STREAK_PENALTY_MAX = 2.0; // 4+ days consecutive
const ISOLATED_LATE_PENALTY = 0.2;
const ABSENT_PENALTY = 1.0;
const SCORE_FLOOR = 1.0;
const SCORE_CEILING = 5.0;
const CUSTOMER_WEIGHT = 0.6;
const DISCIPLINE_WEIGHT = 0.4;

function longestLateStreak(statuses: AttendanceStatus[]): number {
  let best = 0;
  let current = 0;
  for (const s of statuses) {
    if (s === 'late') {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export function calculateDisciplineScore(statuses: AttendanceStatus[]): {
  score: number;
  lateDays: number;
  absentDays: number;
  maxLateStreak: number;
} {
  const lateDays = statuses.filter((s) => s === 'late').length;
  const absentDays = statuses.filter((s) => s === 'absent').length;
  const maxLateStreak = longestLateStreak(statuses);

  const streakPenalty =
    maxLateStreak >= 4 ? STREAK_PENALTY_MAX : (STREAK_PENALTIES[maxLateStreak] ?? 0);

  // Late days NOT in the longest streak still attract a small penalty so
  // a KTV who's late 1 day in week 1 and 1 day in week 3 is worse than
  // someone late only once.
  const isolatedLatePenalty =
    Math.max(lateDays - maxLateStreak, 0) * ISOLATED_LATE_PENALTY;

  const absentPenalty = absentDays * ABSENT_PENALTY;

  const raw = SCORE_CEILING - streakPenalty - isolatedLatePenalty - absentPenalty;
  const score = Math.max(raw, SCORE_FLOOR);

  return { score: round2(score), lateDays, absentDays, maxLateStreak };
}

export function calculateCustomerRating(reviews: number[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r, 0);
  return round2(sum / reviews.length);
}

export function calculateCompositeRating(input: RatingInputs): RatingBreakdown {
  const customerRating = calculateCustomerRating(input.customerReviews);
  const discipline = calculateDisciplineScore(input.attendanceStatuses);

  let composite: number | null;
  if (input.sessionsCount === 0 && input.attendanceStatuses.length === 0) {
    composite = null;
  } else if (customerRating === null) {
    composite = discipline.score;
  } else {
    composite = round2(
      CUSTOMER_WEIGHT * customerRating + DISCIPLINE_WEIGHT * discipline.score
    );
  }

  return {
    composite,
    customerRating,
    disciplineScore: discipline.score,
    lateDays: discipline.lateDays,
    absentDays: discipline.absentDays,
    maxLateStreak: discipline.maxLateStreak,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
