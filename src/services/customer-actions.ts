'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

/**
 * Truy xuất thông tin booking qua Share Token (Dành cho khách hàng)
 */
export async function getCustomerBookingByToken(token: string) {
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      customers (
        name_mother,
        phone,
        loyalty_points
      ),
      session_logs (*)
    `)
    .eq('share_token', token)
    .single();

  if (error || !data) {
    console.error('Error fetching customer booking:', error);
    return null;
  }

  // Sort sessions by number
  if (data.session_logs) {
    data.session_logs.sort((a: any, b: any) => a.session_number - b.session_number);
  }

  return data;
}

/**
 * Khách hàng gửi đánh giá cho một buổi trị liệu
 */
export async function submitCustomerRating(sessionId: string, rating: number, comment: string = '') {
  const supabase = (await createClient()) as any;

  // 1. Cập nhật rating vào session_log
  const { error: updateError } = await supabase
    .from('session_logs')
    .update({
      rating: rating,
      rating_comment: comment
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('Rating update error:', updateError);
    throw new Error('Không thể gửi đánh giá');
  }

  // 2. Kích hoạt tính toán thưởng cho KTV qua RPC
  const { error: rpcError } = await supabase.rpc('apply_rating_bonus', {
    p_session_id: sessionId
  });

  if (rpcError) {
    console.error('Bonus RPC error:', rpcError);
    // Vẫn cho qua vì rating đã lưu, nhưng log lỗi bonus
  }

  return { success: true };
}

/**
 * Tích điểm Loyalty khi hoàn thành thanh toán
 * (Hàm này nên được gọi từ finance-actions khi confirm revenue)
 */
export async function addLoyaltyPoints(customerId: string, amount: number) {
  const supabase = (await createClient()) as any;
  
  // Logic: 100k = 1 điểm
  const pointsToAdd = Math.floor(amount / 100000);
  
  if (pointsToAdd > 0) {
    const { error } = await supabase.rpc('increment_loyalty_points', {
      p_customer_id: customerId,
      p_points: pointsToAdd
    });
    
    if (error) console.error('Error adding loyalty points:', error);
  }
}
