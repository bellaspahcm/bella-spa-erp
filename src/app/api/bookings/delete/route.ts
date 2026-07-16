import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Check user is admin
    const user = await getCurrentUser();
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ admin mới có quyền xóa booking' },
        { status: 403 }
      );
    }

    const { bookingId } = await request.json();
    
    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing bookingId' },
        { status: 400 }
      );
    }

    // Get booking to check it's cancelled or deposit_pending
    const supabase = await createDevelopmentBypassClient();
    
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, tenant_id')
      .eq('id', bookingId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found or access denied' },
        { status: 404 }
      );
    }

    // Only allow deleting cancelled or deposit_pending bookings
    if (booking.status !== 'cancelled' && booking.status !== 'deposit_pending') {
      return NextResponse.json(
        { error: 'Chỉ có thể xóa gói đã hủy hoặc chờ đặt cọc' },
        { status: 400 }
      );
    }

    // Delete booking (cascade will handle session_logs, revenue, etc.)
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .eq('tenant_id', user.tenant_id);

    if (deleteError) {
      console.error('Delete booking error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete booking API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
