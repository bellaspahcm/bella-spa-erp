'use server';

import { resolvePackageName } from '@bella/shared';;
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getPackages as getTenantPackages } from '@/services/package-actions';
import { BookingError } from '@/core/lib/errors';
import type { Database } from '@/types/database.types';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type PackageRow = Database['public']['Tables']['packages']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type RevenueRow = Database['public']['Tables']['revenue']['Row'];

type PackageRef = Pick<PackageRow, 'name'>;
type CustomerRef = Pick<CustomerRow, 'name_mother' | 'phone'> | null;
type BookingListItem = BookingRow & {
  customers?: CustomerRef;
  packages?: PackageRef | null;
};
type BookingCustomerDetailItem = BookingRow & {
  assigned_ktv?: { full_name: string | null; phone: string | null } | null;
  packages?: PackageRef | null;
  session_logs?: (SessionLogRow & {
    completed_by_ktv?: { full_name: string | null; phone: string | null } | null;
  })[];
  revenue?: (RevenueRow & {
    recorded_by?: { full_name: string | null } | null;
  })[];
};

const BOOKING_TENANT_ACCESS_ERROR = 'Không xác định được đơn vị kinh doanh của người dùng hiện tại.';

async function requireCurrentTenantId() {
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) {
    throw new BookingError(BOOKING_TENANT_ACCESS_ERROR, 'BOOKING_TENANT_ACCESS_ERROR');
  }
  return currentUser.tenant_id;
}

export async function getPackages() {
  const packages = await getTenantPackages();
  return packages.filter(pkg => pkg.status === 'active');
}

export async function getBookings() {
  const supabase = await createDevelopmentBypassClient();
  const tenantId = await requireCurrentTenantId();
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone), packages!bookings_package_id_fkey(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new BookingError(`Failed to fetch bookings: ${error.message}`, 'BOOKING_FETCH_ERROR');
  }
  
  if (!data || data.length === 0) return [];

  const bookings = (data || []) as BookingListItem[];
  return bookings.map((b) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: b.start_date,
    end_date: b.end_date,
    expected_birth_date: b.expected_birth_date
  }));
}

export async function getBookingsByCustomerId(customerId: string) {
  const supabase = await createDevelopmentBypassClient();
  const tenantId = await requireCurrentTenantId();
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *, 
      assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name, phone), 
      packages!bookings_package_id_fkey(name),
      session_logs(
        *,
        completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey(full_name, phone)
      ),
      revenue(
        *,
        recorded_by:users!revenue_recorded_by_id_fkey(full_name)
      )
    `)
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new BookingError(`Failed to fetch bookings for customer ${customerId}: ${error.message}`, 'BOOKING_CUSTOMER_FETCH_ERROR', { customerId });
  }
  
  if (!data || data.length === 0) return [];

  const bookings = (data || []) as BookingCustomerDetailItem[];
  return bookings.map((b) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: b.start_date,
    expected_birth_date: b.expected_birth_date
  }));
}

export async function getDraftBooking(customerId: string) {
  const supabase = await createDevelopmentBypassClient();
  const tenantId = await requireCurrentTenantId();
  
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone, address), revenue(amount, status, revenue_type)')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new BookingError(`Failed to fetch draft booking for customer ${customerId}: ${error.message}`, 'BOOKING_DRAFT_FETCH_ERROR', { customerId });
  }

  if (!data || data.length === 0) return null;
  
  const b = data[0];
  if (b.status === 'deposit_pending' || b.status === 'lead') {
    return b;
  }
  
  return null;
}
