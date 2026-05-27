'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getCurrentUser } from './user-actions';
import { resolvePackageName } from '@/lib/utils';

/**
 * Truy xuất thông tin booking qua Share Token (Dành cho khách hàng)
 */
export async function getCustomerBookingByToken(token?: string) {
  // When a token is provided, we use the service-role client to bypass RLS.
  // The token itself (64-bit random hex) IS the security boundary — anyone
  // with the token can read the booking, which is the magic-link model.
  // Anon client cannot read public.bookings (RLS policy "Guest xem bookings (Blocked)").
  let supabase: any;
  if (token && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  } else {
    supabase = await createClient();
  }

  let query = supabase
    .from('bookings')
    .select(`
      *,
      customers (
        name_mother,
        phone,
        loyalty_points
      ),
      packages!bookings_package_id_fkey (
        name
      ),
      assigned_ktv:users!bookings_assigned_ktv_id_fkey (
        id,
        full_name,
        phone
      ),
      session_logs (
        *,
        completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey (
          id,
          full_name,
          avatar_url
        )
      ),
      tenants (
        id,
        name,
        qr_bank_code,
        qr_account_number,
        qr_account_name
      ),
      revenue (
        *
      )
    `);

  if (token) {
    query = query.eq('share_token', token);
  } else {
    const user = await getCurrentUser();
    if (!user || user.role !== 'customer') {
      return null;
    }
    query = query.eq('customer_id', user.id);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('Error fetching customer booking:', error);
    return null;
  }

  // Sort sessions by number
  if (data.session_logs) {
    data.session_logs.sort((a: any, b: any) => a.session_number - b.session_number);
  }

  // Resolve package_name correctly using resolvePackageName helper
  data.package_name = resolvePackageName(data);

  return data;
}

/**
 * Khách hàng gửi đánh giá cho một buổi chăm sóc
 */
export async function submitCustomerRating(sessionId: string, rating: number, comment: string = '') {
  // Customer is anonymous (no auth session) — bypass RLS via service role.
  // Security: sessionId is a non-enumerable UUID. Caller must have already
  // obtained it via getCustomerBookingByToken (gated by share_token).
  let supabase: any;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  } else {
    supabase = await createClient();
  }

  // 1. Lấy thông tin session để đồng bộ hóa
  const { data: session } = await supabase
    .from('session_logs')
    .select('completed_by_ktv_id, tenant_id, bookings(customer_id)')
    .eq('id', sessionId)
    .single();

  // 2. Cập nhật rating vào session_log (Legacy support & quick read)
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

  // 3. Tạo/Cập nhật bản ghi review chính thức (Analytics source)
  if (session) {
    // Check if a placeholder review already exists for this session log
    const { data: existingReview } = await supabase
      .from('session_reviews')
      .select('id')
      .eq('session_log_id', sessionId)
      .maybeSingle();

    const reviewPayload = {
      session_log_id: sessionId,
      ktv_id: session.completed_by_ktv_id,
      reviewer_id: session.bookings?.customer_id || null,
      rating: rating,
      note: comment,
      status: 'approved',
      tenant_id: session.tenant_id
    };

    if (existingReview) {
      const { error: reviewError } = await supabase
        .from('session_reviews')
        .update(reviewPayload)
        .eq('id', existingReview.id);
      if (reviewError) {
        console.error('Error updating session review:', reviewError);
      }
    } else {
      const { error: reviewError } = await supabase
        .from('session_reviews')
        .insert([reviewPayload]);
      if (reviewError) {
        console.error('Error inserting session review:', reviewError);
      }
    }
  }

  // 4. Kích hoạt tính toán thưởng cho KTV qua RPC
  const { error: rpcError } = await supabase.rpc('apply_rating_bonus', {
    p_session_id: sessionId
  });

  if (rpcError) {
    console.error('Bonus RPC error:', rpcError);
  }

  await Promise.all([
    safeRevalidatePath('/dashboard'),
    safeRevalidatePath('/ktv/earnings')
  ]);
  
  return { success: true };
}

/**
 * Tích điểm Loyalty khi hoàn thành thanh toán
 * (Hàm này nên được gọi từ finance-actions khi confirm revenue)
 */
export async function addLoyaltyPoints(customerId: string, amount: number) {
  const supabase = await createClient();
  
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

/**
 * Lấy danh sách khách hàng
 */
export async function getCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
  return data;
}

/**
 * Lấy chi tiết khách hàng
 */
export async function getCustomerById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
  return data;
}

/**
 * Tạo mới khách hàng
 */
export async function createCustomer(customerData: any) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (currentUser?.tenant_id) {
    const { checkSubscriptionLimit } = await import('@/lib/subscription');
    const customerLimit = await checkSubscriptionLimit(currentUser.tenant_id, 'customer');
    if (customerLimit.isBlocked) {
      return { data: null, error: 'Vượt quá giới hạn khách hàng của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.', warning: null };
    }
    customerData.tenant_id = currentUser.tenant_id;
  }

  const { data, error } = await supabase
    .from('customers')
    .insert([customerData])
    .select();
  
  if (error) {
    console.error('Error creating customer:', error);
    return { data: null, error: error.message, warning: null };
  }
  
  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'customers',
        record_id: data[0].id,
        new_data: data[0]
      });
    } catch (auditErr) {
      console.warn('Failed to record createCustomer audit log:', auditErr);
    }
  }

  await safeRevalidatePath('/dashboard/customers');
  return { data: data?.[0] || null, error: null, warning: null };
}

/**
 * Cập nhật khách hàng
 */
export async function updateCustomer(id: string, customerData: any) {
  const supabase = await createClient();
  
  // Fetch existing customer before update for audit trail
  let oldCustomer = null;
  try {
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    oldCustomer = existing;
  } catch (err) {
    console.warn('Failed to fetch old customer for audit trail:', err);
  }

  const { data, error } = await supabase
    .from('customers')
    .update(customerData)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating customer:', error);
    return { data: null, error: error.message, warning: null };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'customers',
        record_id: id,
        old_data: oldCustomer,
        new_data: customerData
      });
    } catch (auditErr) {
      console.warn('Failed to record updateCustomer audit log:', auditErr);
    }
  }
  
  await Promise.all([
    safeRevalidatePath('/dashboard/customers'),
    safeRevalidatePath(`/dashboard/customers/${id}`)
  ]);
  return { data: data?.[0] || null, error: null, warning: null };
}

/**
 * Xóa khách hàng
 */
export async function deleteCustomer(id: string) {
  const supabase = await createClient();

  // Fetch existing customer before delete for audit trail
  let oldCustomer = null;
  try {
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    oldCustomer = existing;
  } catch (err) {
    console.warn('Failed to fetch old customer for delete audit trail:', err);
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting customer:', error);
    return { error: error.message };
  }

  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'DELETE',
      table_name: 'customers',
      record_id: id,
      old_data: oldCustomer
    });
  } catch (auditErr) {
    console.warn('Failed to record deleteCustomer audit log:', auditErr);
  }
  
  await safeRevalidatePath('/dashboard/customers');
  return { success: true, error: null };
}

/**
 * Alias cho submitCustomerRating để tương thích với các component cũ
 */
export const submitSessionRating = submitCustomerRating;
export const getCustomerPortalData = getCustomerBookingByToken;
