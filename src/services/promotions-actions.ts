'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';
import { revalidatePath } from 'next/cache';

/**
 * Lấy tất cả chương trình khuyến mãi thuộc chi nhánh (tenant) của người dùng hiện tại
 */
export async function getPromotions() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    return [];
  }

  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getPromotions] Lỗi lấy danh sách khuyến mãi:', error);
    throw new Error(`Lỗi truy vấn cơ sở dữ liệu: ${error.message}`);
  }

  return data || [];
}

/**
 * Thêm một chương trình khuyến mãi mới
 */
export async function createPromotion(payload: {
  title: string;
  description: string;
  image_url?: string | null;
  discount_code?: string | null;
  discount_percent?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return { success: false, error: 'Không có quyền thực hiện. Vui lòng đăng nhập.' };
  }

  const tenantId = currentUser.tenant_id;
  if (!tenantId) {
    return { success: false, error: 'Không xác định được chi nhánh của người dùng.' };
  }

  if (!payload.title || !payload.description) {
    return { success: false, error: 'Tiêu đề và Mô tả là bắt buộc.' };
  }

  const insertData = {
    title: payload.title,
    description: payload.description,
    image_url: payload.image_url || null,
    discount_code: payload.discount_code || null,
    discount_percent: payload.discount_percent !== undefined ? Number(payload.discount_percent) : null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    tenant_id: tenantId,
  };

  const { data, error } = await supabase
    .from('promotions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[createPromotion] Lỗi thêm khuyến mãi:', error);
    return { success: false, error: error.message };
  }

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'promotions',
    record_id: data.id,
    new_data: insertData,
  });

  revalidatePath('/dashboard/settings');
  return { success: true, data };
}

/**
 * Kích hoạt hoặc hủy kích hoạt một chương trình khuyến mãi
 */
export async function togglePromotionActive(id: string, is_active: boolean) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: 'Không có quyền thực hiện. Vui lòng đăng nhập.' };
  }

  const { data, error } = await supabase
    .from('promotions')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[togglePromotionActive] Lỗi cập nhật trạng thái khuyến mãi:', error);
    return { success: false, error: error.message };
  }

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'promotions',
    record_id: id,
    new_data: { is_active },
  });

  revalidatePath('/dashboard/settings');
  return { success: true, data };
}

/**
 * Xóa một chương trình khuyến mãi
 */
export async function deletePromotion(id: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: 'Không có quyền thực hiện. Vui lòng đăng nhập.' };
  }

  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deletePromotion] Lỗi xóa khuyến mãi:', error);
    return { success: false, error: error.message };
  }

  await recordAuditLog({
    action: 'DELETE',
    table_name: 'promotions',
    record_id: id,
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}
