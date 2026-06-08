export type CustomerListBookingCandidate = {
  package_name?: string | null;
  created_at?: string | null;
  is_in_care?: boolean | null;
  status?: string | null;
  total_sessions?: number | null;
  completed_sessions?: number | null;
};

const ACTIVE_BOOKING_STATUSES = new Set(['booked', 'in_progress', 'active']);
const TERMINAL_BOOKING_STATUSES = new Set(['completed', 'cancelled']);

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? '').trim().toLowerCase();
}

function hasPackageName(booking: CustomerListBookingCandidate) {
  return Boolean(booking.package_name?.trim());
}

function getCreatedAtMs(booking: CustomerListBookingCandidate) {
  const timestamp = new Date(booking.created_at || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function isActiveCareBooking(booking: CustomerListBookingCandidate | null | undefined) {
  if (!booking || !hasPackageName(booking)) return false;

  const status = normalizeStatus(booking.status);
  if (TERMINAL_BOOKING_STATUSES.has(status)) return false;

  const totalSessions = Number(booking.total_sessions ?? 0);
  const completedSessions = Number(booking.completed_sessions ?? 0);
  const hasUnfinishedSessions = totalSessions > 0 && completedSessions < totalSessions;

  return Boolean(
    booking.is_in_care ||
      ACTIVE_BOOKING_STATUSES.has(status) ||
      (hasUnfinishedSessions && status !== 'deposit_pending' && status !== 'lead'),
  );
}

export function selectCustomerDisplayBooking<T extends CustomerListBookingCandidate>(
  bookings: T[] | null | undefined,
) {
  if (!bookings || bookings.length === 0) return null;

  return [...bookings].sort((a, b) => {
    const activeDiff = Number(isActiveCareBooking(b)) - Number(isActiveCareBooking(a));
    if (activeDiff !== 0) return activeDiff;

    const terminalDiff =
      Number(!TERMINAL_BOOKING_STATUSES.has(normalizeStatus(b.status))) -
      Number(!TERMINAL_BOOKING_STATUSES.has(normalizeStatus(a.status)));
    if (terminalDiff !== 0) return terminalDiff;

    return getCreatedAtMs(b) - getCreatedAtMs(a);
  })[0];
}
