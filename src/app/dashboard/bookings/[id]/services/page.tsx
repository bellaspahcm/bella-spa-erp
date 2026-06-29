/**
 * Booking Service Items Management Page
 * 
 * Allows admin to add/edit/delete service items for a booking.
 * Each service item tracks commission for individual services.
 * 
 * Part of Commission System (Task 10)
 */

import { createClient } from '@/lib/supabase-server';
import { notFound, redirect } from 'next/navigation';
import { ServiceItemsList } from '@/components/bookings/ServiceItemsList';
import { AddServiceItemButton } from '@/components/bookings/AddServiceItemButton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { queryBookingServiceItems } from '@/lib/supabase-commission-queries';

interface BookingServicesPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BookingServicesPage({ params }: BookingServicesPageProps) {
  // Await params (required in Next.js 15+)
  const { id } = await params;
  const supabase = await createClient();
  
  // Get current user and tenant
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, tenants(enabled_modules)')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.tenant_id) {
    return <div>Không tìm thấy thông tin người dùng</div>;
  }

  const tenantId = profile.tenant_id;

  // Parse enabled modules
  const enabledModules = profile.tenants?.enabled_modules as Record<string, boolean> | null;
  const isBeautySpaEnabled = enabledModules?.beauty_spa === true;

  // Only available for beauty_spa module
  if (!isBeautySpaEnabled) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-destructive">
          Tính năng này chỉ khả dụng cho mô-đun Beauty Spa
        </h1>
        <p className="mt-2 text-muted-foreground">
          Vui lòng bật module Beauty Spa trong cài đặt hệ thống.
        </p>
      </div>
    );
  }

  // Load booking data
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id,
      customer_id,
      package_id,
      start_date,
      status,
      customers (
        id,
        name_mother,
        phone
      ),
      packages (
        id,
        name,
        price
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    notFound();
  }

  // Load service items for this booking
  const { data: serviceItems } = await queryBookingServiceItems(supabase, id, tenantId);

  // Manually fetch KTV names if needed
  const ktvIds = (serviceItems || []).filter((item) => item.ktv_id).map((item) => item.ktv_id!);
  const { data: ktvs } = ktvIds.length > 0
    ? await supabase
        .from('users')
        .select('id, full_name')
        .in('id', ktvIds)
    : { data: null };

  // Map KTV names to service items
  const serviceItemsWithKTV = (serviceItems || []).map((item) => ({
    ...item,
    users: ktvs?.find(ktv => ktv.id === item.ktv_id) || null,
  }));

  // Load available packages for service selection
  const { data: packages } = await supabase
    .from('packages')
    .select('id, name, price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name');

  // Load KTV list for dropdown
  const { data: ktvListData } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'ktv')
    .eq('status', 'active')
    .order('full_name');

  // Calculate totals (only count active/completed items, exclude cancelled)
  const activeServiceItems = serviceItemsWithKTV.filter(item => item.status !== 'cancelled');
  const totalSubtotal = activeServiceItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const totalCommission = activeServiceItems.reduce((sum, item) => sum + (item.calculated_commission || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/bookings/${id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại Booking
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Quản lý Dịch vụ</h1>
          <p className="text-muted-foreground">
            Khách hàng: <strong>{booking.customers?.name_mother}</strong> | 
            Gói: <strong>{booking.packages?.name}</strong>
          </p>
        </div>
        <AddServiceItemButton
          bookingId={id}
          tenantId={tenantId}
          packages={packages || []}
          ktvList={ktvListData || []}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Tổng số dịch vụ</div>
          <div className="text-2xl font-bold">{activeServiceItems.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Tổng doanh thu</div>
          <div className="text-2xl font-bold">
            {totalSubtotal.toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">Tổng hoa hồng</div>
          <div className="text-2xl font-bold text-primary">
            {totalCommission.toLocaleString('vi-VN')}đ
          </div>
        </div>
      </div>

      {/* Service Items List */}
      <ServiceItemsList
        serviceItems={serviceItemsWithKTV}
        packages={packages || []}
        bookingId={id}
        tenantId={tenantId}
      />
    </div>
  );
}
