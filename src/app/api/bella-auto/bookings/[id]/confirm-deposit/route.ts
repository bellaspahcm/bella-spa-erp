import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { amount, payment_method, transaction_ref, notes } = await request.json();

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Số tiền cọc phải lớn hơn 0' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get booking
    const { data: booking, error: fetchError } = await supabase
      .from('auto_bookings')
      .select('id, tenant_id, deposit_amount, deposit_paid, status')
      .eq('id', params.id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: 'Booking không tồn tại' },
        { status: 404 }
      );
    }

    // Validate amount
    const newDepositPaid = booking.deposit_paid + amount;
    if (newDepositPaid > booking.deposit_amount) {
      return NextResponse.json(
        { error: `Số tiền cọc vượt quá yêu cầu. Tối đa: ${booking.deposit_amount - booking.deposit_paid} VNĐ` },
        { status: 400 }
      );
    }

    // Calculate new payment status
    let payment_status = 'unpaid';
    if (newDepositPaid >= booking.deposit_amount) {
      payment_status = 'fully_paid';
    } else if (newDepositPaid > 0) {
      payment_status = 'partially_paid';
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('auto_bookings')
      .update({
        deposit_paid: newDepositPaid,
        payment_status: payment_status,
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Update booking error:', updateError);
      throw new Error('Không thể cập nhật booking');
    }

    // Create deposit record
    const { data: deposit, error: depositError } = await supabase
      .from('auto_deposits')
      .insert({
        tenant_id: booking.tenant_id,
        booking_id: params.id,
        amount: amount,
        payment_method: payment_method || 'cash',
        payment_date: new Date().toISOString(),
        transaction_ref: transaction_ref,
        notes: notes,
        status: 'confirmed',
        created_by: user.id,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (depositError) {
      console.error('Create deposit error:', depositError);
      throw new Error('Không thể tạo record cọc');
    }

    return NextResponse.json({
      success: true,
      message: payment_status === 'fully_paid' 
        ? '✅ Đã xác nhận cọc đủ. Booking có thể tiến hành bàn giao xe.'
        : '✅ Đã xác nhận cọc. Khách hàng còn thiếu ' + (booking.deposit_amount - newDepositPaid) + ' VNĐ',
      data: {
        deposit_id: deposit.id,
        new_deposit_paid: newDepositPaid,
        payment_status: payment_status,
        remaining: booking.deposit_amount - newDepositPaid,
      }
    });

  } catch (error: any) {
    console.error('[API] Confirm deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi server' },
      { status: 500 }
    );
  }
}
