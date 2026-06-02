'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message.trim() ? error.message : fallback;
  if (typeof error === 'string') return error.trim() ? error : fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

// Helper to create the Supabase client using the service role key to bypass RLS for portal guests
function getServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Hệ thống thiếu cấu hình bảo mật SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Helper to validate the share token and retrieve the associated customer_id and tenant_id
async function validateToken(token: string) {
  if (!token) {
    throw new Error('Mã liên kết (token) không được để trống.');
  }
  
  const supabase = getServiceRoleClient();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('customer_id, tenant_id')
    .eq('share_token', token)
    .maybeSingle();

  if (error) {
    console.error('[validateToken] Lỗi truy vấn database:', error);
    throw new Error(`Lỗi kết nối cơ sở dữ liệu khi xác thực token: ${error.message}`);
  }
  if (!booking || !booking.customer_id || !booking.tenant_id) {
    throw new Error('Liên kết không hợp lệ hoặc đã hết hạn.');
  }

  return {
    customerId: booking.customer_id,
    tenantId: booking.tenant_id,
  };
}

/**
 * Lấy danh sách tin nhắn của khách hàng từ Portal dựa vào Share Token
 */
export async function getPortalChatMessages(token: string) {
  try {
    const { customerId } = await validateToken(token);
    const supabase = getServiceRoleClient();

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getPortalChatMessages] Lỗi lấy tin nhắn:', error);
      throw error; // Re-throw to propagate or handle in client (Zero Silent Database Failures)
    }

    return {
      success: true,
      data: messages || []
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'Lỗi không xác định khi tải tin nhắn.')
    };
  }
}

/**
 * Gửi tin nhắn từ phía khách hàng trên Portal dựa vào Share Token
 */
export async function sendPortalChatMessage(token: string, message: string) {
  try {
    if (!message || message.trim() === '') {
      throw new Error('Nội dung tin nhắn không được để trống.');
    }

    const { customerId, tenantId } = await validateToken(token);
    const supabase = getServiceRoleClient();

    const insertPayload: Database['public']['Tables']['chat_messages']['Insert'] = {
      customer_id: customerId,
      tenant_id: tenantId,
      message: message.trim(),
      sender_type: 'customer',
      sender_id: null,
      is_read: false
    };

    const { data: sentMessage, error } = await supabase
      .from('chat_messages')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[sendPortalChatMessage] Lỗi gửi tin nhắn:', error);
      throw error; // Propagate error (Zero Silent Database Failures)
    }

    return {
      success: true,
      data: sentMessage
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'Lỗi không xác định khi gửi tin nhắn.')
    };
  }
}

/**
 * Đánh dấu tất cả tin nhắn từ Spa (staff) gửi cho khách hàng này là đã đọc
 */
export async function markPortalMessagesAsRead(token: string) {
  try {
    const { customerId, tenantId } = await validateToken(token);
    const supabase = getServiceRoleClient();

    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('sender_type', 'staff')
      .eq('is_read', false);

    if (error) {
      console.error('[markPortalMessagesAsRead] Lỗi đánh dấu đã đọc:', error);
      throw error; // Propagate error (Zero Silent Database Failures)
    }

    return {
      success: true
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err, 'Lỗi không thể cập nhật trạng thái đã đọc.')
    };
  }
}
