export type BookingCompletionStatus =
  | 'deposit_pending'
  | 'booked'
  | 'deposit'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | string;

export type BookingCompletionSnapshot = {
  total_sessions?: number | string | null;
  completed_sessions?: number | string | null;
  status?: BookingCompletionStatus | null;
};

export type BookingCompletionUpdate = {
  completed_sessions: number;
  last_updated_date: string;
  updated_at: string;
  status?: BookingCompletionStatus;
};

export type RollbackResultLike = { success?: boolean; error?: string | null };

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeVietnameseSearchText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function shouldCreateSingleSessionRevenue(packageName: string | null | undefined) {
  const normalized = normalizeVietnameseSearchText(packageName);
  return /\ble\b/.test(normalized);
}

export function calculateBookingCompletionUpdate(input: {
  completedSessionCount: number | string | null | undefined;
  currentBooking: BookingCompletionSnapshot | null | undefined;
  today: string;
  nowIso?: string;
}): BookingCompletionUpdate {
  const completedSessionCount = Math.max(0, asFiniteNumber(input.completedSessionCount));
  const totalSessions = asFiniteNumber(input.currentBooking?.total_sessions);
  const currentStatus = input.currentBooking?.status ?? null;
  const update: BookingCompletionUpdate = {
    completed_sessions: completedSessionCount,
    last_updated_date: input.today,
    updated_at: input.nowIso ?? new Date().toISOString(),
  };

  if (
    completedSessionCount > 0 &&
    (currentStatus === 'deposit_pending' || currentStatus === 'booked' || currentStatus === 'deposit')
  ) {
    update.status = 'in_progress';
  }

  if (totalSessions > 0 && completedSessionCount >= totalSessions) {
    update.status = 'completed';
  }

  return update;
}

export function buildCompletionRollbackPayload(currentBooking: BookingCompletionSnapshot | null | undefined) {
  return {
    completed_sessions: Math.max(0, asFiniteNumber(currentBooking?.completed_sessions)),
    status: currentBooking?.status || 'booked',
  };
}

export function formatRollbackAppend(rollbackResult: RollbackResultLike) {
  return rollbackResult.error ? `; rollback failed: ${rollbackResult.error}` : '';
}
