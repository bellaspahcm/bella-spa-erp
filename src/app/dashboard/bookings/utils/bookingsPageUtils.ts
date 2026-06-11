import type { BookingModalData } from '../components/BookingDayDetailModal';
import type { TimelineSession } from '../components/BookingsTimelineGrid';
import { formatBookingCustomerLabel } from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

export function getMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  const endDate = new Date(lastDay);

  startDate.setDate(startDate.getDate() - startDate.getDay());
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function isSameDay(d1: Date | string, d2: Date | string) {
  return toLocalDateKey(d1) === toLocalDateKey(d2);
}

function toLocalDateKey(d: Date | string) {
  if (typeof d === 'string') return d.split('T')[0];

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

export function buildSessionModalData(
  session: TimelineSession,
  overrides: Partial<BookingModalData>,
  tenantModuleKey: TenantModuleKey,
): BookingModalData {
  return {
    id: session.id,
    date: new Date(session.assigned_date),
    dateString: session.assigned_date,
    customer: formatBookingCustomerLabel({
      moduleKey: tenantModuleKey,
      primaryName: session.bookings?.customers?.name_mother,
      secondaryName: session.bookings?.customers?.name_baby,
    }),
    package: session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình',
    time: session.assigned_time || '09:00 - 11:00',
    ktv: session.bookings?.assigned_ktv?.full_name || 'Chưa phân công',
    contractId: session.bookings?.booking_number || 'N/A',
    contractDetail: session.notes || 'Không có ghi chú',
    bookingId: session.booking_id,
    ktvId: session.bookings?.assigned_ktv_id || undefined,
    location: session.bookings?.customers?.address || 'Tại Spa',
    sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 15} buổi`,
    completedSessions: session.bookings?.completed_sessions || 0,
    totalSessions: session.bookings?.total_sessions || 15,
    originalStatus: session.status || undefined,
    originalDateString: session.assigned_date,
    status: session.status || undefined,
    sessionNumber: session.session_number || 1,
    bookingResourceId: session.booking_resource_id || null,
    bookingResourceName: session.booking_resource?.name || null,
    bookingResourceType: session.booking_resource?.resource_type || null,
    packageRequiresResource: session.bookings?.packages?.requires_resource || false,
    packageDefaultResourceType: session.bookings?.packages?.default_resource_type || null,
    ...overrides,
  };
}
