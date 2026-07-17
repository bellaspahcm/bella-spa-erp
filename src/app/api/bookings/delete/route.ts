import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Check user is admin
    const user = await getCurrentUser();
    if (!user || user.role?.toLowerCase() !== 'admin' || !user.tenant_id) {
      return NextResponse.json(
        { error: 'Chỉ admin thuộc đơn vị kinh doanh mới có quyền xóa booking' },
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

    const isMissingTableError = (err: { message?: string } | null) => {
      return !!err?.message?.includes('Could not find the table') || !!err?.message?.includes('does not exist');
    };

    // Delete referenced records first to avoid foreign key violations
    // 1. Delete session_logs
    const { error: logsError } = await supabase
      .from('session_logs')
      .delete()
      .eq('booking_id', bookingId)
      .eq('tenant_id', user.tenant_id);

    if (logsError && !isMissingTableError(logsError)) {
      console.error('Delete session_logs error:', logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // 2. Set booking_id to null in shifts
    const { error: shiftsError } = await supabase
      .from('shifts')
      .update({ booking_id: null })
      .eq('booking_id', bookingId)
      .eq('tenant_id', user.tenant_id);

    if (shiftsError && !isMissingTableError(shiftsError)) {
      console.error('Update shifts error:', shiftsError);
      return NextResponse.json({ error: shiftsError.message }, { status: 500 });
    }

    // 3. Delete revenue
    const { error: revenueError } = await supabase
      .from('revenue')
      .delete()
      .eq('booking_id', bookingId)
      .eq('tenant_id', user.tenant_id);

    if (revenueError && !isMissingTableError(revenueError)) {
      console.error('Delete revenue error:', revenueError);
      return NextResponse.json({ error: revenueError.message }, { status: 500 });
    }

    // 4. Set booking_id to null in chat_threads
    interface SupabaseBypassClient {
      from: (table: string) => {
        update: (data: Record<string, unknown>) => {
          eq: (col: string, val: unknown) => {
            eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    }
    const { error: chatError } = await (supabase as unknown as SupabaseBypassClient)
      .from('chat_threads')
      .update({ booking_id: null })
      .eq('booking_id', bookingId)
      .eq('tenant_id', user.tenant_id);

    if (chatError && !isMissingTableError(chatError)) {
      console.error('Update chat_threads error:', chatError);
      return NextResponse.json({ error: chatError.message }, { status: 500 });
    }

    // 5. Delete booking (cascade will handle booking_service_items etc. which have ON DELETE CASCADE)
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
